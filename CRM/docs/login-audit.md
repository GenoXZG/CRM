# Integración y auditoría del login

Fecha: 2026-10-27. Origen: `origin/feature/v3` (`406f3a3`). Destino: código
actual de `feature/v2`, incluidas sus mejoras locales sin commit.

## Integración

Se incorporaron manualmente autenticación, administración de usuarios y sus
vistas. No se ejecutó un merge entre historiales independientes ni se reemplazaron
las pantallas operativas de v2. La navegación usa un parcial compartido y mantiene
Directorio, Inventario, Catálogos, asignaciones, mapas, dashboard y Resend.

Archivos principales: `src/auth.ts`, `src/user-admin.ts`, `src/app.ts`,
`src/server.ts`, `src/config.ts`, `views/login.ejs`, `views/usuarios.ejs`,
`views/partials/session-navigation.ejs`, `views/partials/session-bar.ejs`.

## Correcciones sobre la implementación recibida

- Se elimina el correo administrador fijo y la reasignación automática de roles.
  El primer administrador usa `CRM_ADMIN_EMAIL` y `CRM_ADMIN_PASSWORD` únicamente
  cuando no hay usuarios. Las cuentas administradoras existentes se conservan.
- La administración verifica el rol dentro de su router, además del middleware;
  se normalizan rutas para impedir eludir permisos mediante mayúsculas o escapes.
- Leaflet y los recursos de interfaz quedan accesibles. Un técnico puede resolver
  un enlace de mapa para consulta, pero no guardar cambios de ubicación.
- El técnico no recibe controles ni formularios de creación, edición, asignación,
  reapertura o carga de fotografías. Puede consultar y finalizar servicios
  preparados, conservando las validaciones del ciclo de vida.
- Login y cambios de contraseña/rol se serializan mediante bloqueo de la cuenta.
  Los cambios de cuenta revocan sesiones en la misma transacción. El borrado las
  elimina por clave foránea y un nuevo login rota el token anterior del navegador.
- Se limita el login a diez solicitudes por IP en quince minutos; un login exitoso
  reinicia su contador. El límite es en memoria, por instancia, y se reinicia al
  reiniciar el proceso; no es un contador distribuido.
- Contraseñas con scrypt y sal aleatoria; comparación de tiempo constante. Tokens
  aleatorios de 256 bits, guardados únicamente como SHA-256 en MySQL. Cookie
  HttpOnly, SameSite=Lax y caducidad absoluta de doce horas. COOKIE_SECURE configura
  Secure para despliegues HTTPS. Las fechas de sesión se comparan en UTC.
- Mutaciones de navegador rechazan Origin/Referer de otro origen. Clientes HTTP
  sin esos encabezados necesitan igualmente una sesión válida. No se agrega un
  mecanismo separado de token CSRF en esta integración.

## Permisos integrados

| Operación | Administrador | Coordinador | Técnico |
|---|---|---|---|
| Dashboard, bandeja y detalles de tickets | Sí | Sí | Sí |
| Crear/editar servicios y administrar recursos | Sí | Sí | No |
| Finalizar ticket preparado | Sí | Sí | Sí |
| Reabrir ticket | Sí | Sí | No |
| Consultar evidencias y mapas | Sí | Sí | Sí |
| Subir fotografías | Sí | Sí | No |
| Administrar cuentas, incluidos administradores | Sí | No | No |
| Endpoint de correo Resend | Sí | Sí | No |

Las cuentas técnicas ahora se vinculan a un técnico activo del catálogo y solo
acceden a sus tickets asignados, incluidos indicadores, agenda y fotografías. No
pueden finalizar servicios ajenos ni sin asignación. La restricción se aplica en
el servidor y en el cierre transaccional. La administración conserva acceso global.
La recuperación de contraseña ya está implementada con código temporal por correo,
revocación de sesiones y migración explícita `004-password-recovery`. La gestión
de administradores ya permite crear y editar estas cuentas, conservando al menos
un administrador e impidiendo la eliminación de la propia cuenta.

## Datos y arranque

El schema base y la migración explícita crean las tablas que falten. El servidor
no ejecuta CREATE/ALTER al arrancar. Una tabla histórica sin rol
recibe `coordinador`; el valor histórico `usuario` migra a `coordinador`. No se
alteran tablas de tickets, equipos, unidades, directorio o catálogos. Si existen
usuarios sin ningún administrador, el arranque falla con un mensaje explícito;
no eleva automáticamente permisos ni cambia contraseñas mediante `.env`.

## Verificaciones reproducibles

Instancia aislada, puerto 3031, proyecto y volúmenes `crm-auth-audit`. Sus
credenciales de prueba están exclusivamente en `docker/compose.auth-audit.yaml`.
No se usan para acceder a la instancia habitual.

```bash
npm run typecheck
npm run build
docker compose -p crm-auth-audit -f compose.yaml -f docker/compose.auth-audit.yaml up --build -d --wait
node tests/node/auth-audit.cjs
```

El último bloque de la auditoría comprueba el bloqueo por intentos; reinicia
solo la aplicación de prueba antes de repetir la suite o probar su login:

```bash
docker compose -p crm-auth-audit -f compose.yaml -f docker/compose.auth-audit.yaml restart app
```

La suite cubre: validación de login, rechazo anónimo, cookies y hash de sesión,
expiración, rotación, logout, permisos de los tres roles, variantes de rutas,
Origin inválido, CRUD de cuentas, duplicados, protección de administradores,
revocación al editar/eliminar, bloqueo de formularios de técnico, mapas, cierre
válido/inválido y actualización del equipo a instalado. Los fixtures se limpian
al terminar; el entorno sigue siendo desechable y separado del proyecto actual.

Smoke autenticado:

```bash
CRM_SESSION=TOKEN_VERIFICADO BASE_URL=http://127.0.0.1:3031 k6 run tests/k6/smoke.js
```

Postman: completar `authEmail`/`authPassword` y ejecutar primero **Login**. La
colección guarda la cookie en `sessionCookie`; eliminar ese valor al terminar
si se exporta la colección. No incluir credenciales reales en archivos versionados.

## Resultado de la ejecución

- TypeScript y compilación: correctos.
- Auditoría HTTP/SQL: 95 comprobaciones aprobadas.
- Smoke autenticado k6: 165 comprobaciones aprobadas.
- Navegador Chromium: 23 escenarios aprobados entre administrador, coordinador
  y técnico, con revisión móvil, formularios, filtros de usuarios, pantallas
  existentes y cierre de sesión; sin errores JavaScript.
- No se enviaron correos reales durante la auditoría. La integración con Resend
  conserva su implementación y queda protegida por sesión y rol.

Estos resultados corresponden al entorno aislado descrito. No equivalen a una
prueba de penetración completa ni a una validación de TLS o balanceo multiinstancia.


## Actualización: segundo factor por correo (2026-11-03)

El login de contraseña descrito arriba ahora es el primer paso. Se requiere además
el código de seis dígitos de Resend antes de abrir sesión. La matriz de permisos
se conserva. La instancia habitual usa el destino temporal común `AUTH_2FA_TO`;
la aislada usa exclusivamente un servicio de correo simulado, montado desde
`tests/node/mock-auth-mail.cjs`. No se agregó un bypass de segundo factor.

Ver `README.md`, sección **Segundo factor por correo**, para rutas, límites,
almacenamiento, migración de sesiones y ejecución de Postman/k6.

Resultado de la actualización 2FA:

- 51 comprobaciones específicas de códigos temporales aprobadas.
- 137 comprobaciones de autenticación, roles, CRUD y ciclo de vida aprobadas.
- 165 verificaciones HTTP autenticadas aprobadas.
- 17 comprobaciones de navegador entre los tres roles, formulario móvil, código
  incorrecto/correcto y logout, sin errores JavaScript.
- En la instancia habitual se comprobó una solicitud real de envío con Resend,
  aceptada por el proveedor, y el bloqueo de acceso antes de verificar. El desafío
  de esa prueba se canceló sin mostrar su código. No se verificó la recepción ni
  se consumió ese código real; los recorridos completos se validaron con correo
  simulado. Se conservaron 12 tickets y las tres cuentas existentes.


## Migraciones explícitas

La inicialización automática del esquema se sustituyó por `npm run migrate`.
El schema base incluye las tres tablas de autenticación. El historial de cambios
se guarda en `schema_migrations`, y el servidor conserva únicamente la validación
del esquema, la cuenta inicial y limpieza de registros caducados. Ver la sección
**Migraciones de base de datos** en README y `tests/node/migrations-audit.cjs`.


Validación del cambio a migraciones: 19 comprobaciones de esquema/migración
aprobadas (incluido arranque con permisos únicamente DML) y 51 comprobaciones del
segundo factor aprobadas. La migración se aplicó en la instancia habitual y una
segunda ejecución informó `ya aplicada`. La aplicación arrancó correctamente.


## Vinculación usuario–técnico

Se agregó la migración `002-user-technician`: columna opcional, unicidad y FK con
restricción de borrado. Las cuentas heredadas se conservan sin asignación hasta
que un administrador las vincule. La interfaz incluye selección del técnico y
muestra su estado; los técnicos ocupados no se pueden elegir para otra cuenta.
El login y el segundo factor comprueban la vinculación y actividad. Cambiarla
revoca sesiones y desafíos pendientes. La inactividad suspende el acceso sin
borrar datos. El correo de 2FA sigue dirigido temporalmente a la cuenta personal.


Validación de la vinculación: 72 controles de permisos y asignación, 19 controles
de migración, 137 del login/roles, 51 del segundo factor y 165 verificaciones HTTP
aprobados. Se validaron ocho escenarios de navegador para el selector y edición
del vínculo, disponibilidad de técnicos, vista móvil y aislamiento de tickets,
sin errores JavaScript. Los datos y archivos de prueba se crearon y limpiaron en
la instancia aislada; no se enviaron correos reales durante estas pruebas.


## Historial de tickets y cierre real (2026-11-04)

La migración `003-ticket-history` incorpora historial transaccional y una fecha
real de cierre. El autor se obtiene de la sesión mediante AsyncLocalStorage, con
snapshot de correo y rol; permanece legible aunque se elimine la cuenta. Los
cambios de asignación y las evidencias se registran junto al ticket. No se agregan
fechas ni eventos ficticios a datos anteriores.

Validación: 71 comprobaciones de historial, incluidas atribución concurrente,
rechazo de autores falsificados, idempotencia, fallos de auditoría con rollback del
cierre/equipos, snapshots y paginación; 21 de migración; 72 de aislamiento por
técnico; 166 controles HTTP y cinco escenarios de navegador (fecha, historial,
filtros de regreso, XSS y móvil) aprobados. Sin correos reales durante las pruebas.


## Recuperación de contraseña

El login enlaza a `/login/recuperar`. El código es independiente del segundo
factor de acceso y caduca a los 10 minutos, con cinco intentos. El navegador
conserva el token en una cookie HttpOnly limitada a recuperación. Se mantienen
el proveedor Resend y el destinatario temporal compartido configurado.

El cambio se aplica con bloqueo del usuario y su recuperación: actualiza el hash
scrypt y elimina sesiones, desafíos de login y recuperaciones en una transacción.
No inicia sesión automáticamente ni cambia roles o activación de técnicos.
La administración de cuentas invalida también códigos de recuperación.

Validación reproducible: `node tests/node/password-recovery-audit.cjs` en el
entorno aislado con correo simulado. Incluye canje simultáneo, rollback, caducidad,
un solo uso, límites por IP, protección de origen y login con 2FA posterior.


## Administración de cuentas privilegiadas

Solo administradores pueden crear, editar, promover o degradar cuentas. El último
administrador conserva su rol; tampoco puede eliminarse. Se permite editar su
correo y contraseña, con revocación de sesiones y nuevo login con 2FA. Ninguna
cuenta puede eliminarse a sí misma. Un administrador puede cambiar su propio rol
si otro administrador permanece, cerrando inmediatamente su sesión.

El servidor serializa las mutaciones de cuentas en MySQL, comprueba de nuevo rol
y sesión del actor y valida la permanencia de un administrador dentro de la misma
transacción. Esto incluye peticiones concurrentes y peticiones que ya pasaron el
middleware cuando otra operación revocó el acceso del autor.

Auditoría aislada: `node tests/node/admin-management-audit.cjs`. Usa una base nueva
con cuentas temporales y elimina toda la base al terminar. No requiere correos.
