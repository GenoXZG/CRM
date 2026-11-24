# Auditoría final de autorización y contenidos

A y C son administrador y coordinador. T es técnico activo y vinculado. Un
técnico sin vínculo o inactivo solo puede cerrar su sesión y acceder a rutas
públicas, incluidas las de recuperación. «Propio» significa que el ticket tiene
asignado el técnico de la sesión. Cada método con efectos exige CSRF y comprueba
el origen cuando se presenta. Los GET suelen admitir HEAD por Express.

| Método y endpoint | Anónimo | A | C | T | Control de servidor |
| --- | --- | --- | --- | --- | --- |
| GET `/health`, `/favicon.ico`, `/assets/*`, `/css/*`, `/js/*`, `/bootstrap/*`, `/leaflet/*` | Sí | Sí | Sí | Sí | Recursos estáticos explícitos y estado de MySQL |
| GET `/csrf-token`, `/login/csrf-token`, `/login/recuperar/csrf-token` | Sí | Sí | Sí | Sí | Token firmado para el estado de cookies del mismo origen |
| GET/POST `/login`, `/login/verificar` | Sí | Sí | Sí | Sí | Contraseña y desafío válidos para establecer sesión con 2FA. Un GET autenticado redirige |
| POST `/login/cancelar` | Sí | Sí | Sí | Sí | Solo afecta al desafío de la cookie actual |
| GET/POST `/login/recuperar`, `/login/recuperar/restablecer` | Sí | Sí | Sí | Sí | Token y código, respuestas uniformes, consumo transaccional |
| POST `/logout` | — | Sí | Sí | Sí | Sesión vigente, revocación del token presentado |
| GET `/`, `/tickets`, `/estado_tickets`, `/tickets/exportar` | — | Global | Global | Propio | Filtro de técnico añadido por servidor incluso con filtros del cliente |
| GET `/tickets/nuevo`, `/tickets?setup=ticket` | — | Sí | Sí | — | Solo gestores |
| GET `/detalle_ticket/:id` | — | Global | Global | Propio | Filtro SQL y misma instantánea para detalle e historial |
| GET `/uploads/tickets/:name` | — | Global | Global | Propio | Referencia registrada y ticket existente antes de abrir el archivo |
| POST `/tickets/resolver_ubicacion` | — | Sí | Sí | Sí | Conversión sin modificar tickets, URL y cada salto limitados a Google Maps |
| POST `/tickets/finalizar/:id` | — | Global | Global | Propio | Sesión y rol revalidados bajo bloqueo, estado y preparación del ticket comprobados |
| POST `/tickets/reabrir/:id`, `/tickets/asignar_tecnico`, `/tickets/actualizar_comentarios`, `/tickets/actualizar_maps`, `/tickets/:id/subir-fotos`, `/add_ticket`, `/updateAsignacionUnidades` | — | Sí | Sí | — | Solo gestores, validación del estado y referencias |
| GET `/asignaciones`, `/asignacion_unidades`, `/asignacion_equipos`, `/unidades-por-ticket/:id_ticket`, `/equipos_espera` | — | Sí | Sí | — | Datos operativos de asignación limitados a gestores |
| POST `/add_unidades`, `/tickets/:id_ticket/unidades/:id_unidad/quitar`, `/desvincular_equipo`, `/desvincular_accesorio`, `/asignar_equipos` | — | Sí | Sí | — | Validación transaccional de la relación ticket/unidad/equipo/accesorio |
| GET `/inventario`, `/registro_equipos` | — | Sí | Sí | — | Solo gestores |
| POST `/add_equipo`, PATCH/DELETE `/equipos/:id` | — | Sí | Sí | — | Solo gestores. Borrado de equipos sin asignación |
| GET `/catalogos`, `/equipos`, `/unidades`, `/accesorios`, `/modelos`, `/test` | — | Sí | Sí | — | Solo gestores |
| POST `/add_equipo_catalogo`, `/editar_equipo_stock`, `/eliminar_equipo_stock`, `/add_unidad_catalogo`, `/editar_unidad_stock`, `/eliminar_unidad_stock`, `/add_accesorio_catalogo`, `/editar_accesorio_stock`, `/eliminar_accesorio_stock` | — | Sí | Sí | — | Solo gestores. Validación de referencias al retirar registros |
| GET `/directorio`, `/clientes`, `/tecnicos` | — | Sí | Sí | — | Solo gestores |
| POST `/add_cliente`, `/editar_cliente`, `/eliminar_cliente`, `/add_tecnico`, `/editar_tecnico`, `/eliminar_tecnico` | — | Sí | Sí | — | Solo gestores. Se protege la vinculación de cuentas y referencias |
| GET `/usuarios`, POST `/usuarios/crear`, `/usuarios/:id/editar`, `/usuarios/:id/eliminar` | — | Sí | — | — | Solo administrador. Se revalida la sesión al escribir y se conserva el último administrador |
| POST `/api/email/test` | — | Sí | Sí | — | Un destinatario y cuotas por cuenta e instancia |

## Resultados y correcciones

- El detalle filtraba al técnico después de cargar la entidad y consultaba el
  historial posteriormente. Una reasignación concurrente podía separar ambas
  comprobaciones. El repositorio aplica ahora el alcance al leer el detalle y
  reúne detalle e historial en una sola instantánea de MySQL.
- El cierre comprobaba el vínculo del técnico y la titularidad del ticket. La
  sesión se validaba solo al entrar al middleware. El cierre ahora revalida
  sesión y rol dentro de la transacción para los tres roles. El ID de la ruta
  prevalece sobre un ID distinto enviado en el cuerpo.
- El correo de diagnóstico aceptaba el formato flexible de destinatarios del
  proveedor y carecía de cuota propia. El endpoint admite un solo buzón y limita
  intentos por cuenta y por instancia.
- Se revisaron las consultas directas, los modelos, los literales, los filtros,
  el paginado y la exportación. Los valores externos se pasan como parámetros
  o condiciones Sequelize. Los literales usan constantes o fragmentos
  construidos con alias internos. Los órdenes son fijos o dependen de la clave
  primaria del modelo. No se confirmó una inyección SQL. La selección de
  consultas de historial exige claves propias de su lista.
- Las plantillas usan escape en texto y atributos, incluido el JSON de los
  atributos de modales. Las expresiones EJS sin escape incluyen parciales o
  fragmentos constantes. Los comentarios, nombres e historial se tratan como
  texto. Se cerró el paso de HTML arbitrario en la atribución de Leaflet y se
  bloquearon enlaces de ubicación con credenciales o esquemas ajenos a HTTP(S).
  El CSV mantiene sus comillas y neutraliza prefijos de fórmula también cuando
  una normalización Unicode los reduce a sus formas ASCII.
- Las lecturas autorizadas por sesión siguen teniendo una instantánea por
  solicitud. Otras mutaciones de gestores dependen de la comprobación del
  middleware al entrar. Una revocación concurrente no deshace operaciones que
  ya habían sido autorizadas y confirmadas.
