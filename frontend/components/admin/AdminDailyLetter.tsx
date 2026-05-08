'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { canAccessAdminPanel } from '@/lib/utils/permissions';
import { FiX, FiHeart } from 'react-icons/fi';

const DAILY_MESSAGES = [
  // 0: Sunday
  {
    day: 'Chủ Nhật',
    title: 'Chủ nhật chill bíp bíp! 🦄',
    content: 'Cuối tuần rồi nè, nếu bạn đang đọc dòng này thì hẳn là bạn rất tâm huyết với dự án của tụi mình đó. Nhưng mà công việc thì lúc nào cũng làm được, còn sức khỏe và tinh thần của bản thân mới là quan trọng nhất nha. Đừng quên dành thời gian nghỉ ngơi, xem một bộ phim hay, ăn một món ngon để nạp đầy năng lượng chuẩn bị cho tuần mới rực rỡ nè. Cảm ơn sự cống hiến của bạn nha! Tụi mình biết ơn bạn nhiều lắm, dù là cuối tuần bạn vẫn một lòng theo đuổi dự án — đó là điều tuyệt vời đó!',
  },
  // 1: Monday
  {
    day: 'Thứ 2',
    title: 'Chào tuần mới rực rỡ! 💌',
    content: 'Một tuần làm việc mới lại bắt đầu rồi, thứ 2 đôi khi hơi bận rộn và dễ "tụt mood" một xíu nhưng mà bạn của hiện tại đang làm rất tốt và vô cùng chăm chỉ đó nha. Cùng hít một hơi thật sâu, lên dây cót tinh thần, vạch ra những mục tiêu nho nhỏ và từng bước hoàn thành nó nhé. Chúc bạn một ngày xử lý task mượt mà và không gặp bug! Fighting! Đừng quên rằng mỗi dòng code bạn viết ra đều đang giúp hàng trăm học sinh tiến bộ mỗi ngày — bạn đang làm công việc ý nghĩa hơn bạn nghĩ đó!',
  },
  // 2: Tuesday
  {
    day: 'Thứ 3',
    title: 'Chào ngày thứ 3 dễ thương! 🌟',
    content: 'Bắt đầu vào guồng công việc rồi nè. Bạn đã vượt qua được ngày thứ 2 "khó nhằn" một cách xuất sắc, nên hôm nay cứ từ từ tận hưởng nhịp độ công việc nhé. Nhớ là đừng ngồi quá lâu trước màn hình máy tính, thỉnh thoảng vươn vai một cái, uống một ly nước thật to rồi hẵng làm tiếp. Hệ thống thật may mắn khi có cậu đồng hành đó! Bạn làm việc cật lực lắm, từng task một nhỏ bé nhưng cộng lại thành đại thành công cho cả hệ thống. Tự hào về bạn nha!',
  },
  // 3: Wednesday
  {
    day: 'Thứ 4',
    title: 'Thứ 4 nhiệt huyết! 🧋',
    content: 'Úm ba la, thế là chúng ta đã đi được nửa chặng đường của tuần này rồi đó. Dù deadline có đang dí hay task có hơi chồng chất một xíu thì cũng đừng nản lòng nhé. Hãy tự thưởng cho mình một ly trà sữa full topping để lấy lại tinh thần nào. Bạn tuyệt vời lắm đó, tiếp tục tạo ra những nét đột phá cho hệ thống của tụi mình nha! Hôm nay bạn đã cố gắng rất nhiều rồi, đừng so sánh mình với ai khác — chỉ cần hôm nay bạn tốt hơn hôm qua là đã quá giỏi rồi!',
  },
  // 4: Thursday
  {
    day: 'Thứ 5',
    title: 'Thứ 5 rộn ràng! 🚀',
    content: 'Mới đó mà đã thứ 5 rồi, thời gian trôi nhanh quá phải không? Cậu làm việc miệt mài quá đi mất, hãy tự thưởng cho mình một nụ cười thật tươi nhé. Dù hôm nay có một chút rắc rối nhỏ, code có hơi bướng bỉnh một chút thì chúng mình vẫn luôn cố gắng cùng nhau. Đừng tự tạo áp lực nha, vì cậu đang làm rất tốt rồi! Bạn là người anh em đáng tin cậy của team, mỗi ngày bạn đều cho thấy sự kiên trì và tận tâm — điều đó vô cùng quý giá đó!',
  },
  // 5: Friday
  {
    day: 'Thứ 6',
    title: 'Ô la la, thứ 6 đến rồi! 🌈',
    content: 'Yahoo! Ngày mong đợi nhất tuần cuối cùng cũng gõ cửa. Hôm nay hãy dốc sức dọn dẹp ticket thật sạch sẽ để đón một ngày nghỉ cuối tuần trọn vẹn nhé. Cảm ơn bạn vì một tuần qua đã cống hiến hết mình, cày miệt mài vì sự phát triển chung. Tự hào về bạn lắm đó, chốt sổ và chuẩn bị "quẩy" thôi nào! Tuần này bạn đã nỗ lực hết mình rồi, không có gì phải hối tiếc cả — kỳ nghỉ cuối tuần xứng đáng với bạn lắm đó!',
  },
  // 6: Saturday
  {
    day: 'Thứ 7',
    title: 'Thứ 7 mộng mơ~ 🌸',
    content: 'Ai dza, đầu ngày nghỉ mà vẫn chăm chỉ vào check hệ thống nè, đỉnh xóp quá đi mất! Nhưng mà nè, làm lẹ lẹ rồi nhớ dành thời gian ra ngoài dạo phố, măm măm đồ ngon nha. Thứ 7 là đặc quyền để cậu healing, chăm sóc bản thân và bên cạnh những người yêu thương. Vất vả cho bạn trong tuần qua nhiều rồi, xõa thôi! Sự chăm chỉ của bạn là điều khiến cả team ngưỡng mộ, bạn không cần phải hoàn hảo — chỉ cần cố gắng hết mình là đã đủ tuyệt vời rồi nha!',
  },
];

export default function AdminDailyLetter() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(DAILY_MESSAGES[1]);

  useEffect(() => {
    if (!user || !canAccessAdminPanel(user)) return;

    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('admin_daily_letter_date');

    if (lastShown !== today) {
      const dayIndex = new Date().getDay();
      setMessage(DAILY_MESSAGES[dayIndex]);
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('admin_daily_letter_date', new Date().toDateString());
  };

  if (!isOpen) return null;

  const today = new Date();
  const dateStr = today.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">

        {/* Gradient header strip */}
        <div className="h-2 w-full" style={{
          background: 'linear-gradient(90deg, #f472b6 0%, #818cf8 50%, #34d399 100%)'
        }} />

        {/* Action Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-4 z-10 p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all duration-200"
        >
          <FiX size={16} />
        </button>

        {/* Content */}
        <div className="pt-6 pb-8 px-8 bg-gradient-to-b from-white to-pink-50/30">
          {/* Date tag */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-50 px-3 py-1 rounded-full">
              {dateStr}
            </span>
          </div>

          {/* Title */}
          <div className="mb-4">
            {(user?.display_name || user?.full_name) && (
              <p className="text-xs font-medium text-gray-400 mb-1">
                Chào {user.display_name || user.full_name} nhé 👋
              </p>
            )}
            <h2 className="text-2xl font-black text-gray-800 leading-tight">
              {message.title}
            </h2>
          </div>

          {/* Content */}
          <p className="text-sm text-gray-600 leading-relaxed mb-6 font-medium">
            {message.content}
          </p>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FiHeart className="text-pink-400 fill-pink-400 animate-pulse" size={14} />
              <span className="text-xs text-gray-400 font-medium">
                Đội ngũ admin
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-xs font-bold px-5 py-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors shadow-sm"
            >
              Đã hiểu!
            </button>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="h-2 w-full" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fbcfe8 0, #fbcfe8 10px, white 10px, white 20px, #93c5fd 20px, #93c5fd 30px, white 30px, white 40px)'
        }} />
      </div>
    </div>
  );
}
