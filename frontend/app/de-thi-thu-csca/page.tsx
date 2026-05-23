import type { Metadata } from 'next';
import CscaKeywordLanding from '../_seo/CscaKeywordLanding';

export const metadata: Metadata = {
  title: 'Đề Thi Thử CSCA Online Miễn Phí Có Đáp Án Và Chấm Điểm',
  description: 'Làm đề thi thử CSCA online miễn phí, luyện format đề thi CSCA, xem đáp án, phân tích lỗi sai và chuẩn bị hồ sơ học bổng du học Trung Quốc.',
  alternates: { canonical: '/de-thi-thu-csca' },
  keywords: ['đề thi thử CSCA', 'đề CSCA online', 'luyện đề CSCA', 'đề thi CSCA có đáp án'],
};

export default function Page() {
  return <CscaKeywordLanding slug="de-thi-thu-csca" badge="Luyện đề CSCA" title="Đề Thi Thử CSCA Online Miễn Phí Có Đáp Án Và Phân Tích Lỗi Sai" description="Làm đề thi thử CSCA giúp bạn quen format, kiểm tra tốc độ làm bài và biết phần nào đang yếu trước khi thi thật hoặc nộp hồ sơ học bổng." primaryCta="Làm đề thi thử ngay" keywords={['đề thi thử CSCA', 'luyện đề CSCA', 'đề CSCA online']} sections={[{ title: 'Vì sao nên làm đề thi thử CSCA?', body: ['Đề thi thử giúp bạn chuyển kiến thức rời rạc thành kỹ năng làm bài. Khi luyện đề có thời gian, bạn sẽ biết mình mất điểm ở phần đọc hiểu, từ vựng, toán hay kiến thức tổng hợp.', 'Làm đề đều cũng giúp tăng thời gian ở lại web, tạo thói quen học và giúp bạn chuẩn bị tốt hơn cho kỳ thi thật.'] }, { title: 'Cách luyện đề hiệu quả', body: ['Hãy làm đề trong điều kiện giống thi thật: không tra từ điển, bấm giờ và hoàn thành đủ các phần. Sau khi nộp bài, cần xem lại từng câu sai và ghi thành danh sách lỗi.', 'Mỗi tuần nên làm 2–3 đề mô phỏng, xen kẽ với học từ vựng CSCA và ôn lại kiến thức nền.'] }, { title: 'Nên luyện dạng câu nào trước?', body: ['Người mới nên bắt đầu từ câu dễ và chủ đề thường gặp: từ vựng học thuật, từ vựng toán tiếng Trung, văn hóa Trung Quốc và đọc hiểu ngắn.', 'Sau khi điểm ổn định, hãy chuyển sang đề tổng hợp dài hơn để rèn tốc độ và sức bền khi làm bài.'] }]} faqs={[{ question: 'Đề thi thử CSCA có giống đề thật không?', answer: 'Đề mô phỏng nên bám sát kỹ năng và format thường gặp, nhưng không cam kết trùng đề thật.' }, { question: 'Có nên làm nhiều đề liên tục không?', answer: 'Không nên chỉ cày đề. Sau mỗi đề phải phân tích lỗi sai, học lại từ vựng và kiến thức bị hổng.' }, { question: 'Bao nhiêu điểm là ổn?', answer: 'Mục tiêu an toàn thường là trên 70 điểm, nhưng học bổng cạnh tranh nên hướng tới 80+ nếu có thể.' }]} />;
}