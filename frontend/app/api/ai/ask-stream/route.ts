import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { question, attemptId } = body;

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
        body: JSON.stringify({ question, attemptId }),
    });

    if (!response.ok) {
        let message = 'AI stream đang gặp lỗi. Vui lòng thử lại.';
        try {
            const data = await response.json();
            message = data.message || data.error || message;
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
