'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from '@/lib/utils/axios';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import RichMathText from '@/components/common/RichMathText';
import { getExamLanguageText } from '@/lib/exam/languageMode';

interface ExamAnswer {
  id: number;
  answer_key?: string;
  content?: string;
  answer_text?: string;
  answer_text_cn?: string;
  answer_text_en?: string;
  is_correct?: boolean;
}

interface ExamQuestion {
  id: number;
  content?: string;
  question_text?: string;
  question_text_cn?: string;
  question_text_en?: string;
  type?: string;
  points: number;
  answers?: ExamAnswer[];
}

interface ExamData {
  id: number;
  title: string;
  subject?: string;
  subject_name?: string;
  description?: string;
  duration_minutes?: number;
  duration?: number;
  total_points: number;
  allow_download: boolean;
  language_mode?: string;
  questions: ExamQuestion[];
}

function ExamPrintContent({ examId }: { examId: string }) {
  const { t, pick } = useLanguage();
  const searchParams = useSearchParams();
  const showAnswers = searchParams.get('answers') === '1';
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/exams/${examId}/download`)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (!data?.allow_download) {
          setError(pick({ vi: 'Đề thi này không cho phép tải xuống.', en: 'This exam cannot be downloaded.', zh: '该试卷不允许下载。' }));
          setLoading(false);
          return;
        }
        setExam(data);
        setLoading(false);
      })
      .catch((requestError) => {
        const apiMessage = requestError?.response?.data?.message;
        setError(apiMessage || pick({ vi: 'Không thể tải đề thi.', en: 'Cannot load this exam.', zh: '无法加载试卷。' }));
        setLoading(false);
      });
  }, [examId, pick]);

  useEffect(() => {
    if (!loading && exam) setTimeout(() => window.print(), 600);
  }, [loading, exam]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-purple-500" />
          <p className="text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-bold text-gray-800">{error}</h2>
          <button onClick={() => window.history.back()} className="mt-4 rounded-lg bg-purple-600 px-6 py-2 text-white">{t('common.back')}</button>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; color: #000; }
          .question-block { page-break-inside: avoid; }
          .pdf-watermark { opacity: 0.08; }
        }
        @page { size: A4; margin: 15mm 12mm; }
        body { font-family: Arial, sans-serif; }
        .pdf-watermark {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          color: #4c1d95;
          font-size: 64px;
          font-weight: 900;
          letter-spacing: 0.08em;
          opacity: 0.06;
          transform: rotate(-28deg);
          user-select: none;
        }
      `}</style>

      <div className="pdf-watermark" aria-hidden="true">Moly.CSCA</div>

      <div className="no-print flex items-center justify-between bg-purple-700 px-6 py-3 text-white">
        <span className="font-semibold">{pick({ vi: 'Xem trước đề thi', en: 'Exam preview', zh: '试卷预览' })} - {exam.questions?.length || 0}</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <button onClick={() => window.history.back()} className="rounded-lg bg-white/20 px-4 py-1.5 text-sm transition hover:bg-white/30">{t('common.back')}</button>
          <button onClick={() => window.print()} className="rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-purple-700 transition hover:bg-purple-50">
            {pick({ vi: 'Tải xuống PDF', en: 'Download PDF', zh: '下载PDF' })}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-8">
        <div className="mb-6 border-b-2 border-gray-800 pb-4 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">CSCA - moly.study</p>
          <h1 className="text-2xl font-black text-gray-900">{exam.title}</h1>
          <div className="mt-2 flex items-center justify-center gap-6 text-sm text-gray-600">
            <span>{pick({ vi: 'Môn', en: 'Subject', zh: '科目' })}: <strong>{exam.subject || exam.subject_name}</strong></span>
            <span>{pick({ vi: 'Thời gian', en: 'Time', zh: '时间' })}: <strong>{exam.duration_minutes || exam.duration} {t('common.minutes')}</strong></span>
            <span>{pick({ vi: 'Tổng điểm', en: 'Total points', zh: '总分' })}: <strong>{exam.total_points}</strong></span>
          </div>
          {exam.description && <p className="mt-2 text-sm italic text-gray-500">{exam.description}</p>}
        </div>

        <div className="mb-6 flex gap-8 text-sm">
          <div className="flex-1 border-b border-gray-400 pb-1">{pick({ vi: 'Họ và tên', en: 'Full name', zh: '姓名' })}: ___________________________</div>
          <div className="w-48 border-b border-gray-400 pb-1">{pick({ vi: 'Điểm', en: 'Score', zh: '分数' })}: ____________</div>
        </div>

        {(exam.questions || []).map((question, questionIndex) => {
          const questionText = getExamLanguageText({
            vi: question.content || question.question_text,
            en: question.question_text_en,
            zh: question.question_text_cn,
          }, exam.language_mode);

          return (
            <div key={question.id} className="question-block mb-5">
              <div className="mb-2 flex items-start gap-2 font-semibold text-gray-900">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">{questionIndex + 1}</span>
                <div className="min-w-0 flex-1">
                  <RichMathText value={questionText.primary || ''} className="text-gray-900" />
                  {questionText.secondary && (
                    <RichMathText value={questionText.secondary} className="mt-1 border-t border-gray-200 pt-1 text-gray-600" />
                  )}
                  {questionText.tertiary && (
                    <RichMathText value={questionText.tertiary} className="mt-1 border-t border-gray-200 pt-1 text-gray-500" />
                  )}
                </div>
                <span className="ml-2 text-xs text-gray-400">({question.points} {t('common.points')})</span>
              </div>
              {question.answers && question.answers.length > 0 && (
                <div className="ml-8 grid grid-cols-2 gap-1">
                  {question.answers.map((answer, answerIndex) => {
                    const letter = answer.answer_key || String.fromCharCode(65 + answerIndex);
                    const isCorrect = !!answer.is_correct && showAnswers;
                    const answerText = getExamLanguageText({
                      vi: answer.content || answer.answer_text,
                      en: answer.answer_text_en,
                      zh: answer.answer_text_cn,
                    }, exam.language_mode);
                    return (
                      <div key={answer.id} className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${isCorrect ? 'border border-green-300 bg-green-50' : ''}`}>
                        <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-gray-500'}`}>{letter}.</span>
                        <div className="min-w-0">
                          <RichMathText value={answerText.primary || ''} className={isCorrect ? 'font-medium text-green-700' : 'text-gray-700'} />
                          {answerText.secondary && (
                            <RichMathText value={answerText.secondary} className={isCorrect ? 'mt-1 text-green-600' : 'mt-1 text-gray-500'} />
                          )}
                        </div>
                        {isCorrect && <span className="ml-auto text-green-500">✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="no-print mt-8 border-t pt-3 text-center text-xs text-gray-400">
          CSCA · moly.study
        </div>
      </div>
    </>
  );
}

export default function ExamPrintPage() {
  const params = useParams();
  const examId = params?.id as string;

  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-500" />
      </div>
    }>
      <ExamPrintContent examId={examId} />
    </Suspense>
  );
}
