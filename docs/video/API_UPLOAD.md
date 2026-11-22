# API Documentation - Upload & Exam Management

## 📤 Upload API

### Upload ảnh cho câu hỏi

```
POST /api/upload/question-image
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
Body: image (file)

Response:
{
  "success": true,
  "message": "Upload ảnh thành công",
  "data": {
    "filename": "image-1234567890.jpg",
    "url": "/uploads/questions/image-1234567890.jpg",
    "size": 123456,
    "mimetype": "image/jpeg"
  }
}
```

### Upload nhiều ảnh

```
POST /api/upload/question-images
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
Body: images[] (files, max 10)
```

### Xóa ảnh

```
DELETE /api/upload/question-image/:filename
Headers: Authorization: Bearer {token}
```

## 📝 Exam Management API (Admin)

### Tạo đề thi mới

```
POST /api/exams
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "subject_id": 1,
  "code": "MATH_001",
  "title": "Đề thi Toán 001",
  "title_cn": "数学试题001",
  "description": "Mô tả đề thi",
  "duration": 90,
  "total_questions": 30,
  "total_points": 90,
  "difficulty_level": "medium",
  "status": "draft",
  "publish_date": "2024-01-15T00:00:00Z"
}
```

### Thêm câu hỏi vào đề thi

```
POST /api/exams/:examId/questions
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "question_number": 1,
  "question_type": "single_choice",
  "question_text": "Câu hỏi tiếng Việt",
  "question_text_cn": "中文问题",
  "question_text_en": "English question",
  "question_image_url": "/uploads/questions/image-123.jpg",
  "explanation": "Giải thích đáp án",
  "points": 3,
  "difficulty": "easy",
  "answers": [
    {
      "answer_key": "A",
      "answer_text": "Đáp án A",
      "answer_text_cn": "答案A",
      "is_correct": false
    },
    {
      "answer_key": "B",
      "answer_text": "Đáp án B",
      "answer_text_cn": "答案B",
      "is_correct": true
    },
    {
      "answer_key": "C",
      "answer_text": "Đáp án C",
      "answer_text_cn": "答案C",
      "is_correct": false
    },
    {
      "answer_key": "D",
      "answer_text": "Đáp án D",
      "answer_text_cn": "答案D",
      "is_correct": false
    }
  ]
}
```

## 🎯 Quy trình Admin thêm đề thi

### Bước 1: Tạo đề thi

```javascript
const createExam = async () => {
  const response = await fetch("/api/exams", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject_id: 1, // Toán
      code: "MATH_001",
      title: "Đề thi Toán 001",
      duration: 90,
      total_questions: 30,
      total_points: 90,
      status: "draft",
    }),
  });

  const exam = await response.json();
  return exam.data.id; // exam_id
};
```

### Bước 2: Upload ảnh (nếu có)

```javascript
const uploadImage = async (imageFile) => {
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await fetch("/api/upload/question-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json();
  return result.data.url; // /uploads/questions/xxx.jpg
};
```

### Bước 3: Thêm câu hỏi kèm đáp án

```javascript
const addQuestion = async (examId, imageUrl) => {
  const response = await fetch(`/api/exams/${examId}/questions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question_number: 1,
      question_text:
        "Đơn vị nào có thể được biểu thị bằng đơn vị cơ bản là kgm⁻³·s⁻²?",
      question_text_cn: "哪个单位基本单位表示方为 kgm⁻³·s⁻²?",
      question_image_url: imageUrl, // Ảnh vừa upload
      points: 3,
      answers: [
        { answer_key: "A", answer_text: "joule", is_correct: false },
        { answer_key: "B", answer_text: "newton", is_correct: false },
        { answer_key: "C", answer_text: "pascal", is_correct: true },
        { answer_key: "D", answer_text: "watt", is_correct: false },
      ],
    }),
  });
};
```

### Bước 4: Publish đề thi

```javascript
const publishExam = async (examId) => {
  await fetch(`/api/exams/${examId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "published",
      publish_date: new Date().toISOString(),
    }),
  });
};
```

## 📊 File được lưu ở đâu?

- **Local**: `/backend/uploads/questions/`
- **URL**: `http://localhost:5000/uploads/questions/filename.jpg`
- **Giới hạn**: 5MB/file
- **Format**: jpg, jpeg, png, gif, svg, webp
