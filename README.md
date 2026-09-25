# Vivero Maestro Web

Versión autónoma para navegador en un repositorio independiente. Conserva Vivero Maestro Windows y Vivero Campo Android en su repositorio original. La copia controlada del renderer React, modelos y repositorio Firebase está en `src/shared`; este proyecto no necesita el monorepositorio ni Electron para instalar, probar o compilar.

## Uso local

Node >=22.12. Desde esta carpeta:

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Abra `http://127.0.0.1:5174`. La copia del ejemplo es opcional y solo debe hacerse si **no existe** `.env.local`. El ejemplo usa datos ficticios y necesita los emuladores del repositorio para iniciar sesión. Sin configuración se muestra la aplicación desconectada y el acceso se bloquea. No se ha copiado ni leído la configuración privada de Windows.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

La salida está en `dist/` (ignorada); preview usa `http://127.0.0.1:4174`. No abrir index.html como archivo local. No hay instalador ni servidor Node en producción: son archivos estáticos. Sin service worker ni caché offline personalizada.

## Funciones y límites

- Mismas pantallas, roles y Callables para usuarios, catálogo, jornadas, conteos, descartes, migraciones e informes. Las escrituras siguen pasando por Functions.
- Sesión gestionada por Firebase JS SDK y aislada por origen del navegador, distinta de Electron y Android. EMULATOR y PRODUCTION conservan nombres de aplicación Firebase diferentes. No se trasladan sesiones, contraseñas ni almacenamiento local de Windows.
- Apertura de informes en una pestaña nueva: solo HTTPS en drive.google.com/docs.google.com, sin opener ni referrer.
- Estado, reintento y revocación de Drive disponibles según permisos existentes. **Conexión, selección Picker y reconexión OAuth permanecen en Windows.** El cliente Desktop con callback loopback no es un cliente web; no se lo simula ni se guardan refresh tokens en el navegador. Migrar ese flujo requiere una etapa específica de OAuth web y revisión del backend.
- Diseño original reutilizado con ajustes de pantalla pequeña; no convierte Campo en una web ni implementa captura offline de Android.

## Publicación pendiente (no ejecutada)

Usar únicamente variables locales de esta carpeta: `VITE_APP_ENV`, `VITE_USE_FIREBASE_EMULATORS`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_AUTH_DOMAIN`.

Producción exige `production`, emuladores `false`, proyecto `viverocontrol-3f83f` y configuración pública de la aplicación Firebase Web autorizada. HTTPS obligatorio salvo localhost; emuladores solo desde loopback. Vite integra esas variables **públicas** durante el build: nunca agregar secretos OAuth, tokens o claves administrativas.

Antes de publicar: decidir dominio/hosting y autorizar el dominio en Authentication si corresponde; comprobar las Callables desplegadas y sus permisos/CORS; compilar con configuración web aprobada; servir dist mediante HTTPS y cabeceras `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` y Referrer-Policy; no cachear index.html de forma permanente. La CSP incluida solo admite endpoints concretos. No se crea Hosting ni se cambia Firebase en esta migración local.

En Vercel, configure las seis variables anteriores para Production y Preview. `vercel.json` ejecuta el build, publica exclusivamente `dist/`, aplica cabeceras de seguridad y evita cachear permanentemente `index.html`. El archivo `.vercel/` es local y nunca se versiona.

También se admiten los nombres de configuración Web que crea la integración Firebase de Vercel: `apiKey`, `appId`, `authDomain` y `projectId`. En Vercel, el build fija automáticamente `production` y deshabilita emuladores; los nombres `VITE_` explícitos tienen prioridad. `storageBucket`, `messagingSenderId` y `measurementId` no son necesarios para las funciones actuales.

Rollback local: volver a utilizar el programa Windows conservado. No hay migración de datos ni recursos remotos que revertir.

## Verificación de esta migración

- Web: lint, typecheck, 21 pruebas, build y audit de dependencias de ejecución (0 vulnerabilidades).
- Windows: lint, typecheck, 74 pruebas existentes y build del renderer. No se generó ni reemplazó el instalador.
- Validación local con Node 24.15.0; CI configurada con Node 22, no ejecutada remotamente en esta entrega local.
- Vitest por `threads` y un worker: evita el timeout de arranque de forks observado en Windows, sin ampliar timeouts ni omitir pruebas. Para la regresión desktop se usó `npm test -- --pool=threads --maxWorkers=1`.
- Pantalla revisada en navegador, sin errores de consola, acceso bloqueado sin configuración y sin desbordamiento horizontal a 390 px. Navegación administrativa y permisos verificados con repositorios simulados; no se inició sesión en Firebase real.
- Permanece el aviso de Vite por bundle >500 kB. No bloquea la compilación; la optimización de carga queda pendiente.
