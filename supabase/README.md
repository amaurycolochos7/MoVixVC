# MoVix Supabase Database - Fase 2 + 3

## Descripción

Base de datos para la PWA de movilidad MoVix, incluyendo:
- Gestión de usuarios y roles (cliente, taxi, mandadito, admin)
- Solicitudes de servicio con máquina de estados
- Sistema de ofertas y contraofertas con expiración
- Paradas múltiples para servicios de mandadito
- Registro de comisiones (ledger)
- **KYC simple con Google Drive** (Fase 3)
- Row Level Security (RLS) por rol

## Estructura de Archivos

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql  # Tablas, índices, funciones
│   ├── 002_rls_policies.sql    # Políticas de seguridad RLS
│   ├── 003_kyc_schema.sql      # KYC: enum, tabla, funciones
│   └── 004_kyc_rls.sql         # KYC: políticas RLS
├── functions/
│   └── upload-kyc/             # Edge Function para subir docs a Drive
├── seed.sql                     # Datos de prueba
└── README.md                    # Este archivo
```

## Requisitos Previos

1. **Supabase CLI** instalado:
   ```bash
   npm install -g supabase
   ```

2. **Proyecto Supabase** creado (local o en la nube)

3. **Google Cloud Project** (para KYC):
   - Service Account con permisos Drive
   - Carpeta Drive compartida con Service Account

## Configuración Local

### 1. Iniciar Supabase Local

```bash
cd movix
supabase init
supabase start
```

Esto iniciará los contenedores Docker con:
- PostgreSQL en `localhost:54322`
- Supabase Studio en `http://localhost:54323`

### 2. Ejecutar Migraciones

```bash
# Aplicar todas las migraciones
supabase db push

# O ejecutar manualmente en orden:
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/002_rls_policies.sql
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/003_kyc_schema.sql
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/004_kyc_rls.sql
```

### 3. Cargar Seed Data

```bash
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql
```

## Configuración en Supabase Cloud

### 1. Obtener Credenciales

En tu proyecto de Supabase Dashboard:
- **Project URL**: `https://[PROJECT_REF].supabase.co`
- **API Key (anon)**: Para el cliente
- **API Key (service_role)**: Para operaciones admin

### 2. Ejecutar Migraciones

En el SQL Editor del Dashboard, ejecutar en orden:
1. Contenido de `001_initial_schema.sql`
2. Contenido de `002_rls_policies.sql`
3. Contenido de `003_kyc_schema.sql`
4. Contenido de `004_kyc_rls.sql`
5. Contenido de `seed.sql` (opcional, solo para pruebas)

## Usuarios de Prueba

| Email | Rol | Contraseña (crear en Auth) |
|-------|-----|---------------------------|
| admin@movix.test | admin | test123 |
| cliente@test.com | cliente | test123 |
| taxi@test.com | taxi | test123 |
| mandadito@test.com | mandadito | test123 |

> ⚠️ **Nota**: Los usuarios deben crearse primero en Supabase Auth y luego insertarse en la tabla `users` con el mismo UUID.

## Probar Flujos

### Flujo 1: Cliente Crea Solicitud

```sql
-- Como cliente (auth.uid() = '00000000-0000-0000-0000-000000000002')
INSERT INTO service_requests (client_id, service_type, origin_address, destination_address, estimated_price)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'taxi',
    'Mi ubicación de origen',
    'Mi destino',
    100.00
);
```

### Flujo 2: Conductor Hace Oferta

```sql
-- Como taxi (auth.uid() = '00000000-0000-0000-0000-000000000003')
INSERT INTO offers (request_id, driver_id, offer_type, offered_price, expires_at)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    'initial',
    220.00,
    NOW() + INTERVAL '5 minutes'
);
```

### Flujo 3: Cliente Acepta Oferta (Anti-Doble-Asignación)

```sql
-- Usar la función atómica
SELECT assign_driver_to_request(
    '10000000-0000-0000-0000-000000000001'::UUID,
    '00000000-0000-0000-0000-000000000003'::UUID,
    '[OFFER_ID]'::UUID,
    1 -- versión esperada
);
```

### Flujo 4: Completar Servicio

```sql
-- El conductor completa el servicio
SELECT complete_service(
    '10000000-0000-0000-0000-000000000001'::UUID,
    '00000000-0000-0000-0000-000000000003'::UUID
);
```

## Eventos Realtime

### Habilitar Realtime en Tablas

En Supabase Dashboard → Database → Replication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE offers;
ALTER PUBLICATION supabase_realtime ADD TABLE request_stops;
```

### Suscripciones Recomendadas

| Canal | Tabla | Filtro | Consumidor |
|-------|-------|--------|------------|
| `requests:taxi` | service_requests | `service_type=eq.taxi,status=eq.pending` | Taxistas |
| `requests:mandadito` | service_requests | `service_type=eq.mandadito,status=eq.pending` | Mandaditos |
| `my-requests:{user_id}` | service_requests | `client_id=eq.{user_id}` | Cliente |
| `offers:{request_id}` | offers | `request_id=eq.{request_id}` | Cliente |
| `my-offers:{driver_id}` | offers | `driver_id=eq.{driver_id}` | Conductor |

## Comisiones

| Tipo de Servicio | Comisión |
|------------------|----------|
| Taxi | $3.00 MXN |
| Mandadito | $2.50 MXN |

Las comisiones se registran automáticamente en `ledger_entries` al completar el servicio.

## Troubleshooting

### Error: "new row violates row-level security policy"

Verificar que:
1. El usuario está autenticado
2. El rol del usuario coincide con la operación
3. El `auth.uid()` corresponde al usuario en la tabla `users`

### Error: "VERSION_CONFLICT" en asignación

Otro proceso modificó la solicitud. Recargar y reintentar.

### Verificar RLS Policies

```sql
-- Ver todas las policies de una tabla
SELECT * FROM pg_policies WHERE tablename = 'service_requests';
```

## KYC (Verificación de Conductores)

### Estados KYC

| Estado | Descripción | Puede operar |
|--------|-------------|--------------|
| `not_submitted` | No ha enviado documentos | ❌ |
| `pending` | Enviado, esperando revisión | ❌ |
| `approved` | Aprobado por admin | ✅ |
| `rejected` | Rechazado (puede re-enviar) | ❌ |

### Flujo de Aprobación Admin

```sql
-- Aprobar conductor
SELECT approve_kyc(
    'USER_ID'::UUID,
    'ADMIN_ID'::UUID
);

-- Rechazar conductor (con motivo)
SELECT reject_kyc(
    'USER_ID'::UUID,
    'ADMIN_ID'::UUID,
    'Foto de INE borrosa'
);
```

### Constraint de Disponibilidad

Un conductor solo puede activar `is_available = TRUE` si `kyc_status = 'approved'`:

```sql
-- Este INSERT fallará si el conductor no está aprobado:
UPDATE users SET is_available = TRUE WHERE id = 'driver_id';
-- ERROR: violates check constraint "users_driver_kyc_required"
```

## Próximos Pasos

1. Configurar variables de entorno:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   GOOGLE_DRIVE_KYC_FOLDER=[FOLDER_ID]
   ```

2. Integrar cliente Supabase en Next.js
3. Implementar Edge Function `upload-kyc`
4. Implementar UI de KYC para conductores
5. Implementar dashboard admin para aprobaciones

