# Injertación: vista web de PV-F-008 / PV-F-007 versión 002

Implementación de consulta, sin importación histórica ni sincronización remota. Injertos y Yemas se seleccionan mediante botones. Filtros por mes del registro, responsable y detalle. Los totales corresponden al registro seleccionado, no se suman inspecciones que podrían representar las mismas plantas.

## Diferencias respecto a Android actual

El modelo `InjertacionDraft` conserva campos comunes: `id`, `formType`, `date`, `responsible`, `notes`, `totalGraftsCount`, `evaluatedSamplesCount`, `samples`, `yemaCollections`. La web acepta esos nombres. No interpreta `syncStatus` local como confirmación del servidor.

El archivo PV-F-008 recibido (versión 002, 01-09-2026) distingue:

- Planta patrón: edad de nueve meses, tamaño acorde con yemas, condiciones sanas; observaciones y tratamiento NC.
- Injerto: yema acorde al grosor, cubrimiento con cintelita, corte diagonal en bisel; observaciones y tratamiento NC separados.

La web añade campos opcionales `rootstockCriteria` y `graftCriteria` (tres evaluaciones en ese orden), `graftNotes` y `graftNcTreatment`. Cada evaluación contiene `status` C/NC/N.A, `treatment` y `notes`. Solo `healthyCondition` del contrato anterior corresponde al tercer criterio del patrón; ni la edad en texto ni el grosor en mm acreditan cumplimiento de los otros criterios. Campos ausentes: Sin evaluar.

PV-F-007 añade `criteria` por recolección: árbol sin deshidratación, sin plagas/enfermedades, edad productiva mayor de dos años. El modelo Android revisado aún no los contiene. El total usa `yemaQuantity`; un dato ausente hace que el total sea no disponible, un cero explícito se conserva. El árbol madre se identifica conjuntamente por lote de procedencia, línea y número; este lote no se convierte en fecha de siembra.

## Reglas no inferidas

PV-F-008 presenta tabla 1–200:10, 201–500:25, 1001–2000:100, 2001–3000:150. Falta 501–1000 y no define más de 3000, aunque el encabezado dice 5%. Android actualmente agrega 501–1000:50 y un cálculo para más de 3000. La web no copia esa extrapolación ni recalcula `evaluatedSamplesCount`.

La nota sobre tres inspecciones consecutivas requiere historial y una definición de continuidad; no se deduce de tres muestras NC. No hay alertas ni sanciones automáticas. Los códigos 1–6 de tratamiento se conservan como datos, sin ejecutar acciones.

Antes de conectar: acordar extensiones del modelo Android y persistencia servidor, revisar fechas/lotes y confirmar rangos faltantes de muestreo. No se cambió Android en esta tarea.
