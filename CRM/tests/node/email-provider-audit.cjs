// Transport-only tests: SMTP is mocked; no real email is sent.
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { configuration } = require('../../dist/config');
const { sendEmail } = require('../../dist/services/email-service');
const { sendTestEmail } = require('../../dist/services/test-email-service');
const originalTransport = nodemailer.createTransport;
let checks = 0, closed = 0, transportOptions, sent;
const eq = (a,b) => { assert.deepEqual(a,b); checks++; };
(async () => {
  try {
    Object.assign(configuration.email, { gmailUser: 'sender@example.com', gmailAppPassword: 'mock-only-password' });
    nodemailer.createTransport = options => {
      transportOptions = options;
      return { sendMail: async message => { sent = message; return { accepted: [message.to], messageId: 'mock-id' }; }, close: () => { closed++; } };
    };
    eq(await sendEmail('recipient@example.com', 'Access', 'Code body'), 'mock-id');
    eq(transportOptions.service, 'gmail');
    eq(transportOptions.auth.user, 'sender@example.com');
    eq(sent.from, { name: 'CRM TSV', address: 'sender@example.com' });
    eq([sent.to,sent.subject,sent.text], ['recipient@example.com','Access','Code body']);
    eq(closed, 1);
    eq(await sendTestEmail('recipient@example.com'), { id: 'mock-id', to: 'recipient@example.com', provider: 'gmail' });
    nodemailer.createTransport = () => ({ sendMail: async () => { throw new Error('smtp-private-details'); }, close: () => { closed++; } });
    await assert.rejects(sendEmail('recipient@example.com','Reset','Body'), error => error.status === 502 && !error.message.includes('smtp-private-details')); checks++;
    eq(closed, 3);
    nodemailer.createTransport = () => ({ sendMail: async () => ({ accepted: [], messageId: 'rejected' }), close: () => { closed++; } });
    await assert.rejects(sendEmail('recipient@example.com','Reset','Body'), error => error.status === 502); checks++;
    configuration.email.gmailAppPassword = '';
    await assert.rejects(sendEmail('recipient@example.com','Access','Body'), error => error.status === 503); checks++;
    configuration.email.gmailAppPassword = 'mock-only-password';
    configuration.email.gmailUser = '';
    await assert.rejects(sendEmail('recipient@example.com','Access','Body'), error => error.status === 503); checks++;
    console.log('PASS '+checks+' checks: Gmail transport, sender/recipient, errors, cleanup');
  } finally { nodemailer.createTransport = originalTransport; }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
