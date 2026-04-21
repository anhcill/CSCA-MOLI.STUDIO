const autocannon = require('autocannon');

// Nhập URL web thật của bạn hoặc Localhost
const TARGET_URL = 'https://csca-moli-studio.vercel.app'; 

console.log(`🚀 Bắt đầu bắn Load Test vào: ${TARGET_URL}`);
console.log('⚠️ Chú ý: Đang giả lập 100 người dùng truy cập cùng 1 lúc trong 15 giây...');

const instance = autocannon({
    url: TARGET_URL,
    connections: 100, // Số 100 người dùng online cùng lúc
    duration: 15,     // Test liên tục trong 15 giây
    requests: [
        {
            // Bắn vào trang chủ trước
            method: 'GET',
            path: '/'
        },
        // Nếu có API lấy đề thi, bắn thẳng vào Database để ép quá tải
        // {
        //     method: 'GET',
        //     path: '/api/exams' 
        // }
    ]
}, (err, result) => {
    if (err) {
        console.error('❌ Lỗi không thể Test:', err);
        return;
    }
    
    console.log('\n======================================');
    console.log('📊 KẾT QUẢ TEST ĐỘ CHỊU TẢI (REPORT)');
    console.log('======================================');
    console.log(`- ⏱️ Trung bình tải mất: ${result.latency.average} mili-giây (ms)`);
    console.log(`- 🚀 Số lượt tải 1 giây: ${result.requests.average} requests/s`);
    console.log(`- ❌ Số lần Web sập/lỗi: ${result.non2xx} lỗi`);
    console.log(`- ⌛ Số lần bị nghẽn (Timeout): ${result.timeouts} lần`);
    
    if (result.non2xx > 0 || result.timeouts > 0) {
        console.log('\n🚨 KẾT LUẬN: Web của bạn NGHẼN RỒI! Backend hoặc Database không chịu tải nổi 100 User/giây.');
    } else if (result.latency.average > 1500) {
        console.log('\n⚠️ KẾT LUẬN: Web chịu được nhưng RẤT CHẬM (>1.5 Giây). Người dùng sẽ bực mình!');
    } else {
        console.log('\n✅ KẾT LUẬN: TUYỆT VỜI! Web chạy mượt mà không rớt phát nào!');
    }
    console.log('======================================\n');
});

// Hiển thị thanh chạy tiến trình
autocannon.track(instance, { renderProgressBar: true });
