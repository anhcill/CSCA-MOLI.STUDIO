const CURATED_DAILY_GIFT_SOURCE = 'curated_daily_letters';

const LETTER_BODIES = [
  "🌷 Hôm nay không cần phải học quá nhiều đâu, chỉ cần bạn thật sự ngồi xuống và bắt đầu là đã đáng khen rồi. Một câu làm đúng, một lỗi sai được sửa, một chút kiên nhẫn được giữ lại — tất cả đều đang cộng dần thành phiên bản tốt hơn của bạn. Cứ chậm thôi, nhưng đừng dừng lại nhé. Moly tin bạn làm được 💪✨",
  "📚 Có thể hôm nay bạn chưa thấy mình giỏi lên ngay, nhưng đừng vì thế mà buồn. Kiến thức không phải lúc nào cũng hiện ra ngay trước mắt, đôi khi nó đang âm thầm được não sắp xếp lại từng chút một. Chỉ cần bạn vẫn quay lại học, vẫn thử thêm một câu nữa, là bạn đã tiến gần hơn tới CSCA rồi 🌱",
  "🧡 Nếu hôm nay thấy mệt, hãy bắt đầu bằng một câu dễ trước nhé. Đừng ép bản thân phải lao vào phần khó ngay lập tức, vì đôi khi động lực chỉ xuất hiện sau khi mình hoàn thành được điều nhỏ đầu tiên. Làm một câu, hiểu một ý, ghi lại một lỗi sai — vậy là buổi học hôm nay đã có ý nghĩa rồi ✨",
  "🌙 Không sao nếu hôm nay bạn làm sai nhiều hơn bình thường. Sai không có nghĩa là bạn kém, sai chỉ đang cho bạn biết phần nào cần được học lại kỹ hơn thôi. Điều quan trọng là mình không bỏ qua lỗi sai đó, mà ghi lại lý do vì sao sai để lần sau bước vào phòng thi, bạn sẽ tự tin hơn một chút 📖💪",
  "🍀 Mỗi phiên học ngắn đều giống như một viên gạch nhỏ bạn đặt xuống cho mục tiêu CSCA. Một viên thì có thể chưa thấy gì, nhưng nhiều ngày cộng lại sẽ thành một con đường rất rõ. Vậy nên hôm nay chỉ cần đặt thêm một viên nữa thôi, nhẹ nhàng nhưng chắc chắn nhé 🧱✨",
  "☁️ Đừng tự trách mình nếu hôm nay học chậm hơn người khác. Mỗi người có một nhịp riêng, và nhịp của bạn cũng xứng đáng được tôn trọng. Miễn là bạn vẫn đang cố gắng, vẫn chịu học lại phần chưa hiểu, vẫn không bỏ mặc mục tiêu của mình, thì bạn đã rất đáng khen rồi 🌷",
  "🔥 Có những ngày học rất vào, cũng có những ngày nhìn bài thôi đã thấy mệt. Nhưng cả hai kiểu ngày đó đều là một phần của hành trình. Ngày tốt giúp bạn tiến nhanh hơn, ngày khó giúp bạn rèn sự kiên trì hơn. Vì vậy hôm nay dù thế nào, chỉ cần bạn còn tiếp tục là đã thắng rồi 💪📚",
  "🌱 Bạn không cần phải hoàn hảo trong buổi học này. Bạn chỉ cần tốt hơn một chút so với lúc chưa bắt đầu: hiểu thêm một công thức, nhớ thêm một cách làm, hoặc biết thêm một lỗi mình hay mắc. Những điều nhỏ như vậy sẽ âm thầm giúp bạn mạnh hơn từng ngày ✨",
  "💌 Đừng bỏ cuộc chỉ vì một vài câu khó nhé. Câu khó không xuất hiện để làm bạn nản, mà để nhắc bạn rằng mình còn có chỗ để tiến bộ. Cứ bình tĩnh đọc lại đề, làm từng bước một, sai thì sửa, chưa hiểu thì học lại. Moly vẫn tin bạn đang đi đúng đường đó 🧡",
  "🌟 Hôm nay hãy học bằng một tâm thế nhẹ nhàng hơn một chút nhé. Không phải học để tự ép mình, mà học để tương lai có thêm lựa chọn, thêm tự tin, thêm cơ hội. Mỗi phút bạn dành cho bài vở hôm nay đều là một món quà nhỏ gửi cho chính bạn trong ngày thi CSCA sau này 📚✨",
  "🪄 Nếu hôm nay bạn thấy mình chưa đủ giỏi, hãy nhớ rằng không ai giỏi lên chỉ sau một buổi học cả. Người giỏi cũng từng có lúc làm sai, từng không hiểu bài, từng phải học đi học lại nhiều lần. Khác biệt chỉ là họ vẫn tiếp tục. Và hôm nay, bạn cũng đang tiếp tục đó thôi 💪🌷",
  "🍃 Một ngày học không cần phải thật rực rỡ mới có giá trị. Có khi chỉ cần bạn mở vở ra, làm được vài câu, ghi lại phần chưa hiểu và không bỏ cuộc giữa chừng — vậy là đủ để hôm nay đáng được ghi nhận rồi. Cứ tử tế với bản thân, nhưng cũng đừng quên giữ lời hứa với mục tiêu nhé ✨",
  "📖 Mỗi lỗi sai hôm nay có thể là một điểm số bạn giữ lại được trong phòng thi sau này. Vì vậy đừng vội buồn khi sai, hãy xem nó như một tín hiệu rất quý: “À, phần này mình cần chắc hơn.” Ghi lại, sửa lại, luyện lại — từng bước nhỏ như vậy sẽ giúp bạn vững hơn rất nhiều 🌱",
  "🧸 Hôm nay nếu thấy áp lực, hãy hít thở một chút rồi quay lại với bài dễ nhất. Bạn không cần phải thắng cả cuốn sách trong một ngày, chỉ cần thắng được sự trì hoãn của mình thôi. Một khi đã bắt đầu, mọi thứ sẽ bớt đáng sợ hơn rất nhiều. Cố lên nhé, bạn đang làm tốt hơn bạn nghĩ đó 🌷",
  "🌈 CSCA là một mục tiêu lớn, nhưng con đường đến đó được tạo nên từ rất nhiều buổi học nhỏ như hôm nay. Có ngày nhanh, có ngày chậm, có ngày tự tin, có ngày hơi rối — tất cả đều bình thường. Quan trọng là bạn vẫn quay lại, vẫn cố thêm một chút, vẫn chọn không bỏ cuộc 📚💪",
  "✨ Đừng xem buổi học hôm nay là một áp lực, hãy xem nó là một lần bạn chăm sóc ước mơ của mình. Mỗi câu hỏi bạn làm, mỗi kiến thức bạn ôn, mỗi lần bạn sửa sai đều là một cách bạn nói với tương lai rằng: “Mình vẫn đang cố gắng vì bạn.” Nghe thôi đã đáng tự hào rồi 🌷",
  "🌻 Có thể hôm nay bạn chưa làm được nhiều như dự định, nhưng đừng vì vậy mà phủ nhận toàn bộ nỗ lực của mình. Chỉ cần bạn đã học thật lòng, đã cố gắng thêm một chút, đã không bỏ mặc bản thân trong sự lười biếng, thì ngày hôm nay vẫn có điều đáng khen. Moly thấy bạn đang cố đó 🧡",
  "📝 Trước khi bắt đầu, hãy nhắc bản thân rằng: mình không cần hiểu hết ngay lập tức. Mình chỉ cần hiểu thêm một chút so với hôm qua. Học là quá trình tích lũy, không phải cuộc thi xem ai nhanh hơn ai. Cứ bình tĩnh làm từng câu, từng bước, từng phần nhé 🌱✨",
  "💫 Hôm nay hãy cho bản thân một cơ hội để tiến bộ, dù chỉ là rất nhỏ. Có thể là làm đúng một dạng bài từng sai, nhớ được một công thức từng quên, hoặc đơn giản là ngồi học nghiêm túc hơn hôm qua. Những chiến thắng nhỏ ấy cũng xứng đáng được công nhận lắm đó 💪📚",
  "🌙 Kết thúc buổi học hôm nay, dù kết quả thế nào cũng hãy ghi lại một điều mình làm được và một điều mình cần sửa. Đừng chỉ nhìn vào lỗi sai rồi tự trách bản thân, vì bạn vẫn đang cố gắng từng ngày mà. Ngày mai mình lại tiếp tục, nhẹ hơn, chắc hơn, và gần CSCA hơn một chút nhé ✨",
  "🌤️ Hôm nay có thể bạn chưa có nhiều cảm hứng, nhưng chỉ cần bạn chịu mở bài ra và làm từng chút một là đã rất đáng quý rồi. Có những ngày mình không học bằng động lực, mà học bằng lời hứa nhỏ với bản thân. Cứ bắt đầu nhẹ thôi, một câu trước, rồi để sự cố gắng kéo bạn đi tiếp nhé 📚✨",
  "🧩 Đừng sợ những phần mình chưa hiểu, vì chính những chỗ đó đang chỉ cho bạn biết mình cần lớn lên ở đâu. Mỗi lần bạn dừng lại để đọc kỹ hơn, hỏi lại, làm lại, ghi chú lại, là bạn đang tự vá thêm một mảnh kiến thức cho mình. Hôm nay vá thêm một mảnh thôi cũng đủ đáng khen rồi 🌱",
  "🌷 Có những tiến bộ không ồn ào, không khiến bạn nhận ra ngay, nhưng nó vẫn đang diễn ra trong từng lần bạn ngồi học. Một công thức nhớ lâu hơn, một dạng bài bớt sợ hơn, một lỗi sai được phát hiện sớm hơn — tất cả đều là tín hiệu bạn đang đi đúng hướng. Moly tin bạn sẽ ổn thôi 🧡",
  "🚶‍♀️ Đường đến CSCA không yêu cầu bạn phải chạy thật nhanh mỗi ngày. Có hôm chỉ cần bước chậm, bước chắc, bước bằng sự kiên nhẫn cũng là đủ rồi. Quan trọng là bạn vẫn còn trên con đường đó, vẫn chưa quay lưng với mục tiêu của mình. Vậy nên hôm nay, mình đi tiếp một đoạn nhỏ nhé 🌟",
  "📌 Trước khi học, hãy nhắc bản thân một điều: mình không cần làm cho buổi học này hoàn hảo, mình chỉ cần làm cho nó có giá trị. Giá trị có thể đến từ một câu đúng, một lỗi sai được hiểu ra, hoặc một phút bạn không bỏ cuộc dù rất muốn nghỉ. Như vậy là hôm nay đã không vô nghĩa rồi ✨",
  "🕯️ Nếu hôm nay thấy đầu óc hơi rối, đừng vội nghĩ mình kém. Có thể não bạn chỉ đang cần thời gian để làm quen với kiến thức mới thôi. Hãy đọc chậm lại, viết ra từng bước, làm lại từ phần dễ nhất. Sự bình tĩnh đôi khi chính là chiếc chìa khóa mở ra bài khó đó 📖🌿",
  "🍵 Học không phải lúc nào cũng vui, nhưng cảm giác sau khi mình vượt qua một buổi học khó thì rất đáng tự hào. Hôm nay bạn chỉ cần ngồi lại thêm một chút, cố thêm một câu, hiểu thêm một ý. Đừng xem nhẹ những điều nhỏ đó, vì chúng đang âm thầm tạo nên sự khác biệt lớn hơn bạn nghĩ 💪",
  "🌙 Có thể hôm nay bạn mệt, có thể tâm trạng không tốt, có thể bài vở nhìn đâu cũng thấy nhiều. Nhưng mình không cần giải quyết tất cả trong một lần. Hãy chọn một phần nhỏ nhất để bắt đầu, làm nó thật tử tế, rồi tự khen mình vì đã không bỏ cuộc ngay từ đầu nhé 🧸✨",
  "📚 Mỗi lần bạn ghi lại lý do mình sai, bạn không chỉ đang sửa một bài, mà đang dạy não cách tránh lặp lại lỗi đó lần sau. Vậy nên đừng buồn vì sai, hãy biến nó thành một dấu mốc nhỏ: hôm nay mình đã biết thêm một cái bẫy. Lần tới gặp lại, bạn sẽ mạnh hơn nhiều đó 🌱",
  "🌈 Hôm nay đừng so mình với ai cả. Có người đi nhanh hơn, có người nhớ lâu hơn, có người làm bài tốt hơn, nhưng hành trình này vẫn là của bạn. Chỉ cần bạn tốt hơn chính mình của hôm qua một chút, hoặc ít nhất là không bỏ rơi mục tiêu, thì bạn đã có một ngày đáng khen rồi 🧡",
  "🪴 Một cái cây không lớn lên chỉ sau một đêm, và bạn cũng vậy. Kiến thức cần được tưới bằng thời gian, ánh sáng của sự kiên nhẫn, và một chút chăm chỉ lặp lại mỗi ngày. Hôm nay mình chỉ cần tưới thêm một lần thôi, rồi dần dần bạn sẽ thấy mình vững hơn lúc nào không hay 🌷",
  "⚡ Đôi khi phần khó nhất của việc học không phải là bài tập, mà là khoảnh khắc bắt đầu. Vậy nên hôm nay, chỉ cần bạn thắng được giây phút muốn trì hoãn đó là đã rất giỏi rồi. Mở vở ra, làm câu đầu tiên, rồi để mọi thứ nhẹ nhàng tiếp tục. Bạn không hề yếu đâu, bạn đang cố mà 💪",
  "💌 Hôm nay hãy nhẹ nhàng với bản thân, nhưng đừng dễ dãi với mục tiêu nhé. Mình có thể nghỉ một chút khi mệt, có thể làm chậm hơn khi rối, nhưng đừng bỏ hẳn điều mình từng rất muốn đạt được. Mỗi buổi học nhỏ là một lần bạn chọn tương lai của mình ✨",
  "🧠 Có những kiến thức lần đầu học sẽ thấy khó hiểu, lần hai vẫn hơi mơ hồ, nhưng đến lần ba, lần bốn, mọi thứ sẽ bắt đầu sáng ra. Vì vậy đừng vội nản khi chưa hiểu ngay. Bạn không thất bại đâu, bạn chỉ đang ở những lần lặp đầu tiên của quá trình giỏi lên thôi 📖🌟",
  "🌻 Hôm nay hãy thử học với tâm thế: mình đang tích điểm cho tương lai. Một câu bài tập là một điểm cố gắng, một lần sửa sai là một điểm trưởng thành, một buổi không bỏ cuộc là một điểm bản lĩnh. Cứ gom từng chút như vậy, đến một ngày bạn sẽ bất ngờ vì mình đã đi xa đến thế nào 🍀",
  "🧸 Nếu hôm nay bài khó làm bạn thấy hơi nản, hãy tạm dừng vài giây và nhớ lại lý do bạn bắt đầu. Bạn học không chỉ vì một bài kiểm tra, mà vì một cơ hội tốt hơn, một hành trình xa hơn, một phiên bản tự tin hơn của chính mình. Vì lý do đó, mình thử thêm một chút nữa nhé ✨",
  "📝 Đừng chỉ ghi đáp án đúng, hãy ghi cả cách mình đã nghĩ sai. Vì đôi khi điều giúp bạn tiến bộ nhanh nhất không phải là làm thêm thật nhiều bài, mà là hiểu thật rõ vì sao mình từng mắc lỗi. Hôm nay hiểu sâu thêm một lỗi thôi cũng là món quà rất lớn cho ngày thi sau này 📚💪",
  "☁️ Có những ngày bạn sẽ thấy mình học mãi mà chưa vào, nhưng đừng lấy một ngày khó để đánh giá cả hành trình. Một ngày chậm không có nghĩa là bạn không tiến bộ. Nó chỉ nhắc mình cần nghỉ đúng lúc, học đúng cách, rồi quay lại bằng sự bình tĩnh hơn. Moly vẫn tin bạn đang đi lên 🌷",
  "🔥 Hôm nay hãy làm việc nhỏ nhưng làm thật nghiêm túc. Một câu dễ cũng làm cẩn thận, một công thức quen cũng xem lại kỹ, một lỗi sai nhỏ cũng không bỏ qua. Người vững không phải vì chưa từng sai, mà vì họ chịu xây nền từ những điều nhỏ nhất. Bạn cũng đang xây nền cho mình đó 🧱✨",
  "🌟 Kết thúc buổi học hôm nay, dù làm được nhiều hay ít, hãy tự hỏi: “Mình đã hiểu thêm điều gì?” Chỉ cần có một câu trả lời thôi, ngày hôm nay đã có ý nghĩa rồi. Đừng đợi đến khi thật giỏi mới công nhận bản thân, vì chính những ngày còn đang cố này mới là đáng quý nhất 🧡",
];

function normalizeText(value) {
  return String(value || '').normalize('NFC').trim();
}

function getLetterIndex(giftDate) {
  const date = new Date(`${giftDate}T00:00:00.000Z`);
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return Math.abs(dayNumber) % LETTER_BODIES.length;
}

function getCuratedDailyGiftLetter(giftDate) {
  const index = getLetterIndex(giftDate);
  const body = normalizeText(LETTER_BODIES[index]);

  return {
    title: 'Một chút năng lượng cho hôm nay',
    greeting: 'Gửi bạn học viên chăm chỉ,',
    encouragement: body,
    study_reminder: '',
    blessing: '',
    mood: 'encouraging',
    source_model: CURATED_DAILY_GIFT_SOURCE,
    raw_payload: {
      source: CURATED_DAILY_GIFT_SOURCE,
      letterNumber: index + 1,
      totalLetters: LETTER_BODIES.length,
    },
  };
}

module.exports = {
  CURATED_DAILY_GIFT_SOURCE,
  getCuratedDailyGiftLetter,
};
