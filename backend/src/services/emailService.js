const axios = require('axios');

/**
 * Email Service - Brevo (Sendinblue) SMTP
 */
class EmailService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.criticalApiKey = process.env.BREVO_CRITICAL_API_KEY || this.apiKey;
    this.senderEmail = process.env.EMAIL_SENDER || 'cloudlystudio05@gmail.com';
    this.senderName = process.env.EMAIL_SENDER_NAME || 'MOLY.STUDIO';
    this.marketingSenderEmail = process.env.EMAIL_MARKETING_SENDER || this.senderEmail;
    this.marketingSenderName = process.env.EMAIL_MARKETING_SENDER_NAME || this.senderName;
    this.replyToEmail = process.env.EMAIL_REPLY_TO || '';
    this.marketingListId = Number.parseInt(process.env.BREVO_MARKETING_LIST_ID || '', 10);
    this.baseUrl = 'https://api.brevo.com/v3';

    this.client = this._createClient(this.apiKey);
    this.criticalClient = this.criticalApiKey === this.apiKey
      ? this.client
      : this._createClient(this.criticalApiKey);
  }

  _createClient(apiKey) {
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async _send({ to, subject, html, text, account = 'default' }) {
    const useCriticalAccount = account === 'critical';
    const apiKey = useCriticalAccount ? this.criticalApiKey : this.apiKey;
    const client = useCriticalAccount ? this.criticalClient : this.client;
    if (!apiKey) {
      const variableName = useCriticalAccount ? 'BREVO_CRITICAL_API_KEY' : 'BREVO_API_KEY';
      console.warn(`${variableName} not configured, email skipped:`, subject);
      return;
    }

    try {
      await client.post('/smtp/email', {
        sender: { email: this.senderEmail, name: this.senderName },
        to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || subject,
      });
      console.log(`Email sent: "${subject}" -> ${Array.isArray(to) ? to.join(', ') : to}`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      console.error(`Email failed: "${subject}" - ${msg}`);
    }
  }

  async sendCampaignBatch({ recipients, subject, html, text }) {
    if (!this.criticalApiKey) throw new Error('BREVO_CRITICAL_API_KEY not configured');
    if (!Number.isInteger(this.marketingListId) || this.marketingListId <= 0) {
      throw new Error('BREVO_MARKETING_LIST_ID not configured');
    }

    const uniqueRecipients = new Map();
    (recipients || []).forEach(recipient => {
      const email = String(recipient?.email || '').trim();
      if (!email) return;
      uniqueRecipients.set(email.toLowerCase(), {
        email,
        name: String(recipient?.name || email).trim().slice(0, 200),
      });
    });
    const validRecipients = [...uniqueRecipients.values()];
    if (!validRecipients.length) throw new Error('No valid recipients');

    // A Brevo marketing campaign supplies Gmail's standards-compliant
    // unsubscribe handling. Transactional notifications continue to use
    // /smtp/email through _send().
    await this._replaceMarketingList(validRecipients);

    const campaignPayload = {
      name: `Admin campaign ${new Date().toISOString()} - ${subject}`.slice(0, 200),
      sender: {
        email: this.marketingSenderEmail,
        name: this.marketingSenderName,
      },
      subject,
      previewText: subject,
      htmlContent: html,
      recipients: { listIds: [this.marketingListId] },
    };
    if (this.replyToEmail) {
      campaignPayload.replyTo = this.replyToEmail;
    }

    const campaign = await this.criticalClient.post('/emailCampaigns', campaignPayload);
    const campaignId = Number(campaign?.data?.id);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      throw new Error('Brevo did not return a campaign ID');
    }

    await this.criticalClient.post(`/emailCampaigns/${campaignId}/sendNow`);
    return {
      sent: validRecipients.length,
      campaignId,
      listId: this.marketingListId,
    };
  }

  async sendTransactionalBatch({ recipients, subject, html, text }) {
    if (!this.apiKey) throw new Error('BREVO_API_KEY not configured');

    const uniqueRecipients = new Map();
    (recipients || []).forEach(recipient => {
      const email = String(recipient?.email || '').trim();
      if (!email) return;
      uniqueRecipients.set(email.toLowerCase(), {
        ...recipient,
        email,
        name: String(recipient?.name || email).trim().slice(0, 200),
      });
    });
    const validRecipients = [...uniqueRecipients.values()];
    if (!validRecipients.length) throw new Error('No valid recipients');

    const batchSize = 50;
    let sent = 0;
    for (let index = 0; index < validRecipients.length; index += batchSize) {
      const chunk = validRecipients.slice(index, index + batchSize);
      await this.client.post('/smtp/email', {
        sender: { email: this.senderEmail, name: this.senderName },
        subject,
        htmlContent: html,
        textContent: text || subject,
        messageVersions: chunk.map(recipient => ({
          to: [{ email: recipient.email, name: recipient.name }],
          subject,
          htmlContent: recipient.html || html,
          textContent: recipient.text || text || subject,
        })),
      });
      sent += chunk.length;
      if (sent < validRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { sent };
  }

  async _replaceMarketingList(recipients) {
    try {
      const removal = await this.criticalClient.post(
        `/contacts/lists/${this.marketingListId}/contacts/remove`,
        { all: true }
      );
      await this._waitForProcess(removal?.data?.processId, this.criticalClient);
    } catch (error) {
      const message = String(error?.response?.data?.message || '');
      const alreadyEmpty = error?.response?.status === 400
        && message.includes('Contacts already removed from list');
      if (!alreadyEmpty) throw error;
    }

    const imported = await this.criticalClient.post('/contacts/import', {
      jsonBody: recipients.map(recipient => ({
        email: recipient.email,
        attributes: {
          FIRSTNAME: recipient.name,
        },
      })),
      listIds: [this.marketingListId],
      updateExistingContacts: true,
      emptyContactsAttributes: false,
      disableNotification: true,
    });
    await this._waitForProcess(imported?.data?.processId, this.criticalClient);
  }

  async _waitForProcess(processId, client = this.client) {
    if (!processId) return;
    const deadline = Date.now() + 60000;

    while (Date.now() < deadline) {
      const process = await client.get(`/processes/${processId}`);
      const status = String(process?.data?.status || '').toLowerCase();
      if (status === 'completed') return;
      if (['failed', 'error'].includes(status)) {
        throw new Error(`Brevo process ${processId} failed`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Brevo process ${processId} timed out`);
  }

  async getQuotaStatus() {
    const loadAccount = async ({ id, label, apiKey, client }) => {
      if (!apiKey) {
        return { id, label, configured: false, status: 'missing' };
      }

      try {
        const response = await client.get('/account');
        const plans = Array.isArray(response?.data?.plan) ? response.data.plan : [];
        const sendingPlan = plans.find(plan => plan?.creditsType === 'sendLimit') || plans[0] || {};
        const planType = String(sendingPlan.type || 'unknown').toLowerCase();
        const remaining = Number.isFinite(Number(sendingPlan.credits))
          ? Number(sendingPlan.credits)
          : null;
        const dailyLimit = planType === 'free' ? 300 : null;

        return {
          id,
          label,
          configured: true,
          status: 'ok',
          planType,
          creditsType: sendingPlan.creditsType || null,
          remaining,
          dailyLimit,
          usedToday: dailyLimit !== null && remaining !== null
            ? Math.max(0, dailyLimit - remaining)
            : null,
        };
      } catch (error) {
        return {
          id,
          label,
          configured: true,
          status: 'error',
          error: error?.response?.data?.message || 'Không thể đọc quota Brevo',
        };
      }
    };

    const [defaultAccount, criticalAccount] = await Promise.all([
      loadAccount({
        id: 'default',
        label: 'Học tập & hệ thống',
        apiKey: this.apiKey,
        client: this.client,
      }),
      loadAccount({
        id: 'critical',
        label: 'Xác minh, OTP, VIP & marketing',
        apiKey: this.criticalApiKey,
        client: this.criticalClient,
      }),
    ]);

    return {
      updatedAt: new Date().toISOString(),
      accounts: [defaultAccount, criticalAccount],
    };
  }

  buildAdminCampaignEmail({ subject, content, discountCode, actionLabel, actionUrl, recipientName }) {
    const safeContent = this.escapeHtml(content).replace(/\r?\n/g, '<br>');
    const safeCode = discountCode ? this.escapeHtml(discountCode) : '';
    const safeActionUrl = actionUrl ? this.escapeHtml(actionUrl) : '';
    const safeRecipientName = this.escapeHtml(recipientName || 'bạn');
    const safeActionLabel = this.escapeHtml(actionLabel || 'Xem thông tin');

    // Keep campaign emails close to a simple study-abroad letter. The layout
    // uses table-based, inline styles so it remains stable in Gmail and mobile
    // clients without loading external images.
    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0e7;font-family:Arial,'Segoe UI',sans-serif;color:#172033">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${this.escapeHtml(subject)} — Thông báo mới từ MOLY.STUDIO.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f0e7;padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#fffdf8;border:1px solid #ded6c8;border-top:6px solid #b4232e;border-radius:14px;overflow:hidden">
          <tr>
            <td style="padding:24px 28px 20px;border-bottom:1px solid #e8e0d3">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:48px;vertical-align:middle">
                    <div style="width:42px;height:42px;border-radius:50%;background:#b4232e;color:#fffdf8;text-align:center;line-height:42px;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:bold">学</div>
                  </td>
                  <td style="vertical-align:middle">
                    <p style="margin:0;color:#172033;font-size:16px;line-height:1.2;font-weight:900;letter-spacing:.4px">MOLY.STUDIO</p>
                    <p style="margin:4px 0 0;color:#8a7760;font-size:11px;line-height:1.3;font-weight:bold;letter-spacing:1.2px">CSCA · DU HỌC TRUNG QUỐC</p>
                  </td>
                  <td align="right" style="vertical-align:middle">
                    <span style="display:inline-block;border:1px solid #ddcdb8;border-radius:999px;padding:6px 10px;color:#9d2933;font-family:Georgia,'Times New Roman',serif;font-size:12px;font-weight:bold">留学</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 28px 30px">
              <p style="margin:0 0 10px;color:#9d2933;font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase">Thông báo dành cho bạn</p>
              <h1 style="margin:0 0 24px;color:#172033;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.28;font-weight:bold">${this.escapeHtml(subject)}</h1>
              <div style="width:42px;height:3px;margin:0 0 24px;background:#b4232e"></div>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#344054">Chào ${safeRecipientName},</p>
              <div style="font-size:15px;line-height:1.8;color:#475467">${safeContent}</div>
              ${safeCode ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;background:#faf4e8;border:1px dashed #c69a68;border-radius:10px">
                  <tr>
                    <td style="padding:16px 18px">
                      <p style="margin:0 0 7px;color:#8a7760;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase">Mã dành cho bạn</p>
                      <p style="margin:0;color:#9d2933;font-family:Consolas,'Courier New',monospace;font-size:21px;font-weight:900;letter-spacing:2px">${safeCode}</p>
                    </td>
                  </tr>
                </table>` : ''}
              ${safeActionUrl ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0">
                  <tr>
                    <td style="border-radius:8px;background:#b4232e">
                      <a href="${safeActionUrl}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:900">${safeActionLabel} &nbsp;→</a>
                    </td>
                  </tr>
                </table>` : ''}
              <p style="margin:30px 0 0;padding-top:22px;border-top:1px solid #e8e0d3;font-size:14px;line-height:1.7;color:#475467">
                Thân mến,<br>
                <strong style="color:#172033">Đội ngũ MOLY.STUDIO</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#172033;text-align:center">
              <p style="margin:0;color:#d6d0c5;font-size:11px;line-height:1.6">Đồng hành cùng bạn trên hành trình CSCA và du học Trung Quốc.</p>
              <p style="margin:4px 0 0;color:#8e98a8;font-size:10px;line-height:1.5">Đây là email thông báo từ tài khoản MOLY.STUDIO của bạn.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  frontendUrl(path = '') {
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}${path}`;
  }

  formatMoney(amount) {
    return `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))}đ`;
  }

  formatDate(value) {
    if (!value) return 'Chưa xác định';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Chưa xác định';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  toneGradient(tone) {
    const tones = {
      violet: 'linear-gradient(135deg,#7c3aed 0%,#2563eb 100%)',
      emerald: 'linear-gradient(135deg,#10b981 0%,#059669 100%)',
      amber: 'linear-gradient(135deg,#f59e0b 0%,#f97316 100%)',
      rose: 'linear-gradient(135deg,#fb7185 0%,#ef4444 100%)',
      slate: 'linear-gradient(135deg,#475569 0%,#111827 100%)',
      cyan: 'linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%)',
    };
    return tones[tone] || tones.violet;
  }

  button(label, href, tone = 'violet') {
    return `
      <div style="text-align:center;margin:28px 0 8px">
        <a href="${this.escapeHtml(href)}" style="display:inline-block;padding:15px 28px;background:${this.toneGradient(tone)};color:#fff;font-weight:900;border-radius:999px;text-decoration:none;font-size:15px;box-shadow:0 12px 24px rgba(37,99,235,.20)">
          ${this.escapeHtml(label)}
        </a>
      </div>`;
  }

  infoRows(rows) {
    return `
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 24px;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;background:#fff">
        ${rows.map((row, index) => `
          <tr>
            <td style="padding:14px 16px;color:#64748b;font-size:14px;border-bottom:${index === rows.length - 1 ? '0' : '1px solid #eef2f7'}">${this.escapeHtml(row.label)}</td>
            <td style="padding:14px 16px;text-align:right;color:#0f172a;font-size:14px;font-weight:900;border-bottom:${index === rows.length - 1 ? '0' : '1px solid #eef2f7'}">${row.valueHtml || this.escapeHtml(row.value)}</td>
          </tr>
        `).join('')}
      </table>`;
  }

  checklist(items, tone = 'violet') {
    const colors = {
      violet: ['#ede9fe', '#6d28d9'],
      emerald: ['#dcfce7', '#15803d'],
      amber: ['#fef3c7', '#b45309'],
      cyan: ['#cffafe', '#0e7490'],
      slate: ['#f1f5f9', '#334155'],
    }[tone] || ['#ede9fe', '#6d28d9'];

    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:18px 18px;margin:0 0 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${items.map(item => `
            <tr>
              <td valign="top" style="width:30px;padding:0 8px 12px 0">
                <span style="display:inline-block;width:22px;height:22px;border-radius:999px;background:${colors[0]};color:${colors[1]};line-height:22px;text-align:center;font-weight:900">✓</span>
              </td>
              <td valign="top" style="padding:1px 0 12px;color:#334155;font-size:14px;line-height:1.55">${this.escapeHtml(item)}</td>
            </tr>
          `).join('')}
        </table>
      </div>`;
  }

  callout(html, tone = 'violet') {
    const styles = {
      violet: ['#f5f3ff', '#7c3aed', '#4c1d95'],
      emerald: ['#ecfdf5', '#10b981', '#065f46'],
      amber: ['#fffbeb', '#f59e0b', '#92400e'],
      rose: ['#fff1f2', '#fb7185', '#9f1239'],
      slate: ['#f8fafc', '#64748b', '#334155'],
      cyan: ['#ecfeff', '#06b6d4', '#155e75'],
    }[tone] || ['#f5f3ff', '#7c3aed', '#4c1d95'];

    return `
      <div style="background:${styles[0]};border:1px solid ${styles[1]}33;border-left:5px solid ${styles[1]};border-radius:16px;padding:16px 18px;margin:0 0 24px;color:${styles[2]};font-size:14px;line-height:1.65">
        ${html}
      </div>`;
  }

  linkBox(url) {
    return `
      <p style="margin:18px 0 10px;color:#64748b;font-size:13px">Nếu nút không mở được, copy link này nha:</p>
      <div style="word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;color:#475569;font-size:12px;line-height:1.5">
        ${this.escapeHtml(url)}
      </div>`;
  }

  heroCard({ emoji, title, subtitle, tone = 'violet' }) {
    return `
      <div style="background:${this.toneGradient(tone)};border-radius:24px;padding:26px 22px;text-align:center;margin:0 0 26px;color:#fff">
        <div style="width:62px;height:62px;margin:0 auto 14px;border-radius:22px;background:rgba(255,255,255,.20);line-height:62px;font-size:32px">${emoji}</div>
        <h2 style="margin:0;color:#fff;font-size:24px;line-height:1.2;font-weight:900;letter-spacing:-.4px">${this.escapeHtml(title)}</h2>
        ${subtitle ? `<p style="margin:10px 0 0;color:rgba(255,255,255,.86);font-size:14px;line-height:1.55">${this.escapeHtml(subtitle)}</p>` : ''}
      </div>`;
  }

  _wrapper({ title, emoji = '✨', preheader = '', content, tone = 'violet' }) {
    const safeTitle = this.escapeHtml(title);
    const safePreheader = this.escapeHtml(preheader || title);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${safePreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#eef2ff 0%,#f8fafc 100%);padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:separate;border-spacing:0">
          <tr>
            <td style="padding:0 8px 14px;text-align:center">
              <div style="display:inline-block;padding:9px 14px;border-radius:999px;background:#fff;border:1px solid #dbeafe;color:#1d4ed8;font-size:12px;font-weight:900;letter-spacing:.3px">
                ${emoji} MOLY.STUDIO
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#fff;border:1px solid #e5e7eb;border-radius:28px;overflow:hidden;box-shadow:0 22px 60px rgba(15,23,42,.12)">
              <div style="background:${this.toneGradient(tone)};padding:34px 34px 30px;text-align:center;color:#fff">
                <div style="display:inline-block;width:58px;height:58px;border-radius:20px;background:rgba(255,255,255,.18);line-height:58px;font-size:30px;margin-bottom:14px">${emoji}</div>
                <h1 style="margin:0;color:#fff;font-size:26px;line-height:1.18;font-weight:900;letter-spacing:-.6px">${safeTitle}</h1>
                <p style="margin:10px auto 0;max-width:440px;color:rgba(255,255,255,.84);font-size:14px;line-height:1.55">Học CSCA chill hơn, rõ hướng hơn, bớt stress hơn.</p>
              </div>
              <div style="padding:34px 34px 28px;font-size:15px;line-height:1.7;color:#334155">
                ${content}
              </div>
              <div style="padding:22px 34px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center">
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.5">Email tự động từ MOLY.STUDIO. Nếu có gì lạ lạ, đừng reply mã OTP hay mật khẩu cho bất kỳ ai.</p>
                <p style="margin:0;color:#94a3b8;font-size:12px">© 2026 MOLY.STUDIO. Made for CSCA learners.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async sendContactMessage({ to, name, email, phone, subject, message }) {
    if (!this.apiKey) {
      throw new Error('BREVO_API_KEY not configured');
    }

    const safeEmail = this.escapeHtml(email);
    const safeMessage = this.escapeHtml(message).replace(/\n/g, '<br>');

    const html = this._wrapper({
      title: 'Có tin nhắn mới nè',
      emoji: '📩',
      tone: 'cyan',
      preheader: 'Một bạn vừa gửi liên hệ từ website MOLY.STUDIO.',
      content: `
        ${this.heroCard({ emoji: '📩', title: 'Tin nhắn mới từ website', subtitle: 'Có người đang cần MOLY.STUDIO hỗ trợ đó.', tone: 'cyan' })}
        ${this.infoRows([
          { label: 'Họ tên', value: name },
          { label: 'Email', valueHtml: `<a href="mailto:${safeEmail}" style="color:#2563eb;text-decoration:none;font-weight:900">${safeEmail}</a>` },
          { label: 'Điện thoại', value: phone || 'Không cung cấp' },
          { label: 'Chủ đề', value: subject || 'Liên hệ từ website' },
        ])}
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;color:#334155;font-size:14px;line-height:1.7">${safeMessage}</div>`,
    });

    const response = await this.client.post('/smtp/email', {
      sender: { email: this.senderEmail, name: this.senderName },
      to: [{ email: to }],
      replyTo: { email, name },
      subject: `[MOLY.STUDIO] ${subject || 'Tin nhắn liên hệ mới'}`,
      htmlContent: html,
      textContent: [
        `Họ tên: ${name}`,
        `Email: ${email}`,
        `Điện thoại: ${phone || 'Không cung cấp'}`,
        `Chủ đề: ${subject || 'Liên hệ từ website'}`,
        '',
        message,
      ].join('\n'),
    });

    return response.data;
  }

  async sendWelcomeEmail(email, name) {
    const safeName = this.escapeHtml(name || 'bạn');
    const content = `
      <h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a">Chào ${safeName}, welcome lên thuyền MOLY nha 👋</h2>
      <p style="margin:0 0 22px;color:#475569">Tài khoản đã sẵn sàng. Từ giờ bạn có thể luyện đề, lưu lịch sử, gom xu và bật mode học nghiêm túc mà vẫn dễ thở.</p>
      ${this.checklist([
        'Làm đề mô phỏng CSCA và xem lại lỗi sai sau mỗi bài.',
        'Học từ vựng, lý thuyết, công thức theo từng môn.',
        'Theo dõi tiến độ, lịch sử làm bài và bảng xếp hạng.',
        'Dùng xu để giảm một phần đơn hàng hoặc mở lượt AI nếu gói chưa nâng.',
      ], 'violet')}
      ${this.callout('<strong>Tip nhỏ:</strong> làm một đề ngắn trước để MOLY hiểu trình độ của bạn. Có dữ liệu rồi học mới đúng trọng tâm.', 'cyan')}
      ${this.button('Vào học ngay', this.frontendUrl(), 'violet')}`;

    await this._send({
      to: email,
      subject: '🎉 Welcome to MOLY.STUDIO, bắt đầu học thôi!',
      html: this._wrapper({
        title: 'Tài khoản MOLY đã mở khóa',
        emoji: '🎓',
        tone: 'violet',
        preheader: 'Chào mừng bạn đến với MOLY.STUDIO.',
        content,
      }),
    });
  }

  async sendVerificationEmail(email, name, verifyUrl) {
    const safeName = this.escapeHtml(name || 'bạn');
    const content = `
      <h2 style="margin:0 0 12px;font-size:22px;color:#0f172a">Xác nhận email nha ${safeName}</h2>
      <p style="margin:0 0 22px;color:#475569">Một bước nhỏ thôi là tài khoản của bạn sạch đẹp, bảo mật và sẵn sàng lưu toàn bộ tiến độ học.</p>
      ${this.button('Xác nhận email', verifyUrl, 'cyan')}
      ${this.linkBox(verifyUrl)}
      ${this.callout('Link có hiệu lực trong <strong>24 giờ</strong>. Nếu bạn không đăng ký tài khoản, cứ bỏ qua email này nha.', 'amber')}`;

    await this._send({
      to: email,
      subject: '📧 Xác nhận email MOLY.STUDIO',
      account: 'critical',
      html: this._wrapper({
        title: 'Xác nhận email',
        emoji: '📧',
        tone: 'cyan',
        preheader: 'Xác nhận email để hoàn tất tài khoản MOLY.STUDIO.',
        content,
      }),
    });
  }

  async sendPaymentConfirmation({ email, name, packageName, amount, durationDays, transactionCode, method }) {
    const methodLabel = {
      momo: 'MoMo',
      vnpay: 'VNPay',
      bank_transfer: 'Chuyển khoản ngân hàng',
      coupon_free: 'Ưu đãi / xu',
      manual: 'Kích hoạt thủ công',
    }[method] || method || 'Không xác định';

    const content = `
      ${this.heroCard({ emoji: '💳', title: 'Thanh toán thành công', subtitle: `${name || 'Bạn'} ơi, đơn của bạn đã được ghi nhận.`, tone: 'emerald' })}
      ${this.infoRows([
        { label: 'Gói dịch vụ', value: packageName },
        { label: 'Thời hạn', value: `${durationDays} ngày` },
        { label: 'Phương thức', value: methodLabel },
        { label: 'Mã giao dịch', value: transactionCode },
        { label: 'Số tiền', valueHtml: `<span style="font-size:20px;color:#059669">${this.formatMoney(amount)}</span>` },
      ])}
      ${this.callout('<strong>Done!</strong> Gói đã được kích hoạt. Vào học liền cho nóng, đừng để mood học rơi mất.', 'emerald')}
      ${this.button('Mở MOLY và học ngay', this.frontendUrl(), 'emerald')}`;

    await this._send({
      to: email,
      subject: `💳 Thanh toán thành công - ${packageName}`,
      html: this._wrapper({
        title: 'Thanh toán xong rồi nè',
        emoji: '💳',
        tone: 'emerald',
        preheader: `Thanh toán gói ${packageName} đã thành công.`,
        content,
      }),
    });
  }

  async sendOtpEmail({ email, name, otp, reason }) {
    const safeName = this.escapeHtml(name || 'bạn');
    const safeOtp = this.escapeHtml(otp);
    const reasonLabel = reason === 'login' ? 'đăng nhập' : reason === 'password_change' ? 'đổi mật khẩu' : 'xác thực';
    const content = `
      <h2 style="margin:0 0 12px;font-size:22px;color:#0f172a">Mã OTP của ${safeName}</h2>
      <p style="margin:0 0 22px;color:#475569">MOLY nhận được yêu cầu ${reasonLabel}. Nhập mã bên dưới để tiếp tục nha.</p>
      <div style="background:${this.toneGradient('slate')};border-radius:24px;padding:30px;text-align:center;margin:0 0 24px;color:#fff">
        <p style="margin:0 0 10px;color:rgba(255,255,255,.72);font-size:12px;font-weight:900;letter-spacing:1.8px;text-transform:uppercase">Mã xác thực</p>
        <p style="margin:0;font-size:44px;line-height:1;font-weight:900;letter-spacing:10px;font-family:Consolas,Monaco,monospace">${safeOtp}</p>
        <p style="margin:16px 0 0;color:rgba(255,255,255,.72);font-size:13px">Hiệu lực 5 phút.</p>
      </div>
      ${this.callout('<strong>Đừng share mã này nha.</strong> MOLY không bao giờ hỏi OTP qua chat, inbox hay điện thoại.', 'rose')}`;

    await this._send({
      to: email,
      subject: `🔐 Mã OTP MOLY - ${otp}`,
      account: 'critical',
      html: this._wrapper({
        title: 'Mã xác thực MOLY',
        emoji: '🔐',
        tone: 'slate',
        preheader: `Mã OTP của bạn là ${otp}.`,
        content,
      }),
    });
  }

  async sendPasswordResetEmail(email, resetUrl) {
    const content = `
      <h2 style="margin:0 0 12px;font-size:22px;color:#0f172a">Reset mật khẩu nè</h2>
      <p style="margin:0 0 22px;color:#475569">Bạn vừa yêu cầu tạo mật khẩu mới cho tài khoản MOLY.STUDIO. Bấm nút dưới đây để đặt lại.</p>
      ${this.button('Đặt lại mật khẩu', resetUrl, 'slate')}
      ${this.linkBox(resetUrl)}
      ${this.callout('Link chỉ sống trong <strong>15 phút</strong>. Nếu không phải bạn yêu cầu, bỏ qua email này và đổi mật khẩu nếu thấy tài khoản có dấu hiệu lạ.', 'amber')}`;

    await this._send({
      to: email,
      subject: '🔐 Đặt lại mật khẩu MOLY.STUDIO',
      account: 'critical',
      html: this._wrapper({
        title: 'Đặt lại mật khẩu',
        emoji: '🔐',
        tone: 'slate',
        preheader: 'Link đặt lại mật khẩu có hiệu lực trong 15 phút.',
        content,
      }),
    });
  }

  async sendVipExpirationReminder({ email, name, daysLeft, expiresAt }) {
    const safeName = this.escapeHtml(name || 'bạn');
    const formattedDate = this.formatDate(expiresAt);
    const content = `
      ${this.heroCard({ emoji: '⏰', title: `Gói sắp hết hạn sau ${daysLeft} ngày`, subtitle: 'Đừng để chuỗi học bị đứt đoạn nha.', tone: 'amber' })}
      <p style="margin:0 0 18px;color:#475569">Chào ${safeName}, gói của bạn sẽ hết hạn vào <strong>${formattedDate}</strong>.</p>
      ${this.checklist([
        'Giữ quyền truy cập đề và tài liệu theo gói.',
        'Tiếp tục xem lịch sử làm bài, lời giải và phần phân tích.',
        'Không bị ngắt nhịp ôn thi khi đang vào guồng.',
      ], 'amber')}
      ${this.callout('Gia hạn sớm không làm mất ngày còn lại. Học đều mới thắng lớn.', 'amber')}
      ${this.button('Gia hạn ngay', this.frontendUrl('/vip'), 'amber')}`;

    await this._send({
      to: email,
      subject: `⏰ Gói MOLY sắp hết hạn - còn ${daysLeft} ngày`,
      account: 'critical',
      html: this._wrapper({
        title: 'Gói sắp hết hạn',
        emoji: '⏰',
        tone: 'amber',
        preheader: `Gói của bạn còn ${daysLeft} ngày.`,
        content,
      }),
    });
  }

  async sendVipActivatedEmail({ email, name, packageName, durationDays, expiresAt }) {
    const formattedDate = this.formatDate(expiresAt);
    const content = `
      ${this.heroCard({ emoji: '✨', title: 'Nâng cấp thành công', subtitle: `${name || 'Bạn'} đã mở khóa ${packageName}`, tone: 'violet' })}
      ${this.infoRows([
        { label: 'Gói', value: packageName },
        { label: 'Thời hạn', value: `${durationDays} ngày` },
        { label: 'Hết hạn', value: formattedDate },
      ])}
      ${this.checklist([
        'Truy cập nội dung, đề, tài liệu theo phạm vi gói đã mua.',
        'AI phân tích kết quả và gợi ý ôn tập khi đủ dữ liệu.',
        'Xem lại lịch sử làm bài, lời giải và tiến độ học.',
        'Dùng MOLY theo cách chill hơn nhưng vẫn rất có mục tiêu.',
      ], 'violet')}
      ${this.button('Vào khu học của mình', this.frontendUrl(), 'violet')}`;

    await this._send({
      to: email,
      subject: `✨ ${packageName} đã kích hoạt, học thôi ${name || ''}!`,
      account: 'critical',
      html: this._wrapper({
        title: 'Gói đã kích hoạt',
        emoji: '✨',
        tone: 'violet',
        preheader: `Gói ${packageName} đã được kích hoạt.`,
        content,
      }),
    });
  }

  async sendVipExpiredEmail({ email, name, expiredAt }) {
    const safeName = this.escapeHtml(name || 'bạn');
    const formattedDate = this.formatDate(expiredAt);
    const content = `
      ${this.heroCard({ emoji: '📅', title: 'Gói đã hết hạn', subtitle: `Hết hạn từ ${formattedDate}`, tone: 'slate' })}
      <p style="margin:0 0 18px;color:#475569">Chào ${safeName}, quyền lợi gói trả phí của bạn đã tạm dừng. Nhưng dữ liệu học vẫn còn nguyên, không mất gì cả.</p>
      ${this.checklist([
        'Tài khoản và hồ sơ học tập vẫn được giữ.',
        'Lịch sử làm bài, điểm số và thống kê vẫn nằm trong profile.',
        'Bạn vẫn có thể dùng các phần miễn phí trên web.',
      ], 'slate')}
      ${this.callout('Khi cần quay lại nhịp ôn nghiêm túc, bạn có thể gia hạn bất kỳ lúc nào.', 'cyan')}
      ${this.button('Xem gói hiện có', this.frontendUrl('/vip'), 'slate')}`;

    await this._send({
      to: email,
      subject: '📅 Gói MOLY đã hết hạn',
      account: 'critical',
      html: this._wrapper({
        title: 'Gói đã hết hạn',
        emoji: '📅',
        tone: 'slate',
        preheader: 'Gói trả phí đã hết hạn, dữ liệu học vẫn được giữ.',
        content,
      }),
    });
  }

  async sendSecurityAlert({ email, name, event, ip, location, device, time }) {
    const safeName = this.escapeHtml(name || 'bạn');
    const eventLabel = {
      login: 'Có yêu cầu đăng nhập',
      device_replaced: 'Một thiết bị đăng nhập vừa được thay thế',
      password_change: 'Mật khẩu vừa được thay đổi',
      suspicious: 'Hoạt động đáng ngờ',
    }[event] || 'Thông báo bảo mật';
    const tone = event === 'suspicious' ? 'rose' : event === 'password_change' ? 'amber' : 'cyan';

    const content = `
      ${this.heroCard({ emoji: event === 'suspicious' ? '🚨' : '🔐', title: eventLabel, subtitle: 'Bảo mật tài khoản là ưu tiên số 1.', tone })}
      <p style="margin:0 0 18px;color:#475569">Chào ${safeName}, MOLY ghi nhận hoạt động sau trên tài khoản của bạn:</p>
      ${this.infoRows([
        { label: 'Thời gian', value: time || 'Không xác định' },
        { label: 'IP', value: ip || 'Không xác định' },
        { label: 'Vị trí', value: location || 'Không xác định' },
        { label: 'Thiết bị', value: device || 'Không xác định' },
      ])}
      ${this.callout(event === 'login'
        ? 'Nếu đúng là bạn thì yên tâm bỏ qua. Nếu không phải bạn, đổi mật khẩu ngay nha.'
        : '<strong>Nếu không phải bạn thực hiện, hãy đổi mật khẩu ngay</strong> và kiểm tra thiết bị đăng nhập.', event === 'suspicious' ? 'rose' : 'amber')}
      ${this.button('Kiểm tra tài khoản', this.frontendUrl('/profile'), tone)}`;

    await this._send({
      to: email,
      subject: `🔐 [MOLY] ${eventLabel}`,
      html: this._wrapper({
        title: 'Thông báo bảo mật',
        emoji: '🔐',
        tone,
        preheader: eventLabel,
        content,
      }),
    });
  }

  async sendQaReplyEmail({ email, name, ticketId, preview, advisorName, ticketUrl: customTicketUrl }) {
    const safeAdvisor = this.escapeHtml(advisorName || 'cố vấn MOLY');
    const ticketUrl = customTicketUrl || this.frontendUrl(`/hoi-dap/${ticketId}`);
    const previewText = preview
      ? this.escapeHtml(`${preview.substring(0, 150)}${preview.length > 150 ? '...' : ''}`)
      : 'Cố vấn đã gửi phản hồi mới cho bạn.';

    const content = `
      ${this.heroCard({ emoji: '💬', title: 'Cố vấn phản hồi rồi', subtitle: `${name || 'Bạn'}, câu hỏi của bạn có update mới.`, tone: 'cyan' })}
      <p style="margin:0 0 18px;color:#475569"><strong>${safeAdvisor}</strong> vừa phản hồi trong mục Hỏi Đáp 1-1.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin:0 0 24px;color:#334155;font-size:14px;line-height:1.7;font-style:italic">
        "${previewText}"
      </div>
      ${this.callout('Nếu vẫn chưa rõ, cứ hỏi tiếp trong ticket. Cố vấn sẽ bám mạch để hỗ trợ bạn tốt hơn.', 'cyan')}
      ${this.button('Mở câu trả lời', ticketUrl, 'cyan')}`;

    await this._send({
      to: email,
      subject: '💬 Cố vấn MOLY đã phản hồi câu hỏi của bạn',
      html: this._wrapper({
        title: 'Cố vấn đã phản hồi',
        emoji: '💬',
        tone: 'cyan',
        preheader: 'Câu hỏi Hỏi Đáp 1-1 của bạn có phản hồi mới.',
        content,
      }),
    });
  }
}

module.exports = new EmailService();
