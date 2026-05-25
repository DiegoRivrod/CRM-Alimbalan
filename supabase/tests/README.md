# Tests de base de datos

Estos tests validan la capa de Postgres (RLS, policies, schema).
No corren con vitest porque vitest vive en el navegador/jsdom.

## Tests disponibles

| Archivo | Cubre |
|---------|-------|
| `rls.test.sql` | RLS habilitado en tablas críticas, regresión del fix `actividad_insert`, vendedor solo ve sus clientes |

## Cómo correrlos

### Local (Supabase CLI + Docker)

```bash
supabase db reset                              # aplica todas las migraciones limpias
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
```

### Contra cualquier instancia remota (incluida prod, es read-only)

```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.hbxfohohfuzzihjhzhcy.supabase.co:5432/postgres"
npm run test:rls
```

> Los DO blocks crean fixtures temporales (clientes/profiles con IDs 900001/900002 y UUIDs
> `1111…`/`2222…`) y los borran al final. Si el script falla a mitad, esos registros
> pueden quedar — bórralos manualmente antes de re-correr.

### En CI

Agregar al workflow `.github/workflows/ci.yml`:

```yaml
- name: Test RLS
  run: |
    sudo apt-get install -y postgresql-client
    psql "${{ secrets.SUPABASE_DB_URL_STAGING }}" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
```

Usa una **instancia de staging**, no prod (los DO blocks insertan/borran filas).
