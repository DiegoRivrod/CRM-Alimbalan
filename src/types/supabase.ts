export type Rol = 'gerente' | 'supervisor' | 'vendedor'

export type EstadoProspecto = 'nuevo' | 'seguimiento' | 'convertido' | 'perdido'

export type TipoActividad   = 'llamada' | 'nota' | 'seguimiento' | 'match_aprobado' | 'tarea_creada' | 'tarea_completada'

export type TipoTarea     = 'llamada' | 'visita' | 'seguimiento' | 'cobranza' | 'general'
export type PrioridadTarea = 'baja' | 'media' | 'alta' | 'urgente'
export type EstadoTarea    = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
export type TipoImportacion = 'facturas' | 'visitas' | 'maestros'
export type Tier = 'bronce' | 'plata' | 'oro'

export type TipoNotificacion =
  | 'tarea_vencida'
  | 'tarea_asignada'
  | 'prospecto_sin_actividad'
  | 'cliente_inactivo'
  | 'meta_por_cumplir'
  | 'importacion_completada'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      clientes: {
        Row: Cliente
        Insert: Omit<Cliente, 'updated_at'>
        Update: Partial<Cliente>
      }
      productos: {
        Row: Producto
        Insert: Omit<Producto, 'updated_at'>
        Update: Partial<Producto>
      }
      metas: {
        Row: Meta
        Insert: Omit<Meta, 'updated_at'>
        Update: Partial<Meta>
      }
      facturas: {
        Row: Factura
        Insert: Omit<Factura, 'id' | 'created_at'>
        Update: Partial<Factura>
      }
      visitas: {
        Row: Visita
        Insert: Omit<Visita, 'id' | 'created_at'>
        Update: Partial<Visita>
      }
      prospectos: {
        Row: Prospecto
        Insert: Omit<Prospecto, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Prospecto>
      }
      actividad: {
        Row: Actividad
        Insert: Omit<Actividad, 'id' | 'created_at'>
        Update: Partial<Actividad>
      }
      tareas: {
        Row: Tarea
        Insert: Omit<Tarea, 'id' | 'created_at' | 'updated_at' | 'completada_at'>
        Update: Partial<Tarea>
      }
      notificaciones: {
        Row: Notificacion
        Insert: Omit<Notificacion, 'id' | 'created_at'>
        Update: Partial<Pick<Notificacion, 'leida'>>
      }
      importaciones: {
        Row: Importacion
        Insert: Omit<Importacion, 'id' | 'created_at'>
        Update: never
      }
      puntos_mensuales: {
        Row: PuntosMensuales
        Insert: Omit<PuntosMensuales, 'id' | 'total_puntos'>
        Update: Partial<Omit<PuntosMensuales, 'id' | 'total_puntos'>>
      }
      tiers_clientes: {
        Row: TierCliente
        Insert: Omit<TierCliente, never>
        Update: Partial<TierCliente>
      }
    }
  }
}

export interface Profile {
  id: string
  nombre: string
  rol: Rol
  fuerza_de_venta: string | null
  created_at: string
}

export interface Cliente {
  idcliente: string
  razon_sg: string | null
  id_razon: string | null
  nombre: string
  responsable: string | null       // FUERZA DE VENTA del vendedor asignado
  zona: string | null
  departamento: string | null
  provincia: string | null
  distrito: string | null
  vendedor: string | null          // empresa distribuidora
  localizacion: string | null
  lista_precios: string | null
  canal_cluster: string | null
  top: string | null
  status: string | null            // ACTIVO / INACTIVO
  cod: string | null               // COD META
  meta_departamento: number | null
  meta_top: number | null
  meta_canal_cluster: number | null
  canal_truchas: string | null
  meta_truchas_puno: number | null
  meta_semana_1: number | null
  meta_semana_2: number | null
  meta_semana_3: number | null
  meta_semana_4: number | null
  updated_at: string
}

export interface Producto {
  idarticulo: string
  descripcio: string
  lineas: string | null
  marca: string | null
  presentacion: string | null
  peso_saco: number | null
  tipo: string | null
  meta: number | null
  updated_at: string
}

export interface Meta {
  cod: string
  zona_de_venta: string
  meta: number
  updated_at: string
}

export interface Factura {
  id: string
  tipodocume: string
  idserie: string
  numero: string
  docventa: string             // IDSERIE + '-' + NUMERO
  fecha: string
  descondici: string | null
  idcliente: string
  nombre: string
  idarticulo: string | null
  desarticul: string | null
  cantidadar: number | null
  pesokgrtot: number | null
  valortotal: number
  vendedor: string | null
  lineas: string | null
  marca: string | null
  mes: string | null
  anio: number | null
  semana: string | null
  departamento: string | null
  provincia: string | null
  distrito: string | null
  zona: string | null
  fuerza_de_venta: string | null
  canal: string | null
  canal_cluster: string | null
  cod_meta: string | null
  mes_importacion: string | null  // ej: "ABRIL_2026"
  created_at: string
}

export interface Visita {
  id: string
  marca_temporal: string
  fuerza_de_venta: string
  localizacion: string | null
  latitud: number | null
  longitud: number | null
  numero_visita: number           // 1, 2, 3 o 4
  es_cliente_nuevo: boolean
  idcliente: string | null        // si cliente existente
  nombre_cliente_nuevo: string | null  // si nuevo (texto libre)
  contacto: string | null
  zona: string | null
  tipo_cliente: string | null
  especie: string | null
  animales: number | null
  granjas: number | null
  procedencia: string | null
  problema_abastecimiento: string | null
  lineas_productos: string | null
  potencial_consumo_tn: number | null
  marcas_consume: string | null
  created_at: string
}

export interface Prospecto {
  id: string
  visita_id: string | null
  nombre: string
  contacto: string | null
  fuerza_de_venta: string
  zona: string | null
  especie: string | null
  potencial_tn: number | null
  marcas_consume: string | null
  estado: EstadoProspecto
  idcliente_sugerido: string | null
  match_confianza: number | null   // 0-1
  match_aprobado: boolean
  match_aprobado_por: string | null
  match_aprobado_at: string | null
  primera_factura_docventa: string | null
  fecha_conversion: string | null
  created_at: string
  updated_at: string
}

export interface Actividad {
  id: string
  tipo: TipoActividad
  prospecto_id: string | null
  idcliente: string | null
  usuario_id: string
  nota: string | null
  created_at: string
}

export interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  tipo: TipoTarea
  prioridad: PrioridadTarea
  estado: EstadoTarea
  fecha_vencimiento: string | null
  asignado_a: string
  creado_por: string
  prospecto_id: string | null
  idcliente: string | null
  completada_at: string | null
  created_at: string
  updated_at: string
}

export interface Notificacion {
  id: string
  usuario_id: string
  tipo: TipoNotificacion
  titulo: string
  mensaje: string | null
  leida: boolean
  tarea_id: string | null
  prospecto_id: string | null
  idcliente: string | null
  link: string | null
  created_at: string
}

export interface Importacion {
  id: string
  tipo: TipoImportacion
  mes_importacion: string | null
  filas_procesadas: number
  filas_omitidas: number
  prospectos_conv: number
  usuario_id: string
  created_at: string
}

export interface PuntosMensuales {
  id: string
  idcliente: string
  anio: number
  mes: string                    // 'ENERO' … 'DICIEMBRE'
  pts_volumen: number
  pts_valor: number
  pts_diversificacion: number
  pts_frecuencia: number
  pts_bonus: number
  total_puntos: number           // columna generada (solo lectura)
  sacos_total: number | null
  valor_total: number | null
  lineas_distintas: number | null
  semanas_distintas: number | null
  calculado_at: string
}

export interface TierCliente {
  idcliente: string
  tier: Tier
  puntos_12m: number
  tier_anterior: Tier | null
  tier_desde: string | null      // fecha ISO
  actualizado_at: string
}

// Tipos para KPIs calculados
export interface KpiVendedor {
  fuerza_de_venta: string
  mes: string
  anio: number
  cartera_clientes: number
  clientes_atendidos: number
  visitas_realizadas: number
  clientes_nuevos: number
  prospectos_activos: number
  volumen_venta: number
  meta_volumen: number
  pct_cumplimiento: number
}
