# CRM de servicios técnicos

Aplicación para clientes, técnicos, tickets, unidades, equipos, accesorios y
fotografías de servicios. El código propio está en TypeScript y utiliza Node.js
22, Express, EJS, Sequelize y MySQL 8.4. La interfaz conserva Bootstrap y sus
textos en español. El código y los identificadores internos se mantienen en
inglés; la documentación se redacta en español.

## Requisitos de configuración y correo

**El CRM envía todos sus correos mediante Nodemailer y SMTP de Gmail.** Configura
`GMAIL_USER` y `GMAIL_APP_PASSWORD` con una contraseña de aplicación de la cuenta
remitente. No utilices la contraseña normal de Google.

Esta configuración es necesaria para completar el login con 2FA, recuperar
contraseñas y enviar el correo de prueba. Sin SMTP operativo, el servidor puede
arrancar, pero no se podrá completar un nuevo login porque no podrá entregar el
código. `AUTH_2FA_TO` vacío envía los códigos al correo de cada usuario; un valor
explícito conserva un destinatario compartido para pruebas.

Copia `.env.example` a `.env` y completa sus valores antes de iniciar. El archivo
`.env` es privado y está excluido tanto de Git como de la imagen Docker. La
plantilla contiene nombres de variables y ejemplos genéricos, sin contraseñas ni
API keys. Nunca subas configuraciones reales, llaves privadas ni volcados de DB.

## Ejecución con Docker

Define `DOCKER_DB_PASSWORD`, `DOCKER_DB_ROOT_PASSWORD`, `CRM_ADMIN_EMAIL`,
`CRM_ADMIN_PASSWORD` y las credenciales SMTP de Gmail en `.env`. Para una base
existente, utiliza las credenciales actuales: cambiar estas variables no modifica
las contraseñas almacenadas en un volumen MySQL ya inicializado.

```bash
docker compose build app
docker compose up -d --wait db
docker compose run --rm --no-deps app npm run migrate
docker compose up -d --wait app
```

Abrir http://localhost:3030. Si el puerto está ocupado:

```bash
CRM_HTTP_PORT=3031 docker compose build app
docker compose up -d --wait db
docker compose run --rm --no-deps app npm run migrate
docker compose up -d --wait app
```

Compose usa `DOCKER_DB_NAME` y `DOCKER_DB_USER` (por defecto `crm_demo` y `crm`),
y exige las contraseñas `DOCKER_DB_PASSWORD` y `DOCKER_DB_ROOT_PASSWORD` del `.env`.
Las variables `DB_*` se reservan para la ejecución local sin Docker. MySQL no se
publica en el host; la aplicación se publica en loopback. No se incluyen
contraseñas predeterminadas.

El Dockerfile comprueba los tipos, compila desde las fuentes e instala únicamente
las dependencias de ejecución en la imagen final. Copia a la imagen las vistas, los
estilos (`public/css/`) y el script del asistente de inicio (`public/js/`). No
incorpora herramientas de pruebas, colecciones, compilador ni documentación.
Algunos recursos de interfaz siguen cargándose desde CDNs y requieren conexión a
Internet.

El nombre del proyecto Compose (`name:` en `compose.yaml`, o la opción `-p`) decide
qué contenedores y volúmenes se usan. Si ya existe una instancia con otro nombre y
quieres actualizarla conservando sus datos, usa el mismo nombre:

```bash
docker compose up --build -d --wait
```

## Ejecución local

Preparar una base MySQL y su usuario. Aplicar `docker/mysql/init/001-schema.sql`
y, opcionalmente, `002-demo.sql`. Copiar `.env.example` a `.env` si todavía no
existe configuración local.

```bash
npm ci
npm run typecheck
npm run build
npm run migrate
npm start
```

Variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `PORT`.
Los puertos deben estar entre 1 y 65535. El servidor autentica MySQL antes de
escuchar y `/health` comprueba su disponibilidad.

Los comandos npm cubren comprobación estática, compilación, migraciones y
arranque. Para aplicar cambios locales, detener el servidor, recompilar y volver
a iniciarlo. La compilación limpia `dist/` y `public/assets/` para evitar salidas
obsoletas; no elimina fotografías ni datos.

## Archivos necesarios

| Ubicación | Función |
|---|---|
| `src/server.ts`, `src/app.ts`, `src/config.ts` | Arranque, Express y configuración |
| `src/domain/`, `src/services/` | Entidades, validaciones y reglas de negocio |
| `src/controllers/`, `src/routes/`, `src/adapters/` | HTTP, renderizado y compatibilidad con formularios |
| `src/infrastructure/database/` | Conexión, modelos tipados, relaciones y consultas |
| `src/browser/` | Lógica de las páginas y módulos compartidos del navegador |
| `views/`, `public/css/`, `public/js/` | Las plantillas EJS, los estilos activos y el script del asistente de inicio |
| `public/uploads/` | Fotografías persistidas; no se eliminan durante la limpieza |
| `dist/`, `public/assets/` | JavaScript generado necesario para ejecutar la aplicación |
| `scripts/build.js` | Compilación reproducible de ambos destinos |
| `tsconfig.json`, `tsconfig.browser.json` | Configuraciones del servidor y navegador |
| `package.json`, `package-lock.json` | Comandos y dependencias reproducibles |
| `Dockerfile`, `compose.yaml`, `docker/mysql/init/` | Entorno, persistencia e inicialización de demo |
| `.env.example`, `.gitignore`, `.dockerignore` | Configuración de ejemplo y exclusiones |
| `tests/postman/`, `tests/k6/`, `tests/node/` | Comprobaciones HTTP y reglas de integración |

Todos los módulos de `src/` tienen referencias desde el servidor, el navegador o
sus tipos. Las plantillas, estilos y el script de `public/js/` están en uso. La
coincidencia entre fuentes TypeScript y salidas JavaScript es parte de la
compilación, no código residual.

En la reorganización inicial se retiraron las suites Node/Playwright, fixtures, reportes, el Compose de pruebas,
Prettier, la configuración de tipos de pruebas y las utilidades anteriores de
limpieza, desarrollo y smoke. La documentación se consolidó en este archivo. La
historia de esas pruebas sigue disponible en Git; no forman parte de la suite heredada
actual. El SQL histórico, las notas locales y el reset antiguo se retiraron del
directorio de trabajo con una copia temporal fuera del proyecto.

## Catálogos unificados

La pantalla `/catalogos` reúne Equipos, Unidades y Accesorios en tarjetas
horizontales a todo el ancho disponible, una debajo de otra. Cada catálogo tiene búsqueda independiente
(por marca o modelo, o por nombre para accesorios), paginación y selección de
5, 10, 25 o 50 filas. MySQL aplica los filtros y límites antes de devolver los
registros. Los filtros y páginas se conservan en la URL y tras guardar cambios.

Cada tarjeta permite agregar, editar y eliminar registros con las validaciones
existentes. Las rutas `/equipos`, `/unidades` y `/accesorios` también muestran la
pantalla unificada para conservar los enlaces anteriores. El asistente de inicio
abre el catálogo correspondiente y conserva el regreso a la guía al registrar.

## Directorio unificado

El menú **Directorio** abre `/directorio` y reúne **Clientes** y **Técnicos** en
dos tarjetas a todo el ancho, una debajo de otra. Clientes permite buscar por
empresa, encargado o teléfono; Técnicos por nombre o teléfono y por estado
Activo/Inactivo. Cada tarjeta tiene su propia paginación y selector de 5, 10, 25
o 50 filas al pie. MySQL aplica los filtros y límites; cambiar una tarjeta
conserva los filtros y la página de la otra.

Registrar, editar y eliminar usan modales con validación y errores dentro del
formulario. Guardar conserva el contexto; cerrar o salir advierte si hay cambios
pendientes. Los registros con tickets asociados muestran la restricción de
eliminación, que también se comprueba en el servidor. Un técnico puede
inactivarse para evitar nuevas asignaciones sin perder sus servicios existentes.

`/clientes` y `/tecnicos` siguen abriendo la pantalla unificada y enfocan su
sección. Las entradas `?setup=clients` y `?setup=technicians` conservan el regreso
a la guía después de registrar. Los POST anteriores siguen aceptando formularios
tradicionales y devuelven redirecciones; con `Accept: application/json` devuelven
`{ success, redirect }` para mantener los errores dentro del modal.

## Inventario de equipos

El menú **Inventario** abre `/inventario`; `/registro_equipos` conserva el acceso
anterior a la misma pantalla. El inventario reúne los dispositivos físicos, con
búsqueda por marca, modelo, IMEI, módem o número de equipo, filtros por marca,
modelo y estado, y paginación de 5, 10, 25 o 50 filas al pie. MySQL aplica los
filtros y límites; la URL conserva la búsqueda al cambiar de página.

Los conteos generales muestran total, disponibles, asignados e instalados. En la
interfaz, **Disponible** corresponde al estado existente `En espera` de MySQL.
Cada dispositivo vinculado muestra su unidad y un enlace al ticket. Las marcas
y modelos siguen administrándose desde Catálogos.

Cada fila permite **Editar** marca/modelo, IMEI/serie e ID del módem, incluso si
el equipo está asignado o instalado. La edición conserva su estado y su vínculo
con la unidad. El modal advierte sobre la restricción de eliminación y conserva
los datos si falla el guardado. **Eliminar** solicita confirmación y solo está
disponible para equipos sin unidad vinculada. El servidor comprueba nuevamente
el vínculo dentro de una transacción y rechaza la eliminación con HTTP 409 si
el equipo ya está asignado, también en servicios finalizados.

`PATCH /equipos/:id` actualiza los datos de captura usando `id_equipo_modelo`,
`imei` e `id_modem`; `DELETE /equipos/:id` elimina un dispositivo sin asignación.
Ambos devuelven JSON y conservan la búsqueda y paginación al volver al inventario.

**Registrar equipo** abre un modal con búsqueda de modelo, IMEI y módem. La
confirmación conserva los filtros y permite localizar el nuevo equipo. Los
formularios y sus validaciones se comparten con el selector de equipos de
Asignaciones y del detalle del ticket: **Registrar equipo sin salir del ticket**
crea el dispositivo y lo selecciona para la unidad actual, conservando las otras
selecciones y accesorios pendientes. Su vínculo se confirma al guardar las
asignaciones; antes permanece disponible en inventario.

`POST /add_equipo` devuelve HTTP 201 con `{ success, data }` cuando se solicita
`Accept: application/json`. Los formularios tradicionales conservan una
redirección al inventario. Los errores de registro se muestran dentro del
formulario y permiten corregir los datos sin perder el contexto.

## Tickets y espacio de trabajo del servicio

El menú **Tickets** abre `/tickets`, una bandeja con búsqueda por número, cliente
o técnico, filtros por estado, cliente, técnico y fechas del servicio. MySQL
aplica la búsqueda y la paginación; el selector de 5, 10, 25 o 50 filas está al
pie. Los filtros quedan en la URL y se conservan al cambiar de página.
`/estado_tickets` continúa mostrando esta misma bandeja.

**Nuevo ticket** abre un panel dentro de la bandeja, sin cambiar de página ni
perder filtros. **Volver a la bandeja** conserva el borrador en memoria y permite
retomarlo con **Continuar borrador**; atrás y adelante del navegador también
alternan el panel. El borrador no se conserva al recargar o abandonar la página:
si hay cambios, el navegador advierte antes de salir. `#nuevo-ticket` abre el panel
directamente. El formulario y los selectores se comparten con `/tickets/nuevo`,
que sigue disponible como acceso independiente y alternativa si falla la carga.

Al guardar desde el panel, las validaciones se muestran dentro del formulario y
se bloquean los controles durante la solicitud para evitar envíos repetidos.
El éxito abre `/detalle_ticket/<id>`; **Volver a Tickets** conserva búsqueda,
estado, cliente, técnico, fechas, filas y página originales. El contexto también
se conserva al editar comentarios, técnico, ubicación, evidencias y al finalizar
o reabrir. Los destinos de regreso aceptan solo `/tickets` y filtros conocidos.

La guía de inicio usa `/tickets/nuevo?setup=ticket` y
conserva el regreso al dashboard con `setupTicketCreated=1`; el enlace anterior
`/tickets?setup=ticket` también sigue funcionando.

`POST /add_ticket` conserva la redirección tradicional. Con
`Accept: application/json` devuelve HTTP 201 y `{ success, ticketId, redirect }`.
El panel usa esta respuesta para mantener los datos ante errores. Los módulos del
formulario y el mapa se inicializan al abrirlo, sin solicitar mosaicos en la bandeja.

El formulario separa cliente, servicio, técnico, ubicación e indicaciones. En
escritorio agrupa los datos y el mapa en dos columnas; en móvil apila las tarjetas.
**Crear ticket** es la acción principal al pie. El técnico queda pendiente por
defecto; **Quitar técnico** aparece únicamente después de seleccionar uno.

El detalle reúne información, técnico, ubicación, comentarios, unidades, equipos,
accesorios, evidencias y cierre. Los formularios y módulos de preparación se
comparten con la bandeja de Asignaciones. Al guardar unidades, equipos o accesorios,
el usuario permanece dentro del mismo ticket. Los equipos guardados se pueden
liberar y los accesorios se pueden agregar o quitar desde sus tarjetas.

La preparación muestra unidades registradas y unidades con equipo respecto a la
cantidad prevista; su porcentaje combina ambos conteos. La siguiente acción
orienta al registro, a la asignación o a revisar y finalizar el servicio. El botón
de cierre se habilita cuando todas las unidades previstas tienen equipo. Si hay
asignaciones sin guardar, se solicita guardarlas antes de cambiar el estado y se
confirma su descarte al guardar otros formularios. Los tickets finalizados muestran
su información y evidencias para consulta e impresión; reabrir conserva sus datos.

## Ubicación del servicio en mapa

La creación y el detalle del ticket integran Leaflet con mapas de OpenStreetMap,
sin clave de Google. Al crear o editar la ubicación se puede seleccionar un punto,
mover el marcador, capturar latitud/longitud o solicitar **Usar mi ubicación**.
Esta última opción requiere permiso del navegador y HTTPS o localhost; obtiene la
ubicación del dispositivo del operador. No se solicita automáticamente.

Se guarda un enlace con coordenadas en el campo existente `Link_maps`, sin cambios
al esquema ni migración de tickets. El detalle muestra el marcador de consulta;
los servicios abiertos permiten modificarlo y **Quitar ubicación** guarda `NULL`.
Este control aparece solo si hay un enlace o coordenadas capturadas. Las coordenadas
manuales se encuentran en una sección desplegable debajo del mapa. La creación no
duplica el visor con un botón para abrir un mapa externo.
Los cambios de coordenadas también se aplican al guardar el formulario. Crear y
editar validan que los enlaces usen HTTP o HTTPS.

Los enlaces anteriores se conservan. Se reconocen coordenadas explícitas de Google
Maps (`q`, `query`, rutas `/maps/search/latitud,longitud` o datos del lugar) y
OpenStreetMap (`mlat`, `mlon`). Un centro de vista de Google (`@lat,lng`) no se
interpreta como ubicación del servicio.

Pegar un enlace corto de `maps.app.goo.gl` o `goo.gl/maps` inicia su conversión.
**Reintentar ubicación** aparece solo si falla la conversión. El servidor sigue las
redirecciones y, si el destino contiene un punto explícito, el formulario muestra
sus coordenadas y sustituye el enlace por uno con ese punto. Guardar confirma el
cambio; mientras la conversión está en curso se solicita esperar. Una respuesta
tardía no sobrescribe una selección manual. Si no se obtiene un punto preciso,
se conserva el enlace y se permite seleccionarlo manualmente o guardar el original.

En tickets anteriores, el mapa resuelve automáticamente el enlace corto al mostrar
la sección, sin modificar la base. Editar y guardar permite conservar la conversión.
El detalle ofrece **Agregar ubicación** o **Editar ubicación** según el estado,
además de **Abrir en Maps** cuando hay un enlace. El enlace original y su copia se
consultan en un desplegable; no se muestran botones deshabilitados para ubicaciones
pendientes.
No se incluye búsqueda ni autocompletado de direcciones.

`POST /tickets/resolver_ubicacion` recibe `{ url }` y devuelve
`{ success: true, data: { lat, lng, normalizedUrl } }`. Acepta únicamente HTTPS y
dominios/rutas conocidos de Google Maps, también en cada redirección; rechaza
credenciales y puertos alternos. Solo lee encabezados, sin descargar ni analizar
las páginas. Tiene un límite de cinco redirecciones, ocho segundos de espera,
cuatro conversiones concurrentes y treinta solicitudes por IP por minuto. Las
conversiones exitosas se reutilizan durante treinta minutos (hasta 256 enlaces).
Estos límites y la caché viven en memoria por instancia. No requiere una clave de
Google; depende de que Google mantenga accesibles los enlaces y su formato.

Leaflet, sus estilos e iconos se sirven localmente en `/leaflet`; solo el mapa base
requiere Internet. Si falla, se conserva la captura de coordenadas y el enlace.
Las pruebas de navegador usan mosaicos simulados; la disponibilidad externa se
comprueba por separado.

Los mosaicos públicos de OSM tienen atribución obligatoria, capacidad limitada y
disponibilidad sin garantía: [política de uso](https://operations.osmfoundation.org/policies/tiles/).
El visor solicita mosaicos solo al mostrar el mapa, conserva la atribución y usa
la caché normal del navegador. Para cambiar de proveedor se pueden definir
`MAP_TILE_URL` y `MAP_TILE_ATTRIBUTION`; en Docker, Compose toma esas dos variables
del entorno o del `.env`. Si no se definen, se usan los valores de OpenStreetMap.

## Asignaciones de unidades y equipos

`/asignaciones` reúne la selección del ticket, el registro de sus unidades y la
asignación de equipos y accesorios. El menú tiene una sola entrada **Asignaciones**;
las rutas anteriores `/asignacion_unidades` y `/asignacion_equipos` siguen abriendo
la misma pantalla. Los enlaces de la bandeja pueden incluir `?ticket=<id>` para
abrir directamente el ticket elegido. El detalle integra estos mismos formularios.

La lista permite buscar por ticket, cliente o técnico, filtrar por etapa y elegir
5, 10, 25 o 50 filas por página. Estos filtros se aplican en el navegador sobre
los tickets abiertos cargados. Durante el registro se pueden quitar filas y confirmar
la reducción de la cantidad prevista; al guardar, se abre automáticamente la etapa
de equipos del mismo ticket. Las asignaciones de equipos pueden guardarse de forma
parcial y retomarse después. El progreso distingue equipos guardados y cambios
pendientes. Cambiar de ticket o salir avisa si hay datos sin guardar.

Las unidades registradas se pueden quitar desde Asignaciones o desde el detalle
mientras el ticket esté en seguimiento. La operación confirma el retiro, reduce
la cantidad prevista, libera el equipo al inventario, elimina los vínculos con
accesorios y recalcula el avance dentro de una transacción. Los catálogos no se
modifican. El ticket debe conservar al menos una unidad; los tickets finalizados
rechazan el retiro. Si hay selecciones de equipos sin guardar, la confirmación
advierte que se descartarán al retirar la unidad.

Los equipos y accesorios ya guardados se modifican desde el detalle del servicio. Los tickets finalizados no se pueden asignar desde esta
pantalla. Se conservan las validaciones y transacciones de los servicios actuales.

## Datos y operación

MySQL ejecuta el esquema y el dataset únicamente al inicializar un volumen vacío.
Reconstruir la aplicación no reinicia la base ni vuelve a insertar la demo. El
backend usa un registro de diez modelos y una sola instancia Sequelize. La
migración a TypeScript no cambió tablas, columnas ni restricciones SQL.

Las escrituras de datos maestros validan campos, longitudes, teléfonos y estados.
Las eliminaciones desde la aplicación comprueban referencias dentro de una
transacción. Inactivar un técnico conserva sus servicios y bloquea asignaciones
nuevas. Finalizar tickets exige todas las unidades previstas y sus equipos;
reabrir conserva equipos, accesorios y evidencias.

MySQL y fotografías usan volúmenes independientes.

```bash
docker compose ps
docker compose logs -f app db
docker compose stop
docker compose start
docker compose down
```

`down` conserva los volúmenes. Para eliminar explícitamente los datos y fotografías
de una demo desechable y recrearla:

```bash
docker compose down --volumes
docker compose up --build -d --wait
```

### Reinsertar la demo

`002-demo.sql` solo se ejecuta automáticamente con un volumen vacío. Para volver a
cargarla en una base ya creada, con las tablas vacías:

```bash
docker compose exec db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" < /docker-entrypoint-initdb.d/002-demo.sql'
```

El script usa identificadores fijos: si quedan registros previos, MySQL responderá
`Duplicate entry`. Para vaciar las tablas antes de reinsertar, respetando las
llaves foráneas (esto elimina también los tickets, porque se borran en cascada con
sus clientes):

```bash
docker compose exec db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "DELETE FROM Cliente; DELETE FROM Tecnicos; DELETE FROM Equipos_catalogo; DELETE FROM Unidades_catalogo; DELETE FROM Accesorios_catalogo;"'
```

Antes de borrar datos que quieras conservar, haz un respaldo:

```bash
docker compose exec db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -u "$MYSQL_USER" "$MYSQL_DATABASE" > /tmp/respaldo.sql'
docker cp <contenedor-db>:/tmp/respaldo.sql ./respaldo.sql
```

## Asistente de inicio

El dashboard muestra una guía de configuración con barra de progreso. Su lógica
está en `public/js/setup-wizard.js`, se carga desde `views/index.ejs` y sus
estilos están en `public/css/dashboard.css`.

| Paso | Progreso |
|---|---|
| Clientes | 25% |
| Técnicos (solo activos) | 25% |
| Catálogo de equipos | 10% |
| Catálogo de unidades | 10% |
| Catálogo de accesorios | 10% |
| Crear primer ticket | 20% |
| **Total** | **100%** |

Un paso cuenta como completado si la base tiene registros, o si se omite con
**Omitir**; al volver a pulsarlo ("Restaurar paso") deja de contar. **Omitir los
tres catálogos** actúa sobre los tres a la vez. **Omitir todos e ir a crear un
ticket** deja el progreso en 80% y abre la pantalla de tickets. El 20% final se
alcanza solo al guardar el primer ticket desde la guía; un ticket creado por otra
vía no suma.

La **X** cierra la guía y deja una tarjeta para volver a abrirla con **Mostrar
guía**. **Reiniciar guía** guarda el número actual de registros como punto de
partida y borra los pasos omitidos y la marca del ticket: la barra vuelve a 0% sin
tocar la base de datos, y un paso se completa solo al registrar algo nuevo
respecto a ese punto de partida.

El estado de la guía vive en el navegador (`localStorage`), no en la base:

| Clave | Contenido |
|---|---|
| `crmSetupSkippedStepsV1` | Pasos omitidos |
| `crmSetupAssistantDismissedV1` | Guía cerrada con la X |
| `crmSetupTicketCreatedV1` | Primer ticket guardado desde la guía |
| `crmSetupBaselineV1` | Registros existentes al pulsar **Reiniciar guía** |

Los conteos de registros los calcula `getSetupStatus`
(`src/infrastructure/database/dashboard-repository.ts`) y la vista los entrega
como `data-setup-count`. Como el estado es del navegador, cada navegador o perfil
tiene su propio progreso.

La base de demo trae clientes, técnicos y catálogos, así que la guía arranca en
80% con los botones **Omitir** de esos pasos deshabilitados. En bases con registros,
la guía comienza compacta bajo **Mostrar guía**, salvo que exista una preferencia
guardada o un regreso explícito desde el tutorial. Para probarla desde
cero usa **Reiniciar guía**, o limpia el navegador desde la consola:

```js
['crmSetupSkippedStepsV1','crmSetupAssistantDismissedV1','crmSetupTicketCreatedV1','crmSetupTicketDeferredV1','crmSetupBaselineV1'].forEach(k => localStorage.removeItem(k));
location.reload();
```

## Postman y k6

Importar `tests/postman/crm.postman_collection.json` en Postman. Ajustar `baseUrl`
(debe coincidir con el puerto publicado) y `ticketId` en las variables de la
colección; el ID predeterminado es `2`, que existe en el dataset de demo. La marca
para consultar modelos se obtiene durante la ejecución. La colección se ejecuta
desde Postman Desktop; no se incorpora un runner de Postman como dependencia o
utilidad del proyecto.

Con k6 instalado:

```bash
CRM_SESSION=TOKEN_DE_SESION_VERIFICADA k6 run tests/k6/smoke.js
# Otra dirección o ticket existente:
CRM_SESSION=TOKEN_DE_SESION_VERIFICADA k6 run -e BASE_URL=http://127.0.0.1:3031 -e TICKET_ID=2 tests/k6/smoke.js
```

Ambos archivos comprueban mediante GET salud, páginas, APIs de lectura, módulos
compilados, estilos y Bootstrap. También prueban el POST de lectura para resolver
un enlace con coordenadas explícitas, sin consultar servicios externos. Requieren un ticket existente y al menos una marca
en el catálogo. No modifican registros ni fotografías. k6 ejecuta una iteración
con un usuario virtual y exige que pasen todas las comprobaciones.

La colección de Postman verifica además el asistente de inicio: que el dashboard
incluya sus elementos (X, Omitir todos, Reiniciar guía), que ya no exista
"Omitir por ahora", que los seis pesos sumen 100, que cada paso con datos tenga
su contador, que `/js/setup-wizard.js` se sirva como JavaScript con su lógica, que
exista la regla de estilos del pie de la guía y que respondan las seis rutas
**Configurar**. El script k6 no incluye todavía estas comprobaciones.

Estas comprobaciones son una base de disponibilidad y contratos de lectura. Falta
trasladar a Postman las validaciones de escritura y el ciclo completo del ticket,
y definir escenarios de carga k6 sobre datos aislados. No sustituyen todavía la
cobertura de las suites retiradas ni prueban interacciones visuales del navegador:
el comportamiento de la guía (omitir, restaurar, reiniciar, cerrar y llegar a 100%)
se verifica de forma manual.


## Pendientes del proyecto

API para la nueva interfaz, Astro/Tailwind, exportación descargable PDF/XLSX/Word,
correo, ampliación de Postman y k6, pruebas de navegador (por ejemplo, Playwright)
para el comportamiento del asistente de inicio y preparación del despliegue de la
demo.

### Dashboard operativo

El inicio reúne servicios del día, estados abiertos y vencidos, seguido por
**Requieren atención**, agenda por día/semana/mes, carga de los cinco técnicos
con más servicios abiertos y los cinco modelos con menos equipos disponibles.
Finalizados y total histórico se identifican explícitamente como acumulados.
La fecha de cierre ya se registra; su incorporación a las métricas queda pendiente.

Los enlaces operativos abren `/tickets?attention=overdue|unassigned|incomplete|active`.
El filtro se combina con cliente, técnico, estado y fechas, conserva paginación y
regreso desde el detalle. Los grupos pueden solaparse y excluyen finalizados.
La preparación usa las unidades reales: cantidad registrada igual a la prevista,
mayor que cero, y todas con equipo; no depende del indicador almacenado.

El día operativo se calcula en `America/Mexico_City`. Las fechas de servicio
mantienen la convención existente de captura civil (`datetime-local` almacenado
como UTC), sin desplazar horarios históricos. Vencido significa abierto con fecha
anterior al día operativo; los servicios sin fecha no se consideran vencidos.

La agenda consulta exclusivamente el periodo seleccionado, con límite de 200
servicios ordenados por fecha y un enlace a la bandeja para consultar el total.
En escritorio muestra cuadrícula mensual y en móvil una agenda vertical. La
agenda y las barras nativas de carga se renderizan en servidor y funcionan sin
FullCalendar ni Chart.js externos. El tutorial conserva sus pasos y preferencias.

Validación de reglas con registros temporales y limpieza por ID (base de demo):

```bash
npm run typecheck
npm run build
docker compose exec -T app node < tests/node/dashboard.cjs
CRM_SESSION=TOKEN_DE_SESION_VERIFICADA k6 run tests/k6/smoke.js
```

### Correo de prueba con Nodemailer

Único endpoint: `POST /api/email/test`. Requiere sesión de administrador o
coordinador. No requiere interfaz ni modifica datos del CRM. Usa la misma cuenta
Gmail configurada para el login y la recuperación: `GMAIL_USER` y
`GMAIL_APP_PASSWORD`. Compose transmite estas variables al contenedor.

```bash
curl -X POST http://localhost:3030/api/email/test \
  -H 'Content-Type: application/json' \
  -H 'Cookie: crm_session=TOKEN_DE_SESION_VERIFICADA' \
  -d '{"to":"destinatario@example.com"}'
```

Puede enviarse `{}` si se configuró `MAIL_TEST_TO`. Asunto y texto son fijos.
La respuesta exitosa es HTTP 200 con `{success:true, message, data:{id,to,provider}}`
y `provider: "gmail"`. Significa aceptación por SMTP, no confirmación de entrega
en la bandeja. Se devuelve 503 si falta configuración y 502 si Gmail rechaza el
envío. La prueba no agrega validaciones de destinatario ni reintentos automáticos.

## Login y administración de usuarios

La integración manual de `feature/v3` conserva las pantallas actuales. Acceder a
`/login` y usar una cuenta del CRM. La instancia habitual configura el primer
administrador mediante `CRM_ADMIN_EMAIL` y `CRM_ADMIN_PASSWORD` en `.env`; Compose
transmite ambas variables. Solo se utilizan si la tabla `usuarios` está vacía.
La contraseña debe tener entre 12 y 1024 caracteres. No hay contraseña predeterminada
ni correo fijo con privilegios, y cambiar `.env` no modifica cuentas existentes.

Las sesiones viven en MySQL, duran doce horas y se cierran con `POST /logout`.
Administrador y coordinador mantienen los flujos operativos; solo el administrador
accede a `/usuarios` para crear, editar o eliminar cuentas, incluidas las administradoras,
con protección del último administrador y sin eliminación de la propia cuenta.
El técnico puede consultar dashboard, bandeja, detalles, evidencias y mapas, y
finalizar servicios preparados. No puede crear/editar recursos, subir fotos o
reabrir tickets. Las cuentas técnicas deben vincularse a un técnico activo del catálogo; solo
pueden consultar y finalizar sus tickets asignados.

El schema base incluye las tablas de autenticación y `npm run migrate` adapta
las bases existentes. El arranque no crea ni modifica tablas; comprueba el esquema
y prepara la cuenta inicial si no existen usuarios. No degrada administradores
existentes. Si ya hay usuarios y ninguno es administrador, detiene el arranque
con una explicación para resolver esa condición de forma controlada.

Para Postman, configurar `authEmail` y `authPassword`, ejecutar **Login** primero y
usar la cookie guardada por la colección. El endpoint de correo también requiere
sesión de administrador o coordinador. k6 recibe `CRM_SESSION`, obtenida después de verificar el código por correo,
y cierra esa sesión al terminar.

La cookie es HttpOnly y SameSite=Lax. En HTTPS configurar `COOKIE_SECURE=true`.
El login limita solicitudes por IP; para desarrollo, después de comprobar el
bloqueo, reiniciar la aplicación restablece el contador. La auditoría y la matriz
de permisos se documentan en [docs/login-audit.md](docs/login-audit.md).


### Cuenta Gmail dedicada para el CRM

Todos los flujos usan Gmail mediante SMTP con Nodemailer. No se crea una cuenta
Google automáticamente. Crear o elegir una cuenta exclusiva del CRM, activar su
verificación en dos pasos y generar una contraseña de aplicación para el CRM:
https://myaccount.google.com/apppasswords. La disponibilidad depende de la cuenta
Google. No usar la contraseña habitual de inicio de sesión.

Configurar directamente en `.env`:

```dotenv
GMAIL_USER=tu-cuenta-del-crm@gmail.com
GMAIL_APP_PASSWORD=CONTRASENA_DE_APLICACION
MAIL_TEST_TO=destinatario@example.com
```

`GMAIL_APP_PASSWORD` admite el formato con espacios mostrado por Google; el
servidor los elimina. No incluir secretos en Git, Postman ni el cuerpo del POST.
El remitente visible es `CRM TSV <GMAIL_USER>`, por lo que las respuestas llegan a
esa cuenta. Gmail aplica sus límites y controles; no se garantiza entrega en
bandeja principal. No se permite escoger un remitente diferente desde el body.

```bash
docker compose up --build -d --wait app
```

Después de iniciar sesión, enviar `POST /api/email/test` con
`{"to":"otro-destinatario@example.com"}`. Si se omite `to`, se usa `MAIL_TEST_TO`
y la respuesta incluye `provider: "gmail"`.
Se devuelve 503 cuando falta la configuración y 502 si el envío SMTP falla. No
se agregan reintentos ni validaciones de destinatario a la prueba mínima.

## Segundo factor por correo

El login ahora exige contraseña **y** un código aleatorio de seis dígitos enviado
mediante Nodemailer y SMTP de Gmail. El login,
la recuperación y el correo de prueba comparten `src/services/email-service.ts`.

Si se configura `AUTH_2FA_TO=correo-personal@example.com`, todos los códigos
llegan al destinatario compartido. Esta modalidad de pruebas no verifica la
posesión del correo individual; en uso normal deja la variable vacía.
Al dejar `AUTH_2FA_TO` vacío, se envían al correo de cada cuenta.

Flujo:

1. `POST /login` con `correo` y `password` valida las credenciales y envía el código.
   Responde 302 a `/login/verificar`, establece `crm_pending` (HttpOnly, SameSite=Lax,
   ruta `/login`, cinco minutos) y elimina la cookie de sesión previa.
2. `GET /login/verificar` muestra el formulario solo si existe un desafío vigente.
3. `POST /login/verificar` con `code` (texto de seis dígitos, conserva ceros iniciales)
   crea la sesión de doce horas y redirige a `/` únicamente si el código es correcto.
4. `POST /login/cancelar` invalida el desafío y vuelve al login.

Hay un desafío vigente por cuenta, cinco intentos por código, cinco minutos de
caducidad y un minuto entre solicitudes de correo. Pedir uno nuevo requiere
volver al login e introducir de nuevo las credenciales; reemplaza al anterior.
La limitación por IP del login sigue activa y se restablece solo al completar
ambos pasos. El correo incluye la cuenta que intentó acceder.

La tabla `desafios_login` almacena hashes, no códigos ni tokens en texto plano.
El código usa HMAC con la cookie aleatoria como clave; contraseña/rol/correo se
vinculan al desafío. Editar o eliminar una cuenta invalida sus desafíos. La
verificación y el consumo son atómicos: un código no puede crear dos sesiones.
Si falla el envío, se elimina el desafío y no se emite una sesión.

La migración agrega `segundo_factor` a `sesiones_usuario`; las sesiones
anteriores a esta integración quedan inválidas y se requiere iniciar sesión otra
vez. Las tablas operativas y las cuentas existentes se conservan.

Pruebas aisladas con proveedor simulado (no envían correos ni publican códigos):

```bash
docker compose -p crm-auth-audit -f compose.yaml -f docker/compose.auth-audit.yaml up --build -d --wait
node tests/node/two-factor-audit.cjs
node tests/node/auth-audit.cjs
```

El Compose aislado monta `tests/node/mock-auth-mail.cjs`; la instancia habitual
usa `dist/server.js` y nunca carga ese simulador. Tras la prueba de bloqueo de
login, reiniciar solo el app de auditoría restablece su contador.

Postman: ejecutar **1. Login**, leer el código en el correo, completar `authCode`
y ejecutar **2. Verificar código**. La colección conserva la cookie pendiente y
luego la cookie de sesión. Solo entonces ejecutar las demás peticiones. El
proveedor aceptando el correo no confirma su llegada a la bandeja.


## Migraciones de base de datos

`docker/mysql/init/001-schema.sql` contiene el esquema completo de una instalación
nueva, incluidas `usuarios`, `sesiones_usuario` y `desafios_login`. Solo se aplica
automáticamente al inicializar un volumen MySQL vacío.

Para instalaciones existentes se ejecuta explícitamente `npm run migrate`.
El archivo `docker/mysql/migrations/001-authentication.sql` agrega las tablas que
falten, y `scripts/migrate.js` adapta las columnas históricas `rol` y
`segundo_factor`. No elimina cuentas, contraseñas, sesiones, desafíos ni registros
operativos; `usuario` se transforma en `coordinador` conservando administradores.

```bash
# Docker: construir primero y migrar con la base disponible, antes del app.
docker compose build app
docker compose up -d --wait db
docker compose run --rm --no-deps app npm run migrate
docker compose up -d --wait app

# Local: usar las variables DB_* del .env para la base que se quiere actualizar.
npm run build
npm run migrate
npm start
```

Las versiones aplicadas se registran en `schema_migrations`; repetir el comando
omite las que ya están registradas. Un bloqueo de MySQL por base impide ejecutar
dos migradores simultáneamente. MySQL confirma DDL implícitamente: una migración
fallida no tiene rollback automático, sus pasos admiten repetición y se registra
solo después de terminar correctamente. Respaldar la base antes de actualizarla.

El ejecutor y sus SQL se incluyen en la imagen de ejecución. No se ejecutan desde
`server.ts`, el servicio de desafíos ni cada login. Al faltar el esquema, el
arranque solicita ejecutar la migración. La limpieza de desafíos y sesiones
caducadas sigue siendo DML durante el arranque, separada de la creación de tablas.

Verificaciones aisladas de migración (bases temporales, sin tocar `crm_demo`):

```bash
docker compose -p crm-auth-audit -f compose.yaml -f docker/compose.auth-audit.yaml build app
docker compose -p crm-auth-audit -f compose.yaml -f docker/compose.auth-audit.yaml up -d --wait db
node tests/node/migrations-audit.cjs
```

Las migraciones ya aplicadas no deben editarse: agregar una nueva versión y
registrarla en `scripts/migrate.js`. La cuenta que ejecuta migraciones necesita
permisos DDL; la aplicación no los necesita para inicializar la autenticación
sobre un esquema actualizado. Esto se verifica en la suite con una cuenta de
prueba que solo tiene SELECT, INSERT, UPDATE y DELETE.


## Vinculación de usuarios y técnicos

En **Administrar usuarios**, crear o editar una cuenta con rol técnico y elegir
su **Técnico del catálogo**. Se requiere un técnico activo y cada técnico puede
estar vinculado a una sola cuenta. Las cuentas de administrador/coordinador no
usan este vínculo. El catálogo sigue separado del acceso: registrar un técnico
no crea una cuenta automáticamente.

La migración `002-user-technician` agrega `usuarios.id_tecnico`, una restricción
única y una clave foránea a `Tecnicos.ID_Tecnico`. El schema base incluye el mismo
vínculo. Las cuentas existentes quedan con NULL: no se asocian automáticamente
por nombre o correo. El administrador debe completar sus vínculos.

Las cuentas técnicas sin vínculo o con técnico inactivo no pueden operar ni
iniciar un nuevo login; el rechazo sucede antes de enviar un código. Una sesión
existente también queda bloqueada mientras el técnico esté inactivo. Puede cerrar
sesión y solicitar ayuda al administrador. Activarlo vuelve a habilitar su alcance
mientras la sesión siga vigente; cambiar el vínculo de una cuenta revoca sus
sesiones y códigos pendientes, exigiendo un nuevo login con segundo factor.

El servidor limita bandeja, filtros de clientes/técnicos, indicadores, calendario,
carga de trabajo y detalles al técnico conectado. No se confía en IDs enviados por
URL o formulario. La finalización verifica la asignación bajo bloqueo del ticket;
las fotografías se autorizan contra el ticket al que pertenecen. Reasignar un
servicio cambia inmediatamente qué técnico puede acceder. Los tickets sin técnico
quedan bajo gestión de administrador/coordinador.

No se puede eliminar un técnico con una cuenta vinculada. Se puede cambiar el
vínculo o eliminar la cuenta desde administración antes de eliminar el técnico,
siempre respetando las referencias a tickets. Inactivar conserva los registros.
El técnico mantiene sus operaciones existentes: consulta y finalización de
servicios preparados; no se amplían permisos de edición o carga de fotografías.

Para bases existentes ejecutar la migración antes de levantar la versión nueva:

```bash
docker compose build app
docker compose run --rm --no-deps app npm run migrate
docker compose up -d --wait app
```

Prueba aislada: `node tests/node/technician-access-audit.cjs` con el proyecto de
auditoría migrado y activo. Crea y limpia sus propias cuentas, servicios y archivos.
La vinculación de técnicos no modifica la cuenta Gmail ni `AUTH_2FA_TO`;
utiliza la misma configuración SMTP del login.


## Historial de tickets y fecha de cierre

El detalle del servicio incluye **Historial** desplegable, cerrado inicialmente,
con paginación independiente y filas por página. El enlace de navegación y los
cambios de página del historial lo abren automáticamente. Las acciones de
imprimir, finalizar y reabrir están al pie, después del historial. Muestra quién realizó cada cambio (correo y rol de la sesión),
cuándo ocurrió y los valores anteriores/nuevos. La atribución se obtiene en el
servidor: no se aceptan identificadores de usuario del formulario como autor.
Las operaciones internas sin sesión se identifican como **Sistema**.

Se registran creación de tickets, cambios de estado, técnico, comentarios,
ubicación, cantidad prevista y preparación; registro/retiro de unidades;
asignación/retiro de equipos y accesorios; y evidencias agregadas. Los eventos
se insertan en la misma transacción que los cambios. Si falla su escritura,
la operación se revierte. Guardar valores idénticos o repetir asignaciones ya
persistidas no agrega eventos. No se auditan consultas, cambios directos por SQL
ni ediciones de catálogos o datos del inventario desde este historial del ticket.

La migración `003-ticket-history` crea `ticket_historial` y agrega
`Tickets.Fecha_cierre`. El schema base contiene ambos para instalaciones nuevas.
El cierre registra el instante UTC real de la operación, no la fecha programada
del servicio. Al reabrir, la fecha del cierre actual vuelve a NULL; los cierres
anteriores permanecen en el historial. Cada cierre posterior registra su propia
fecha. Los servicios antiguos conservan fecha desconocida e historial vacío
hasta que tengan nuevas operaciones; no se reconstruyen datos inexistentes.

Se conserva una copia del correo y rol del autor incluso si se elimina su cuenta;
la referencia de usuario pasa a NULL. Al borrar un ticket se elimina su historial
por la relación de base de datos (la aplicación no expone una eliminación de
tickets en este flujo). El historial requiere acceso al propio ticket: un técnico
solo puede leerlo para sus servicios actuales, también tras una reasignación.
Las fechas del historial y del cierre se muestran en Ciudad de México.

Actualizar una instalación existente antes de iniciar la nueva imagen:

```bash
docker compose build app
docker compose run --rm --no-deps app npm run migrate
docker compose up -d --wait app
```

Archivos principales: `src/infrastructure/audit/context.ts`,
`src/infrastructure/database/ticket-history-repository.ts`,
`views/partials/ticket-history.ejs` y la migración SQL correspondiente. El contexto
usa AsyncLocalStorage para mantener el autor correcto entre peticiones simultáneas.

Auditoría aislada: `node tests/node/ticket-history-audit.cjs`. Crea y limpia sus
fixtures, incluidos archivos de evidencia y un disparador temporal para simular
fallos. Solo actúa sobre el proyecto `crm-auth-audit`; no envía correos reales.

Las referencias del historial muestran nombres de clientes/técnicos/accesorios,
modelo y placa/VIN de unidades, y modelo/IMEI de equipos, conservando su ID como
referencia secundaria. Los eventos nuevos guardan `beforeLabel`/`afterLabel`
junto a los IDs originales en el JSON, por lo que renombrar catálogos no altera
su descripción histórica. Los eventos anteriores sin snapshot se resuelven en
lectura con la información actual disponible, sin reescribirlos; al faltar un
registro se informa explícitamente. Los valores que no cambiaron (por ejemplo,
la unidad de un accesorio asignado) se muestran una sola vez como contexto.
Cada evento ocupa una sección compacta, con cambios en formato antes → después. No requiere una migración de esquema adicional.


## Exportación de tickets

En la bandeja, **Exportar CSV** descarga todos los resultados de los filtros
aplicados (búsqueda, atención, estado, cliente, técnico y fechas de servicio),
independientemente de la página y cantidad de filas visibles. Si cambias filtros,
aplícalos antes de descargar. El archivo UTF-8 con BOM es compatible con Excel;
no es un archivo XLSX. Si Excel no separa las columnas automáticamente, importa
el CSV indicando coma como delimitador y UTF-8 como codificación.

`GET /tickets/exportar` acepta los mismos filtros de `/tickets`. Requiere sesión
y segundo factor; administradores/coordinadores exportan su consulta completa,
y técnicos únicamente sus propios tickets, aunque alteren el filtro de técnico.
La descarga incluye ID, cliente, técnico, tipo de servicio, estado, unidades
previstas, preparación registrada, fechas de servicio/cierre, ubicación y
comentarios. No incluye el desglose de unidades, equipos, evidencias ni historial.
Las fechas programadas conservan la hora capturada; los cierres usan Ciudad de
México. Los cierres históricos desconocidos se dejan vacíos.

La consulta comparte filtros con la bandeja y lee lotes de 500 tickets por ID
descendente; la respuesta se transmite sin crear archivos ni cargar el conjunto
completo en memoria. Los cambios simultáneos pueden afectar el contenido: la
descarga no representa una instantánea transaccional. Los textos se escapan como
CSV y se neutralizan prefijos de fórmulas de hojas de cálculo. Cero resultados
produce un archivo con encabezados.

Validación aislada: `node tests/node/ticket-export-audit.cjs`, con el proyecto
`crm-auth-audit` actualizado y activo. Crea y limpia sus datos y sesiones de
prueba; verifica más de 500 resultados, filtros, permisos, fechas y escape CSV
sin enviar correos reales. Las métricas del dashboard permanecen pendientes.


## Recuperación de contraseñas

Desde **¿Olvidaste tu contraseña?** en el login, ingresa el correo de la cuenta.
La siguiente pantalla permite capturar el código de seis dígitos y la nueva
contraseña con confirmación (12 a 1024 caracteres). Se requiere el mismo navegador
que hizo la solicitud; no se envían contraseñas ni tokens por URL. La respuesta
es genérica para cuentas existentes/desconocidas y fallos del proveedor de correo.
Si el envío falla, no queda un código utilizable; revisar la configuración
del proveedor de correo y solicitar nuevamente cuando corresponda.

Se usa Nodemailer con Gmail y el destino `AUTH_2FA_TO` del login. Mientras esté
configurado, los códigos de todas las cuentas llegan a ese correo personal; la
recuperación depende del acceso a ese buzón. Dejar vacío `AUTH_2FA_TO` envía al
correo de cada cuenta mediante Gmail.
Los códigos de acceso y de recuperación son independientes y sus correos explican
para qué sirve cada uno. No se envían correos reales durante las auditorías.

La migración `004-password-recovery` crea `recuperaciones_password`; también está
en el schema base. Se ejecuta explícitamente con `npm run migrate` antes de
iniciar la nueva versión, nunca desde un endpoint o al arrancar la aplicación.
El token de navegador se guarda en cookie HttpOnly/SameSite=Lax limitada a
`/login/recuperar`, con Secure cuando corresponde. En DB se guardan el hash del
token, un HMAC del código y la huella de las credenciales, no el código en claro.

El código dura 10 minutos, admite cinco intentos y se consume en una transacción
con el cambio de contraseña y la revocación de todas las sesiones y desafíos de
login/recuperación. Dos canjes simultáneos solo permiten un cambio. Editar la
cuenta desde administración también invalida su recuperación. Un cambio de rol,
correo, contraseña o vínculo técnico invalida la huella anterior. Recuperar una
cuenta técnica no activa su técnico ni modifica sus permisos.

Hay un minuto de espera por cuenta entre envíos; pedir otro código válido
reemplaza el anterior. Durante esa espera, el mismo navegador conserva su token
vigente. Se limitan solicitudes a cinco y canjes a veinte por IP cada 15 minutos;
estos contadores están en memoria y se reinician al reiniciar la aplicación.
Los intentos por código y la espera por cuenta están en MySQL. No se configura
confianza automática en encabezados de proxy. Un despliegue con varias réplicas
necesitará un limitador compartido y configurar explícitamente el proxy confiable.

Solicitar un código no cambia la contraseña ni revoca sesiones. Solo al completar
el cambio se cierran las sesiones anteriores. No se crea una sesión automática:
el usuario vuelve al login y completa el 2FA habitual con la nueva contraseña.

Endpoints públicos, con comprobación de origen para POST:

- `GET /login/recuperar`: formulario de solicitud.
- `POST /login/recuperar`: `correo`; respuesta 302 y cookie `crm_recovery`.
- `GET /login/recuperar/restablecer`: formulario de código y contraseña.
- `POST /login/recuperar/restablecer`: `code`, `password`, `confirmPassword`, y
  cookie de recuperación; éxito HTML 200, datos/código inválidos 400, límite 429.

Pruebas: `node tests/node/password-recovery-audit.cjs` y
`node tests/node/migrations-audit.cjs`, usando solo el proyecto aislado
`crm-auth-audit`. La auditoría de recuperación crea y elimina una cuenta temporal,
valida un solo uso, caducidad, concurrencia, rollback, límites, revocación y 2FA.
Reiniciar la app aislada antes de repetirla restablece los límites por IP.


## Gestión de administradores

En **Administrar usuarios**, el rol **Administrador** está disponible al crear o
editar una cuenta. Solo otro administrador con sesión vigente y segundo factor
completo puede operar esta pantalla y sus endpoints; coordinadores y técnicos
no pueden crear ni modificar administradores. No se requieren nuevas tablas ni
migraciones para esta mejora.

Se pueden editar correo y contraseña del administrador actual, incluso si es
el único. Dejar la contraseña vacía conserva la existente. Guardar cualquier
edición revoca las sesiones, códigos de acceso y recuperaciones de esa cuenta.
Si editas tu propia cuenta, regresas al login y debes completar de nuevo el 2FA.
La recuperación por correo permanece disponible para las cuentas administradoras.

Siempre debe quedar al menos un administrador. El último no puede eliminarse ni
cambiar a otro rol: primero crea o promueve otra cuenta. La pantalla lo identifica
y deshabilita esas opciones; el servidor aplica la misma regla aunque se altere
el formulario. Tampoco se permite eliminar la propia cuenta, incluso si hay
más administradores: debe hacerlo otro administrador. Sí se permite cambiar el
propio rol cuando existe otro administrador, cerrando la sesión actual.

Cambiar de técnico a administrador/coordinador libera su vínculo del catálogo;
cambiar una cuenta a técnico requiere un técnico activo y disponible. El resto
de datos operativos y el historial conservan las relaciones existentes.

Las mutaciones de cuentas se serializan con `SELECT id,rol FROM usuarios ORDER BY
id FOR UPDATE` dentro de una transacción MySQL. Antes de mutar se vuelve a validar
el rol y la sesión del autor bajo bloqueo, para impedir que una petición que ya
pasó el middleware actúe después de ser revocada o degradada. El mismo bloqueo
protege el recuento de administradores entre procesos e impide que dos cambios
simultáneos dejen la aplicación sin administrador. Este bloqueo abarca el conjunto
de cuentas y está limitado a las operaciones de administración.

Pruebas: `node tests/node/admin-management-audit.cjs` crea y elimina una base
temporal dentro de `crm-auth-audit`, sin tocar cuentas reales ni enviar correos.
Valida creación, edición, promoción/degradación, permisos, revocación de sesiones,
protección del último administrador y solicitudes simultáneas o ya revocadas.
La auditoría general `node tests/node/auth-audit.cjs` incluye las nuevas reglas.


### Proveedor de correo compartido

Nodemailer usa SMTP de Gmail para códigos de acceso, recuperación y pruebas. El remitente es la cuenta `GMAIL_USER`; `GMAIL_APP_PASSWORD` se configura
solo en el `.env` privado y se normaliza quitando espacios. No se incorpora a Git,
a la imagen Docker ni al JavaScript del navegador. Compose la inyecta al proceso
del servidor. No se publica ningún puerto SMTP entrante.

Para entregar códigos a cada usuario, deja `AUTH_2FA_TO` vacío y comprueba que el
correo de la cuenta sea real y esté bajo su control. Un destinatario compartido
sigue disponible únicamente si se configura explícitamente para pruebas.

Validación sin envíos reales: `node tests/node/email-provider-audit.cjs`, después
de compilar y con la configuración de base de datos disponible. Las auditorías
de login y recuperación utilizan un proveedor simulado.
