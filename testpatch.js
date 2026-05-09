const fs = require('fs');
const file = 'backend/src/controllers/aiController.js';
let content = fs.readFileSync(file, 'utf8');

const newCode = \
async function askAIStream(req, res) {
  try {
    const userId = req.user.id;
    // Check access
    const { question, attemptId, conversationHistory } = req.body;
    
    // Set response headers for SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Important for Nginx

    let context = {};
    if (attemptId) {
      const db = require('../../config/database');
      const attemptResult = await db.query(
        'SELECT e.title as exam_title, s.name as subject_name, ea.total_score, ea.total_correct, ea.total_incorrect, ea.total_questions FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id LEFT JOIN subjects s ON e.subject_id = s.id WHERE ea.id =  AND ea.user_id = ',
        [attemptId, userId]
      );
      if (attemptResult.rows[0]) {
        const a = attemptResult.rows[0];
        context.examTitle = a.exam_title;
        context.subjectName = a.subject_name;
        context.userScore = a.total_questions > 0 ? Math.round((a.total_correct / a.total_questions) * 100) : parseFloat(a.total_score) || 0;
      }
    }
    
    await require('../services/aiService').askAIStream(question, context, res);
  } catch (err) {
    console.error('L?i askAIStream:', err);
    res.write('data: ' + JSON.stringify({ error: err.message }) + '\\n\\n');
    res.end();
  }
}
\;

content = content.replace('module.exports = {', newCode + '\nmodule.exports = {\n  askAIStream,');
fs.writeFileSync(file, content);

