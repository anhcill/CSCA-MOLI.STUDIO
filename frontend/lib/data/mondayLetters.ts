export interface MondayLetterItem {
  id: number;
  title: string;
  quoteChinese: string;
  quoteViet: string;
  quoteAuthor: string;
  greeting?: string;
  paragraphs: string[];
  proverbCallout: {
    badge: string;
    quote: string;
    meaning: string;
  };
  actionableGoals: {
    title: string;
    desc: string;
  }[];
  reminder: string;
  blessing: string;
}

export const MONDAY_LETTERS_BANK: MondayLetterItem[] = [
  {
    id: 1,
    title: 'Hành Trình Vạn Dặm Bắt Đầu Từ Một Bước Chân 🌟',
    quoteChinese: '千里之行，始于足下',
    quoteViet: 'Hành trình vạn dặm, khởi đầu từ một bước chân đơn sơ nhất.',
    quoteAuthor: 'Lão Tử — Đạo Đức Kinh',
    paragraphs: [
      'Thứ Hai đầu tuần đã gõ cửa rồi bạn ơi! 🌅 Chúc bạn một ngày mới tràn ngập nguồn năng lượng tươi mới, tinh thần minh mẫn và niềm tin vững chắc vào con đường mình đã lựa chọn.',
      'Cổ nhân dạy rằng: "Thiên lý chi hành, thủy vu túc hạ" (千里之行，始于足下). Đứng trước đỉnh núi cao sừng sững, người ta dễ sinh lòng e ngại. Nhìn vào bộ đề thi CSCA đồ sộ với hàng ngàn từ vựng HSK, hàng trăm công thức toán học và những dạng bài thi chuẩn hóa hóc búa, đôi lúc chúng mình cũng không tránh khỏi cảm giác choáng ngợp.',
      'Nhưng bạn ơi, không ai sinh ra đã lập tức trở thành thủ khoa, và cũng chẳng có ai giải trọn vẹn điểm tuyệt đối ngay trong lần thi thử đầu tiên. Tất cả những anh chị học viên bước lên bục vinh quang nhận học bổng toàn phần danh giá tại Thanh Hoa, Bắc Đại, Chiết Giang, Giao Đại... đều đã từng ngồi hàng trăm đêm miệt mài bên trang sách, kiên trì đi từng bước nhỏ giống hệt bạn lúc này.',
      'Thứ Hai hôm nay là một trang giấy mới tinh khôi. Hãy gác lại mọi băn khoăn của tuần cũ, tự tin đặt bước chân đầu tiên của tuần này thật dứt khoát và kiêu hãnh!',
    ],
    proverbCallout: {
      badge: 'Châm ngôn dẫn lối',
      quote: '“Người đi ngàn dặm không phải vì có đôi cánh, mà vì họ dám bước bước chân đầu tiên và không ngừng tiến tới.”',
      meaning: 'Mỗi bài tập bạn hoàn thành hôm nay, dù nhỏ bé, cũng đang rút ngắn khoảng cách đưa bạn đến cổng trường đại học mơ ước.',
    },
    actionableGoals: [
      {
        title: 'Bắt đầu bằng một bước nhỏ',
        desc: 'Giải quyết 1 đề hoặc 5 câu bài tập quen thuộc trong 25 phút Pomodoro đầu ngày để lấy đà quán tính.',
      },
      {
        title: 'Không so sánh với người khác',
        desc: 'Mỗi người có một biểu đồ tiến bộ riêng; chỉ cần hôm nay bạn hiểu thêm 1 công thức so với hôm qua là đã thắng.',
      },
      {
        title: 'Lưu giữ lỗi sai',
        desc: 'Cập nhật ngay vào Sổ tay câu sai — mỗi lỗi sai được mổ xẻ thấu đáo là một điểm số bạn giữ lại trong phòng thi thật.',
      },
    ],
    reminder: '🎯 Mục tiêu tuần này: Bật tối thiểu 2 ca Pomodoro tập trung cao độ mỗi ngày và không bỏ cuộc giữa chừng!',
    blessing: 'Chúc bạn tuần mới chân cứng đá mềm, học bài nào chắc bài đó và bứt phá mục tiêu! 🔥',
  },
  {
    id: 2,
    title: 'Chân Cứng Đá Mềm — Vượt Mọi Chông Gai 🚀',
    quoteChinese: '踏平坎坷成大道，斗罢艰险又出发',
    quoteViet: 'Đạp bằng gập ghềnh hóa đại đạo, vượt muôn hiểm trở lại lên đường.',
    quoteAuthor: 'Thành ngữ cổ phong',
    paragraphs: [
      'Người Việt ta từ xưa đã có câu đúc kết tuyệt đẹp: "Chân cứng đá mềm". Đá dẫu sắc nhọn, gập ghềnh đến đâu cũng phải chịu mòn nhẵn trước đôi bàn chân rắn rỏi đã trải qua ngàn dặm phong trần.',
      'Hành trình chinh phục học bổng CSCA và ước mơ bay sang giảng đường đại học Trung Quốc chưa bao giờ là một thảm đỏ êm ái. Sẽ có những ngày bạn ngồi trước một bài toán hình học hay một đoạn văn xã hội dài ngoằng mà thấy đầu óc đặc quánh. Sẽ có những lúc điểm thi thử tụt dốc khiến bạn nghi ngờ chính năng lực của bản thân.',
      'Nhưng chính trong những khoảnh khắc nghẹt thở ấy, đôi chân bạn đang học cách trở nên cứng cáp hơn. Khó khăn không sinh ra để dập tắt ngọn lửa trong bạn, mà sinh ra để chứng minh bạn xứng đáng với tấm vé du học danh giá này đến nhường nào!',
    ],
    proverbCallout: {
      badge: 'Bản lĩnh chiến binh',
      quote: '“Gặp gian nan mới biết dạ sắt son, qua ghềnh thác mới tỏ tài thuyền trưởng.”',
      meaning: 'Người kiên định là người nhìn thấy cơ hội bứt phá tiềm ẩn ngay bên trong những bài tập khó nhằn nhất.',
    },
    actionableGoals: [
      {
        title: 'Xem lại câu điểm liệt',
        desc: 'Dành 30 phút rà soát các câu hỏi bạn hay đánh lụi để tìm ra quy luật bẫy đề thi.',
      },
      {
        title: 'Tăng cường sức bền tinh thần',
        desc: 'Khi thấy muốn bỏ cuộc, hãy ngồi ráng thêm đúng 5 phút để hoàn thành nốt đoạn văn đang đọc dở.',
      },
      {
        title: 'Tự thưởng lời khen',
        desc: 'Mỗi tối hãy ghi nhận nỗ lực bền bỉ của chính mình vì bạn đã không đầu hàng trước áp lực.',
      },
    ],
    reminder: '📚 Lời nhắc: Đá dù cứng nhưng lòng người bền bỉ hơn đá. Vững bước tiến lên bạn nhé!',
    blessing: 'Vững tin lên bạn nhé, MOLY luôn đồng hành và tin tưởng tuyệt đối vào bản lĩnh của bạn! 🧡',
  },
  {
    id: 3,
    title: 'Bảo Kiếm Sắc Tự Tôi Mài, Hoa Mai Thơm Tự Giá Lạnh 💎',
    quoteChinese: '宝剑锋从磨砺出，梅花香自苦寒来',
    quoteViet: 'Bảo kiếm sắc bén nhờ tôi rèn, hoa mai thơm ngát tự giá lạnh.',
    quoteAuthor: 'Cổ huấn phương Đông',
    paragraphs: [
      'Chào buổi sáng người bạn kiên cường! 🌸 Bạn có từng tự hỏi tại sao thanh bảo kiếm truyền đời lại sáng loáng và chém sắt như chém bùn? Bởi vì nó đã trải qua hàng nghìn độ lửa đỏ nung nấu và muôn vạn nhát búa thép đập dập không thương tiếc.',
      'Và vì sao hoa mai lại được tôn vinh là loài hoa quân tử thanh cao nhất? Bởi vì giữa mùa đông tuyết trắng lạnh cắt da cắt thịt, khi muôn loài hoa khác héo úa lụi tàn thì mai vẫn âm thầm ngậm nụ, kiên cường bung nở hương thơm ngạt ngào khi xuân về.',
      'Những đêm bạn thức khuya giải đề, những buổi sáng mùa đông rời giường ấm để ngồi vào bàn học lúc 5 giờ sáng... Tất cả những giá lạnh ấy chính là môi trường nuôi dưỡng hương thơm hoa mai của bạn. Rồi một ngày không xa, khi cầm trên tay bức thư mời nhập học của ngôi trường mơ ước, bạn sẽ mỉm cười tự hào vì mình đã không sống hoài phí những năm tháng tuổi trẻ này!',
    ],
    proverbCallout: {
      badge: 'Đạo lý tôi luyện',
      quote: '“Không kinh qua một phen buốt giá thấu xương, sao có thể ngửi thấy mùi hoa mai thơm ngát mũi?”',
      meaning: 'Sự vất vả hôm nay chính là cái giá xứng đáng để đổi lấy tự do lựa chọn tương lai ngày mai.',
    },
    actionableGoals: [
      {
        title: 'Đón nhận bài khó với tâm thế tò mò',
        desc: 'Xem mỗi câu sai là một cơ hội để tôi rèn thêm một chiêu giải đề mới.',
      },
      {
        title: 'Tạo không gian học tập yên tĩnh',
        desc: 'Bật nhạc không lời kích thích sóng não Alpha tại Trạm Động Lực và tắt mọi thông báo.',
      },
      {
        title: 'Duy trì kỷ luật giờ giấc',
        desc: 'Ngủ đủ 7 tiếng và thức dậy đúng giờ để não bộ luôn ở trạng thái sắc bén nhất.',
      },
    ],
    reminder: '💡 Mẹo học tuần mới: Làm từ câu dễ đến câu khó, bảo vệ trọn vẹn điểm số cơ bản trước khi chinh phục câu phân loại.',
    blessing: 'Chúc bạn một tuần mới rực rỡ khí thế, kiên định vượt qua giá lạnh để đón chào mùa hoa mai nở rộ! 🌷',
  },
  {
    id: 4,
    title: 'Bất Tích Tích Bộ, Vô Dĩ Chí Thiên Lý 🌊',
    quoteChinese: '不积跬步，无以至千里；不积小流，无以成江海',
    quoteViet: 'Không góp nửa bước, chẳng thể tới ngàn dặm; không gom suối nhỏ, khó thành biển khơi.',
    quoteAuthor: 'Tuân Tử — Khuyến Học Thiên',
    paragraphs: [
      'Một tuần mới lại bắt đầu, mang theo biết bao cơ hội để bạn bứt phá! 🌊 Triết gia Tuân Tử từ nghìn năm trước đã để lại cho hậu thế bài học sâu sắc về sự tích lũy: Nếu không kiên nhẫn bước từng nửa bước chân nhỏ, bạn vĩnh viễn không thể vượt qua vạn dặm sơn hà.',
      'Nhiều bạn học viên thường rơi vào cảm giác sốt ruột: "Tại sao học cả tuần rồi mà điểm số thi thử vẫn chưa tăng vọt?". Nhưng tri thức cũng giống như mạch nước ngầm. Mỗi ngày bạn đọc một trang sách, mỗi ngày bạn ghi nhớ thêm 5 từ mới, mỗi ngày giải thêm 1 bài toán — nhìn bề ngoài có vẻ không đổi khác là bao, nhưng dòng nước ngầm ấy đang âm thầm tích tụ đầy ắp.',
      'Đến một thời điểm chín muồi, dòng nước ấy sẽ tuôn trào thành con sóng lớn đẩy bạn vượt qua mọi kỳ thi. Đừng nôn nóng muốn thấy kết quả ngay trong 24 giờ. Hãy tin tưởng vào phép màu của sự lặp đi lặp lại bền bỉ mỗi ngày!',
    ],
    proverbCallout: {
      badge: 'Sức mạnh tích lũy',
      quote: '“Mỗi ngày tiến bộ 1%, sau một năm bạn sẽ trở nên xuất sắc hơn gấp 37 lần.”',
      meaning: 'Đừng đánh giá thấp những nỗ lực tưởng chừng nhỏ bé mỗi ngày; chúng chính là nền móng của kỳ tích.',
    },
    actionableGoals: [
      {
        title: 'Chia nhỏ khối lượng kiến thức',
        desc: 'Học 10 từ vựng chuyên ngành mỗi ngày thay vì nhồi nhét 100 từ vào ngày cuối tuần.',
      },
      {
        title: 'Ôn tập ngắt quãng (Spaced Repetition)',
        desc: 'Xem lại công thức đã học của ngày hôm qua trước khi bắt đầu học bài mới.',
      },
      {
        title: 'Duy trì tính liên tục',
        desc: 'Dù bận rộn đến đâu cũng dành tối thiểu 20 phút học tập để mạch tư duy không bị đứt đoạn.',
      },
    ],
    reminder: '⏰ Deep Work: Đặt đồng hồ 25 phút Pomodoro, tập trung 100% không xao nhãng và cảm nhận từng hạt cát tri thức tích tụ.',
    blessing: 'Mỗi giờ bạn tập trung hôm nay là một bước tiến gần hơn tới cánh cổng trường đại học mơ ước! 🔥',
  },
  {
    id: 5,
    title: 'Nước Chảy Đá Mòn — Có Công Mài Sắt Có Ngày Nên Kim 🪨',
    quoteChinese: '水滴石穿，绳锯木断；铁杵磨成针',
    quoteViet: 'Nước chảy đá mòn, dây cưa gỗ đứt; thanh sắt mài hoài cũng hóa kim khâu.',
    quoteAuthor: 'Ngạn ngữ cổ phương Đông',
    paragraphs: [
      'Chào buổi sáng bạn hiền thân mến! 💧 Bạn hãy quan sát giọt nước mưa rơi trên mái hiên: Giọt nước mềm mại, yếu ớt, chạm vào tay liền tan biến. Thế nhưng, nếu hàng nghìn giọt nước cứ rơi đúng vào một điểm trên phiến đá hoa cương qua năm tháng, phiến đá cứng rắn kia cũng phải lõm thủng.',
      'Khối sắt đen sì, thô ráp và nặng nề, nhưng nếu có người ngày qua ngày kiên nhẫn mài giũa nó trên đá nhám, một ngày kia nó sẽ trở thành cây kim thêu tinh xảo có thể xuyên qua lụa là.',
      'Sự thông minh bẩm sinh có thể giúp ai đó xuất phát nhanh hơn bạn nửa vòng đua. Nhưng chính lòng nhẫn nại phi thường và sự bền bỉ không dứt mới là thứ đưa bạn cán đích thành công. Đừng tự ti nếu mình học chậm hơn người khác. Nước chảy đá mòn — người đi sau kiên trì hoàn toàn có thể trở thành quán quân!',
    ],
    proverbCallout: {
      badge: 'Sức mạnh bền bỉ',
      quote: '“Thành công không phải là một bước nhảy vọt thần kỳ, mà là chuỗi ngày không ngừng nỗ lực ngay cả khi không ai nhìn thấy.”',
      meaning: 'Sự nhẫn nại chính là vũ khí tối thượng biến những điều tưởng như bất khả thi thành hiện thực.',
    },
    actionableGoals: [
      {
        title: 'Luyện tập theo chuyên đề',
        desc: 'Chọn dạng toán bạn thấy yếu nhất và làm liên tục 10 bài tương tự cho tới khi nhuần nhuyễn.',
      },
      {
        title: 'Không bỏ qua lỗi nhỏ',
        desc: 'Lỗi tính toán dấu cộng trừ hay đọc thiếu dữ kiện đề bài cần được ghi chú bằng bút đỏ nổi bật.',
      },
      {
        title: 'Giữ tâm bình thản',
        desc: 'Khi gặp câu quá khó, hít thở sâu 3 giây rồi phân tích đề bài thành từng mảnh ghép nhỏ.',
      },
    ],
    reminder: '📝 Hành động ngay: Mở lại đề thi gần nhất, tìm ra 2 câu bạn chọn sai vì bất cẩn và tự tay giải lại thật chuẩn xác.',
    blessing: 'Chúc bạn có được sự kiên định bền bỉ như dòng nước mát, chảy qua mọi ghềnh thác để chạm đến biển lớn thành công! 🌊',
  },
  {
    id: 6,
    title: 'Quy Luật Cây Tre — 4 Năm Đầu Âm Thầm Cắm Sâu Bộ Rễ 🎋',
    quoteChinese: '厚积薄发，行稳致远',
    quoteViet: 'Tích lũy dày sâu mới vươn mình mạnh mẽ, bước đi vững chãi mới đến được chốn xa.',
    quoteAuthor: 'Đạo lý phương Đông',
    paragraphs: [
      'Thứ Hai tươi sáng nhé bạn ơi! 🎋 Bạn có biết câu chuyện chấn động về loài tre xanh ở phương Đông? Sau khi người nông dân gieo hạt, suốt 4 năm ròng rã, mầm tre chỉ nhú lên khỏi mặt đất vẻn vẹn đúng 3 centimet. Ai nhìn vào cũng tưởng hạt mầm đã chết hoặc còi cọc không thể lớn.',
      'Nhưng ít ai biết rằng, sâu thẳm dưới lòng đất tăm tối, bộ rễ của nó đang âm thầm lan rộng hàng trăm mét vuông, đâm xuyên qua sỏi đá khô cằn để hút trọn từng giọt dinh dưỡng quý báu.',
      'Để rồi bước sang năm thứ năm, từ một mầm non bé nhỏ, tre vươn mình với tốc độ thần kỳ: 30cm mỗi ngày! Chỉ trong vòng vỏn vẹn 6 tuần lễ, nó đã vút cao 15 mét, trở thành cả một rừng tre bạt ngàn kiêu hãnh trước bão giông.',
      'Nếu lúc này bạn thấy mình cày cuốc rất nhiều mà điểm số vẫn chưa tăng vọt, xin bạn đừng bao giờ nản lòng hay nghi ngờ bản thân. Bạn đang giống hệt như cây tre ấy — bạn đang cắm bộ rễ thật sâu, thật chắc vào lòng đất tri thức để chuẩn bị cho khoảnh khắc bứt phá ngoạn mục sắp tới!',
    ],
    proverbCallout: {
      badge: 'Quy luật tự nhiên',
      quote: '“Mọi kỳ tích vươn cao trên bầu trời đều bắt nguồn từ những tháng ngày âm thầm cắm rễ trong bóng tối.”',
      meaning: 'Đừng vội đòi hỏi quả ngọt khi cái cây của bạn mới đang trong giai đoạn bén rễ sâu.',
    },
    actionableGoals: [
      {
        title: 'Tin vào tiến trình của mình',
        desc: 'Dừng thói quen so sánh điểm số với bạn bè; tập trung toàn bộ năng lượng vào việc lấp lỗ hổng kiến thức.',
      },
      {
        title: 'Củng cố nền tảng lý thuyết',
        desc: 'Ôn chắc các định lý cơ bản và phương pháp biến đổi trước khi đi tìm các mẹo bấm máy tính.',
      },
      {
        title: 'Ghi nhật ký học tập',
        desc: 'Mỗi ngày viết ra 1 điều bạn đã làm tốt để tự nhắc nhở rằng bộ rễ của bạn đang lớn lên từng ngày.',
      },
    ],
    reminder: '🌱 Lời nhắn: Đừng nghi ngờ công sức của bản thân chỉ vì kết quả chưa hiện rõ ngay lập tức. Hãy tin vào bộ rễ của bạn!',
    blessing: 'Chúc bạn tâm thế vững vàng, an yên tích lũy và sẵn sàng cho khoảnh khắc vươn mình rực rỡ nhất! ✨',
  },
  {
    id: 7,
    title: 'Đừng Sợ Đi Chậm, Chỉ Sợ Đứng Yên 🚶‍♂️',
    quoteChinese: '不怕慢，只怕站；坚持到底，就是胜利',
    quoteViet: 'Không sợ đi chậm, chỉ sợ dừng chân; kiên trì đến cùng ắt là thắng lợi.',
    quoteAuthor: 'Danh ngôn dân gian',
    paragraphs: [
      'Gửi bạn một cái ôm tiếp lửa đầu tuần! 🐢 Trong truyện ngụ ngôn Rùa và Thỏ, chú thỏ chạy như bay nhưng vì ngạo mạn nằm ngủ dưới gốc cây nên cuối cùng đành ngậm ngùi nhìn chú rùa chậm chạp bước qua vạch đích.',
      'Trong cuộc đua dài hơi ôn thi CSCA cũng vậy: Điều nguy hiểm nhất không phải là bạn giải một đề toán mất nhiều thời gian hơn bạn bè, cũng không phải là bạn phải đọc lại một đoạn văn ba lần mới hiểu. Điều nguy hiểm duy nhất là bạn nản lòng, buông xuôi và DỪNG CHÂN ĐỨNG YÊN.',
      'Đi chậm mà đều đặn thì một ngày nào đó ngàn dặm chông gai cũng ở lại sau lưng. Mỗi ngày giải 1 đề, mỗi tuần thuộc 50 từ, mỗi tháng làm chủ 1 chuyên đề. Cứ đi đi, đừng dừng lại, bạn sẽ thấy mình đã đi xa đến mức khó tin!',
    ],
    proverbCallout: {
      badge: 'Tốc độ của sự kiên trì',
      quote: '“Người chậm chạp nhất mà không lạc hướng sẽ về đích nhanh hơn người chạy thục mạng mà không có mục tiêu.”',
      meaning: 'Sự kiên định và phương pháp đúng đắn quan trọng gấp vạn lần tốc độ mù quáng.',
    },
    actionableGoals: [
      {
        title: 'Thiết lập nhịp điệu đều đặn',
        desc: 'Học cố định vào một khung giờ trong ngày để tạo phản xạ tự nhiên cho não bộ.',
      },
      {
        title: 'Giải tỏa áp lực tâm lý',
        desc: 'Nếu hôm nay quá mệt, chỉ cần hoàn thành 1 phiên Pomodoro 25 phút thay vì ép mình ngồi 4 tiếng rồi kiệt sức.',
      },
      {
        title: 'Theo dõi tiến độ trực quan',
        desc: 'Đánh dấu tích xanh vào lịch học mỗi khi hoàn thành mục tiêu ngày.',
      },
    ],
    reminder: '🎯 Kế hoạch hôm nay: Chia nhỏ bài học khó thành từng phần 15 phút. Giải quyết từng phần một cách trọn vẹn.',
    blessing: 'Chúc bạn từng bước đi thong dong mà vững chãi, không hoang mang trước tốc độ của người khác! 🌸',
  },
  {
    id: 8,
    title: 'Thắng Người Là Có Lực, Thắng Mình Mới Là Cường Nhân 🛡️',
    quoteChinese: '胜人者有力，自胜者强',
    quoteViet: 'Thắng người khác chỉ là có sức mạnh, thắng được chính mình mới là bậc chân cường.',
    quoteAuthor: 'Lão Tử — Đạo Đức Kinh',
    paragraphs: [
      'Thứ Hai đầy nhiệt huyết nhé chiến binh dũng cảm! ⚔️ Chiến thắng một ai đó trong một bài kiểm tra có thể đem lại niềm hãnh diện nhất thời. Nhưng chiến thắng vinh quang và cao quý nhất của đời người là CHIẾN THẮNG CHÍNH MÌNH.',
      'Đó là khoảnh khắc bạn chiến thắng chiếc chăn ấm vào buổi sáng sớm để ngồi vào bàn học. Đó là lúc bạn dằn lòng đặt chiếc điện thoại xuống, không sa đà vào những đoạn video ngắn vô bổ. Đó là lúc bạn kiên nhẫn mở lại bài thi vừa bị điểm kém để phân tích từng câu sai thay vì trốn tránh.',
      'Bạn không sinh ra để cạnh tranh với bất kỳ ai trên thế giới này ngoài phiên bản của chính bạn ngày hôm qua. Làm chủ được tâm trí, rèn giũa được thói quen kỷ luật, bạn sẽ trở thành bất khả chiến bại trước mọi kỳ thi!',
    ],
    proverbCallout: {
      badge: 'Ý chí sắt đá',
      quote: '“Kẻ thù lớn nhất của đời người là chính mình, và chiến thắng vẻ vang nhất là chiến thắng sự lười nhác nội tâm.”',
      meaning: 'Mỗi lần bạn từ chối sự lười biếng để ngồi vào bàn học là một lần bạn khẳng định phẩm chất của một thủ khoa tương lai.',
    },
    actionableGoals: [
      {
        title: 'Quy tắc 3 giây',
        desc: 'Khi chuông báo thức reo hoặc đến giờ học, đếm "3, 2, 1" và lập tức đứng dậy hành động, không đắn đo.',
      },
      {
        title: 'Cách ly nguồn xao nhãng',
        desc: 'Để điện thoại ở phòng khác hoặc bật chế độ Không làm phiền trong suốt ca học.',
      },
      {
        title: 'Tự đánh giá trung thực',
        desc: 'Cuối ngày tự hỏi: "Hôm nay mình đã thực sự tập trung hay chỉ ngồi giả vờ chăm chỉ?".',
      },
    ],
    reminder: '🛡️ Thử thách bản thân: Dám tắt thông báo điện thoại trọn vẹn 2 tiếng đồng hồ để giải trọn 1 đề thi thử.',
    blessing: 'Chúc bạn nội lực phi thường, tự tin làm chủ thời gian và làm chủ vận mệnh của chính mình! 🌟',
  },
  {
    id: 9,
    title: 'Cánh Diều Bay Cao Nhờ Ngược Gió 🪁',
    quoteChinese: '逆风的方向，更适合飞翔；我不怕千万人阻挡，只怕自己投降',
    quoteViet: 'Hướng ngược chiều gió mới càng thích hợp để bay cao; chỉ sợ lòng mình đầu hàng, chẳng sợ muôn ngàn trắc trở.',
    quoteAuthor: 'Triết lý cánh diều',
    paragraphs: [
      'Chào buổi sáng người bạn bản lĩnh! 🪁 Bạn đã bao giờ thả diều trên triền đê lộng gió chưa? Nếu bạn chạy xuôi theo chiều gió, cánh diều sẽ loạng choạng rơi cắm đầu xuống đất. Nhưng khi bạn kéo căng dây và hướng cánh diều ngược lại chiều gió thổi, gió càng gầm rít dữ dội thì diều lại càng no gió và vút bay kiêu hãnh lên tầng mây xanh.',
      'Cuộc đời và kỳ thi CSCA này cũng hệt như vậy. Áp lực thời gian đếm ngược từng ngày, kỳ vọng từ cha mẹ thầy cô, những dạng đề thi mới lạ hóc búa... Tất cả những áp lực ấy chính là luồng gió ngược đang thử thách sải cánh ước mơ của bạn.',
      'Đừng trốn chạy áp lực, hãy kéo căng dây diều ý chí và mượn chính cơn gió ngược ấy làm bệ phóng đưa bạn bay cao hơn tất cả!',
    ],
    proverbCallout: {
      badge: 'Vượt qua nghịch cảnh',
      quote: '“Cây sồi trong thung lũng êm ả thường mềm yếu, chỉ có cây sồi trên đỉnh đồi lộng gió mới có rễ sâu và gỗ bền ngàn năm.”',
      meaning: 'Thử thách khắc nghiệt chính là món quà tôi rèn nên những nhân cách lớn và những tài năng kiệt xuất.',
    },
    actionableGoals: [
      {
        title: 'Chuyển hóa nỗi sợ thành hành động',
        desc: 'Thay vì lo lắng "Lỡ thi trượt thì sao?", hãy biến nó thành: "Mình sẽ làm gì ngay bây giờ để chắc chắn đỗ?".',
      },
      {
        title: 'Tập giải đề dưới áp lực thời gian',
        desc: 'Bấm giờ đúng 60 phút khi làm bài mô phỏng để quen dần với nhịp tim và áp lực phòng thi thật.',
      },
      {
        title: 'Tìm bạn đồng hành',
        desc: 'Vào Phòng Tự Học tại Trạm Động Lực để cùng học với các bạn học viên khác và tiếp thêm sinh khí.',
      },
    ],
    reminder: '🪁 Đổi góc nhìn: Thay vì than "Bài khó quá", hãy tự nhủ "Bài này sẽ giúp mình ghi điểm vượt trội so với các đối thủ khác!".',
    blessing: 'Chúc bạn sải cánh kiên cường, biến mọi cơn gió ngược thành lực đẩy đưa bạn tới bến bờ vinh quang! 🌈',
  },
  {
    id: 10,
    title: 'Ngọc Bất Trác Bất Thành Khí, Nhân Bất Học Bất Tri Đạo 🪓',
    quoteChinese: '玉不琢，不成器；人不学，不知道',
    quoteViet: 'Ngọc không mài giũa chẳng thành bảo vật; người không học hỏi khó tỏ tường chân lý.',
    quoteAuthor: 'Lễ Ký — Học Ký',
    paragraphs: [
      'Gửi bạn ngàn lời chúc tốt lành cho tuần mới! 💎 Trong lòng núi sâu tăm tối, viên ngọc thô lẫn trong đất đá xù xì, chẳng ai biết đến giá trị của nó. Chỉ khi người thợ kim hoàn tài ba dùng dao đục, lưỡi mài cắt xẻ từng nhát đau đớn, loại bỏ đi lớp vỏ xỉn màu thì ánh ngọc bích lấp lánh bên trong mới bừng sáng trước muôn người.',
      'Con người chúng ta sinh ra cũng như viên ngọc thô ấy. Những kiến thức hàn lâm sâu rộng, khả năng tư duy logic nhạy bén hay vốn Hán ngữ uyên thâm không tự nhiên mà có. Chúng là thành quả của quá trình mài giũa không ngừng nghỉ.',
      'Mỗi bài toán hóc búa bạn vật lộn hôm nay, mỗi từ mới bạn nắn nót viết vào vở chính là một nhát đục gọt giũa nên vẻ đẹp trí tuệ của bạn. Hãy trân trọng quá trình mài ngọc này bạn nhé!',
    ],
    proverbCallout: {
      badge: 'Tôi luyện giá trị',
      quote: '“Viên ngọc hoàn mỹ không phải là viên ngọc không tì vết bẩm sinh, mà là viên ngọc đã vượt qua muôn vàn lần mài giũa để tỏa sáng rực rỡ nhất.”',
      meaning: 'Đừng sợ những khuyết điểm hiện tại; mỗi ngày học tập là một ngày bạn đang gọt giũa bản thân hoàn thiện hơn.',
    },
    actionableGoals: [
      {
        title: 'Đối diện thẳng thắn với điểm yếu',
        desc: 'Lập danh sách 3 chủ đề kiến thức bạn thấy sợ nhất và dành tuần này để giải quyết dứt điểm.',
      },
      {
        title: 'Đặt câu hỏi đến cùng',
        desc: 'Khi chưa hiểu một bước giải, hãy tra cứu tài liệu hoặc hỏi trợ giảng MOLY đến khi thông suốt.',
      },
      {
        title: 'Giữ gìn sự chỉn chu',
        desc: 'Trình bày nháp và ghi chú một cách khoa học, rõ ràng để rèn luyện tính cẩn thận trong phòng thi.',
      },
    ],
    reminder: '📌 Thói quen tinh hoa: Viết lại lời giải chi tiết cho 1 dạng bài khó nhất mà bạn từng sợ hãi.',
    blessing: 'Chúc bạn luôn giữ được sự thanh cao, kiên nhẫn để từng đường nét tài năng trong bạn được tỏa sáng! 🌟',
  },
  {
    id: 11,
    title: 'Hạt Mầm Trong Đất Sâu Không Hề Sợ Bóng Tối 🌱',
    quoteChinese: '向阳而生，破土而出',
    quoteViet: 'Hướng về ánh dương mà sinh trưởng, phá vỡ lớp đất dày mà vươn lên.',
    quoteAuthor: 'Triết lý hạt mầm',
    paragraphs: [
      'Tuần mới an lành nhé bạn ơi! 🌱 Có bao giờ bạn cảm thấy cô đơn trên hành trình ôn thi này? Những buổi tối chỉ có một mình đối diện với màn hình máy tính và trang sách, bạn bè ngoài kia đang vui chơi giải trí, còn bạn vẫn ngồi đây cặm cụi từng nét bút.',
      'Những lúc như thế, hãy tự nhủ: "Mình không phải đang bị chôn vùi trong bóng tối, mà mình là một hạt giống đang được ươm dưỡng trong lòng đất phì nhiêu". Mọi cây đại thụ ngàn năm trước khi vươn cành đón nắng đều phải trải qua những tháng ngày nằm lặng lẽ dưới lòng đất sâu.',
      'Đó là khoảng thời gian hạt mầm tích lũy dưỡng chất, ủ men khát vọng và gom góp từng chút sinh lực. Ngày bạn bung vỏ hạt, phá vỡ lớp đất cằn cỗi để vươn mình đón ánh bình minh rạng rỡ sắp đến rồi. Kiên trì thêm một chút nữa thôi!',
    ],
    proverbCallout: {
      badge: 'Sức sống mãnh liệt',
      quote: '“Hạt giống nhỏ bé mang trong mình giấc mơ của cả một cánh rừng; chỉ cần nó không ngừng khao khát ánh sáng, không lớp đất nào có thể ngăn nó nảy mầm.”',
      meaning: 'Nỗi cô đơn và sự nỗ lực âm thầm hôm nay chính là tiền đề cho màn ra mắt huy hoàng ngày mai.',
    },
    actionableGoals: [
      {
        title: 'Chăm sóc sức khỏe tinh thần',
        desc: 'Tự dành cho mình 15 phút nghe nhạc thư giãn hoặc đi dạo nhẹ nhàng sau mỗi ca học căng thẳng.',
      },
      {
        title: 'Nhớ lại lý do bắt đầu',
        desc: 'Dán hình ảnh ngôi trường đại học bạn mơ ước lên trước bàn học để tiếp thêm động lực mỗi ngày.',
      },
      {
        title: 'Học tập với niềm vui khám phá',
        desc: 'Xem việc học không phải là gánh nặng ép buộc, mà là cơ hội tuyệt vời để nâng tầm nhận thức của chính mình.',
      },
    ],
    reminder: '🌿 Lời nhắn: Uống một cốc nước ấm, hít thở sâu 5 nhịp trước khi bắt đầu phiên học mới.',
    blessing: 'MOLY tin rằng ngày bạn vươn mình đón ánh bình minh rực rỡ đang đến rất gần! Hãy kiên cường nảy mầm! 💌',
  },
  {
    id: 12,
    title: 'Kỷ Luật Là Cầu Nối Duy Nhất Giữa Ước Mơ & Thực Tế 🌉',
    quoteChinese: '自律是通往梦想唯一的桥梁',
    quoteViet: 'Kỷ luật tự giác chính là cây cầu duy nhất dẫn lối ước mơ hóa thành hiện thực.',
    quoteAuthor: 'Nguyên lý thành công',
    paragraphs: [
      'Khởi đầu tuần mới thật kỷ luật nhé! ⚡ Hầu như ai trong chúng ta cũng ấp ủ những giấc mơ tuyệt đẹp: Giấc mơ nhận được thư trúng tuyển học bổng du học toàn phần, giấc mơ đặt chân đến Bắc Kinh, Thượng Hải, Hàng Châu, giấc mơ làm rạng danh gia đình và bản thân.',
      'Thế nhưng, ước mơ nếu không đi kèm hành động kỷ luật thì mãi mãi chỉ là những giấc mộng viển vông nằm trên trang giấy. Khoảng cách giữa bờ bên này (Ước mơ) và bờ bên kia (Hiện thực) được nối với nhau bằng một cây cầu độc nhất mang tên: KỶ LUẬT TỰ GIÁC.',
      'Cảm hứng chỉ là que diêm thắp lên ngọn lửa ban đầu; chính kỷ luật mới là khúc gỗ giữ cho ngọn lửa ấy bùng cháy qua những đêm đông lạnh giá. Khi bạn kỷ luật với chính mình, cuộc đời sẽ trao cho bạn quyền tự do lựa chọn tương lai mà bạn khao khát sống!',
    ],
    proverbCallout: {
      badge: 'Sức mạnh kỷ luật',
      quote: '“Chúng ta đều phải chịu một trong hai nỗi đau: Nỗi đau của sự kỷ luật hoặc nỗi đau của sự hối hận. Nhưng nỗi đau kỷ luật chỉ nặng vài gram, còn nỗi đau hối hận nặng tới ngàn cân.”',
      meaning: 'Hãy chọn chịu đựng sự vất vả tạm thời của kỷ luật để không bao giờ phải thốt lên hai từ "giá như".',
    },
    actionableGoals: [
      {
        title: 'Lập danh sách to-do list rõ ràng',
        desc: 'Viết ra đúng 3 nhiệm vụ quan trọng nhất cần hoàn thành trong ngày và giải quyết chúng trước tiên.',
      },
      {
        title: 'Kiên quyết không thỏa hiệp',
        desc: 'Đã hẹn giờ học là ngồi vào bàn, dù có lười biếng hay không có tâm trạng cũng phải bắt tay vào làm.',
      },
      {
        title: 'Đo lường thời gian thực học',
        desc: 'Sử dụng đồng hồ bấm giờ để biết chính xác bạn đã học sâu được bao nhiêu tiếng trong ngày.',
      },
    ],
    reminder: '⏰ Quy tắc 5 phút: Khi thấy lười biếng, hãy tự nhủ "Mình chỉ ngồi học đúng 5 phút thôi". Khi bắt đầu rồi, đà quán tính sẽ cuốn bạn vào bài học.',
    blessing: 'Chúc bạn rèn luyện được tinh thần kỷ luật thép, biến mọi ước mơ đẹp đẽ thành kết quả cụ thể trong tầm tay! 🎖️',
  },
  {
    id: 13,
    title: 'Con Thuyền Không Chìm Vì Nước Vây Quanh ⛵',
    quoteChinese: '风浪中的定力，决定舟楫的前程',
    quoteViet: 'Định lực giữa phong ba bão táp sẽ quyết định tiền đồ của cánh buồm rẽ sóng.',
    quoteAuthor: 'Triết lý biển cả',
    paragraphs: [
      'Một tuần mới thanh thản và định tâm nhé bạn! 🌊 Bạn có biết vì sao con thuyền nhỏ bằng gỗ có thể lênh đênh giữa đại dương mênh mông bão táp mà không bị chìm? Không phải vì biển cả ngoài kia không có sóng dữ, mà vì con thuyền KHÔNG ĐỂ NƯỚC BIỂN TRÀN VÀO KHOANG.',
      'Con thuyền chỉ chìm khi nó để nước từ bên ngoài rò rỉ vào bên trong lòng thuyền. Tâm trí bạn cũng hệt như vậy: Cuộc sống xung quanh sẽ luôn có những lời bàn tán hoài nghi ("Khó thế sao mà đỗ được?"), những so sánh áp lực, những nỗi âu lo bất an về tương lai.',
      'Những thứ đó không bao giờ có thể đánh gục bạn, TRỪ PHI bạn cho phép chúng tràn vào chiếm ngự tâm trí mình. Hãy bịt kín mọi khe hở của sự tự ti và nghi ngờ. Giữ tâm tĩnh lặng như mặt hồ, chỉ tập trung vào từng trang sách trước mặt. Tâm định thì tuệ phát, tuệ phát thì vạn sự ắt hanh thông!',
    ],
    proverbCallout: {
      badge: 'Nội lực định tĩnh',
      quote: '“Gió lay động cành cây, nước gợn sóng mặt hồ; nhưng người có tâm định như núi thái sơn thì không ngọn gió nào lay chuyển nổi.”',
      meaning: 'Sự tập trung cao độ và bình an nội tâm là chìa khóa mở ra tiềm năng học tập vô hạn.',
    },
    actionableGoals: [
      {
        title: 'Thanh lọc thông tin tiêu cực',
        desc: 'Hạn chế đọc các bài viết hay bình luận gây hoang mang về tỉ lệ chọi và độ khó của kỳ thi.',
      },
      {
        title: 'Tập thở sâu trước khi làm bài',
        desc: 'Thực hành hít vào 4 giây, giữ 4 giây, thở ra 4 giây để hạ nhịp tim và lấy lại sự bình tĩnh.',
      },
      {
        title: 'Tập trung vào điều bạn kiểm soát được',
        desc: 'Bạn không kiểm soát được đề thi sẽ ra câu gì, nhưng bạn hoàn toàn kiểm soát được nỗ lực học tập của mình hôm nay.',
      },
    ],
    reminder: '🕊️ Thanh lọc tâm trí: Dành 3 phút ngồi tĩnh tâm, thả lỏng vai gáy trước khi bước vào phòng thi mô phỏng.',
    blessing: 'Chúc bạn một tâm thế an nhiên tự tại, định lực vững vàng như núi thái sơn trước mọi thử thách! 🏔️',
  },
  {
    id: 14,
    title: 'Gieo Thói Quen Nhỏ, Gặt Số Phận Vinh Quang 🌾',
    quoteChinese: '播种习惯，收获命运；细节决定成败',
    quoteViet: 'Gieo thói quen nhỏ gặt hái số phận vinh quang; từng nét chi tiết quyết định nên bại thành.',
    quoteAuthor: 'Quy luật nhân quả học vấn',
    paragraphs: [
      'Chào buổi sáng người bạn chăm chỉ! 🌾 Khi nhìn vào những thủ khoa hay những học sinh xuất sắc nhận học bổng toàn phần, người ta thường nghĩ họ có bí quyết gì đó siêu nhiên hoặc sở hữu chỉ số IQ vượt trội. Nhưng sự thật hoàn toàn không phải vậy!',
      'Bí quyết duy nhất của họ chính là HỆ THỐNG THÓI QUEN NHỎ được lặp lại hàng ngày. Thói quen đọc lại lý thuyết mỗi sáng sớm, thói quen ghi chú câu sai bằng bút màu nổi bật, thói quen tra từ điển cặn kẽ khi gặp từ mới, thói quen kiểm tra lại bài làm 5 phút trước khi nộp...',
      'Thành công lớn không phải là một sự kiện chấn động diễn ra trong một đêm, mà là tổng hòa của hàng ngàn thói quen nhỏ tích lũy qua năm tháng. Hãy xây dựng cho mình những thói quen của một học giả chân chính ngay từ tuần này bạn nhé!',
    ],
    proverbCallout: {
      badge: 'Sức mạnh thói quen',
      quote: '“Trước tiên chúng ta tạo ra thói quen, sau đó chính thói quen sẽ kiến tạo nên số phận của chúng ta.”',
      meaning: 'Muốn thay đổi kết quả điểm số, trước hết hãy thay đổi những thói quen học tập nhỏ nhất mỗi ngày.',
    },
    actionableGoals: [
      {
        title: 'Rèn thói quen chuẩn bị bài',
        desc: 'Xem trước mục lục và các dạng bài sẽ học vào tối hôm trước để ngày hôm sau tiếp thu nhanh hơn.',
      },
      {
        title: 'Rèn thói quen ghi chú thông minh',
        desc: 'Áp dụng phương pháp ghi chép Cornell: Chia trang vở thành phần ý chính, phần chi tiết và phần tóm tắt.',
      },
      {
        title: 'Rèn thói quen dứt điểm',
        desc: 'Đã bắt đầu làm một đề thi thì phải làm đến câu cuối cùng, không bỏ dở giữa chừng.',
      },
    ],
    reminder: '📌 Thói quen vàng: Mỗi tối trước khi đi ngủ, dành ra đúng 10 phút để điểm lại 3 điều tâm đắc nhất bạn đã học được trong ngày.',
    blessing: 'Chúc bạn từng ngày gieo những hạt giống thói quen tốt lành để gặt hái một mùa vàng bội thu học bổng! 🌾🌟',
  },
  {
    id: 15,
    title: 'Ánh Sáng Sau Đường Hầm — Đêm Càng Tối Bình Minh Càng Rực Rỡ 🌅',
    quoteChinese: '黎明前的黑暗，是最接近光明的时刻',
    quoteViet: 'Khoảnh khắc tối tăm nhất trước bình minh cũng chính là lúc gần chạm tới ánh dương rực rỡ nhất.',
    quoteAuthor: 'Triết lý ánh sáng',
    paragraphs: [
      'Gửi bạn một cái ôm thật chặt và nhiều năng lượng ấm áp! 🌄 Người xưa từng chiêm nghiệm: Thời khắc tăm tối và lạnh giá nhất của một đêm dài luôn luôn là lúc mặt trời sắp sửa nhô lên khỏi đường chân trời.',
      'Trên con đường luyện thi gian truân này, sẽ có những thời điểm bạn cảm thấy sức lực dường như cạn kiệt, bài vở ngập đầu, điểm số chững lại và bạn muốn buông xuôi tất cả. Nhưng bạn ơi, hãy lắng nghe thật kỹ: Đó chính là dấu hiệu cho thấy bạn đã đi rất gần đến vạch đích rồi!',
      'Rất nhiều người đã dừng bước và bỏ cuộc ngay trước ngưỡng cửa thành công chỉ vì họ không biết rằng ánh sáng bình minh chỉ cách họ một bước chân nữa thôi. Đừng bỏ cuộc vào lúc này! Hãy ráng thêm một chút, kiên trì thêm một bài nữa, bình minh rạng rỡ của ngày vinh quy bái tổ đang chờ đón bạn phía trước!',
    ],
    proverbCallout: {
      badge: 'Niềm tin tất thắng',
      quote: '“Khi đôi chân bạn muốn dừng lại, hãy bước tiếp bằng ý chí và niềm tin của trái tim.”',
      meaning: 'Sự kiên trì trong những giây phút khó khăn nhất chính là ranh giới phân định giữa người bỏ cuộc và người chiến thắng.',
    },
    actionableGoals: [
      {
        title: 'Không ra quyết định khi kiệt sức',
        desc: 'Nếu thấy quá căng thẳng, hãy đi ngủ sớm và thức dậy với một tâm trí tươi mới vào sáng hôm sau.',
      },
      {
        title: 'Hình dung khoảnh khắc chiến thắng',
        desc: 'Mỗi khi nản lòng, hãy nhắm mắt 10 giây và tưởng tượng nụ cười tự hào của cha mẹ khi nhận tin bạn đỗ học bổng.',
      },
      {
        title: 'Gặp gỡ những người truyền cảm hứng',
        desc: 'Xem các video chia sẻ kinh nghiệm du học tại Trạm Động Lực để hâm nóng lại ngọn lửa khát khao trong lòng.',
      },
    ],
    reminder: '⚡ Tự tiếp sức: Khi thấy nản, hãy tự nhủ: "Chỉ còn một đoạn đường ngắn nữa thôi, mình nhất định sẽ làm được!".',
    blessing: 'Chúc bạn kiên cường vượt qua những giây phút tối tăm nhất để ngẩng cao đầu đón trọn ánh hào quang rực rỡ! ☀️💫',
  },
  {
    id: 16,
    title: 'Chí Hướng Cao Xa, Từng Bước Vững Vàng 🏔️',
    quoteChinese: '志当存高远，行当积跬步',
    quoteViet: 'Chí hướng phải nuôi dưỡng nơi cao xa, hành động phải chắc chắn từng bước nhỏ.',
    quoteAuthor: 'Gia Cát Lượng — Giới Tử Thư',
    paragraphs: [
      'Khởi đầu tuần mới với khí phách ngút trời nhé bạn! 📜 Bậc đại trí Gia Cát Lượng trong bức thư dạy con nổi tiếng muôn đời đã căn dặn: Làm người nuôi chí thì phải nhìn xa trông rộng, ôm ấp hoài bão lớn lao; nhưng khi bắt tay vào hành động thì phải cẩn trọng, tích lũy vững chắc từng nửa bước đi.',
      'Đặt mục tiêu giành học bổng toàn phần CSCA loại A không có gì là viển vông hay xa vời, nếu như mỗi ngày bạn đều cụ thể hóa ước mơ ấy bằng những giờ học sâu sắc, những đề thi được giải cặn kẽ và những lỗi sai được khắc phục triệt để.',
      'Tuổi trẻ của bạn là mùa xuân đẹp nhất của đời người. Đừng để nó trôi qua trong sự nhạt nhòa, lười biếng hay những lời tiếc nuối muộn màng. Hãy biến mỗi tuần lễ thành một kiệt tác của sự tập trung và nỗ lực hết mình. Tương lai rạng ngời đang vẫy tay chào đón bạn!',
    ],
    proverbCallout: {
      badge: 'Chí lớn hành động thật',
      quote: '“Nuôi chí lớn giúp bạn có phương hướng cuộc đời; hành động thực tế giúp bạn chạm tay vào đỉnh cao vinh quang.”',
      meaning: 'Sự kết hợp hoàn hảo giữa ước mơ bay bổng và hành động kiên định sẽ biến bạn thành người dẫn đầu.',
    },
    actionableGoals: [
      {
        title: 'Đặt mục tiêu tuần cụ thể',
        desc: 'Cam kết hoàn thành trọn vẹn 3 đề mô phỏng và học thuộc 40 thuật ngữ chuyên ngành trước tối Chủ Nhật.',
      },
      {
        title: 'Đánh giá lại vào cuối tuần',
        desc: 'Dành 30 phút tối Chủ Nhật để xem lại tỷ lệ hoàn thành mục tiêu và rút kinh nghiệm cho tuần sau.',
      },
      {
        title: 'Học tập với lòng biết ơn',
        desc: 'Biết ơn vì bản thân đang có cơ hội, thời gian và trí tuệ để phấn đấu cho một tương lai tươi sáng.',
      },
    ],
    reminder: '🎯 Hành động quyết liệt: Đặt ra 1 mục tiêu khó nhất tuần này và cam kết hoàn thành nó trước 22h tối thứ Sáu!',
    blessing: 'Chúc bạn nuôi chí lớn vững như bàn thạch, gặt hái trọn vẹn điểm số mơ ước và chạm tay vào tương lai huy hoàng! 🏆👑',
  },
];

/**
 * Lấy chỉ số bức thư tuần này dựa trên số tuần trong năm (hoặc ngày)
 */
export function getWeeklyLetterIndex(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  return Math.abs(weekNumber) % MONDAY_LETTERS_BANK.length;
}

export function getWeeklyMondayLetter(date: Date = new Date()): MondayLetterItem {
  const index = getWeeklyLetterIndex(date);
  return MONDAY_LETTERS_BANK[index];
}
