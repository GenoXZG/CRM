# Preparación de producción y recuperación

Ejecuta primero este procedimiento en un proyecto Compose aislado con datos
ficticios y correo simulado.

## Base limpia y actualización

- Verifica el nombre del proyecto y los volúmenes efectivos `mysql_data` y
  `uploads`. Conserva el nombre para actualizar. Usa uno distinto para una
  instalación limpia o un ensayo de restauración.
- El Compose base aplica solo `001-schema.sql` a un volumen MySQL nuevo.
  `docker/compose.demo.yaml` carga datos ficticios en `local` o `test`.
  `docker/compose.auth-audit.yaml` crea su demo con correo simulado. Usa el
  Compose base para producción.
- Los archivos de inicialización actúan solo en volúmenes vacíos. Una
  instalación existente conserva sus datos, incluidos registros de demo
  anteriores. Para empezar limpio, crea otro proyecto y conserva el anterior.
- Arranca MySQL, aplica migraciones y luego inicia Express. Si separas la
  cuenta DML de ejecución, usa credenciales DDL aparte para las migraciones.
  El administrador inicial se crea solo cuando `usuarios` está vacía.
  Verifica su 2FA antes de retirar `CRM_ADMIN_PASSWORD` de la configuración.
  Usa un buzón bajo su control y una contraseña aleatoria custodiada fuera de Git.

~~~bash
release=(docker compose -p "$project")
"${release[@]}" up -d --wait db
"${release[@]}" build app
"${release[@]}" run --rm --no-deps app npm run migrate
"${release[@]}" up -d --wait app
~~~

Asigna a `project` el nombre previamente verificado. Conserva el montaje privado
de la Fase 3 y los directorios `tickets` y `validated`.

## Configuración de ejecución

| Variables | Uso |
| --- | --- |
| `CRM_DEPLOYMENT=public`, `TRUSTED_PROXY_IP` | IP exacta del par TCP de Apache observada dentro del contenedor |
| `CSP_MODE` | Vacía o `enforce` activa CSP obligatoria en público. `report-only` se reserva para validaciones controladas |
| `AUTH_2FA_TO` | Vacía en producción. El destino compartido solo se admite en pruebas |
| `DOCKER_DB_NAME`, `DOCKER_DB_USER`, `DOCKER_DB_PASSWORD`, `DOCKER_DB_ROOT_PASSWORD` | Esquema y cuentas MySQL. En una instancia existente deben coincidir con las cuentas ya provisionadas |
| `CRM_ADMIN_EMAIL`, `CRM_ADMIN_PASSWORD` | Alta inicial cuando la tabla de usuarios está vacía |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_TEST_TO` | Proveedor de login y recuperación, con destino de prueba opcional |
| `CRM_HTTP_PORT` | Puerto publicado solo en loopback. Predeterminado 3030 |
| `EVIDENCE_MIN_FREE_MIB` | Reserva de espacio utilizable. Predeterminado 128 MiB |
| `MAP_TILE_URL`, `MAP_TILE_ATTRIBUTION` | Proveedor HTTPS y atribución como texto o enlace HTTPS simple |
| `EVIDENCE_ROOT`, `DB_*`, `PORT` | Configuración directa. Compose fija la raíz en `/app/evidence` y el puerto interno en 3030 |
| `COOKIE_SECURE` | Opcional en local y test. El perfil público fuerza el atributo |

Ambos servicios usan `restart: unless-stopped`, `no-new-privileges` y rotación
JSON de tres archivos de 10 MiB. Node se ejecuta como `node`, sin capabilities.
El arranque de MySQL conserva las necesarias para preparar permisos y bajar a
su usuario de servicio. Verifica que ambos procesos queden sin UID 0 y que el
usuario Node pueda escribir en el volumen. Sharp se instala mediante `npm ci`
en la imagen Debian con Node 22. Valida la imagen en la arquitectura definitiva.

El healthcheck de MySQL consulta el esquema. El de Express verifica la
conexión a MySQL y puede servir `503` durante un reinicio de la base.
Docker aplica su política cuando termina un proceso. Un estado `unhealthy`
por sí solo no reinicia el contenedor. Monitorea ambos. Mide CPU y memoria
durante carga, recodificación, exportación, arranque de MySQL y respaldo.
Usa `cpus` y `mem_limit` en un overlay con valores medidos y ajusta el buffer
pool al presupuesto de MySQL. El Compose base no fija esas cuotas.

### Ocupación de evidencias

Dos operaciones comparten la capacidad de imagen entre cargas nuevas y lectura
histórica, incluidos los HEAD que deban determinar el tipo real. La saturación
devuelve `503` y `Retry-After`. Un cierre puede cancelar la lectura. Sharp puede
terminar el trabajo nativo ya iniciado antes de liberar su plaza.

La salida recodificada se limita a 5 MiB. JPEG y WebP usan calidad 80 y PNG
compresión 9. Las cargas nuevas que superan el límite devuelven `413`. Los
originales históricos permanecen disponibles como descarga. La memoria
transitoria del decodificador puede superar el tamaño final.

Se comprueba el espacio utilizable antes de escribir cada archivo. Si la
reserva no alcanza o el sistema devuelve `ENOSPC` o `EDQUOT`, se informa
`507` y se registra un evento sin nombres. La comprobación puede coincidir con
otras escrituras. Monitorea espacio e inodos con `df -h /app/evidence` y
`df -i /app/evidence` o desde el host. Alerta antes de alcanzar la reserva
y mide el crecimiento y la retención de respaldos. El CRM no borra evidencias
automáticamente.

## Respaldo coordinado

Prepara un directorio privado nuevo. Conserva aparte, cifrados y con acceso
restringido, la configuración de entorno y overlays, el nombre del proyecto,
la referencia Git y el digest de la imagen, la versión de MySQL y la
configuración del VirtualHost y renovación de TLS. Custodia las credenciales
y llaves en el gestor establecido. Evita imprimir la configuración expandida.

Detén todos los escritores, incluido el CRM y los trabajos externos. Espera
el cierre de Express y mantén MySQL activo. En una sesión cuyo proyecto hayas
verificado, asigna a `backup_dir` el directorio privado preparado y ejecuta:

~~~bash
umask 077
docker compose stop app
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 --triggers --routines --events "$MYSQL_DATABASE"' > "$backup_dir/mysql.sql"
docker compose run --rm --no-deps -T --entrypoint tar app -C /app/evidence -czf - . > "$backup_dir/evidence.tar.gz"
(cd "$backup_dir" && sha256sum mysql.sql evidence.tar.gz > integrity.sha256 && sha256sum -c integrity.sha256)
tar -tzf "$backup_dir/evidence.tar.gz"
docker compose up -d --wait app
~~~

Verifica el éxito de cada comando antes de continuar. Los hashes detectan
cambios accidentales. Solo restaura conjuntos de procedencia verificada.
Protege el dump como información sensible porque contiene cuentas, sesiones y
trazas. La pausa de escritores coordina MySQL y disco. Evita cambios de
esquema mientras corre el dump.

## Restauración en otro proyecto

Usa un nombre nuevo, volúmenes nuevos, credenciales de ensayo, correo simulado
y otro puerto en loopback. Revisa hashes y listado del archivo. Emplea la
misma versión MySQL y la imagen registrada. Prepara la imagen de destino antes
de ejecutar comandos de restauración. Usa el esquema vacío y no agregues demo.
La importación puede sustituir tablas en el esquema destino.

~~~bash
restore=(docker compose --env-file /ruta/privada/restauracion.env -p crm-restore-aislado -f compose.yaml)
"${restore[@]}" up -d --wait db
"${restore[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"' < "$backup_dir/mysql.sql"
"${restore[@]}" run --rm --no-deps -T --entrypoint tar app --no-same-owner -xzf - -C /app/evidence < "$backup_dir/evidence.tar.gz"
"${restore[@]}" run --rm --no-deps -T app npm run migrate
"${restore[@]}" run --rm --no-deps -T --entrypoint node app < scripts/check-evidence.cjs
"${restore[@]}" up -d --wait app
~~~

Compara recuentos y hashes de una muestra de cada directorio. El verificador
reporta referencias desligadas, nombres inválidos, ausencias, duplicados y
archivos sin referencia o no regulares. Guarda el informe y revisa diferencias
sin borrar archivos. Verifica salud, login, 2FA, recuperación y acceso a una
evidencia de cada directorio con cuentas de prueba. Una sesión restaurada
puede continuar vigente. En un incidente con credenciales comprometidas,
coordina su revocación y rotación antes de permitir tráfico real. Detén el
proyecto de ensayo cuando termines.

## Checklist y rollback

- [ ] Imagen, arquitectura, auditorías y regresiones revisadas.
- [ ] Proyecto y volúmenes confirmados. Configuración y permisos verificados
      sin mostrar secretos.
- [ ] Respaldo coordinado reciente y restauración aislada verificada.
- [ ] Migraciones, dos healthchecks y alarmas de capacidad, reinicios y correo.
- [ ] VirtualHost TLS del CRM con redirección desde HTTP, `Host` preservado y
      cabeceras reenviadas regeneradas por Apache. IP observada por Express
      verificada. MySQL sin puerto publicado, backend en loopback y sin alias
      público de evidencias.
- [ ] `LimitRequestBody` en el VirtualHost del CRM con 262144 bytes generales
      y 27262976 bytes para cargar fotos. Validación con `apachectl configtest`.
      CSP obligatoria y HSTS circunscrito al host del CRM.
- [ ] Login, 2FA, recuperación, mapa, carga, evidencia histórica y rechazo de
      acceso anónimo probados con el dominio definitivo. Digest y punto de
      restauración registrados.

Si falla una actualización, retira el tráfico, detén escritores y respalda
también el estado fallido. Si esquema y almacenamiento son compatibles, prueba
la imagen anterior sobre una copia aislada. Ante cambios incompatibles o
compatibilidad incierta, restaura el par MySQL/evidencias previo en otro
proyecto y verifica antes de cambiar el proxy. El punto anterior no contiene
operaciones posteriores. Conserva el estado posterior para reconciliarlas.
Versiones anteriores a Fase 3 buscan los archivos nuevos en otra carpeta y
pueden servir el volumen como contenido estático. Valida accesos y cualquier
copia de archivos en aislamiento antes de exponer una reversión de ese tipo.
Conserva los volúmenes de origen y destino.
