jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

const pool = require('../../config/database');
const emailPreferenceService = require('../emailPreferenceService');

describe('emailPreferenceService', () => {
  beforeAll(() => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret-with-at-least-thirty-two-characters';
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
});
