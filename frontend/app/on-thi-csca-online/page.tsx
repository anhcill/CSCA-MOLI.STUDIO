import type { Metadata } from 'next';
import CscaKeywordLanding from '../_seo/CscaKeywordLanding';

export const metadata: Metadata = {
  title: 'Ôn Thi CSCA Online Từ Cơ Bản Đến Luyện Đề Học Bổng CSC',
  description: 'Ôn thi CSCA online theo lộ trình: học từ vựng, luyện đề mô phỏng, xem lời giải, phân tích lỗi sai và chuẩn bị học bổng du học Trung Quốc.',
  alternates: { canonical: '/on-thi-csca-online' },
  keywords: ['ôn thi CSCA online', 'luyện thi CSCA online', 'học CSCA online', 'ôn học bổng CSC'],
};

export default function Page() {
  return <CscaKeywordLanding slug="on-thi-csca-online" badge="Học CSCA online" title="Ôn Thi CSCA Online Từ Cơ Bản Đến Luyện Đề Học Bổng CSC" description="Lộ trình ôn thi CSCA online cho học sinh Việt Nam: học nền tảng, luyện từ vựng, làm đề mô phỏng, xem lời giải và cải thiện điểm từng tuần." primaryCta="Bắt đầu ôn online" keywords={['ôn thi CSCA online', 'luyện thi CSCA online', 'học bổng CSC']} sections={[{ title: 'Ôn thi CSCA online phù hợp với ai?', body: ['Hình thức online phù hợp với học sinh ở xa trung tâm, người đang chuẩn bị hồ sơ học bổng hoặc muốn tự kiểm tra trình độ trước khi thi thật.', 'Điểm mạnh của học online là có thể học theo tốc độ cá nhân, xem lại lỗi sai và luyện đề nhiều lần.'] }, { title: 'Lộ trình ôn online nên gồm gì?', body: ['Một lộ trình tốt cần có 4 phần: hiểu cấu trúc đề, học từ vựng trọng tâm, luyện đề theo chuyên đề và làm đề tổng hợp có bấm giờ.', 'Mỗi tuần nên đặt mục tiêu rõ: số từ vựng cần học, số đề cần làm, số lỗi sai cần sửa và điểm mục tiêu.'] }, { title: 'MOLI.STUDIO hỗ trợ gì?', body: ['MOLI.STUDIO tập trung vào đề mô phỏng CSCA, từ vựng theo chủ đề, bài blog hướng dẫn và công cụ phân tích kết quả để người học biết cần cải thiện phần nào.', 'Khi kết hợp blog SEO và công cụ luyện đề miễn phí, người học có thể đi từ tìm hiểu CSCA đến đăng ký tài khoản và luyện tập thật.'] }]} faqs={[{ question: 'Ôn CSCA online có hiệu quả không?', answer: 'Có, nếu học theo lộ trình, làm đề đều và sửa lỗi sau mỗi bài.' }, { question: 'Người mới bắt đầu từ đâu?', answer: 'Nên đọc bài CSCA là gì, học từ vựng cơ bản rồi làm đề thử để biết trình độ.' }, { question: 'Có cần học HSK trước CSCA không?', answer: 'Nên có nền HSK 3–4 để đọc hiểu đề tốt hơn, sau đó học thêm từ vựng CSCA chuyên biệt.' }]} />;
}