# CRM Comercial — ABAL S.A.C.

CRM B2B para **ALIMENTOS BALANCEADOS DEL PERU S.A.C.** Maneja clientes, vendedores,
prospectos, facturas, visitas, KPIs y el programa de fidelización **ABAL+** (puntos + tiers).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + Radix |
| Routing | React Router 7 |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + RLS) |
| Tests | Vitest + Testing Library (jsdom) |
| Deploy | Vercel |

## Estado y fuente de verdad

El estado del proyecto, fases y arquitectura viven en **[PROGRESO_CRM.md](./PROGRESO_CRM.md)**.
Antes de cambiar lógica de negocio, schema o flujos, léelo.

Convenciones del repo en **[CLAUDE.md](./CLAUDE.md)**.

## Setup local

```bash
npm install                       # con error 403 → ver "Reglas críticas" abajo
cp .env.example .env.local        # rellenar con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev                       # http://localhost:5178
```

## Scripts

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor Vite en `http://localhost:5178` |
| `npm run build` | TypeScript + build de producción |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm test` | Tests Vitest (ETL, ABAL+, utils) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:rls` | Tests SQL de RLS (necesita `SUPABASE_DB_URL`) |

## Estructura

```
src/
├── components/   # layout (AppLayout, Sidebar, ProtectedRoute) + reutilizables
├── hooks/        # 1 hook por dominio (useClientes, useProspectos, useAbalPlus, …)
├── lib/          # supabase, etl, abalPlus, googleSheets, utils
├── pages/        # 1 carpeta por módulo (clientes, prospectos, vendedores, …)
├── types/        # supabase.ts — tipos manuales (sin codegen)
└── test/setup.ts # bootstrap de @testing-library/jest-dom

supabase/
├── migrations/   # SQL versionado (001…007)
├── functions/    # Edge Functions Deno (calcular-puntos, sync-maestros, …)
└── tests/        # rls.test.sql + README de cómo correrlo
```

## Roles y RLS

| Rol | Acceso |
|-----|--------|
| `gerente` | SELECT en todo |
| `supervisor` | SELECT en todo + UPDATE en prospectos |
| `vendedor` | SELECT solo donde `fuerza_de_venta = su propio valor` |

El campo `fuerza_de_venta` en `profiles` se usa como discriminador RLS.

## Reglas críticas

- **Facturas son inmutables.** Nunca `DELETE` en `public.facturas` — son datos
  financieros. Re-importar = UPSERT con constraint `facturas_linea_unica (idserie, numero, idarticulo)`.
- **`npm install` con error 403:**
  ```bash
  npm install --strict-ssl false --registry https://registry.npmmirror.com
  ```
- **No incluir "Co-Authored-By: Claude"** en commits.

## Deploy

```bash
vercel --prod
```

Las migraciones de Supabase se aplican manualmente vía Dashboard → SQL Editor
o `supabase db push` (CLI). Ver [supabase/tests/README.md](./supabase/tests/README.md)
para tests de DB.
