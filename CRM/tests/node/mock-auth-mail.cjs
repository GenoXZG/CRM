// Isolated audit container only. Never used by the normal application command.
const fs = require('node:fs');
const mail = require('/app/dist/services/email-service');
mail.sendEmail = async (to, subject, text) => {
  if (fs.existsSync('/tmp/crm-auth-mail-fail')) throw new Error('Simulated provider failure');
  const code = text.match(/Tu código es: (\d{6})/)?.[1];
  const account = text.match(/con la cuenta ([^\s]+)\./)?.[1];
  fs.writeFileSync('/tmp/crm-auth-test-mail.json', JSON.stringify({ to, subject, code, account, text }), { mode: 0o600 });
  return 'mock-mail-id';
};
require('/app/dist/server').startServer().catch(error => { console.error(error.message); process.exitCode = 1; });
