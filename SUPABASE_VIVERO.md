# Vivero en la base compartida de Arles

Proyecto autorizado: `gfgsnnweyfryfcqdnlvw` (Almacen Arles Nuevo).
La web usa Supabase Auth y PostgREST directamente, con clave pública y RLS.
No hay puente activo, lecturas, escrituras ni migración histórica desde Firestore.

## Separación

- Todas las tablas nuevas tienen prefijo `vivero_`. No se utilizan ni modifican tablas, funciones, perfiles o permisos de Almacén.
- Solo una cuenta activa en `vivero_members` puede acceder a Vivero. Tener cuenta en Supabase o en Almacén no basta.
- La cuenta existente `almacen@arlessas.com` recibe únicamente una membresía administrativa de Vivero. No se cambia su contraseña, su cuenta ni su perfil de Almacén.
- Sesión persistente con almacenamiento `arles-vivero-supabase-v1`. Cerrar Vivero usa `scope: local`.
- El modo DEMO y el shell antiguo no forman parte del punto de entrada productivo. El código legado sigue disponible para referencia y pruebas, no como fallback.
- Inicio vacío autorizado: no se copian datos reales ni simulados de Firebase. Esto no equivale a borrar el proyecto Firebase.

## Contrato de datos para Android

Android **todavía necesita cambiar su adaptador y autenticación**. Publicar la web no modifica el APK instalado. No marcar borradores antiguos como sincronizados ni subirlos automáticamente: el usuario pidió empezar vacío.

Autenticar con Supabase; usar el JWT de la cuenta y la clave pública. Nunca una clave privada/service_role.
Los operadores nuevos necesitan una cuenta Auth y una membresía explícita de Vivero; nunca un perfil de Almacén.

| Tabla | Uso |
| --- | --- |
| vivero_members | Membresía, nombre, rol y estado de Vivero; sin escritura desde clientes |
| vivero_locations | Vivero, módulo, germinador, jardín clonal y cama; jerarquía parent_id |
| vivero_lines | Líneas, location_id, código y orden |
| vivero_inventory | Conteo vigente por línea: id=line_id; females, males, rootstocks, dead, counted_on |
| vivero_lots / vivero_lot_lines | Lotes SIEMBRA o INJERTACION por mes YYYY-MM y asociación a líneas |
| vivero_documents | Formularios diarios, monitoreo, aplicaciones, injertos y yemas |
| vivero_audit | Auditoría automática de escrituras, solo consulta de supervisores/administrador |

### Formularios

`vivero_documents`: `id` estable generado en el dispositivo, `kind`, `record_date` (YYYY-MM-DD), `payload`, `version`.
El payload debe coincidir con el ID y fecha de la fila.

- DAILY: contrato `DailyActivity`, en `src/shared/domain/DailyActivityContract.ts`. El conversor `dailyActivityFromAndroid` adapta el borrador Android antiguo.
- APPLICATIONS: `ApplicationRecord`, en `ApplicationsSection.tsx`.
- MONITORING: `MonitoringRecord`, en `MonitoringSection.tsx`.
- GRAFTING: `GraftingRecord`, en `GraftingSection.tsx`; formType diferencia PV_F008_INJERTACION y PV_F007_YEMAS.

INSERT para registros nuevos; si un reintento devuelve ID duplicado, consultar y comparar el registro antes de confirmarlo. No generar un ID nuevo para el mismo envío.
UPDATE con filtro `id=eq.<id>&version=eq.<version leída>` y la misma versión en el cuerpo. El servidor incrementa la versión; cero filas significa conflicto, no éxito.
No usar upsert ciego: podría sobrescribir un cambio concurrente. Los clientes no tienen permiso DELETE.
El servidor establece autor, responsable y hora; el móvil no puede suplantarlos.

Inventario: las cantidades son enteras no negativas; total se calcula como hembras + machos + patrones, sin muertas. Una fila en cero es distinta de una línea sin inventario.
Crear ubicaciones/líneas/lotes requiere administrador o supervisor. No se precargan módulos ni existencias ficticias.

## Lectura, exportación y verificación

Las vistas consultan tablas Vivero y conservan los exportadores de los formatos oficiales. Consultas paginadas para no truncar silenciosamente a 1.000 registros. Realtime solo escucha tablas Vivero; volver a la ventana también actualiza.

- Migración: `supabase/migrations/20261103195501_vivero_isolated_backend.sql`.
- Prueba transaccional: `supabase/tests/vivero_isolation.sql`. Reversión de todos los datos de prueba; verifica RLS, autores, auditoría, cero real, negativos y versión obsoleta.
- Configuración: copiar `.env.example` a archivo local ignorado. Configurar las dos variables VITE_SUPABASE en Vercel/Production. Sin credenciales en Git.

La entrada con contraseña real debe comprobarla el titular de la cuenta; las pruebas SQL no sustituyen esa comprobación.

La revisión de seguridad no reportó alertas para las tablas Vivero. El análisis de rendimiento solo indicó [índices nuevos todavía sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), normal al comenzar vacío; se conservan para las consultas y claves foráneas.
Almacén puede seguir recibiendo movimientos de sus propios usuarios durante una verificación. Esta migración no escribe en sus tablas ni intenta revertir actividad concurrente.

## Cortes históricos de inventario

- `vivero_inventory_periods`: mes del conteo, huella SHA-256 del Excel, controles de filas/vivas/muertas y manifiesto de origen. Solo se publica un corte cuando todos sus controles coinciden.
- `vivero_inventory_history`: una fila por corte y línea, con ubicación de ese momento, cantidades, fecha real, responsable del documento, hoja, fila y celdas originales. Los cortes publicados son inmutables. El usuario eligió las cantidades de Excel sobre las de los PDF físicos.
- `vivero_inventory_effective`: vista `security_invoker` que combina el último corte publicado con los conteos vivos de igual o posterior fecha. No suma meses ni arrastra líneas ausentes desde cortes anteriores. La cuenta de importación no sustituye al responsable histórico.
- `vivero_inventory_counts` conserva por separado los futuros envíos de inventario operativo. Los archivos históricos no se hacen pasar por envíos nuevos del celular.

El selector del módulo Inventario permite consultar y exportar cada corte por separado. Las fechas del Excel exportado son las del conteo, no las de importación. Germinadores distintos que usan la misma hoja de plantilla salen en archivos separados, conservando el formato original.

Preparación local: `scripts/prepare-inventory-history.py archivo.zip directorio-privado`. El script es de solo lectura sobre el ZIP. Genera datos normalizados y SQL transaccional con comprobación de duplicados y del catálogo existente. Los archivos generados contienen datos reales: mantenerlos fuera de Git y de `public/`. Ejecutar únicamente sobre el proyecto autorizado de Supabase y revisar antes los controles y el mes de cada corte. Los encabezados se normalizan a las fechas de las filas, y G3 conserva su identidad aunque un encabezado copiado diga G2.

Prueba breve con reversión: `supabase/tests/vivero_imported_inventory.sql` (controles específicos de la primera importación). Comprueba prioridad del Excel, fechas, inmutabilidad, ausencia frente a cero, precedencia de conteos posteriores y aislamiento de no miembros/anon.
