const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createBunnyStreamAdapter, bunnyConfigFromEnv } = require('../src/services/bunnyStreamAdapter');

const guid = '657bb740-a71b-4529-a012-528021c31a92';
const config = { libraryId: '133', apiKey: 'test-upload-key', tokenKey: 'test-token-key', webhookSigningKey: 'test-read-only-key', now: () => 1791763200000 };
const adapter = extra => createBunnyStreamAdapter({ ...config, ...extra });

test('TUS authorization scopes credentials to library/video/expiry without exposing API key', () => {
  const value = adapter().createTusAuthorization(guid, 600);
  assert.equal(value.endpoint, 'https://video.bunnycdn.com/tusupload');
  assert.equal(value.headers.LibraryId, '133'); assert.equal(value.headers.VideoId, guid);
  assert.equal(value.headers.AuthorizationExpire, '1791763800');
  const expected = crypto.createHash('sha256').update('133test-upload-key1791763800' + guid).digest('hex');
  assert.equal(value.headers.AuthorizationSignature, expected);
  assert.equal(JSON.stringify(value).includes(config.apiKey), false);
  assert.notEqual(adapter().createTusAuthorization(guid, 601).headers.AuthorizationSignature, expected);
});

test('embed signature uses separate security key, not upload API key', () => {
  const value = adapter().createEmbedUrl(guid, 300);
  const url = new URL(value.url);
  assert.equal(url.origin, 'https://player.mediadelivery.net');
  assert.equal(url.pathname, `/embed/133/${guid}`);
  assert.equal(url.searchParams.get('expires'), '1791763500');
  assert.equal(url.searchParams.get('token'), crypto.createHash('sha256').update('test-token-key' + guid + '1791763500').digest('hex'));
  assert.equal(JSON.stringify(value).includes(config.tokenKey), false);
});

test('invalid IDs, absent credentials and invalid TTL fail closed', async () => {
  for (const id of ['../videos', 'https://evil.invalid', '', 'not-a-guid']) assert.throws(() => adapter().createTusAuthorization(id));
  for (const ttl of [0, 30, 90000, '300', 300.5]) assert.throws(() => adapter().createEmbedUrl(guid, ttl));
  assert.throws(() => adapter({ tokenKey: undefined }).createEmbedUrl(guid), { code: 'BUNNY_NOT_CONFIGURED' });
  assert.throws(() => adapter({ apiKey: undefined }).createTusAuthorization(guid), { code: 'BUNNY_NOT_CONFIGURED' });
  assert.throws(() => adapter({ libraryId: '../123' }).createEmbedUrl(guid));
  await assert.rejects(createBunnyStreamAdapter().getVideo(guid), { code: 'BUNNY_NOT_CONFIGURED' });
});

test('server requests use fixed host and protected headers, and validate provider identity', async () => {
  const calls = [];
  const instance = adapter({ fetchImpl: async (url, options) => {
    calls.push({ url, options }); return { ok: true, json: async () => ({ guid, videoLibraryId: 133, status: 3, length: 120 }) };
  } });
  await instance.createVideo('  Lesson one  '); const result = await instance.getVideo(guid);
  assert.equal(calls[0].url, 'https://video.bunnycdn.com/library/133/videos');
  assert.equal(calls[0].options.method, 'POST'); assert.equal(calls[0].options.body, '{"title":"Lesson one"}');
  assert.equal(calls[1].options.headers.AccessKey, config.apiKey); assert.equal(calls[1].options.redirect, 'error');
  assert.equal(result.length, 120);
  await assert.rejects(adapter({ fetchImpl: async () => ({ ok: true, json: async () => ({ guid, videoLibraryId: 999 }) }) }).getVideo(guid), { code: 'BUNNY_INVALID_RESPONSE' });
});

test('network/provider failures do not leak credentials or response body', async () => {
  await assert.rejects(adapter({ fetchImpl: async () => { throw new Error(config.apiKey); } }).getVideo(guid), error => {
    assert.equal(error.code, 'BUNNY_REQUEST_FAILED'); assert.equal(error.message.includes(config.apiKey), false); return true;
  });
  await assert.rejects(adapter({ fetchImpl: async () => ({ ok: false, status: 401 }) }).getVideo(guid), { code: 'BUNNY_REQUEST_FAILED' });
});

test('webhook validates exact raw bytes, version and algorithm; parsing/reformatting fails', () => {
  const raw = Buffer.from('{ "VideoLibraryId": 133, "Status": 3 }');
  const headers = { 'x-bunnystream-signature-version': 'v1', 'x-bunnystream-signature-algorithm': 'hmac-sha256',
    'x-bunnystream-signature': crypto.createHmac('sha256', config.webhookSigningKey).update(raw).digest('hex') };
  assert.equal(adapter().verifyWebhook(raw, headers), true);
  assert.equal(adapter().verifyWebhook(Buffer.from(JSON.stringify(JSON.parse(raw))), headers), false);
  assert.equal(adapter().verifyWebhook(raw, { ...headers, 'x-bunnystream-signature-version': 'v2' }), false);
  assert.equal(adapter().verifyWebhook(raw, { ...headers, 'x-bunnystream-signature-algorithm': 'sha256' }), false);
  assert.equal(adapter().verifyWebhook(raw, { ...headers, 'x-bunnystream-signature': 'short' }), false);
  assert.equal(adapter().verifyWebhook(raw.toString(), headers), false);
});

test('server environment configuration has no frontend/public fallback', () => {
  assert.deepEqual(bunnyConfigFromEnv({ NEXT_PUBLIC_BUNNY_STREAM_API_KEY: 'must-not-use' }), {
    libraryId: undefined, apiKey: undefined, tokenKey: undefined, webhookSigningKey: undefined,
  });
});
