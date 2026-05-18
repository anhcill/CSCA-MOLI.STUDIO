const http = require('http');

const data = JSON.stringify({
    question: 'Xin chào, 2+2 bằng mấy?',
    attemptId: 1
});

const options = {
    hostname: 'localhost',
    port: 5000,
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

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Time to connect: ${Date.now() - start}ms\n`);

    res.on('data', (chunk) => {
        if (!firstChunk) {
            firstChunk = Date.now();
            console.log(`Time to first chunk: ${firstChunk - start}ms\n--- Streaming ---\n`);
        }

        const lines = chunk.toString().split('\n');
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
                    // skip malformed
                }
            }
        }
    });

    res.on('end', () => {
        if (!done) {
            const total = Date.now() - start;
            console.log(`\n\nTotal: ${total}ms, Chars: ${charCount}`);
        }
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.write(data);
req.end();

setTimeout(() => {
    const total = Date.now() - start;
    console.log(`\nTimeout! Total: ${total}ms`);
    req.destroy();
    process.exit(0);
}, 60000);
