jest.mock('../../config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));
jest.mock('../questionReportWorkflowService', () => ({
  resolve: jest.fn(),
  ignore: jest.fn(),
}));

const db = require('../../config/database');
const questionReportWorkflow = require('../questionReportWorkflowService');
const controller = require('../../controllers/adminReportCenterController');

function responseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('admin report center controller', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns normalized paginated items', async () => {
    db.query.mockResolvedValue({
      rows: [{
        key: 'forum:12', source: 'forum', source_id: 12, type: 'message',
        status: 'pending', raw_status: 'pending', priority: 'high',
        title: 'Báo cáo tin nhắn', summary: 'Nội dung xấu', reporter_id: 2,
        reporter_name: 'A', reporter_email: 'a@example.com', target_type: 'message',
        target_id: 99, target_label: 'B', reference_url: null, assigned_to: null,
        created_at: new Date(), updated_at: new Date(), metadata: { messageId: 99 },
        total_count: 1,
      }],
    });
    const req = { query: { source: 'forum', page: '1', limit: '20' } };
    const res = responseMock();

    await controller.getItems(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: [expect.objectContaining({
        key: 'forum:12',
        reporter: { id: 2, name: 'A', email: 'a@example.com' },
        target: { type: 'message', id: 99, label: 'B' },
      })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }));
  });

  test('resolves a forum item transactionally', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 4, reporter_id: 7, reported_user_id: 8 }], rowCount: 1 })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValue(client);
    const req = {
      params: { source: 'forum', id: '4' },
      body: { action: 'resolve', note: 'Đã kiểm tra' },
      user: { id: 1 },
    };
    const res = responseMock();

    await controller.actionItem(req, res);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, affected: 1 }));
  });

  test('delegates question resolution without checking out a transaction client', async () => {
    questionReportWorkflow.resolve.mockResolvedValue({
      data: { id: 15, status: 'fixed' },
      resolvedCount: 2,
    });
    const req = {
      params: { source: 'question', id: '15' },
      body: { action: 'resolve', note: 'Đã sửa đáp án' },
      user: { id: 1, email: 'admin@example.com' },
    };
    const res = responseMock();

    await controller.actionItem(req, res);

    expect(questionReportWorkflow.resolve).toHaveBeenCalledWith(expect.objectContaining({
      id: 15,
      reason: 'Đã sửa đáp án',
    }));
    expect(db.pool.connect).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, affected: 2 }));
  });
});
