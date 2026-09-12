# Exportación de formatos originales

Las vistas generan XLSX desde copias sanitizadas de los seis archivos suministrados. Nunca escriben en Downloads, Firebase ni Drive. No se incluyen registros históricos; se conservan hojas de control de cambios y nombres originales de pestañas.

- Procesos y aplicaciones: registros filtrados, distribuidos en las filas existentes. Más de una copia se descarga en ZIP.
- Monitoreo: ficha seleccionada completa. Se escribe en la primera hoja del formato; su fecha está en C5. Los nombres originales de las pestañas se conservan y las demás fichas quedan vacías.
- Injertación: ficha seleccionada, separada por módulo/cama y capacidad de 22 muestras. Yemas: seis recolecciones por copia.
- Inventario: líneas filtradas, hojas originales por módulo. Si una ubicación no existe en el formato, se bloquea la descarga en lugar de inventar una hoja. La fecha procede de la actualización del inventario. Las muertas iniciales se consignan como observación, no como muertas de un nuevo conteo.
- El informe general conserva su exportación JSON: no se suministró un formato Excel para ese resumen ni para mapas.

El exportador modifica únicamente las celdas de datos autorizadas. Conserva los estilos, combinaciones y partes restantes del paquete OOXML. Usa fflate porque se necesita preservar las partes nativas del libro sin reconstruirlas. Las cadenas compartidas no utilizadas se vacían al preparar las plantillas para evitar conservar históricos ocultos. Las fórmulas históricas usadas como datos de entrada se limpian; las fórmulas de totales de inventario se conservan con cachés recalculadas para la selección exportada.

Las observaciones largas conservan el tamaño de celda del original y pueden requerir inspección en la barra de fórmulas de Excel. No se amplían filas ni se reduce la letra automáticamente. Los nombres en los campos de responsable son texto, no firmas digitales.

Verificación: typecheck, lint dirigido, siete pruebas de mapeo/preservación, apertura XML de las seis salidas y revisión de vistas renderizadas. Los originales se verifican mediante SHA-256 durante la preparación. La integración productiva pendiente no se habilita mediante este cambio.
