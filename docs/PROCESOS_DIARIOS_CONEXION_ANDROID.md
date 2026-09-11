# Conexión de Procesos diarios: estado y contrato

## Avance local posterior a la revisión inicial

Se implementó una conexión exclusiva para emuladores. Android debug incorpora Firebase Auth y Functions, sesión local y cola durable por UID/ID. El envío es explícito, no automático en segundo plano. Congela la operación antes de enviarla y conserva su clave al reintentar; una confirmación idéntica no vuelve a enviarse. No se guardan contraseñas por código propio.

Backend: `sincronizarProcesoDiarioMovil` y `listarProcesosDiariosMovil`, ambas bloqueadas fuera del emulador. El cuerpo de escritura es `{schemaVersion:1,operationId,expectedVersion,draft}`. La respuesta es `{id,version}`. El backend deriva el registrador del perfil activo; escritura de AUXILIAR/SUPERVISOR/ADMINISTRADOR, edición solo del propietario, lectura web solo ADMINISTRADOR. Estas decisiones requieren ratificación antes de habilitar producción.

Colecciones nuevas propuestas e implementadas solo localmente: `procesosDiariosMovil` y `operacionesProcesosDiarios`. Reutiliza la denegación predeterminada de las reglas para acceso directo: solo Admin SDK dentro de Functions accede. Ninguna escritura cambia inventario, jornadas o Drive.

La web consulta por fecha únicamente en modo EMULATOR y permite actualizar manualmente. En producción permanece como conexión pendiente. Límite de 200 registros por día; si se excede, muestra error, nunca totales truncados.

Verificado: compilación Android, pruebas existentes Android, pruebas de conversión/consulta web y transacciones reales de Firestore emulado para idempotencia, conflicto e inactivación. Pendiente: prueba visual Android → Auth/Functions emulados → web, recuperación tras cierre de app y revisión productiva. No hubo despliegue ni instalación en el teléfono.

Los apartados siguientes conservan el diagnóstico inicial y el plan; no describen todos el estado posterior a este avance.

Revisión local de Android y web: 11 de septiembre de 2026.

## Estado comprobado

Android `vivero-procesos-android` guarda `ActivityDraft` mediante `DraftStore` en SharedPreferences `local_drafts_v1`, clave `activities`. Conserva el ID al editar. No tiene permiso INTERNET, dependencias Firebase ni autenticación. No hay sincronización productiva. Los endpoints de otros documentos son propuestas, no servicios existentes.

La web dispone de `AndroidDailyDraft` y `dailyActivityFromAndroid` para representar esos datos sin pérdida. El adaptador no es un cliente remoto ni valida un payload desconocido. No se conecta todavía en App: no debe presentar borradores locales como registros sincronizados.

## Campos compartidos existentes

`id`, `date`, `activity`, `locations[{place,beds,lines}]`, `workers[{name,start,end,quantity}]`, `individualHours`, `start`, `end`, `individualQuantity`, `quantity`, `unit`, `notes`.

Cantidades enteras en texto como en Android. Un vacío no es cero. Si la cantidad es del equipo, no multiplicarla por colaboradores ni ubicaciones. Si es individual, sumar solo cuando todas las cantidades estén disponibles. Mantener unidades y horarios individuales. No convertir líneas discontinuas en un rango continuo. No deducir plantas únicas sumando actividades.

## Etapa siguiente requerida (no implementada ni desplegada)

1. Configurar autenticación Android contra `viverocontrol-3f83f`. Confirmar identificador Android productivo antes de registrar aplicaciones; debug usa `.preview`. No usar usuarios inventados ni contraseñas incorporadas.
2. Implementar servicio autenticado de sincronización en el backend Firebase. El servidor verifica UID y perfil activo/rol de `usuarios`; deriva el responsable desde el perfil y no confía en un nombre enviado por el cliente.
3. Acordar y validar versión de esquema, revisión de registro y clave de idempotencia. Mantener IDs; rechazar conflictos de edición, no sobrescribir una revisión ajena. Registrar auditoría y hora de servidor. No asignar retrospectivamente un autor de conteo a borradores que carecen de él.
4. Añadir cola local durable con reintentos. Mostrar sincronizado únicamente después del acuse del servidor; no perder borradores ni asumir éxito sin red.
5. Exponer lectura autorizada por fecha y con límites para la web. Validar payload antes de pasar al adaptador; diferenciar carga, error, vacío y conexión pendiente.
6. Pruebas locales/emulador de permisos, duplicados, conflicto y reintento. Después autorizar despliegue de los recursos explícitos y un registro real de verificación.

No crear colecciones, reglas permisivas ni rutas ficticias como solución provisional. No tocar el Excel de Drive en esta etapa. Los contratos de Inventario, Aplicaciones y Monitoreo se integran después; sus escrituras no deben alterar existencias por simple envío de un borrador.
