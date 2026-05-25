# E2E Smoke Tests

Smoke tests con Playwright que corren contra una URL de Vercel deployada.

## Correr localmente

```bash
# 1. Instalar Playwright (solo primera vez)
npm install
npx playwright install --with-deps chromium

# 2. Apuntar a dev local o a prod
$env:BASE_URL = "http://localhost:5178"  # dev
# o
$env:BASE_URL = "https://crm-abal.vercel.app"  # prod

# 3. Credenciales del usuario e2e (rol gerente en Supabase)
$env:SUPABASE_E2E_USER_EMAIL = "e2e@abal.test"
$env:SUPABASE_E2E_USER_PASSWORD = "<password>"

# 4. Correr
npm run test:e2e -- --grep @smoke
```

## Crear el usuario `e2e@abal.test` en Supabase

1. Dashboard → Authentication → Users → Add user (email + password)
2. SQL Editor:
   ```sql
   insert into public.perfiles (id, email, rol)
   values ('<UUID-del-usuario>', 'e2e@abal.test', 'gerente');
   ```
3. Guardar las credenciales como secrets de GitHub:
   - `SUPABASE_E2E_USER_EMAIL`
   - `SUPABASE_E2E_USER_PASSWORD`

## Anti-patrón

**NO** usar `SUPABASE_SERVICE_ROLE_KEY` en estos tests. El objetivo es validar
que la cadena `usuario → auth → RLS → datos` funciona en producción. Usar la
service-role key bypassaría RLS y daría falsos positivos.
