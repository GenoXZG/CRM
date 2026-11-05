# CRM TSV

La aplicación actual y su configuración Docker están en [`CRM/`](CRM/).
Consulta [instalación, variables de entorno y migraciones](CRM/README.md) antes
de iniciar.

```bash
cd CRM
cp .env.example .env
# Completar la configuración privada antes de ejecutar Docker Compose.
```

Se requiere una API key válida de Resend (`RESEND_API_KEY`) para completar el
login con 2FA, recuperar contraseñas y enviar correos. Las credenciales se
configuran únicamente en `.env`, que no se versiona. No se incluyen contraseñas
ni API keys reales en los archivos de configuración del repositorio.

`develop` concentra la versión integrada; `feature/v3` conserva su desarrollo.
