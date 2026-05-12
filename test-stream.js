const https = require('https');

const data = JSON.stringify({
    question: 'Xin chào, 2+2 bằng mấy?',
    attemptId: 1
});

const options = {
    hostname: 'www.molystudio.online',
    path: '/api/ai/ask-stream',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const start = Date.now();
let firstChunk = null;
let charCount = 0;
let done = false;

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Time to connect: ${Date.now() - start}ms`);

    res.on('data', (chunk) => {
        if (!firstChunk) {
            firstChunk = Date.now();
            console.log(`Time to first chunk: ${firstChunk - start}ms`);
            console.log('\n--- Streaming content ---\n');
        }

        const text = chunk.toString();
        const lines = text.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') {
                    console.log('\n--- DONE ---');
                    done = true;
                    return;
                }
                try {
                    const parsed = JSON.parse(dataStr);
                    const content = parsed?.choices?.[0]?.delta?.content;
                    if (content) {
                        charCount += content.length;
                        process.stdout.write(content);
                    }
                } catch (e) {
                    // skip
                }
            }
        }
    });

    res.on('end', () => {
        if (!done) {
            const total = Date.now() - start;
            console.log(`\n\nTotal time: ${total}ms, Total chars: ${charCount}`);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
});

req.write(data);
req.end();

setTimeout(() => {
    const total = Date.now() - start;
    console.log(`\nTimeout! Total: ${total}ms, Chars: ${charCount}`);
    req.destroy();
    process.exit(0);
}, 90000);
