# CRM Comercial (ALIMENTOS BALANCEADOS DEL PERU S.A.C.)

## Fuente de verdad del proyecto

Antes de cambiar lógica de negocio, schema o flujos: lee **[PROGRESO_CRM.md](./PROGRESO_CRM.md)** (no pegues hilos largos de otros chats; el estado vive en ese archivo).

| Tema | Sección en PROGRESO_CRM.md |
|------|----------------------------|
| Fases, pendientes (F7…), stack | Estado de Fases, Infraestructura |
| Rutas de código y carpetas | Arquitectura del Código |
| Joins, PKs, prospectos | Schema de Base de Datos |
| RLS y roles | Roles y RLS |
| Import Excel / reglas ETL | Lógica ETL |
| Reglas duras (facturas inmutables, npm 403) | Reglas Críticas |

## Punto de entrada de la app

- Rutas y layout: [`src/App.tsx`](src/App.tsx)
- Auth: [`src/lib/auth.tsx`](src/lib/auth.tsx), guard [`src/components/layout/ProtectedRoute.tsx`](src/components/layout/ProtectedRoute.tsx)
- Cliente Supabase: [`src/lib/supabase.ts`](src/lib/supabase.ts)

## Base de datos

- Migraciones: [`supabase/migrations/`](supabase/migrations/)
- Tipos TS manuales (sin codegen): [`src/types/supabase.ts`](src/types/supabase.ts) — patrón `as` / `as never` en hooks

## Desarrollo

```bash
npm run dev   # http://localhost:5178 (ver vite.config.ts)
```
