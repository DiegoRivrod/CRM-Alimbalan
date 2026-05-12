# CRM Comercial — Progreso del Proyecto

**Empresa:** ALIMENTOS BALANCEADOS DEL PERU S.A.C.  
**Última actualización:** 2026-05-12  
**Stack:** React 19 + TypeScript + Tailwind CSS + shadcn/ui → Vite → Vercel  
**Backend:** Supabase (PostgreSQL + Auth + Edge Functions)

---

## Estado de Fases

| Fase | Módulo | Estado |
|------|--------|--------|
| F1 | Setup + Schema + Auth + RLS + Routing | ✅ Completo |
| F2 | ETL + ImportarPage + Edge Functions | ✅ Completo |
| F3 | Módulo Clientes (lista + detalle) | ✅ Completo |
| F4 | Módulo Vendedores (performance + metas) | ✅ Completo |
| F5 | Módulo Prospectos (lista + detalle + match) | ✅ Completo |
| F6 | KPIs automáticos | ✅ Completo |
| F7 | Actividad y call center | ✅ Completo |
| F8 | Auto-conversión prospecto al importar facturas | ✅ Completo |
| F9 | Semáforo de salud del cliente (inactividad) | ✅ Completo |
| F10 | Dashboard con gráficas de tendencia | ✅ Completo |
| F11 | Historial de importaciones | ✅ Completo |
| F12 | Exportación a Excel de reportes | ✅ Completo |
| F13 | Búsqueda global (clientes + prospectos) | ✅ Completo |
| F14 | Filtros avanzados en Prospectos | ✅ Completo |
| F15 | Sync automático de maestros (cron diario) | ✅ Completo |

---

## Infraestructura

### Supabase
- **Proyecto ID:** `hbxfohohfuzzihjhzhcy` *(solo entorno interno / operación; no compartir repo públicamente sin revisar)*
- **URL:** `https://hbxfohohfuzzihjhzhcy.supabase.co`
- **Dev server:** `npm run dev` → http://localhost:5178 (puerto fijado en [`vite.config.ts`](vite.config.ts) `server.port`)

### Google Sheets (fuentes de datos maestros — CSV público)
| Hoja | Sheet ID |
|------|----------|
| Clientes | `179agEPXpVq0V4qHqmyGWzhtBRbJO-ZEh4WlQi0el6s0` |
| Productos | `1r3Tow469UzhczgI3VQi3AkJjTAZoGefFZ8Mc3mf5x4I` |
| Metas (Pelletizado) | `1x81BG7b2Ap-gvYDFwQTY7_zjBCtaa5STGsTDWJYM_sg` |

---

## Arquitectura del Código

```
crm/
├── src/
│   ├── components/
│   │   └── layout/
│   │       ├── AppLayout.tsx      # Layout principal con Sidebar
│   │       ├── Sidebar.tsx        # Navegación lateral con roles
│   │       └── ProtectedRoute.tsx # Guard de autenticación y roles
│   ├── lib/
│   │   ├── supabase.ts           # Cliente Supabase (createClient)
│   │   ├── auth.tsx              # AuthProvider + useAuth hook
│   │   ├── etl.ts                # Lógica ETL browser-side (xlsx)
│   │   ├── googleSheets.ts       # Sync maestros desde Google Sheets
│   │   └── utils.ts              # Utilidades generales
│   ├── types/
│   │   └── supabase.ts           # Tipos TypeScript manuales de tablas
│   ├── hooks/
│   │   ├── useClientes.ts        # useClientes(), useClienteDetalle()
│   │   ├── useVendedores.ts      # useVendedores(), useVendedorDetalle()
│   │   ├── useProspectos.ts      # useProspectos(), useProspectoDetalle()
│   │   └── useKpis.ts            # useKpisExtras() — inactivos, prospectos, comparativa semanal
│   │                             # + aprobarMatch, rechazarMatch, cambiarEstado
│   │                             # + buscarClientesSimilares (trigramas JS)
│   └── pages/
│       ├── auth/
│       │   └── LoginPage.tsx
│       ├── clientes/
│       │   ├── ClientesPage.tsx       # Tabla + filtros + paginación
│       │   └── ClienteDetallePage.tsx # Timeline facturas + visitas
│       ├── vendedores/
│       │   ├── VendedoresPage.tsx     # Tabla comparativa con barra de meta %
│       │   └── VendedorDetallePage.tsx # KPIs + semanas + top clientes + líneas
│       ├── prospectos/
│       │   ├── ProspectosPage.tsx     # Tabs por estado + filtros
│       │   └── ProspectoDetallePage.tsx # Datos visita + match + cambio estado
│       ├── importar/
│       │   └── ImportarPage.tsx       # ETL 3 pasos: maestros, facturas, visitas
│       ├── kpis/
│       │   └── KpisPage.tsx           # KPIs: meta, inactivos, prospectos, semanas
│       ├── DashboardPage.tsx          # Stub
│       └── VisitasPage.tsx            # Stub
├── supabase/
│   ├── migrations/
│   │   └── 001_schema_inicial.sql   # Schema completo PostgreSQL
│   └── functions/
│       ├── sync-maestros/           # Edge Function: sync Google Sheets → Supabase
│       └── sync-visitas/            # Edge Function: normalizar visitas Forms → visitas table
└── PROGRESO_CRM.md                  # Este archivo
```

---

## Schema de Base de Datos

### Orden de dependencia
```
profiles → clientes → productos → metas → facturas → visitas → prospectos → actividad
```

### Campos clave para joins
| Campo | Une |
|-------|-----|
| `idcliente` (padStart 6) | clientes ↔ facturas ↔ visitas |
| `idarticulo` | facturas ↔ productos |
| `cod` / `cod_meta` | clientes / facturas ↔ metas |
| `docventa` = `idserie + '-' + numero` | clave única de factura |
| `fuerza_de_venta` | campo RLS para filtrar por vendedor |

### Tabla `prospectos` (clave para F5)
```sql
id                      uuid PK
visita_id               uuid → visitas.id
nombre                  text NOT NULL
contacto                text
fuerza_de_venta         text NOT NULL
zona                    text
especie                 text
potencial_tn            numeric
marcas_consume          text
estado                  text CHECK ('nuevo','seguimiento','convertido','perdido')
idcliente_sugerido      text → clientes.idcliente  -- match sugerido
match_confianza         numeric (0-1)              -- % de similitud
match_aprobado          boolean DEFAULT false
match_aprobado_por      uuid → profiles.id
match_aprobado_at       timestamptz
primera_factura_docventa text
fecha_conversion        date
```

---

## Roles y RLS

| Rol | Acceso |
|-----|--------|
| `gerente` | SELECT en todo, sin restricción |
| `supervisor` | SELECT en todo + UPDATE en prospectos (aprobación match) |
| `vendedor` | SELECT solo donde `fuerza_de_venta = su propio valor` |

El campo RLS es `fuerza_de_venta`. Viene de `profiles.fuerza_de_venta`.  
En clientes: campo `responsable` = `fuerza_de_venta` del vendedor.

---

## Lógica ETL (browser-side, `src/lib/etl.ts`)

### Facturas (`ImportarPage.tsx` → `etl.ts`)
1. Join facturas + productos on `IDARTICULO`
2. Join resultado + clientes on `IDCLIENTE`
3. Join resultado + metas on `COD`
4. Calcular `SEMANA`: días 1-8=S1, 9-15=S2, 16-22=S3, 23-30=S4
5. Reasignar `FUERZA_DE_VENTA` por reglas de negocio
6. Filtrar: eliminar 'CLIENTE VARIOS', `VALORTOTAL=0`
7. Upsert con constraint `facturas_linea_unica (idserie, numero, idarticulo)`

### Reglas de reasignación FUERZA_DE_VENTA
- Truchas + Puno → VENDEDOR ZONA PUNO
- VITAMAXPRO/INVITA + Puno → ASESORA COMERCIAL 2
- VITAMAXPRO/INVITA + Apurimac/Junin → ASESORA COMERCIAL 2
- VITAMAXPRO AQUA + VENDEDOR COBERTURA AREQUIPA → ASESORA COMERCIAL 1
- ASESORA COMERCIAL 1 + VITAMAXPRO AQUA → cod_meta = ASESORA COMERCIAL 1-ArequipaExtrusion
- LLAMOCCA HANCCO MAGDALENA + ARENAS → VENDEDOR TÉCNICO AREQUIPA

### Omisiones esperadas ETL (~43% de filas)
| Razón | Descripción |
|-------|-------------|
| Nombre "CLIENTE VARIOS" | Ventas genéricas sin cliente |
| VALORTOTAL = 0 | Anticipos, fletes, administrativo |
| IDARTICULO sin match | Productos fuera del catálogo |
| Duplicado por clave natural | Ya importado |

**Referencia real (ABRIL_2026):** 2,017 procesadas / 1,570 omitidas ✅

### Visitas (Google Forms)
- El form captura hasta 4 visitas por fila (prefijos 001, 002, 003, 004)
- La normalización transforma a 1 fila por visita
- Si `es_cliente_nuevo=true` → crear registro en `prospectos`

---

## Módulo Prospectos — F5 (implementado 2026-05-12)

### Archivos creados
| Archivo | Descripción |
|---------|-------------|
| `src/hooks/useProspectos.ts` | Hook completo: lista, detalle, acciones |
| `src/pages/prospectos/ProspectosPage.tsx` | Lista con tabs por estado + filtros |
| `src/pages/prospectos/ProspectoDetallePage.tsx` | Detalle + match + cambio estado |

### Flujo de trabajo del supervisor
1. Visita con `es_cliente_nuevo=true` → se crea prospecto en estado `nuevo`
2. Supervisor abre el prospecto → ve sugerencias automáticas de clientes similares
3. Supervisor selecciona el mejor match y hace clic en **Aprobar match**
4. El prospecto pasa a estado `seguimiento`
5. Cuando se detecta la primera factura → estado `convertido` (F6/F7)

### Algoritmo de similitud (trigramas JS)
- Normaliza: minúsculas, sin acentos, sin "SAC/EIRL/SRL"
- Calcula trigramas de 3 caracteres de cada string
- Similitud = 2 × intersección / (|A| + |B|)
- Umbral mínimo: 20% — muestra top 5 resultados
- **Por qué JS y no SQL RPC:** 1,450 clientes = ~50KB, computación instantánea,  
  evita crear una función RPC extra en Supabase para esta fase

### Patrón de tipos TypeScript
El cliente Supabase en este proyecto no tiene tipos generados automáticamente.
**Patrón correcto:** castear siempre los resultados de queries:
```typescript
const { data: raw } = await supabase.from('tabla').select('...')
const rows = (raw ?? []) as Array<MiTipo>
// Para .update() con campos check constraint:
.update({ campo: valor } as never)
```
Este patrón está en `useClientes.ts`, `useVendedores.ts`, `useProspectos.ts`.

---

## ⚠️ Reglas Críticas

### Facturas: INMUTABLES
```
NUNCA DELETE en tabla facturas. Son datos financieros históricos.
Re-importar = UPSERT con constraint facturas_linea_unica (idserie, numero, idarticulo)
```

### npm con error 403
```bash
npm install --strict-ssl false --registry https://registry.npmmirror.com
```

---

## F6 — KPIs automáticos (implementado)

Dashboard en [`src/pages/kpis/KpisPage.tsx`](src/pages/kpis/KpisPage.tsx): cumplimiento por fuerza de venta (reusa datos de `useVendedores`), clientes inactivos vía vista `clientes_ultima_factura`, conteo de prospectos abiertos (`nuevo` + `seguimiento`), y ventas por `SEMANA 1…4` con comparativa semana actual vs anterior cuando el mes/año seleccionado coincide con el mes calendario actual.

---

## F7 — Actividad y call center (implementado 2026-05-12)

### Archivos creados
| Archivo | Descripción |
|---------|-------------|
| `src/hooks/useActividad.ts` | `useActividadProspecto`, `useActividadCliente`, `useActividadGlobal` + `insertarActividad` |
| `src/components/actividad/ActividadTimeline.tsx` | Componente reutilizable: formulario + timeline visual por tipo |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/pages/prospectos/ProspectoDetallePage.tsx` | `<ActividadTimeline prospecto_id={id} />` al final |
| `src/pages/clientes/ClienteDetallePage.tsx` | `<ActividadTimeline idcliente={id} />` al final |
| `src/pages/VisitasPage.tsx` | Convertido en Call Center: prospectos en seguimiento + feed global |
| `src/pages/DashboardPage.tsx` | 4 KPI cards con datos reales desde Supabase |
| `src/components/layout/Sidebar.tsx` | Label "Visitas" → "Actividad", icono `Activity` |

### Lógica de resolución de autores
`ActividadConAutor = Actividad & { autor_nombre: string }`. El hook hace batch-fetch de `profiles` por los `usuario_id` únicos de cada carga, evita N+1 queries.

### Patrón de insert
`as never` en el `.insert()` (igual que el resto de hooks), ya que no hay codegen de tipos Supabase.

---

## Próximas Fases

### F8 — Auto-conversión de prospecto al importar facturas
**Objetivo:** Cerrar el loop comercial. Al importar facturas, si una factura tiene `idcliente` que coincide con `idcliente_sugerido` de un prospecto con `match_aprobado = true` y estado `seguimiento`, marcarlo automáticamente como `convertido`.
- **Dónde:** `src/lib/etl.ts` — función `procesarFacturas()`, al final del upsert
- **Qué hace:** query a `prospectos` buscando matches aprobados cuyos `idcliente_sugerido` aparecen en las facturas procesadas → `UPDATE estado='convertido', primera_factura_docventa=..., fecha_conversion=...`
- **Actividad automática:** insertar registro en `actividad` con `tipo='seguimiento'` y nota de conversión
- **RLS:** se ejecuta en contexto del usuario logueado (browser-side ETL)

### F9 — Semáforo de salud del cliente
**Objetivo:** Indicador visual en `ClientesPage` y `ClienteDetallePage` según días desde última factura.
- Verde: < 30 días | Amarillo: 30–60 días | Rojo: > 60 días | Gris: sin facturas
- **Dato:** vista `clientes_ultima_factura` ya existe en Supabase (usada en KpisPage/useKpis)
- **Cambios:** `useClientes.ts` (incluir `ultima_factura` en el tipo), `ClientesPage.tsx` (columna semáforo), `ClienteDetallePage.tsx` (badge en header)

### F10 — Dashboard con gráficas de tendencia
**Objetivo:** `DashboardPage.tsx` con gráficas visuales.
- Ventas S1→S2→S3→S4 del mes actual (barras)
- Comparativa mes actual vs mes anterior (línea)
- Top 5 clientes del mes (tabla)
- **Librería:** `recharts` (instalar) — ligera, compatible con React 19
- **Datos:** queries a `facturas` agrupando por `semana` y `mes/anio`

### F11 — Historial de importaciones
**Objetivo:** Registrar cada importación para auditoría y prevenir duplicados accidentales.
- **Nueva tabla en Supabase:** `importaciones (id, mes_importacion, tipo, filas_procesadas, filas_omitidas, usuario_id, created_at)`
- **Migration:** nuevo archivo `002_importaciones.sql`
- **UI:** sección en `ImportarPage.tsx` mostrando las últimas importaciones con fecha, usuario y conteo
- **Lógica:** al finalizar ETL exitosamente → insertar registro en `importaciones`

### F12 — Exportación a Excel de reportes
**Objetivo:** Descargar reportes clave como .xlsx directamente desde la app.
- **Reportes:** KPIs del mes por vendedor, clientes inactivos (+60 días), prospectos abiertos
- **Dónde:** botón "Exportar" en `KpisPage.tsx` y `ClientesPage.tsx`
- **Librería:** `xlsx` ya está instalada (usada en ETL de importación)
- **Sin backend:** generación 100% browser-side con los datos ya cargados en el hook

### F13 — Búsqueda global
**Objetivo:** Barra de búsqueda en el header que busca en clientes y prospectos simultáneamente.
- **UI:** input en `AppLayout.tsx` (header superior), dropdown de resultados con hasta 5 por entidad
- **Lógica:** debounce 300ms → `ilike` en `clientes.nombre` y `prospectos.nombre` → navegar al detalle al seleccionar
- **Shortcut:** `Ctrl+K` para enfocar

### F14 — Filtros avanzados en Prospectos
**Objetivo:** `ProspectosPage.tsx` con filtros por zona, especie y fuerza de venta (además de los tabs de estado actuales).
- Chips de filtro activos visibles
- Combinar con el tab de estado seleccionado
- Filtrado client-side sobre datos ya cargados (sin nuevas queries)

### F15 — Sync automático de maestros (implementado 2026-05-12)

**Archivos:**
| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/003_cron_sync.sql` | Script pg_cron — ejecutar manualmente en SQL Editor |
| `supabase/functions/sync-maestros/index.ts` | Registra en `importaciones` con `usuario_id='00000000...'` al correr |
| `src/pages/importar/ImportarPage.tsx` | Muestra "Último sync automático" en sección Maestros |

**Activar cron en Supabase (pasos):**
1. Dashboard → Database → Extensions → habilitar `pg_cron` y `pg_net`
2. Dashboard → Settings → API → copiar `service_role key`
3. SQL Editor → `ALTER DATABASE postgres SET "app.service_role_key" = '<KEY>';`
4. SQL Editor → ejecutar `supabase/migrations/003_cron_sync.sql`

### F15 original — descripción
**Objetivo:** Sincronizar Google Sheets → Supabase automáticamente cada día sin intervención manual.
- **Dónde:** Edge Function `sync-maestros` ya existe — agregar invocación por cron
- **Opción A:** Supabase `pg_cron` — `SELECT cron.schedule('sync-diario', '0 6 * * *', ...)` (requiere extensión habilitada)
- **Opción B:** Vercel Cron Jobs — `vercel.json` con schedule que llame al endpoint de la Edge Function
- **UI:** en `ImportarPage.tsx` mostrar fecha del último sync automático

---

## Comandos útiles

```bash
# Desarrollo
cd crm
npm run dev        # inicia en http://localhost:5178

# Build de producción
npm run build

# Deploy a Vercel (desde CLI, sin plugin)
vercel --prod
```
