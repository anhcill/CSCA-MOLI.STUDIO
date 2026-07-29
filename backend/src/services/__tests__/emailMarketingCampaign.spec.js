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

    expect(result).toEqual({ sent: 2, campaignId: 99, listId: 4 });
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
    expect(client.get).toHaveBeenCalledTimes(2);
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
    })).resolves.toEqual({ sent: 1, campaignId: 100, listId: 4 });
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/contacts/import',
      expect.any(Object)
    );
  });
});
