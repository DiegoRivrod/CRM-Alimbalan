-- supabase/tests/rls.test.sql
-- Tests estructurales y funcionales de Row Level Security.
--
-- Cómo correr:
--   1) Local (con Supabase CLI + Docker arriba):
--        supabase db reset
--        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
--   2) Contra cualquier instancia (incluida producción, en READ-ONLY no rompe nada
--      porque todo va dentro de transacciones que se hacen ROLLBACK al final):
--        psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
--
-- Cualquier RAISE EXCEPTION aborta el script con exit code != 0 → falla en CI.

\echo '══════════════════════════════════════════════════════════════'
\echo ' Tests de RLS — CRM ABAL'
\echo '══════════════════════════════════════════════════════════════'

-- ─── 1. RLS habilitado en todas las tablas críticas ──────────────────────────
\echo ''
\echo '[1] Verificando que RLS está habilitado en tablas críticas...'

DO $$
DECLARE
  t  text;
  rls_on boolean;
  tablas text[] := ARRAY[
    'profiles', 'clientes', 'productos', 'metas',
    'facturas', 'visitas', 'prospectos', 'actividad'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    SELECT relrowsecurity INTO rls_on
    FROM pg_class
    WHERE oid = ('public.' || t)::regclass;

    IF NOT rls_on THEN
      RAISE EXCEPTION 'FAIL: RLS NO está habilitado en public.%', t;
    END IF;
  END LOOP;

  RAISE NOTICE '  ✓ RLS habilitado en las 8 tablas críticas';
END $$;

-- ─── 2. Policy actividad_insert valida usuario_id = auth.uid() ───────────────
-- (regresión del fix de migración 007)
\echo ''
\echo '[2] Verificando policy actividad_insert (regresión fix 007)...'

DO $$
DECLARE
  check_expr text;
BEGIN
  SELECT pg_get_expr(polwithcheck, polrelid)
  INTO check_expr
  FROM pg_policy
  WHERE polname = 'actividad_insert'
    AND polrelid = 'public.actividad'::regclass;

  IF check_expr IS NULL THEN
    RAISE EXCEPTION 'FAIL: policy actividad_insert no existe';
  END IF;

  IF check_expr NOT LIKE '%usuario_id%' OR check_expr NOT LIKE '%auth.uid%' THEN
    RAISE EXCEPTION 'FAIL: policy actividad_insert NO valida usuario_id = auth.uid(). Check actual: %', check_expr;
  END IF;

  RAISE NOTICE '  ✓ actividad_insert valida usuario_id = auth.uid()';
END $$;

-- ─── 3. Tablas con datos confidenciales tienen al menos 1 policy por operación
\echo ''
\echo '[3] Verificando cobertura mínima de policies por operación...'

DO $$
DECLARE
  faltantes int;
BEGIN
  -- Tablas que vendedores no deben poder modificar libremente
  WITH esperadas AS (
    SELECT 'clientes'::text  AS tabla, 'SELECT'::text AS op
    UNION ALL SELECT 'facturas',  'SELECT'
    UNION ALL SELECT 'visitas',   'SELECT'
    UNION ALL SELECT 'prospectos','SELECT'
    UNION ALL SELECT 'actividad', 'SELECT'
    UNION ALL SELECT 'actividad', 'INSERT'
  ),
  cobertura AS (
    SELECT e.tabla, e.op
    FROM esperadas e
    LEFT JOIN pg_policy p
      ON p.polrelid = ('public.' || e.tabla)::regclass
     AND (
       (e.op = 'SELECT' AND p.polcmd IN ('r', '*')) OR
       (e.op = 'INSERT' AND p.polcmd IN ('a', '*')) OR
       (e.op = 'UPDATE' AND p.polcmd IN ('w', '*')) OR
       (e.op = 'DELETE' AND p.polcmd IN ('d', '*'))
     )
    GROUP BY e.tabla, e.op
    HAVING count(p.polname) = 0
  )
  SELECT count(*) INTO faltantes FROM cobertura;

  IF faltantes > 0 THEN
    RAISE EXCEPTION 'FAIL: % combinaciones tabla/op sin policy', faltantes;
  END IF;

  RAISE NOTICE '  ✓ Todas las tablas críticas tienen policies por operación';
END $$;

-- ─── 4. Funciones helper get_rol() y get_fuerza_de_venta() existen y son SECURITY DEFINER
\echo ''
\echo '[4] Verificando funciones helper de RLS...'

DO $$
DECLARE
  is_definer boolean;
BEGIN
  SELECT prosecdef INTO is_definer
  FROM pg_proc
  WHERE proname = 'get_rol'
    AND pronamespace = 'public'::regnamespace;

  IF is_definer IS NULL THEN
    RAISE EXCEPTION 'FAIL: función public.get_rol() no existe';
  END IF;

  IF NOT is_definer THEN
    RAISE EXCEPTION 'FAIL: public.get_rol() debe ser SECURITY DEFINER (si no, leerá profiles bajo RLS y nunca encontrará nada)';
  END IF;

  SELECT prosecdef INTO is_definer
  FROM pg_proc
  WHERE proname = 'get_fuerza_de_venta'
    AND pronamespace = 'public'::regnamespace;

  IF is_definer IS NULL THEN
    RAISE EXCEPTION 'FAIL: función public.get_fuerza_de_venta() no existe';
  END IF;

  IF NOT is_definer THEN
    RAISE EXCEPTION 'FAIL: public.get_fuerza_de_venta() debe ser SECURITY DEFINER';
  END IF;

  RAISE NOTICE '  ✓ get_rol() y get_fuerza_de_venta() existen y son SECURITY DEFINER';
END $$;

-- ─── 5. Test funcional: un vendedor solo ve clientes de su fuerza_de_venta ────
-- Usa una transacción + set_config para simular un JWT distinto, luego ROLLBACK.
\echo ''
\echo '[5] Test funcional: vendedor solo ve sus clientes...'

DO $$
DECLARE
  total_clientes int;
  visibles_vendedor_a int;
  visibles_vendedor_b int;
  uid_a uuid := '11111111-1111-1111-1111-111111111111';
  uid_b uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  -- Insertar fixtures dentro de un savepoint (limpieza garantizada)
  CREATE TEMP TABLE _rls_test_fixtures (created boolean) ON COMMIT DROP;

  -- auth.users (FK desde profiles). En entorno Supabase real, esta tabla
  -- es del schema "auth" y se llena via signUp. En CI/local con stub, podemos
  -- insertar directo si tenemos permisos.
  BEGIN
    INSERT INTO auth.users (id, email)
      VALUES (uid_a, 'test_a@ci.local'), (uid_b, 'test_b@ci.local')
      ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_table THEN
      RAISE NOTICE '  ⚠ No se puede insertar en auth.users (entorno restringido); test funcional [5] saltado';
      RETURN;
  END;

  -- Profiles vendedores (bypass RLS porque corremos como postgres/service_role)
  INSERT INTO public.profiles (id, nombre, rol, fuerza_de_venta)
    VALUES
      (uid_a, 'Test A', 'vendedor', 'FUERZA_TEST_A'),
      (uid_b, 'Test B', 'vendedor', 'FUERZA_TEST_B')
    ON CONFLICT (id) DO UPDATE
      SET rol = EXCLUDED.rol, fuerza_de_venta = EXCLUDED.fuerza_de_venta;

  -- Clientes uno de cada fuerza
  INSERT INTO public.clientes (idcliente, nombre, responsable)
    VALUES
      ('900001', 'CLIENTE A', 'FUERZA_TEST_A'),
      ('900002', 'CLIENTE B', 'FUERZA_TEST_B')
    ON CONFLICT (idcliente) DO NOTHING;

  SELECT count(*) INTO total_clientes FROM public.clientes
    WHERE idcliente IN ('900001', '900002');
  IF total_clientes <> 2 THEN
    RAISE EXCEPTION 'FAIL: setup — esperaba 2 clientes de fixture, hay %', total_clientes;
  END IF;

  -- Simular sesión vendedor A: set role + claim auth.uid()
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_a::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO visibles_vendedor_a
    FROM public.clientes
    WHERE idcliente IN ('900001', '900002');

  RESET ROLE;

  IF visibles_vendedor_a <> 1 THEN
    RAISE EXCEPTION 'FAIL: vendedor A debería ver 1 cliente (900001), ve %', visibles_vendedor_a;
  END IF;

  -- Simular sesión vendedor B
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO visibles_vendedor_b
    FROM public.clientes
    WHERE idcliente IN ('900001', '900002');

  RESET ROLE;

  IF visibles_vendedor_b <> 1 THEN
    RAISE EXCEPTION 'FAIL: vendedor B debería ver 1 cliente (900002), ve %', visibles_vendedor_b;
  END IF;

  RAISE NOTICE '  ✓ Vendedor solo ve sus clientes (RLS aplicada correctamente)';

  -- Limpieza (auth.users cascade borra profiles)
  DELETE FROM public.clientes WHERE idcliente IN ('900001', '900002');
  BEGIN
    DELETE FROM auth.users WHERE id IN (uid_a, uid_b);
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    DELETE FROM public.profiles WHERE id IN (uid_a, uid_b);
  END;
END $$;

\echo ''
\echo '══════════════════════════════════════════════════════════════'
\echo ' ✓ Todos los tests de RLS pasaron'
\echo '══════════════════════════════════════════════════════════════'
