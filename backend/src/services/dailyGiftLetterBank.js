const CURATED_DAILY_GIFT_SOURCE = 'curated_daily_letters';

const MOTIVATION_LETTERS = [
  {
    title: 'Thư Thứ Hai: Hành Trình Vạn Dặm Bắt Đầu Từ Một Bước Chân 🌟',
    quote: '千里之行，始于足下 (Thiên lý chi hành, thủy vu túc hạ - Lão Tử)',
    body: '🌅 Cổ nhân từng dạy: "Hành trình vạn dặm luôn bắt đầu từ một bước chân đơn sơ nhất" (千里之行，始于足下). Đừng nhìn lên đỉnh núi cao vời vợi mà chùn bước. Người đi vạn dặm không phải vì có đôi cánh, mà vì họ dám đặt bàn chân đầu tiên xuống đất và kiên định không ngừng bước tiếp.\n\nKhông ai sinh ra đã là thủ khoa, và cũng chẳng ai giải trọn vẹn một đề thi CSCA 90+ ngay từ ngày đầu tiên. Tất cả những anh chị học viên bước lên bục vinh quang nhận học bổng danh giá tại Thanh Hoa, Bắc Đại, Chiết Giang, Giao Đại... đều đã từng ngồi hàng trăm đêm miệt mài bên trang sách, kiên trì đi từng bước nhỏ giống như chính bạn hôm nay. Thứ Hai là trang giấy mới tinh khôi, hãy bước bước chân đầu tiên của tuần này thật vững vàng và tự tin nhé! 💪✨',
    reminder: '🎯 Mục tiêu tuần này: Bật Pomodoro 25 phút mỗi ngày, giải 2 đề thi mô phỏng và không bỏ cuộc giữa chừng!',
    blessing: 'Chúc bạn tuần mới chân cứng đá mềm, học bài nào chắc bài đó và bứt phá mục tiêu! 🔥',
  },
  {
    title: 'Thư Bản Lĩnh: Chân Cứng Đá Mềm, Vượt Mọi Chông Gai 🚀',
    quote: '踏平坎坷成大道 (Đạp bình khảm khả thành đại đạo)',
    body: '🔥 Người xưa có câu: "Chân cứng đá mềm". Đá dẫu sắc nhọn, gập ghềnh cũng phải khuất phục trước đôi bàn chân rắn rỏi đã kinh qua ngàn dặm gió sương. Con đường chinh phục học bổng CSCA và giấc mơ du học Trung Quốc chưa bao giờ là thảm đỏ trải hoa hồng phẳng lặng.\n\nSẽ có những dạng toán phân tích hóc búa, những bài đọc hiểu dài ngoằng, những từ vựng HSK chuyên ngành làm bạn thấy mỏi mệt. Nhưng bạn ơi, mỗi thử thách hôm nay chính là đá sỏi tôi luyện cho đôi chân bạn thêm cứng cáp, bản lĩnh học giả trong bạn thêm dày dặn. Khó khăn không sinh ra để cản bước, mà để chứng minh bạn xứng đáng với ước mơ lớn của mình đến nhường nào! 🧱🌱',
    reminder: '📚 Lời nhắc: Đừng sợ làm sai! Mỗi câu sai được hiểu sâu hôm nay là một điểm số quý giá bạn giữ lại trong phòng thi thật.',
    blessing: 'Vững tin lên bạn nhé, MOLY luôn đồng hành và tin tưởng tuyệt đối vào nỗ lực phi thường của bạn! 🧡',
  },
  {
    title: 'Thư Tôi Luyện: Bảo Kiếm Sắc Tự Tôi Mài, Mai Thơm Tự Giá Lạnh 💎',
    quote: '宝剑锋从磨砺出，梅花香自苦寒来 (Bảo kiếm phong tòng ma lệ xuất, mai hoa hương tự khổ hàn lai)',
    body: '❄️ Thanh bảo kiếm sắc bén ngàn năm lưu danh chỉ thành hình sau vô vàn lần nung mình trong lửa đỏ và chịu trăm ngàn nhát búa đập tôi rèn. Bông hoa mai vàng kiêu hãnh giữa đất trời chỉ tỏa ra hương thơm thanh khiết nhất khi đã kiên cường băng qua mùa đông giá rét cắt da cắt thịt.\n\nVinh quang của suất học bổng toàn phần danh giá cũng vậy — nó chỉ nở rộ cho những ai từng dám ngồi lại một mình bên bàn học lúc đêm khuya, kiên trì gặm nhấm từng công thức khô khan, tự lau đi giọt nước mắt thất vọng sau một bài kiểm tra chưa ưng ý. Những ngày tháng cô đơn khổ luyện này chính là ngọn lửa tôi rèn nên một phiên bản kiệt xuất của bạn mai sau! 🗡️🌸',
    reminder: '💡 Mẹo học tuần mới: Làm từ câu dễ đến câu khó, ghi chú lại các bẫy đề thi vào Sổ tay câu sai ngay sau khi nộp bài.',
    blessing: 'Chúc bạn một tuần mới rực rỡ khí thế, kiên định vượt qua giá lạnh để đón chào hương thơm hoa mai nở rộ! 🌷',
  },
  {
    title: 'Thư Tích Lũy: Bất Tích Tích Bộ, Vô Dĩ Chí Thiên Lý 🌊',
    quote: '不积跬步，无以至千里；不积小流，无以成江海 (Tuân Tử - Khuyến Học)',
    body: '🌊 Triết gia Tuân Tử từng đúc kết: "Không gom góp từng nửa bước chân, không thể đi tới ngàn dặm; không tích tụ từng dòng suối nhỏ, chẳng thể hợp thành biển lớn mênh mông". Đừng bao giờ sốt ruột vì hôm nay mình mới chỉ làm được một vài câu toán, mới chỉ nhớ thêm mười từ vựng mới.\n\nĐại dương mênh mông được tạo nên từ vô số giọt nước tí hon; ngọn núi Thái Sơn sừng sững cũng bắt đầu từ từng nắm đất cát. Mỗi 25 phút tập trung tại Trạm Động Lực, mỗi bài giải chi tiết bạn ghi vào vở chính là một hạt cát bồi đắp nên lâu đài tri thức. Cứ đều đặn, không gián đoạn — phép màu của sự tích lũy sẽ khiến bạn kinh ngạc khi nhìn lại! 📖✨',
    reminder: '⏰ Chiến lược Deep Work: Duy trì tối thiểu 2 phiên Pomodoro 25 phút liên tục mỗi ngày, tuyệt đối không chạm vào điện thoại.',
    blessing: 'Mỗi giờ bạn tập trung hôm nay là một bước tiến gần hơn tới cánh cổng trường đại học mơ ước! 🔥',
  },
  {
    title: 'Thư Kiên Trì: Nước Chảy Đá Mòn - Có Công Mài Sắt Có Ngày Nên Kim 🪨',
    quote: '水滴石穿，绳锯木断；铁杵磨成针 (Thủy tích thạch xuyên, thiết chứ ma thành châm)',
    body: '💧 Từng giọt nước rơi xuống tưởng chừng mỏng manh yếu ớt, nhưng rơi mãi nghìn ngày thì khối đá hoa cương rắn chắc nhất cũng phải mòn lõm. Thanh sắt dù thô ráp nặng trĩu, qua bàn tay nhẫn nại mài giũa mỗi ngày rồi cũng biến thành chiếc kim thêu tinh xảo.\n\nSự thông minh bẩm sinh có thể giúp ai đó xuất phát nhanh hơn, nhưng chính lòng kiên trì bất khuất mới là thứ đưa bạn vượt qua vạch đích cuối cùng. Khi bạn cảm thấy bài học quá dài hay đề thi quá hóc búa, hãy nhớ đến giọt nước bền bỉ. Bạn không cần phải làm điều gì quá phi thường mỗi ngày, chỉ cần bạn không bao giờ bỏ cuộc! ⏳💎',
    reminder: '📝 Hành động nhỏ: Mở đề thi gần nhất, xem lại 3 câu bạn đã chọn sai và tự tay giải lại theo cách hiểu của mình.',
    blessing: 'Chúc bạn sự kiên định bền bỉ như dòng nước mát, chảy qua mọi ghềnh thác để chạm đến biển lớn thành công! 🌊',
  },
  {
    title: 'Thư Âm Thầm: Quy Luật Cây Tre - 4 Năm Đầu Cắm Sâu Bộ Rễ 🎋',
    quote: '厚积薄发 (Hậu tích bạc phát - Tích lũy dày sâu, vươn mình mạnh mẽ)',
    body: '🎋 Bạn có biết quy luật kỳ diệu của cây tre? Suốt 4 năm đầu tiên sau khi gieo mầm, nó chỉ nhú lên khỏi mặt đất vỏn vẹn 3cm. Nhìn bề ngoài tưởng như nó chẳng hề lớn lên. Nhưng sâu thẳm dưới lòng đất tối tăm, bộ rễ của nó đang âm thầm lan tỏa rộng hàng trăm mét vuông, bám chặt vào từng thớ đá.\n\nĐể rồi từ năm thứ 5 trở đi, tre vươn mình với tốc độ kinh ngạc: 30cm mỗi ngày, chỉ sau 6 tuần đã cao vút 15 mét rợp bóng trời xanh! Nếu lúc này bạn cảm thấy mình học rất nhiều mà điểm số chưa nhảy vọt ngay, đừng nản lòng. Bạn đang giống như cây tre ấy — đang âm thầm cắm những chiếc rễ nền tảng sâu nhất để chuẩn bị cho màn bứt phá phi thường sắp tới! 🌿🚀',
    reminder: '🌱 Lời nhắn nhủ: Đừng nghi ngờ công sức của bản thân chỉ vì kết quả chưa hiện rõ ngay lập tức. Hãy tin vào bộ rễ của bạn!',
    blessing: 'Chúc bạn tâm thế vững vàng, an yên tích lũy và sẵn sàng cho khoảnh khắc vươn mình rực rỡ nhất! ✨',
  },
  {
    title: 'Thư Vững Vàng: Đừng Sợ Đi Chậm, Chỉ Sợ Đứng Yên 🚶‍♂️',
    quote: '不怕慢，只怕站 (Bất phạ mạn, chỉ phạ trạm)',
    body: '🐢 Người chạy nhanh như thỏ nếu chủ quan dừng lại ngủ quên sẽ bị chú rùa chậm chạp từng bước vượt qua. Trong cuộc đua dài hơi như kỳ thi CSCA, điều đáng sợ nhất không bao giờ là bạn tiếp thu bài chậm hơn ai đó, mà là sự chán nản, buông xuôi và dừng chân đứng yên giữa đường.\n\nChỉ cần mỗi ngày bạn nhích thêm 1% tốt hơn ngày hôm qua, thì sau một năm bạn đã tiến bộ gấp 37 lần theo quy luật hàm mũ. Chậm mà chắc, hiểu sâu nhớ lâu, không đốt cháy giai đoạn. Đi chậm mà không ngừng bước thì ngàn dặm đường dài rồi cũng sẽ ở lại sau lưng! 🛤️👣',
    reminder: '🎯 Kế hoạch hôm nay: Chia nhỏ bài học khó thành từng phần 15 phút. Giải quyết từng phần một cách trọn vẹn.',
    blessing: 'Chúc bạn từng bước đi thong dong mà vững chãi, không hoang mang trước tốc độ của người khác! 🌸',
  },
  {
    title: 'Thư Bản Ngã: Thắng Người Là Có Sức, Thắng Mình Mới Là Cường Nhân 🛡️',
    quote: '胜人者有力，自胜者强 (Thắng nhân giả hữu lực, tự thắng giả cường - Lão Tử)',
    body: '⚔️ Vượt qua người khác bằng điểm số có thể cho bạn cảm giác hãnh diện nhất thời. Nhưng chiến thắng vinh quang và bền vững nhất muôn đời chính là: CHIẾN THẮNG CHÍNH MÌNH. Đó là khi bạn chiến thắng chiếc giường ấm êm vào buổi sáng se lạnh, chiến thắng sự cám dỗ của mạng xã hội, chiến thắng tiếng nói thì thầm rủ rê "để mai học cũng được".\n\nBạn không cần phải nhìn sang bạn bè xung quanh để so đo áp lực. Hãy chỉ so sánh bản thân của hôm nay với bản thân của ngày hôm qua: Bạn đã giải thêm được bài nào chưa? Đã hiểu thêm công thức nào chưa? Làm chủ được chính mình, cả thế giới sẽ nhường đường cho bạn! 🦁🔥',
    reminder: '🛡️ Thử thách bản thân: Dám tắt thông báo điện thoại trọn vẹn 2 tiếng đồng hồ để giải trọn 1 đề thi thử.',
    blessing: 'Chúc bạn nội lực phi thường, tự tin làm chủ thời gian và làm chủ vận mệnh của chính mình! 🌟',
  },
  {
    title: 'Thư Nghịch Cảnh: Cánh Diều Bay Cao Nhờ Ngược Gió 🪁',
    quote: '逆风的方向，更适合飞翔 (Nghịch phong đích phương hướng, canh thích hợp phi tường)',
    body: '💨 Cánh diều giấy không bao giờ có thể bay lên nếu chỉ thuận theo chiều gió êm ả lướt nhẹ. Gió càng thổi mạnh ngược chiều, diều càng no gió và kiêu hãnh vút lên tầng mây xanh thẳm. Nghịch cảnh chính là bệ phóng của những con người kiệt xuất.\n\nNhững áp lực thi cử đè nặng trên vai, những kỳ vọng của gia đình, những trăn trở về tương lai du học... đừng coi đó là gánh nặng dìm bạn xuống, hãy biến chúng thành luồng gió nâng cánh ước mơ của bạn bay cao hơn. Càng trong gian khó, phẩm chất can trường và sự sáng tạo của bạn càng tỏa sáng rực rỡ! 🌤️🚀',
    reminder: '🪁 Đổi góc nhìn: Thay vì than "Bài khó quá", hãy tự nhủ "Bài này sẽ giúp mình ghi điểm vượt trội so với các đối thủ khác!".',
    blessing: 'Chúc bạn sải cánh kiên cường, biến mọi cơn gió ngược thành lực đẩy đưa bạn tới bến bờ vinh quang! 🌈',
  },
  {
    title: 'Thư Tôi Luyện: Ngọc Bất Trác Bất Thành Khí, Nhân Bất Học Bất Tri Đạo 🪓',
    quote: '玉不琢，不成器；人不学，不知道 (Lễ Ký)',
    body: '✨ Khối ngọc bích quý giá nghìn năm chôn sâu trong lòng đá thô, nếu không chịu đựng những nhát đục đẽo đau đớn của người nghệ nhân thì mãi mãi chỉ là hòn đá sần sùi vô danh. Con người dẫu thông tuệ đến đâu, nếu không qua học hỏi, trui rèn và thử thách cam go thì trí tuệ chẳng thể khai mở, khí chất chẳng thể tinh hoa.\n\nNhững bài toán khó nhằn, những cấu trúc ngữ pháp phức tạp mà bạn đang trăn trở hôm nay chính là lưỡi dao điêu khắc của người thợ tài ba. Hãy mỉm cười đón nhận sự mài giũa này, bởi nó đang biến bạn từ một viên đá thô sơ thành một bảo ngọc sáng rực rỡ trước hội đồng xét duyệt học bổng! 💎👑',
    reminder: '📌 Thói quen tinh hoa: Viết lại lời giải chi tiết cho 1 dạng bài khó nhất mà bạn từng sợ hãi.',
    blessing: 'Chúc bạn luôn giữ được sự thanh cao, kiên nhẫn để từng đường nét tài năng trong bạn được tỏa sáng! 🌟',
  },
  {
    title: 'Thư Nảy Mầm: Hạt Mầm Trong Đất Sâu Không Hề Sợ Bóng Tối 🌱',
    quote: '种子破土，必经幽暗 (Chủng tử phá thổ, tất kinh u ám)',
    body: '🌱 Khi bạn cảm thấy mình đang bị vây quanh bởi sự mệt mỏi, áp lực điểm số và nỗi cô đơn của những đêm ôn bài một mình, hãy tự nhắc nhở bản thân: Mình không phải đang bị chôn vùi trong bóng tối, mà mình là một hạt mầm quý giá đang được ươm ủ trong lòng đất mẹ phì nhiêu!\n\nMọi hạt mầm vĩ đại trước khi trở thành cổ thụ che bóng mát đều phải trải qua giai đoạn nằm lặng lẽ trong đất tối, âm thầm hấp thụ tinh hoa và chờ đợi ngày bung vỏ đâm chồi. Ánh nắng rực rỡ của ngày vinh quy bái tổ, ngày cầm trên tay giấy báo nhập học đang ở ngay phía trên kia rồi. Hãy nỗ lực bung nở bạn nhé! 🌻✨',
    reminder: '🌿 Chăm sóc bản thân: Uống một cốc nước ấm, hít thở sâu 5 nhịp trước khi bắt đầu phiên học mới.',
    blessing: 'MOLY tin rằng ngày bạn vươn mình đón ánh bình minh rực rỡ đang đến rất gần! Hãy kiên cường nảy mầm! 💌',
  },
  {
    title: 'Thư Kỷ Luật: Cầu Nối Duy Nhất Giữa Ước Mơ & Hiện Thực 🌉',
    quote: '自律是通往梦想唯一的桥梁 (Tự luật thị thông vãng mộng tưởng duy nhất đích kiều lương)',
    body: '⚡ Giấc mơ du học Trung Quốc tại các ngôi trường hàng đầu châu Á là một giấc mơ tuyệt đẹp. Nhưng giấc mơ sẽ mãi chỉ là ảo ảnh nếu thiếu đi chiếc cầu nối duy nhất: KỶ LUẬT BẢN THÂN. Cảm hứng nhất thời có thể thắp lên ngọn lửa ban đầu, nhưng chỉ có kỷ luật sắt đá mới giữ cho ngọn lửa ấy cháy rực qua hàng trăm ngày đêm ôn luyện.\n\nKỷ luật không phải là sự gò bó ép buộc, kỷ luật là sự lựa chọn tự nguyện: Bạn chọn từ bỏ những thú vui chốc lát để đổi lấy một tương lai rạng rỡ cả đời. Khi bạn giữ được kỷ luật với chính mình, bạn sẽ nắm trọn quyền năng kiến tạo cuộc đời mà bạn hằng khao khát! 🏆🔥',
    reminder: '⏰ Quy tắc 5 phút: Khi thấy lười biếng, hãy tự nhủ "Mình chỉ ngồi học đúng 5 phút thôi". Khi bắt đầu rồi, đà quán tính sẽ giúp bạn học say sưa.',
    blessing: 'Chúc bạn rèn luyện được tinh thần kỷ luật thép, biến mọi ước mơ đẹp đẽ thành kết quả cụ thể trong tầm tay! 🎖️',
  },
  {
    title: 'Thư Định Lực: Con Thuyền Không Chìm Vì Nước Vây Quanh ⛵',
    quote: '风浪中的定力，决定舟楫的前程 (Phong lãng trung đích định lực)',
    body: '🌊 Biển cả ngoài khơi dù phong ba bão táp gầm gào dữ dội đến đâu, con thuyền nhỏ vẫn có thể hiên ngang rẽ sóng vươn khơi, miễn là nó không để nước biển tràn vào khoang lái. Cuộc sống và kỳ thi ngoài kia cũng vậy: Sẽ luôn có những lời bàn tán hoài nghi, những so sánh áp lực, những nỗi âu lo vu vơ.\n\nNhững điều đó không thể đánh gục bạn, trừ phi bạn cho phép chúng xâm lấn và làm đục ngầu tâm trí mình. Hãy giữ cho tâm mình tĩnh lặng như mặt hồ phẳng lặng, hít một hơi thật sâu, gạt bỏ mọi tạp âm ngoài kia và chỉ tập trung vào từng trang sách, từng đề toán ngay trước mắt. Tâm an thì trí sáng, trí sáng thì vạn sự ắt thành công! 🧘‍♂️🕊️',
    reminder: '🕊️ Thanh lọc tâm trí: Dành 3 phút ngồi tĩnh tâm, thả lỏng vai gáy trước khi bước vào phòng thi mô phỏng.',
    blessing: 'Chúc bạn một tâm thế an nhiên tự tại, định lực vững vàng như núi thái sơn trước mọi thử thách! 🏔️',
  },
  {
    title: 'Thư Thói Quen: Gieo Thói Quen Nhỏ, Gặt Số Phận Vinh Quang 🌾',
    quote: '播种习惯，收获命运 (Bá chủng tập quán, thu hoạch mệnh vận)',
    body: '🌾 Thành công rực rỡ của một kỳ thi không phải là phép màu ngẫu nhiên rơi xuống từ trên trời, mà là kết quả tất yếu của những thói quen tốt được lặp đi lặp lại bền bỉ mỗi ngày. Thói quen dậy sớm ôn bài, thói quen ghi chép cẩn thận từng mẹo giải nhanh, thói quen kiểm tra lại bài làm trước khi nộp...\n\nChính những hành động nhỏ bé tưởng chừng vô thưởng vô phạt mỗi ngày ấy lại đang âm thầm dệt nên tấm thảm số phận lộng lẫy của bạn. Đừng bao giờ coi thường những việc nhỏ, hãy làm những việc bình thường với một sự kiên trì phi thường — vinh quang sẽ tự tìm đến bạn! 🧵✨',
    reminder: '📌 Thói quen vàng: Mỗi tối trước khi đi ngủ, dành ra đúng 10 phút để điểm lại 3 điều bạn đã học được trong ngày.',
    blessing: 'Chúc bạn từng ngày gieo những hạt giống thói quen tốt lành để gặt hái một mùa vàng bội thu học bổng! 🌾🌟',
  },
  {
    title: 'Thư Ánh Sáng: Khoảnh Khắc Tối Nhất Chính Là Lúc Trời Sắp Sáng 🌅',
    quote: '黎明前的黑暗，是最接近光明的时刻 (Lê minh tiền đích hắc ám)',
    body: '🌄 Cổ nhân nói: Khoảnh khắc tăm tối và lạnh lẽo nhất của đất trời luôn là lúc màn đêm sắp sửa chuyển mình đón ánh bình minh. Khi bạn cảm thấy con đường ôn luyện sao mà gian nan quá, khi sức lực và niềm tin dường như bị thử thách tới giới hạn cùng cực, đó chính là dấu hiệu cho thấy bạn đã đi rất gần đến vạch đích rồi!\n\nRất nhiều người bỏ cuộc ngay trước ngưỡng cửa thành công chỉ vì họ không biết rằng ánh sáng bình minh chỉ cách họ một bước chân nữa thôi. Hãy cố gắng thêm một chút, ráng gượng thêm một bài nữa, bình minh rực rỡ của sự đỗ đạt đang chờ đón bạn ở cuối con đường! 🌅✨',
    reminder: '⚡ Tự tiếp sức: Khi thấy nản, hãy nhắm mắt lại 10 giây và mường tượng khoảnh khắc bạn nhận tin trúng tuyển học bổng du học!',
    blessing: 'Chúc bạn kiên cường vượt qua những giây phút tối tăm nhất để ngẩng cao đầu đón trọn ánh hào quang rực rỡ! ☀️💫',
  },
  {
    title: 'Thư Đại Chí: Chí Hướng Cao Xa, Từng Bước Vững Vàng 🏔️',
    quote: '志当存高远，行当积跬步 (Chí đương tồn cao viễn, hành đương tích khỏa bộ - Gia Cát Lượng)',
    body: '📜 Thừa tướng Gia Cát Lượng từng dạy hậu thế: Làm người nuôi chí phải nhìn xa trông rộng, nhưng hành động thì phải cẩn trọng, chắc chắn từng bước đi. Đặt mục tiêu học bổng cao nhất không có gì là viển vông nếu bạn biết chia nhỏ nó thành những bài tập cụ thể mỗi ngày.\n\nĐừng để tuổi trẻ của mình trôi qua trong sự êm đềm tẻ nhạt hay những nỗi tiếc nuối "giá như ngày ấy mình cố gắng hơn". Bạn đang ở độ tuổi đẹp nhất với trí tuệ và nhiệt huyết tràn đầy. Hãy để tuần mới này trở thành một kiệt tác của sự nỗ lực và cống hiến hết mình. Tương lai rạng ngời đang vẫy gọi bạn phía trước! 🚀🌟',
    reminder: '🎯 Hành động quyết liệt: Đặt ra 1 mục tiêu khó nhất tuần này và cam kết hoàn thành nó trước 22h tối thứ Sáu!',
    blessing: 'Chúc bạn nuôi chí lớn vững như bàn thạch, gặt hái trọn vẹn điểm số mơ ước và chạm tay vào tương lai huy hoàng! 🏆👑',
  },
];

function normalizeText(value) {
  return String(value || '').normalize('NFC').trim();
}

function getLetterIndex(giftDate) {
  if (!giftDate) {
    const now = new Date();
    const dayNumber = Math.floor(now.getTime() / 86_400_000);
    return Math.abs(dayNumber) % MOTIVATION_LETTERS.length;
  }
  const date = new Date(`${giftDate}T00:00:00.000Z`);
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return Math.abs(dayNumber) % MOTIVATION_LETTERS.length;
}

function getCuratedDailyGiftLetter(giftDate) {
  const index = getLetterIndex(giftDate);
  const letterItem = MOTIVATION_LETTERS[index];

  return {
    title: letterItem.title,
    quote: letterItem.quote,
    greeting: 'Gửi bạn học viên CSCA thương mến,',
    encouragement: normalizeText(letterItem.body),
    study_reminder: normalizeText(letterItem.reminder),
    blessing: normalizeText(letterItem.blessing),
    mood: 'motivational',
    source_model: CURATED_DAILY_GIFT_SOURCE,
    raw_payload: {
      source: CURATED_DAILY_GIFT_SOURCE,
      letterNumber: index + 1,
      totalLetters: MOTIVATION_LETTERS.length,
    },
  };
}

module.exports = {
  CURATED_DAILY_GIFT_SOURCE,
  getCuratedDailyGiftLetter,
  getLetterIndex,
  MOTIVATION_LETTERS,
};
