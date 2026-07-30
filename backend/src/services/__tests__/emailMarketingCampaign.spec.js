describe('EmailService marketing campaigns', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('syncs a deduplicated Brevo list before sending a campaign', async () => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'test-key',
      BREVO_MARKETING_LIST_ID: '4',
      EMAIL_MARKETING_SENDER: 'marketing@molystudio.online',
      EMAIL_MARKETING_SENDER_NAME: 'CSCA Moly',
    };

    const client = {
      get: jest.fn().mockResolvedValue({ data: { status: 'completed' } }),
      post: jest.fn()
        .mockResolvedValueOnce({ data: { processId: 11 } })
        .mockResolvedValueOnce({ data: { processId: 12 } })
        .mockResolvedValueOnce({ data: { id: 99 } })
        .mockResolvedValueOnce({ data: {} }),
    };
    jest.doMock('axios', () => ({
      create: jest.fn(() => client),
    }));

    const emailService = require('../emailService');
    const result = await emailService.sendCampaignBatch({
      recipients: [
        { email: 'student@example.com', name: 'Học sinh A' },
        { email: 'STUDENT@example.com', name: 'Tên trùng' },
        { email: 'second@example.com', name: 'Học sinh B' },
      ],
      subject: 'Thông báo mới',
      html: '<html><body>Xin chào</body></html>',
    });

    expect(result).toEqual(expect.objectContaining({
      sent: 2,
      campaignId: 99,
      campaignIds: [99],
    }));
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/contacts/lists/4/contacts/remove',
      { all: true }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/contacts/import',
      expect.objectContaining({
        listIds: [4],
        updateExistingContacts: true,
        disableNotification: true,
        jsonBody: [
          {
            email: 'STUDENT@example.com',
            attributes: { FIRSTNAME: 'Tên trùng' },
          },
          {
            email: 'second@example.com',
            attributes: { FIRSTNAME: 'Học sinh B' },
          },
        ],
      })
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      '/emailCampaigns',
      expect.objectContaining({
        sender: {
          email: 'marketing@molystudio.online',
          name: 'CSCA Moly',
        },
        recipients: { listIds: [4] },
        subject: 'Thông báo mới',
        htmlContent: '<html><body>Xin chào</body></html>',
      })
    );
    expect(client.post).toHaveBeenNthCalledWith(4, '/emailCampaigns/99/sendNow');
    expect(client.get).toHaveBeenCalledTimes(4);
  });

  test('refuses bulk sending when no Brevo marketing list is configured', async () => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'test-key',
    };
    delete process.env.BREVO_MARKETING_LIST_ID;

    const client = {
      get: jest.fn(),
      post: jest.fn(),
    };
    jest.doMock('axios', () => ({
      create: jest.fn(() => client),
    }));

    const emailService = require('../emailService');
    await expect(emailService.sendCampaignBatch({
      recipients: [{ email: 'student@example.com' }],
      subject: 'Thông báo',
      html: '<html><body>Thông báo</body></html>',
    })).rejects.toThrow('BREVO_MARKETING_LIST_ID not configured');
    expect(client.post).not.toHaveBeenCalled();
  });

  test('continues when the Brevo marketing list is already empty', async () => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'test-key',
      BREVO_MARKETING_LIST_ID: '4',
    };

    const emptyListError = Object.assign(new Error('empty list'), {
      response: {
        status: 400,
        data: { message: 'Contacts already removed from list and/or does not exist' },
      },
    });
    const client = {
      get: jest.fn().mockResolvedValue({ data: { status: 'completed' } }),
      post: jest.fn()
        .mockRejectedValueOnce(emptyListError)
        .mockResolvedValueOnce({ data: { processId: 12 } })
        .mockResolvedValueOnce({ data: { id: 100 } })
        .mockResolvedValueOnce({ data: {} }),
    };
    jest.doMock('axios', () => ({
      create: jest.fn(() => client),
    }));

    const emailService = require('../emailService');
    await expect(emailService.sendCampaignBatch({
      recipients: [{ email: 'student@example.com', name: 'Học sinh' }],
      subject: 'Thông báo',
      html: '<html><body>Thông báo</body></html>',
    })).resolves.toEqual(expect.objectContaining({ sent: 1, campaignId: 100 }));
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/contacts/import',
      expect.any(Object)
    );
  });

  test('sends academic notices through the transactional sender', async () => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'test-key',
      EMAIL_SENDER: 'notification@molystudio.online',
      EMAIL_SENDER_NAME: 'CSCA Moly Notifications',
    };

    const client = {
      get: jest.fn(),
      post: jest.fn().mockResolvedValue({ data: { messageId: 'test-id' } }),
    };
    jest.doMock('axios', () => ({
      create: jest.fn(() => client),
    }));

    const emailService = require('../emailService');
    await expect(emailService.sendTransactionalBatch({
      recipients: [{
        email: 'student@example.com',
        name: 'Học sinh',
        html: '<html><body>Thông báo riêng</body></html>',
        text: 'Thông báo riêng',
      }],
      subject: 'Lịch học mới',
      html: '<html><body>Thông báo</body></html>',
      text: 'Thông báo',
    })).resolves.toEqual(expect.objectContaining({ sent: 1 }));

    expect(client.post).toHaveBeenCalledWith('/smtp/email', {
      sender: {
        email: 'notification@molystudio.online',
        name: 'CSCA Moly Notifications',
      },
      subject: 'Lịch học mới',
      htmlContent: '<html><body>Thông báo</body></html>',
      textContent: 'Thông báo',
      messageVersions: [{
        to: [{ email: 'student@example.com', name: 'Học sinh' }],
        subject: 'Lịch học mới',
        htmlContent: '<html><body>Thông báo riêng</body></html>',
        textContent: 'Thông báo riêng',
      }],
    });
  });

  test('routes OTP and VIP email through the critical account', async () => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'default-key',
      BREVO_CRITICAL_API_KEY: 'critical-key',
      EMAIL_SENDER: 'notification@molystudio.online',
      EMAIL_CRITICAL_SENDER: 'security@example.com',
    };

    const defaultClient = {
      get: jest.fn(),
      post: jest.fn().mockResolvedValue({ data: { messageId: 'default-id' } }),
    };
    const criticalClient = {
      get: jest.fn(),
      post: jest.fn().mockResolvedValue({ data: { messageId: 'critical-id' } }),
    };
    jest.doMock('axios', () => ({
      create: jest.fn(config => (
        config.headers['api-key'] === 'critical-key' ? criticalClient : defaultClient
      )),
    }));

    const emailService = require('../emailService');
    await emailService.sendWelcomeEmail('student@example.com', 'Học sinh');
    await emailService.sendOtpEmail({
      email: 'student@example.com',
      name: 'Học sinh',
      otp: '123456',
      reason: 'login',
    });
    await emailService.sendVipActivatedEmail({
      email: 'student@example.com',
      name: 'Học sinh',
      packageName: 'VIP',
      durationDays: 30,
      expiresAt: new Date('2026-08-30T00:00:00.000Z'),
    });

    expect(defaultClient.post).toHaveBeenCalledTimes(1);
    expect(criticalClient.post).toHaveBeenCalledTimes(2);
    expect(criticalClient.post).toHaveBeenCalledWith(
      '/smtp/email',
      expect.objectContaining({
        sender: expect.objectContaining({ email: 'security@example.com' }),
        subject: '🔐 Mã OTP MOLY - 123456',
      })
    );
  });

  test('splits an admin batch across both accounts while preserving critical reserve', async () => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'default-key',
      BREVO_CRITICAL_API_KEY: 'critical-key',
      BREVO_CRITICAL_RESERVE: '1',
    };

    const defaultClient = {
      get: jest.fn().mockResolvedValue({
        data: { plan: [{ type: 'free', credits: 2, creditsType: 'sendLimit' }] },
      }),
      post: jest.fn().mockResolvedValue({ data: { messageIds: ['d1', 'd2'] } }),
    };
    const criticalClient = {
      get: jest.fn().mockResolvedValue({
        data: { plan: [{ type: 'free', credits: 5, creditsType: 'sendLimit' }] },
      }),
      post: jest.fn().mockResolvedValue({ data: { messageIds: ['c1', 'c2'] } }),
    };
    jest.doMock('axios', () => ({
      create: jest.fn(config => (
        config.headers['api-key'] === 'critical-key' ? criticalClient : defaultClient
      )),
    }));

    const emailService = require('../emailService');
    const result = await emailService.sendTransactionalBatch({
      recipients: [1, 2, 3, 4].map(index => ({
        email: `student${index}@example.com`,
        name: `Student ${index}`,
      })),
      subject: 'Lịch học',
      html: '<p>Lịch học</p>',
      text: 'Lịch học',
    });

    expect(result.sent).toBe(4);
    expect(result.reserveCritical).toBe(1);
    expect(result.accounts).toEqual([
      expect.objectContaining({ id: 'default', sent: 2, quotaBefore: 2, projectedAfter: 0 }),
      expect.objectContaining({ id: 'critical', sent: 2, quotaBefore: 5, projectedAfter: 3 }),
    ]);
    expect(defaultClient.post).toHaveBeenCalledTimes(1);
    expect(criticalClient.post).toHaveBeenCalledTimes(1);
  });

  test('returns quota for both Brevo accounts without exposing account details', async () => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'default-key',
      BREVO_CRITICAL_API_KEY: 'critical-key',
    };

    const defaultClient = {
      get: jest.fn().mockResolvedValue({
        data: {
          email: 'private@example.com',
          plan: [{ type: 'free', credits: 172, creditsType: 'sendLimit' }],
        },
      }),
      post: jest.fn(),
    };
    const criticalClient = {
      get: jest.fn().mockResolvedValue({
        data: {
          email: 'other-private@example.com',
          plan: [{ type: 'free', credits: 300, creditsType: 'sendLimit' }],
        },
      }),
      post: jest.fn(),
    };
    jest.doMock('axios', () => ({
      create: jest.fn(config => (
        config.headers['api-key'] === 'critical-key' ? criticalClient : defaultClient
      )),
    }));

    const emailService = require('../emailService');
    const result = await emailService.getQuotaStatus();

    expect(result.accounts).toEqual([
      expect.objectContaining({
        id: 'default',
        remaining: 172,
        dailyLimit: 300,
        usedToday: 128,
      }),
      expect.objectContaining({
        id: 'critical',
        remaining: 300,
        dailyLimit: 300,
        usedToday: 0,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('private@example.com');
  });
});
