jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

const pool = require('../../config/database');
const emailPreferenceService = require('../emailPreferenceService');

describe('emailPreferenceService', () => {
  beforeAll(() => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret-with-at-least-thirty-two-characters';
    process.env.BREVO_WEBHOOK_SECRET = 'test-brevo-webhook-secret-at-least-32-chars';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates and verifies a signed unsubscribe token', () => {
    const token = emailPreferenceService.createUnsubscribeToken(42);

    expect(emailPreferenceService.parseUnsubscribeToken(token)).toEqual({ userId: 42 });
    expect(emailPreferenceService.parseUnsubscribeToken(`${token}x`)).toBeNull();
  });

  test('rejects invalid user ids', () => {
    expect(() => emailPreferenceService.createUnsubscribeToken('invalid')).toThrow(
      'Invalid unsubscribe user',
    );
  });

  test('disables marketing email for a valid token', async () => {
    const token = emailPreferenceService.createUnsubscribeToken(7);
    pool.query.mockResolvedValue({
      rows: [{
        user_id: 7,
        marketing_enabled: false,
        unsubscribed_at: new Date(),
      }],
    });

    const result = await emailPreferenceService.unsubscribeByToken(token);

    expect(result.user_id).toBe(7);
    expect(result.marketing_enabled).toBe(false);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('marketing_enabled = FALSE'),
      [7, 'one_click'],
    );
  });

  test('does not query the database for an invalid token', async () => {
    await expect(emailPreferenceService.unsubscribeByToken('invalid')).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('verifies the Brevo webhook secret without accepting partial values', () => {
    expect(emailPreferenceService.verifyBrevoWebhookSecret(
      'test-brevo-webhook-secret-at-least-32-chars',
    )).toBe(true);
    expect(emailPreferenceService.verifyBrevoWebhookSecret(
      'test-brevo-webhook-secret',
    )).toBe(false);
  });

  test('suppresses hard bounces from Brevo marketing webhooks', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(emailPreferenceService.recordBrevoEvents({
      email: 'Student@Example.com',
      event: 'hard_bounce',
      camp_id: 99,
      ts_event: 123456,
    })).resolves.toBe(1);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO email_suppressions'),
      [
        'student@example.com',
        'hard_bounce',
        JSON.stringify({
          event: 'hard_bounce',
          campaignId: 99,
          eventTimestamp: 123456,
        }),
      ],
    );
  });

  test('updates both suppression and preference records on unsubscribe', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(emailPreferenceService.recordBrevoEvents({
      email: 'student@example.com',
      event: 'unsubscribe',
    })).resolves.toBe(1);

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[1][0]).toContain('marketing_enabled = FALSE');
    expect(pool.query.mock.calls[1][1]).toEqual(['student@example.com']);
  });
});
