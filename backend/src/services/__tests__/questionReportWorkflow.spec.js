jest.mock('../../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../../utils/auditLog', () => ({
  log: jest.fn(),
  reqMeta: jest.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'test' })),
}));

const { pool } = require('../../config/database');
const AuditLog = require('../../utils/auditLog');
const workflow = require('../questionReportWorkflowService');

describe('question report workflow', () => {
  afterEach(() => jest.clearAllMocks());

  test('resolve fixes every active report for the same question and writes audit history', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ question_id: 44 }] })
      .mockResolvedValueOnce({ rows: [{ id: 8, status: 'fixed' }], rowCount: 3 });

    const result = await workflow.resolve({
      id: 8,
      user: { id: 2, email: 'admin@example.com' },
      reason: 'Đã sửa đáp án',
      req: {},
    });

    expect(result.resolvedCount).toBe(3);
    expect(pool.query.mock.calls[1][0]).toContain("WHERE question_id = $3");
    expect(AuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resolve_question_report',
      entityId: 8,
      afterData: { status: 'fixed', resolvedCount: 3 },
    }));
  });

  test('ignore only closes the selected report and writes audit history', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 9, status: 'ignored' }], rowCount: 1 });

    const result = await workflow.ignore({
      id: 9,
      user: { id: 2, email: 'admin@example.com' },
      reason: 'Không phải lỗi',
      req: {},
    });

    expect(result.data.status).toBe('ignored');
    expect(AuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ignore_question_report',
      entityId: 9,
    }));
  });
});
