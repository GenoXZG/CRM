# Sourced by the official MySQL entrypoint during initial setup.
case "${CRM_DEPLOYMENT:-local}" in
  local|test) docker_process_sql < /opt/crm-demo/002-demo.sql ;;
  *) echo "CRM demonstration data skipped for this deployment profile" ;;
esac
