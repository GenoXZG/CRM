# CRM TSV

La aplicación actual y su configuración Docker están en [`CRM/`](CRM/).
Consulta [instalación, variables de entorno y migraciones](CRM/README.md) antes
de iniciar.

```bash
cd CRM
cp .env.example .env
# Completar la configuración privada antes de ejecutar Docker Compose.
```

El correo del CRM (login con 2FA, recuperación y pruebas) se envía mediante
Nodemailer y SMTP de Gmail. Configura `GMAIL_USER` y `GMAIL_APP_PASSWORD` con la
contraseña de aplicación de la cuenta remitente. Las credenciales se
configuran únicamente en `.env`, que no se versiona. No se incluyen contraseñas
ni API keys reales en los archivos de configuración del repositorio.

`develop` concentra la versión integrada; `feature/v3` conserva su desarrollo.
