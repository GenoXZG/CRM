const assert = require('node:assert/strict');
const { test } = require('node:test');
const sharp = require('sharp');
Object.assign(process.env, { NODE_ENV: 'test', DB_NAME: 'evidence_test', DB_USER: 'evidence_test' });
const { normalizeEvidence, safeEvidenceName } = require('../../dist/services/ticket-evidence');

const image = (width = 3, height = 4) => sharp({ create: { width, height, channels: 3, background: '#123456' } });
const rejected = error => error.status === 415;
test('decodes supported formats and rejects truncated, oversized and active inputs', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const data = await image().toFormat(format).toBuffer();
    const name = 'image.' + (format === 'jpeg' ? 'jpg' : format);
    const result = await normalizeEvidence(data, { originalname: name, mimetype: 'image/' + format });
    assert.equal((await sharp(result.buffer).metadata()).format, format);
    await assert.rejects(normalizeEvidence(data.subarray(0, data.length - 1)), rejected);
    await assert.rejects(normalizeEvidence(Buffer.concat([data, Buffer.from('surplus')])), rejected);
  }
  const png = await image().png().toBuffer();
  const broken = Buffer.concat([png.subarray(0, 15), png.subarray(-12)]);
  await assert.rejects(normalizeEvidence(broken), rejected);
  await assert.rejects(normalizeEvidence(await image(6001, 3).png().toBuffer()), rejected);
  await assert.rejects(normalizeEvidence(await image(4500, 4000).png().toBuffer()), rejected);
  await assert.rejects(normalizeEvidence(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), rejected);
  for (const name of ['../bad.png', 'bad\\name.png', '..', 'a\u0000.png']) assert.equal(safeEvidenceName(name), false);
});
