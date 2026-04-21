import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 }, // Tăng dần lên 50 người trong 10 giây
    { duration: '30s', target: 50 }, // Giữ nguyên 50 người dùng bắn liên tục trong 30 giây
    { duration: '5s', target: 0 },   // Dừng lại
  ],
};

export default function() {
  const BASE_URL = 'https://csca-moli-studio.vercel.app/api';
  
  // 1. Lấy thông số chung của hệ thống (Rất tốn Data SQL)
  let statsRes = http.get(`${BASE_URL}/stats`);
  
  // 2. Lấy danh sách môn học
  let subjectsRes = http.get(`${BASE_URL}/subjects`);

  // 3. Lấy Bảng xếp hạng Leaderboard
  let leaderboardRes = http.get(`${BASE_URL}/leaderboard`);

  // Gọi 3 API cùng lúc, ép Database chạy tối đa công suất
  check(statsRes, { 'GET Stats là 200': (r) => r.status === 200 });
  check(subjectsRes, { 'GET Subjects là 200': (r) => r.status === 200 });
  check(leaderboardRes, { 'GET Leaderboard là 200': (r) => r.status === 200 });

  // Nghỉ 1 giây rồi F5 làm lại
  sleep(1);
}
