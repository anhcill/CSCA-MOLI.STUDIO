const assert = require('node:assert/strict');
const test = require('node:test');
const emailService = require('../src/services/emailService');

test('OTP delivery keeps the one-time code out of the email subject', async () => {
  const originalSend = emailService._send;
  let payload;
  emailService._send = async (value) => {
    payload = value;
    return { sent: true };
  };

  try {
    await emailService.sendOtpEmail({
      email: 'private@example.com',
      name: 'Private User',
      otp: '123456',
      reason: 'login',
    });
    assert.ok(payload);
    assert.doesNotMatch(payload.subject, /123456/);
    assert.match(payload.html, /123456/);
  } finally {
    emailService._send = originalSend;
  }
});

test('email transport logs do not expose recipients or subject secrets', async () => {
  const originalApiKey = emailService.apiKey;
  const originalClient = emailService.client;
  const originalLog = console.log;
  const messages = [];

  emailService.apiKey = 'test-key';
  emailService.client = { post: async () => ({ status: 201 }) };
  console.log = (...args) => messages.push(args.join(' '));

  try {
    await emailService._send({
      to: 'private@example.com',
      subject: 'Secret code 123456',
      html: '<p>private</p>',
    });
    const output = messages.join('\n');
    assert.doesNotMatch(output, /private@example\.com/);
    assert.doesNotMatch(output, /123456/);
    assert.doesNotMatch(output, /Secret code/);
  } finally {
    emailService.apiKey = originalApiKey;
    emailService.client = originalClient;
    console.log = originalLog;
  }
});
