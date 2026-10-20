# CRM de servicios técnicos

Aplicación para clientes, técnicos, tickets, unidades, equipos, accesorios y
fotografías de servicios. El código propio está en TypeScript y utiliza Node.js
22, Express, EJS, Sequelize y MySQL 8.4. La interfaz conserva Bootstrap y sus
textos en español. El código y los identificadores internos se mantienen en
inglés; la documentación se redacta en español.

## Ejecución con Docker

```bash
docker compose up --build -d --wait
```

Abrir http://localhost:3030. Si el puerto está ocupado:

```bash
CRM_HTTP_PORT=3031 docker compose up --build -d --wait
```

Compose configura la base `crm_demo`, independiente de la instalación local, y
no utiliza el `.env` del proyecto. MySQL no se publica en el host; la aplicación
se publica en loopback. Las contraseñas incluidas son de desarrollo.

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
npm start
```

Variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `PORT`.
Los puertos deben estar entre 1 y 65535. El servidor autentica MySQL antes de
escuchar y `/health` comprueba su disponibilidad.

Solo se conservan tres comandos npm: comprobación estática, compilación y
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
| `tests/postman/`, `tests/k6/` | Las únicas comprobaciones funcionales mantenidas |

Todos los módulos de `src/` tienen referencias desde el servidor, el navegador o
sus tipos. Las plantillas, estilos y el script de `public/js/` están en uso. La
coincidencia entre fuentes TypeScript y salidas JavaScript es parte de la
compilación, no código residual.

Se retiraron las suites Node/Playwright, fixtures, reportes, el Compose de pruebas,
Prettier, la configuración de tipos de pruebas y las utilidades anteriores de
limpieza, desarrollo y smoke. La documentación se consolidó en este archivo. La
historia de esas pruebas sigue disponible en Git; ya no forman parte de la suite
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

## Tickets y espacio de trabajo del servicio

El menú **Tickets** abre `/tickets`, una bandeja con búsqueda por número, cliente
o técnico, filtros por estado, cliente, técnico y fechas del servicio. MySQL
aplica la búsqueda y la paginación; el selector de 5, 10, 25 o 50 filas está al
pie. Los filtros quedan en la URL y se conservan al cambiar de página.
`/estado_tickets` continúa mostrando esta misma bandeja.

**Nuevo ticket** abre `/tickets/nuevo`. Al guardar, el flujo normal abre
`/detalle_ticket/<id>`. La guía de inicio usa `/tickets/nuevo?setup=ticket` y
conserva el regreso al dashboard con `setupTicketCreated=1`; el enlace anterior
`/tickets?setup=ticket` también sigue funcionando.

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
80% con los botones **Omitir** de esos pasos deshabilitados. Para probarla desde
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
k6 run tests/k6/smoke.js
# Otra dirección o ticket existente:
k6 run -e BASE_URL=http://127.0.0.1:3031 -e TICKET_ID=2 tests/k6/smoke.js
```

Ambos archivos comprueban mediante GET salud, páginas, APIs de lectura, módulos
compilados, estilos y Bootstrap. Requieren un ticket existente y al menos una marca
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

API para la nueva interfaz, Astro/Tailwind, exportación descargable PDF/Excel/Word,
correo, ampliación de Postman y k6, pruebas de navegador (por ejemplo, Playwright)
para el comportamiento del asistente de inicio y preparación del despliegue de la
demo.
