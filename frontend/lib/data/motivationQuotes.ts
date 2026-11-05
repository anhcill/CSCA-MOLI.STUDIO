export interface MotivationQuote {
  text: string;
  author: string;
  originalChinese?: string;
  category?: 'discipline' | 'grit' | 'scholarship' | 'resilience';
}

export const RICH_MOTIVATION_QUOTES: MotivationQuote[] = [
  {
    text: 'Hành trình vạn dặm luôn bắt đầu từ một bước chân đơn sơ nhất. Đừng nhìn lên đỉnh núi mà chùn bước, hãy nhìn vào bước chân bạn sắp bước hôm nay.',
    author: 'Lão Tử — Đạo Đức Kinh',
    originalChinese: '千里之行，始于足下 (Thiên lý chi hành, thủy vu túc hạ)',
    category: 'resilience',
  },
  {
    text: 'Bảo kiếm sắc bén nhờ tôi rèn qua lửa đỏ và búa thép; hoa mai thơm ngát tự kiên cường vượt qua gió tuyết mùa đông giá lạnh. Nỗi vất vả hôm nay là hương thơm của ngày mai.',
    author: 'Cổ huấn phương Đông',
    originalChinese: '宝剑锋从磨砺出，梅花香自苦寒来',
    category: 'grit',
  },
  {
    text: 'Chân cứng đá mềm. Đá dẫu gập ghềnh sắc nhọn đến đâu cũng phải khuất phục trước đôi bàn chân không ngừng tiến bước của người có chí lớn.',
    author: 'Thành ngữ Việt Nam',
    originalChinese: '踏平坎坷成大道 (Đạp bình khảm khả thành đại đạo)',
    category: 'grit',
  },
  {
    text: 'Không gom góp từng nửa bước chân thì không thể đi tới ngàn dặm; không tích tụ từng dòng suối nhỏ thì chẳng thể hợp thành biển lớn mênh mông.',
    author: 'Tuân Tử — Khuyến Học',
    originalChinese: '不积跬步，无以至千里；不积小流，无以成江海',
    category: 'scholarship',
  },
  {
    text: 'Nước chảy đá mòn, có công mài sắt có ngày nên kim. Giọt nước tuy mềm nhưng rơi mãi thì đá tảng hoa cương cũng phải thủng.',
    author: 'Ngạn ngữ cổ',
    originalChinese: '水滴石穿，铁杵磨成针 (Thủy tích thạch xuyên, thiết chứ ma thành châm)',
    category: 'resilience',
  },
  {
    text: 'Cây tre suốt 4 năm đầu chỉ nhú lên 3cm nhưng rễ lan hàng trăm mét; từ năm thứ 5 vươn mình 30cm mỗi ngày. Bạn đang cắm rễ thật sâu trước ngày bứt phá!',
    author: 'Quy luật cây tre (竹子定律)',
    originalChinese: '厚积薄发 (Hậu tích bạc phát)',
    category: 'resilience',
  },
  {
    text: 'Đừng sợ đi chậm, chỉ sợ đứng yên. Người đi chậm mà không dừng lại bao giờ cũng sẽ vượt qua người chạy nhanh mà bỏ cuộc giữa chừng.',
    author: 'Ngạn ngữ phương Đông',
    originalChinese: '不怕慢，只怕站 (Bất phạ mạn, chỉ phạ trạm)',
    category: 'discipline',
  },
  {
    text: 'Thắng người khác là có sức mạnh, nhưng chiến thắng chính sự lười nhác và trì hoãn của bản thân mới là bậc chân cường nhân.',
    author: 'Lão Tử — Đạo Đức Kinh',
    originalChinese: '胜人者有力，自胜者强 (Thắng nhân giả hữu lực, tự thắng giả cường)',
    category: 'discipline',
  },
  {
    text: 'Cánh diều bay cao là nhờ ngược gió. Càng trong áp lực và nghịch cảnh, đôi cánh bản lĩnh và trí tuệ của bạn càng vút cao trên bầu trời.',
    author: 'Triết lý cánh diều',
    originalChinese: '逆风飞翔 (Nghịch phong phi tường)',
    category: 'grit',
  },
  {
    text: 'Ngọc không mài giũa không thành bảo vật, người không qua khổ luyện học tập khó thấu tỏ chân lý và làm nên đại sự.',
    author: 'Lễ Ký — Học Ký',
    originalChinese: '玉不琢，不成器；人不学，不知道',
    category: 'scholarship',
  },
  {
    text: 'Hạt mầm nằm sâu trong lòng đất không hề sợ hãi bóng tối; nó đang âm thầm tích lũy sinh lực cho ngày bung vỏ đón ánh bình minh rạng rỡ.',
    author: 'Triết lý hạt giống',
    originalChinese: '向阳而生 (Hướng dương nhi sinh)',
    category: 'resilience',
  },
  {
    text: 'Chúng ta đều phải chịu một trong hai nỗi đau: Nỗi đau của sự kỷ luật hoặc nỗi đau của sự hối hận. Kỷ luật chỉ nặng vài gram, hối hận nặng tới ngàn cân.',
    author: 'Jim Rohn',
    category: 'discipline',
  },
  {
    text: 'Con thuyền không bao giờ chìm vì nước vây quanh, nó chỉ chìm khi để nước tràn vào khoang. Giữ vững tâm thế định tĩnh trước mọi lo âu thi cử.',
    author: 'Triết lý an tâm',
    originalChinese: '风浪中的定力 (Phong lãng trung đích định lực)',
    category: 'resilience',
  },
  {
    text: 'Gieo suy nghĩ gặt hành động, gieo hành động gặt thói quen, gieo thói quen gặt số phận. Mỗi 25 phút Pomodoro hôm nay đang dệt nên tương lai của bạn.',
    author: 'Ngạn ngữ học vấn',
    originalChinese: '播种习惯，收获命运 (Bá chủng tập quán, thu hoạch mệnh vận)',
    category: 'discipline',
  },
  {
    text: 'Thời khắc tăm tối và lạnh giá nhất của đêm dài chính là lúc trời sắp sáng. Đừng bỏ cuộc khi bạn chỉ còn cách vạch đích vài bước chân!',
    author: 'Triết lý ánh sáng',
    originalChinese: '黎明前的黑暗 (Lê minh tiền đích hắc ám)',
    category: 'resilience',
  },
  {
    text: 'Chí hướng phải nuôi dưỡng nơi cao xa, hành động phải chắc chắn từng bước nhỏ. Ước mơ lớn chỉ thành tựu qua những trang bài tập tỉ mỉ mỗi ngày.',
    author: 'Gia Cát Lượng — Giới Tử Thư',
    originalChinese: '志当存高远，行当积跬步',
    category: 'scholarship',
  },
  {
    text: 'Nỗi mệt mỏi của những đêm thức khuya giải đề sẽ qua đi rất nhanh, nhưng niềm tự hào khi cầm bức thư mời nhập học sẽ theo bạn suốt cả cuộc đời.',
    author: 'MOLY.STUDIO Scholar',
    category: 'scholarship',
  },
  {
    text: 'Đừng đợi đến khi có đầy đủ cảm hứng mới bắt tay vào học; chính hành động ngồi vào bàn và mở trang sách ra sẽ kéo cảm hứng tìm đến với bạn.',
    author: 'Kỷ luật tự thân',
    category: 'discipline',
  },
  {
    text: 'Mỗi câu sai trong đề thi thử hôm nay không phải là thất bại, mà là một món quà: Nó chỉ cho bạn biết chính xác mình cần vá lỗ hổng ở đâu để lấy trọn điểm thi thật.',
    author: 'Bí quyết thủ khoa CSCA',
    category: 'scholarship',
  },
  {
    text: 'Thiên tài chỉ có 1% là bẩm sinh, 99% còn lại là mồ hôi và nước mắt đổ trên trang giấy. Người bình thường kiên trì đến cùng sẽ làm nên kỳ tích phi thường.',
    author: 'Thomas Edison',
    category: 'grit',
  },
  {
    text: 'Nếu bạn sinh ra không phải là con nhà có sẵn xuất phát điểm vượt trội, hãy tự biến mình thành điểm xuất phát vinh quang cho thế hệ mai sau.',
    author: 'Khát vọng thanh xuân',
    category: 'grit',
  },
  {
    text: 'Khi bạn muốn bỏ cuộc, hãy nhớ lại lý do vì sao ngày đầu tiên bạn quyết định dấn thân vào hành trình chinh phục kỳ thi này.',
    author: 'Tâm nguyện ban sơ',
    originalChinese: '不忘初心，方得始终 (Bất vong sơ tâm, phương đắc thủy chung)',
    category: 'resilience',
  },
  {
    text: 'Sách vở là bậc thang đưa con người tiến lên đỉnh cao văn minh. Mỗi trang sách bạn nghiền ngẫm hôm nay là một nấc thang nâng tầm nhân sinh quan của bạn.',
    author: 'Maxim Gorky',
    category: 'scholarship',
  },
  {
    text: 'Tập trung sâu giống như thấu kính hội tụ ánh sáng mặt trời thành một điểm: Khi năng lượng không bị phân tán, nó có thể đốt cháy mọi rào cản thách thức.',
    author: 'Cal Newport — Deep Work',
    category: 'discipline',
  },
  {
    text: 'Trời không phụ lòng người có tâm có chí. Người có chí nguyện son sắt, kiên định vượt muôn trùng sóng gió thì cửa ải nào rồi cũng sẽ vượt qua.',
    author: 'Kinh Thi phương Đông',
    originalChinese: '天道酬勤 (Thiên đạo thù cần - Trời đền đáp người chăm chỉ)',
    category: 'scholarship',
  },
];
