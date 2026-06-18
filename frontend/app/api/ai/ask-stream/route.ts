import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PUBLIC_AI_UNAVAILABLE_MESSAGE = 'Xin lỗi, AI đang gặp sự cố tạm thời. Bên mình sẽ kiểm tra và khắc phục sớm, bạn thử lại sau nhé.';
const PRIVATE_AI_ERROR_PATTERNS = [
    /https?:\/\//i,
    /www\./i,
    /\b(?:beeknoee|beegnoee|benoke|bennoke|9router|openrouter)\b/i,
    /\b(?:insufficient|balance|billing|payment|credit|credits|quota|recharge|top\s*up|api\s*key|api-key|apikey|no\s+api\s+key|not\s+enough|resource\s+exhausted)\b/i,
    /\b(?:so\s*du|nap\s*tien|tai\s*khoan|het\s*tien|het\s*credit)\b/i,
    /余额|账户|充值|额度|欠费/,
];

function sanitizeAIUserError(value: unknown, fallback = 'AI stream đang gặp lỗi. Vui lòng thử lại.'): string {
    const message = typeof value === 'string' ? value.trim() : fallback;
    if (!message) return fallback;
    const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (PRIVATE_AI_ERROR_PATTERNS.some(pattern => pattern.test(normalized))) {
        return PUBLIC_AI_UNAVAILABLE_MESSAGE;
    }
    return message;
}

export async function POST(req: NextRequest) {
    const body = await req.json();

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
    const streamUrl = apiUrl.endsWith('/api')
        ? `${apiUrl}/ai/ask-stream`
        : `${apiUrl}/api/ai/ask-stream`;
    const token = req.headers.get('authorization')?.replace('Bearer ', '');

    const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        let message = 'AI stream đang gặp lỗi. Vui lòng thử lại.';
        try {
            const data = await response.json();
            message = sanitizeAIUserError(data.message || data.error || message, message);
        } catch {
            // Keep default message if backend did not return JSON.
        }

        return new Response(
            `data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`,
            {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                },
            }
        );
    }

    if (!response.body) {
        return new Response(
            `data: ${JSON.stringify({ error: 'Không thể kết nối AI stream' })}\n\ndata: [DONE]\n\n`,
            {
                status: response.status,
                headers: {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                },
            }
        );
    }

    const stream = new ReadableStream({
        async start(controller) {
            const reader = response.body!.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                }
            } finally {
                reader.releaseLock();
            }
            controller.close();
        },
    });

    return new Response(stream, {
        status: response.status,
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
