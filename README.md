# CRM de servicios técnicos

Aplicación web para administrar clientes, técnicos, tickets de servicio, catálogos de unidades, equipos y accesorios, asignaciones y evidencias fotográficas. Incluye autenticación con sesiones en MySQL, administración de usuarios por roles y un asistente de configuración inicial.

## Tecnologías

- **Backend:** Node.js 22, TypeScript, Express 5, Sequelize 6 y MySQL 8.4.
- **Interfaz:** EJS, Bootstrap 5, CSS y módulos TypeScript compilados para el navegador.
- **Contenedores:** Docker y Docker Compose.
- **Pruebas disponibles:** colecciones de Postman y un smoke test de k6.

## Requisitos

**Con Docker (recomendado):** Docker Engine o Docker Desktop con Compose.

**Sin Docker:** Node.js 22, npm y una instancia de MySQL compatible, con una base y un usuario configurados.

Los comandos siguientes deben ejecutarse desde la carpeta que contiene `compose.yaml`, `package.json` y `Dockerfile` (en este ZIP: `CRM_V4/CRM/`).

## Inicio rápido con Docker

### 1. Configurar el entorno

En Git Bash, desde la carpeta del proyecto:

```bash
cp .env.example .env
```

Edita `.env`. Para el **primer arranque con una base sin usuarios**, usa estas variables:

```dotenv
CRM_ADMIN_EMAIL=admin@gmail.com
CRM_ADMIN_PASSWORD=REEMPLAZA_POR_UNA_CLAVE_PRIVADA_DE_12_O_MAS
```

**Importante sobre el administrador:** la implementación actual reserva el rol `admin` exclusivamente a `admin@gmail.com`. Aunque `.env.example` propone otro correo, usarlo crearía un usuario inicial con rol `coordinador`, **no** un administrador. Por eso se recomienda usar `admin@gmail.com` para el primer usuario. La contraseña inicial debe tener al menos 12 caracteres.

No subas `.env` a Git ni compartas contraseñas. Las credenciales de MySQL para Docker están definidas en `compose.yaml`; las variables `DB_*` del `.env` se usan para ejecución local, no sustituyen por sí solas la configuración del servicio `db`.

### 2. Construir y levantar los contenedores

```bash
docker compose up --build -d --wait
```

Compose utiliza el nombre de proyecto `crm-demo`, la base `crm_demo` y publica la aplicación en `127.0.0.1:3030`. MySQL no expone su puerto al host.

Abre **http://localhost:3030/login** e inicia sesión con las credenciales del usuario inicial o con las de un usuario ya existente.

Si el puerto 3030 está ocupado, puedes elegir otro puerto del host:

```bash
CRM_HTTP_PORT=3031 docker compose up --build -d --wait
```

En ese caso, abre `http://localhost:3031/login`; el puerto interno de la aplicación sigue siendo 3030.

### 3. Comprobar el estado

```bash
docker compose ps
docker compose logs --tail=100 app db
```

La ruta `GET /health` consulta la disponibilidad de MySQL y devuelve `{"status":"ok"}` cuando responde correctamente.

### 4. Detener o reiniciar

```bash
docker compose stop
docker compose start
```

Para eliminar los contenedores y la red **sin borrar los volúmenes**:

```bash
docker compose down
```

Para recrear la aplicación sin borrar los datos:

```bash
docker compose up --build -d --wait
```

**ADVERTENCIA: borrar datos.** El siguiente comando elimina los volúmenes de este proyecto Compose, incluidos MySQL y las fotografías alojadas en el volumen de uploads. Úsalo solamente si quieres reiniciar una instalación desechable y ya tienes los respaldos necesarios:

```bash
docker compose down --volumes
docker compose up --build -d --wait
```

Usa siempre el mismo nombre de proyecto Compose si quieres conservar sus volúmenes. Los comandos anteriores asumen el nombre `crm-demo` establecido en `compose.yaml`; si lo cambias con `-p`, utiliza el mismo `-p` en todas las operaciones.

## Autenticación, usuarios y roles

El CRM utiliza las tablas `usuarios` y `sesiones_usuario`. Las contraseñas se almacenan mediante `scrypt` con sal aleatoria; las sesiones se identifican mediante una cookie `HttpOnly`, `SameSite=Lax` y caducan después de 12 horas. Cerrar sesión invalida el token guardado en MySQL.

| Rol | Acceso en la implementación actual |
| --- | --- |
| **Administrador (`admin`)** | Acceso a las pantallas operativas y a `/usuarios` para crear, editar y eliminar cuentas no administradoras. |
| **Coordinador (`coordinador`)** | Acceso a las rutas operativas del CRM, pero no a `/usuarios`. |
| **Técnico (`tecnico`)** | Acceso GET limitado a dashboard, lista de tickets, estado de tickets y detalles de tickets; puede enviar el POST para finalizar un ticket y cerrar sesión. No puede crear ni editar otros recursos mediante las rutas bloqueadas. |

La autorización se aplica en `src/auth.ts`, desde el servidor, no solamente mediante elementos visuales. **La cuenta `admin@gmail.com` es la única que puede conservar el rol administrador** al iniciarse el servidor; otras cuentas marcadas como `admin` se convierten a `coordinador`.

En `/usuarios`, el administrador puede crear usuarios con rol `coordinador` o `tecnico`, cambiar su correo, rol y contraseña, y eliminar cuentas no administradoras. No puede modificar ni borrar la cuenta administradora desde esa pantalla. El cambio de contraseña elimina las sesiones existentes del usuario modificado y el borrado de un usuario elimina sus sesiones por la relación de claves foráneas.

**Consideraciones para bases existentes:**

- En el arranque, el servidor crea las tablas de autenticación si faltan y adapta la columna `rol` de `usuarios` a los valores `admin`, `coordinador` y `tecnico`.
- Los roles históricos `usuario` pasan a `coordinador`.
- Si `usuarios` está vacía, se crea un usuario inicial a partir de `CRM_ADMIN_EMAIL` y `CRM_ADMIN_PASSWORD`. Si ya existen usuarios, cambiar esas variables **no cambia las cuentas ni sus contraseñas**.
- Si ya existen usuarios y ninguno tiene el correo `admin@gmail.com`, el arranque **no crea automáticamente otro administrador**. Es necesario resolver esa situación de manera controlada antes de depender de `/usuarios`.
- Al iniciar sesión se redirige a `/`; el middleware restringe las rutas según el rol. No se debe interpretar esa redirección como permiso para todas las operaciones.

## Funcionalidades

### Dashboard y asistente de inicio

El dashboard (`/`) presenta indicadores, calendario y un asistente para preparar el CRM. El asistente guía al registro de clientes, técnicos, tres catálogos y el primer ticket.

| Paso | Peso |
| --- | ---: |
| Registrar clientes | 25% |
| Registrar técnicos activos | 25% |
| Catálogo de equipos | 10% |
| Catálogo de unidades | 10% |
| Catálogo de accesorios | 10% |
| Crear el primer ticket desde la guía | 20% |
| **Total** | **100%** |

Los pasos iniciales pueden completarse con registros o marcarse como omitidos. También es posible omitir los tres catálogos o todos los pasos previos y pasar a crear el ticket (80% previo al ticket). La guía puede cerrarse y reabrirse. **Reiniciar guía** toma los conteos actuales como referencia sin borrar registros de MySQL.

La selección de pasos omitidos, estado de cierre, línea base y marca de creación del ticket se guardan en el `localStorage` del navegador; por ello la barra puede ser diferente en otro navegador o perfil. La lógica está en `public/js/setup-wizard.js`.

### Clientes y técnicos

Las rutas `/clientes` y `/tecnicos` permiten registrar, editar y solicitar la eliminación de datos maestros. Los teléfonos se validan con diez dígitos; los técnicos pueden estar activos o inactivos.

**Limitación actual de eliminación:** `src/services/master-data-service.ts` rechaza la eliminación con HTTP 409 cuando encuentra referencias relacionadas. Esto aplica a clientes, técnicos y también a los tres catálogos; **la eliminación forzada con confirmación no está implementada en este ZIP**. No borres relaciones directamente en la base sin evaluar antes las consecuencias sobre tickets e inventario.

### Catálogos

`/catalogos` concentra los catálogos de **equipos**, **unidades** y **accesorios**, con búsquedas independientes, paginación y selector de 5, 10, 25 o 50 filas. Las rutas antiguas `/equipos`, `/unidades` y `/accesorios` también abren la vista unificada.

### Tickets

- `/tickets`: bandeja de tickets, filtros, búsqueda y paginación.
- `/tickets/nuevo`: formulario para crear un ticket.
- `/estado_tickets`: entrada alternativa a la bandeja.
- `/detalle_ticket/:id`: espacio de trabajo con información del servicio, técnico, ubicación, comentarios, unidades, equipos, accesorios, fotografías y acciones de cierre o reapertura.

La preparación del ticket se calcula a partir de las unidades previstas, las registradas y las equipadas. Se pueden guardar asignaciones parciales, retomarlas y liberar equipos. Las acciones de cierre y reapertura conservan las validaciones del servicio y su estado.

### Asignaciones e inventario

`/asignaciones` reúne el trabajo de unidades, equipos y accesorios por ticket. Se mantienen como entradas compatibles `/asignacion_unidades` y `/asignacion_equipos`. El inventario de equipos se gestiona desde `/registro_equipos`.

Se pueden retirar unidades mientras el ticket esté en seguimiento, con confirmación y actualización de los vínculos correspondientes; el ticket debe conservar al menos una unidad. No se permite retirar unidades de tickets finalizados mediante ese flujo.

### Evidencias

El detalle del ticket permite subir fotografías de servicio. En Docker se almacenan en el volumen `uploads`, montado en `public/uploads`; ese volumen es independiente de `mysql_data`. **Eliminar el volumen `uploads` elimina esas fotografías**, incluso si hay registros de ellas en la base.

## Base de datos

Docker utiliza MySQL 8.4.6. Al crear un volumen de datos vacío se ejecutan los scripts ubicados en `docker/mysql/init/`:

- `001-schema.sql`: tablas y relaciones del CRM, incluidas las tablas iniciales de autenticación.
- `002-demo.sql`: datos de demostración.

Estos scripts de inicialización **no vuelven a ejecutarse** al reconstruir la imagen de la aplicación o al reiniciar contenedores con un volumen existente. El código de autenticación completa, al arrancar, la creación o adaptación de tablas y roles que necesita la versión actual.

Para consultar las tablas de la base de datos que está usando Docker:

```bash
docker compose exec db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES;"'
```

Para abrir la consola de MySQL:

```bash
docker compose exec db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"'
```

Para hacer un respaldo SQL en la carpeta actual de tu computadora:

```bash
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -u "$MYSQL_USER" "$MYSQL_DATABASE"' > respaldo_crm.sql
```

Un respaldo SQL **no incluye automáticamente** los archivos de fotografías del volumen `uploads`. Respalda también ese volumen si necesitas restaurar las evidencias.

## Ejecución local sin Docker

Crea una base MySQL y un usuario con los permisos necesarios, aplica `docker/mysql/init/001-schema.sql` y, si deseas datos de ejemplo, `002-demo.sql`. Después crea un `.env` con la conexión real:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=crm_demo
DB_USER=crm
DB_PASSWORD=TU_PASSWORD_LOCAL
PORT=3030
CRM_ADMIN_EMAIL=admin@gmail.com
CRM_ADMIN_PASSWORD=UNA_CLAVE_PRIVADA_DE_AL_MENOS_12_CARACTERES
```

Ajusta las credenciales a las de tu propia instalación. Ejecuta:

```bash
npm ci
npm run typecheck
npm run build
npm start
```

El servidor autentica MySQL e inicializa autenticación antes de escuchar el puerto configurado. El proyecto no define actualmente un script `npm run dev`: para incorporar cambios de TypeScript, detén el servidor, vuelve a compilar y arráncalo nuevamente.

## Estructura principal

```text
CRM/
├── compose.yaml                 # Servicios app y db, red y volúmenes
├── Dockerfile                   # Compilación e imagen final
├── .env.example                 # Variables de ejemplo (no publicar .env)
├── docker/mysql/init/           # SQL de esquema y datos demo
├── src/
│   ├── app.ts                   # Express, middleware y rutas
│   ├── server.ts                # Inicio y cierre del servidor
│   ├── config.ts                # Variables de configuración
│   ├── auth.ts                  # Login, sesiones y autorización
│   ├── user-admin.ts            # Administración de usuarios
│   ├── controllers/             # Controladores HTTP
│   ├── routes/                  # Rutas operativas
│   ├── services/                # Reglas de negocio
│   ├── domain/                  # Entidades y errores
│   ├── infrastructure/database/ # Modelos, conexión y repositorios
│   ├── adapters/                # Adaptadores y compatibilidad
│   └── browser/                 # Scripts TypeScript del navegador
├── views/                       # Plantillas EJS
├── public/css/                  # Estilos
├── public/js/                   # Asistente y administración de usuarios
├── public/uploads/              # Fotografías, persistidas en Docker
├── scripts/build.js             # Compilación
└── tests/
    ├── postman/                # Colecciones Postman
    └── k6/smoke.js             # Comprobaciones de lectura
```

`dist/` y `public/assets/` son resultados generados de la compilación; no se editan como fuentes principales.

## Pruebas

### Postman

Importa una colección desde `tests/postman/`. Este ZIP contiene:

- `crm.postman_collection.json`
- `CRM_postman_collection_17_10_26.json`

Configura sus variables de entorno o colección según corresponda, especialmente `baseUrl` y el ID de un ticket que exista en tu base. La colección principal se diseñó como comprobación de rutas y respuestas de lectura; verifica su contenido antes de ejecutarla contra datos importantes.

### k6

Con k6 instalado:

```bash
k6 run tests/k6/smoke.js
```

Para cambiar el host y el ticket usado:

```bash
k6 run -e BASE_URL=http://127.0.0.1:3031 -e TICKET_ID=2 tests/k6/smoke.js
```

El ID `2` es un ejemplo y puede no existir después de borrar o sustituir los datos de demostración. **Atención:** las comprobaciones de lectura heredadas pueden necesitar autenticación tras la incorporación del login y los roles. Su presencia en `tests/` no demuestra que sean exitosas en todas las configuraciones actuales; no se ejecutaron como parte de esta revisión documental.

## Seguridad y limitaciones

- El proyecto está preparado principalmente para desarrollo y pruebas locales. `compose.yaml` incluye contraseñas de MySQL de demostración y publica el CRM solamente en `127.0.0.1`.
- No expongas estas credenciales ni esta configuración de ejemplo a Internet. Antes de un despliegue público, configura HTTPS, secretos propios y protecciones adicionales contra intentos reiterados de acceso.
- La cookie de sesión puede marcarse `Secure` estableciendo `COOKIE_SECURE=true` en el **entorno del contenedor/app** y usando HTTPS. Agregar la variable al `.env` no basta si Compose no la pasa al servicio.
- La implementación restringe métodos y rutas para los técnicos; no existe una matriz completa de permisos granulares por campo o por ticket.
- Las rutas de eliminación de datos maestros bloquean registros relacionados: no hay en esta versión un mecanismo de borrado forzado.
- Se incluyen pruebas de lectura, pero no una suite integral automatizada para verificar todas las acciones visuales, permisos, escrituras y ciclos de tickets.

## Solución de problemas

**Los contenedores no arrancan:** revisa `docker compose ps -a` y `docker compose logs --tail=100 db app`. Si MySQL aparece como `unhealthy`, comprueba la configuración de la base, los scripts de inicialización y los permisos del volumen; no borres volúmenes como primer intento de solución.

**Compose pide `CRM_ADMIN_EMAIL` o `CRM_ADMIN_PASSWORD`:** confirma que existe `.env` en la misma carpeta que `compose.yaml` y que ambas variables tienen valores.

**El usuario inicial no es administrador:** comprueba que su correo sea exactamente `admin@gmail.com`. El código solo asigna ese rol a esa dirección.

**Cambiar `.env` no cambia la contraseña:** las credenciales del usuario inicial se usan al crear la primera cuenta en una tabla `usuarios` vacía. Los cambios posteriores requieren una actualización de la cuenta, no un reinicio del contenedor.

**El puerto 3030 está ocupado:** usa `CRM_HTTP_PORT=3031` en el comando de arranque o detén la aplicación que ya ocupa el puerto.

**No se puede eliminar un registro relacionado:** actualmente es una restricción del servicio de datos maestros; el servidor devuelve un conflicto en vez de realizar un borrado forzado.
