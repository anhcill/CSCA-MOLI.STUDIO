'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import examApi, { Exam, PracticeFeedback, Question } from '@/lib/api/exams';
import { FiClock, FiCheck, FiChevronLeft, FiChevronRight, FiAlertCircle, FiSend, FiGrid, FiShield, FiFlag, FiPlay, FiRotateCcw, FiBookOpen } from 'react-icons/fi';
import { ProUpgradeModal } from '@/components/common/ProModal';
import { ViolationWarning } from '@/components/common/ViolationWarning';
import { useExamProtection } from '@/lib/hooks/useExamProtection';
import { useAuthStore } from '@/lib/store/authStore';
import { ExamRegistration, officialExamApi } from '@/lib/api/officialExams';
import type { OfficialExamLeaderboardEntry } from '@/lib/api/officialExams';
import OfficialExamLeaderboard from '@/components/exam/OfficialExamLeaderboard';
import PdfRoomExamWorkspace from '@/components/exam/PdfRoomExamWorkspace';
import InkResultBackground, {
  inkResultButtonPanel,
  inkResultMuted,
  inkResultPanel,
  inkResultSoftPanel,
  inkResultTitle,
} from '@/components/layout/InkResultBackground';
import RichMathText from '@/components/common/RichMathText';
import AiAnalyzingOverlay from '@/components/common/AiAnalyzingOverlay';
import { useExamOffline } from '@/hooks/useExamOffline';
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { getExamLanguageText, normalizeExamLanguageMode } from '@/lib/exam/languageMode';

type PendingEssaySave = {
  questionId: number;
  answerKey: string;
  essayText: string;
  practiceMode: boolean;
};

const ESSAY_SAVE_DEBOUNCE_MS = 650;
const DEFAULT_EXAM_MAX_VIOLATIONS = 4;
const PDF_ROOM_MAX_VIOLATIONS = 3;

function hasAnsweredValue(value: number | string | undefined) {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function getChineseFirstText(chinese?: string | null, vietnamese?: string | null) {
  return (chinese || vietnamese || '').trim();
}

function getVietnameseTranslation(chinese?: string | null, vietnamese?: string | null) {
  const primary = getChineseFirstText(chinese, vietnamese);
  const translation = (vietnamese || '').trim();
  return translation && translation !== primary ? translation : '';
}

function getExamText(values: { vi?: string | null; zh?: string | null; en?: string | null }, mode?: string | null) {
  // Never render an empty question/answer when an imported localization is
  // missing. The source field remains available while the data is repaired.
  return getExamLanguageText(values, mode, { fallback: true });
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    tabOwnerIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  // useMemo để tránh tính lại mỗi lần render
  const examId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return null;          // chưa có params
    const n = parseInt(raw as string, 10);
    return Number.isFinite(n) && n > 0 ? n : NaN; // NaN nếu không hợp lệ
  }, [params?.id]);

  const [exam, setExam] = useState<Exam | null>(null);
  const [preflight, setPreflight] = useState<Exam | null>(null);
  const [registration, setRegistration] = useState<ExamRegistration | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [preflightLeaderboard, setPreflightLeaderboard] = useState<OfficialExamLeaderboardEntry[]>([]);
  const [preflightLeaderboardLoading, setPreflightLeaderboardLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number | string>>({});
  const [practiceMode, setPracticeMode] = useState(false);
  const [showVietnameseTranslations, setShowVietnameseTranslations] = useState(false);
  const [examLanguage, setExamLanguage] = useState<string>('');
  const [explanationLanguage, setExplanationLanguage] = useState<string>('');
  const [practiceFeedback, setPracticeFeedback] = useState<Record<number, PracticeFeedback>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [navFilter, setNavFilter] = useState<'all' | 'unanswered' | 'answered' | 'flagged'>('all');
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vipError, setVipError] = useState<string | null>(null);
  const [violations, setViolations] = useState(0);
  const [showViolation, setShowViolation] = useState(false);
  const [lastViolation, setLastViolation] = useState('');
  const [isScreenCaptured, setIsScreenCaptured] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [queuedSubmit, setQueuedSubmit] = useState(false);
  const [draftCheckedAttemptId, setDraftCheckedAttemptId] = useState<number | null>(null);
  const [tabConflict, setTabConflict] = useState(false);
  const submitInFlightRef = useRef(false);
  const tabOwnerIdRef = useRef('');
  const activeSavePromisesRef = useRef<Set<Promise<void>>>(new Set());
  const essaySaveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pendingEssaySavesRef = useRef<Record<number, PendingEssaySave>>({});
  const isPdfRoomExam = Boolean(started && exam?.start_time && exam?.has_exam_pdf && !practiceMode);
  const violationLimit = isPdfRoomExam ? PDF_ROOM_MAX_VIOLATIONS : DEFAULT_EXAM_MAX_VIOLATIONS;

  const {
    isOffline,
    pendingCount,
    isSyncing,
    saveAnswerOfflineAware,
    submitOfflineAware,
    persistDraft,
    restoreDraft,
    flushQueue,
    clearDraft,
  } = useExamOffline({
    examId: Number.isFinite(examId) ? examId : null,
    attemptId,
    practiceMode,
    selectedAnswers,
    timeLeft,
    started,
  });

  const { maxViolations, resetViolations } = useExamProtection({
    enabled: !!attemptId && !submitting && !practiceMode,
    maxViolations: violationLimit,
    requireFullscreen: isPdfRoomExam,
    onViolation: (type: string) => {
      setViolations((v) => {
        const next = v + 1;
        setLastViolation(type);
        if (next > 0) setShowViolation(true);
        if (attemptId) {
          officialExamApi.logViolation(attemptId, {
            type,
            count: next,
            severity: next >= violationLimit
              ? 'critical'
              : next === violationLimit - 1
                ? 'high'
                : 'warning',
            metadata: {
              questionIndex: currentQuestionIndex,
              timeLeft,
              href: typeof window !== 'undefined' ? window.location.href : '',
            },
          }).catch(() => {});
        }
        return next;
      });
      // Show capture shield briefly on visibility-related violations
      if (type === 'tab_switch' || type === 'window_blur') {
        setIsScreenCaptured(true);
      }
    },
  });

  const claimAttemptTabLock = useCallback(() => {
    if (!attemptId) return;
    const key = `csca-active-attempt-${attemptId}`;
    const owner = tabOwnerIdRef.current || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    tabOwnerIdRef.current = owner;
    localStorage.setItem(key, JSON.stringify({ owner, updatedAt: Date.now() }));
    setTabConflict(false);
  }, [attemptId]);

  useEffect(() => {
    if (!started || !attemptId || practiceMode || typeof window === 'undefined') {
      setTabConflict(false);
      return;
    }

    const key = `csca-active-attempt-${attemptId}`;
    const owner = tabOwnerIdRef.current || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    tabOwnerIdRef.current = owner;

    const readLock = () => {
      try {
        return JSON.parse(localStorage.getItem(key) || 'null') as { owner?: string; updatedAt?: number } | null;
      } catch {
        return null;
      }
    };

    const lock = readLock();
    const isStale = !lock?.updatedAt || Date.now() - lock.updatedAt > 15000;
    if (!lock || lock.owner === owner || isStale) {
      localStorage.setItem(key, JSON.stringify({ owner, updatedAt: Date.now() }));
      setTabConflict(false);
    } else {
      setTabConflict(true);
    }

    const heartbeat = window.setInterval(() => {
      const current = readLock();
      if (!current || current.owner === owner || Date.now() - (current.updatedAt || 0) > 15000) {
        localStorage.setItem(key, JSON.stringify({ owner, updatedAt: Date.now() }));
        setTabConflict(false);
      } else {
        setTabConflict(true);
      }
    }, 3000);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      const current = readLock();
      setTabConflict(Boolean(current?.owner && current.owner !== owner && Date.now() - (current.updatedAt || 0) <= 15000));
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('storage', handleStorage);
      const current = readLock();
      if (current?.owner === owner) {
        localStorage.removeItem(key);
      }
    };
  }, [attemptId, practiceMode, started]);

  // Auto-dismiss capture shield after 3 seconds
  useEffect(() => {
    if (!isScreenCaptured) return;
    const timer = setTimeout(() => setIsScreenCaptured(false), 3000);
    return () => clearTimeout(timer);
  }, [isScreenCaptured]);

  useEffect(() => {
    return () => {
      Object.values(essaySaveTimersRef.current).forEach(clearTimeout);
      essaySaveTimersRef.current = {};
      pendingEssaySavesRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!started || !attemptId || draftCheckedAttemptId === attemptId) return;
    setDraftCheckedAttemptId(attemptId);

    restoreDraft()
      .then((draft) => {
        if (!draft || !draft.selectedAnswers || Object.keys(draft.selectedAnswers).length === 0) return;
        const shouldRestore = window.confirm('Tìm thấy bài đang làm được lưu trên máy. Bạn muốn tiếp tục bài này?');
        if (shouldRestore) {
          setSelectedAnswers(draft.selectedAnswers);
          if (!practiceMode && Number.isFinite(draft.timeLeftSeconds)) {
            setTimeLeft(Math.max(0, draft.timeLeftSeconds));
          }
          setOfflineNotice('Đã khôi phục bài làm lưu trên máy.');
        } else {
          clearDraft();
        }
      })
      .catch(() => {});
  }, [started, attemptId, draftCheckedAttemptId, restoreDraft, clearDraft, practiceMode]);

  useEffect(() => {
    if (!started || !attemptId) return;
    const timer = setTimeout(() => persistDraft(), 250);
    return () => clearTimeout(timer);
  }, [started, attemptId, selectedAnswers, persistDraft]);

  useEffect(() => {
    if (!started) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isPdfRoomExam && !isOffline && pendingCount <= 0) return;
      event.preventDefault();
      event.returnValue = isPdfRoomExam
        ? 'Bạn chỉ có thể rời phòng thi sau khi nộp bài thành công.'
        : 'Bài làm vẫn đang lưu trên máy. Hãy chờ đồng bộ xong trước khi rời trang.';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [started, isOffline, pendingCount, isPdfRoomExam]);

  useEffect(() => {
    if (!queuedSubmit || isOffline || pendingCount > 0 || !attemptId || !examId) return;
    router.push(`/exam/${examId}/result?attemptId=${attemptId}`);
  }, [queuedSubmit, isOffline, pendingCount, attemptId, examId, router]);

  useEffect(() => {
    if (!offlineNotice || isOffline || pendingCount > 0 || isSyncing) return;
    const timer = setTimeout(() => setOfflineNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [offlineNotice, isOffline, pendingCount, isSyncing]);

  const handleViolationClose = useCallback(() => {
    setShowViolation(false);
    if (violations >= maxViolations) {
      // Optional: auto-submit or report to admin
      alert('Bạn đã vi phạm quá nhiều lần. Bài thi sẽ được gửi và báo cáo cho quản trị viên.');
      handleSubmit({ force: true });
    }
  }, [violations, maxViolations]);

  useEffect(() => {
    if (examId === null) return;      // params chưa sẵn sàng, chờ
    if (!Number.isFinite(examId)) {   // NaN hoặc giá trị xấu
      setLoading(false);
      router.replace('/exam-room');
      return;
    }
    loadPreflight();
  }, [examId]);

  // Timer countdown
  useEffect(() => {
    if (!started || !attemptId || practiceMode || submitting) return;
    if (timeLeft <= 0) {
      handleSubmit({ force: true });
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit({ force: true }); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attemptId, practiceMode, started, submitting, timeLeft]);

  const loadPreflight = async () => {
    if (examId === null || Number.isNaN(examId)) {
      return;
    }

    try {
      setLoading(true);
      setPreflightLeaderboard([]);

      const token = sessionStorage.getItem('token');
      if (!token) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        alert('Vui lòng đăng nhập để thực hiện tính năng này!');
        router.push('/login');
        return;
      }

      const response = await examApi.getExamPreflight(examId);
      setPreflight(response);
      const scheduledExamEnded = Boolean(
        response.start_time
        && response.end_time
        && Date.now() > new Date(response.end_time).getTime()
      );
      const canLoadLeaderboard = !response.start_time || scheduledExamEnded;
      if (canLoadLeaderboard) {
        setPreflightLeaderboardLoading(true);
        officialExamApi.getLeaderboard(examId)
          .then((data) => setPreflightLeaderboard((data.leaderboard || []).slice(0, 10)))
          .catch((error) => {
            console.error('Exam leaderboard error:', error);
            setPreflightLeaderboard([]);
          })
          .finally(() => setPreflightLeaderboardLoading(false));
      } else {
        setPreflightLeaderboard([]);
        setPreflightLeaderboardLoading(false);
      }
      if (response.start_time) {
        officialExamApi.getMyRegistration(examId)
          .then(setRegistration)
          .catch(() => setRegistration(null));
      }
    } catch (error: any) {
      console.error('Error loading exam preflight:', error);
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message || 'Không thể tải thông tin đề.';

      if (errorCode === 'VIP_REQUIRED') {
        setVipError(errorMessage);
      } else {
        alert(errorMessage);
        router.push('/exam-room');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOfficialRegister = async () => {
    if (examId === null || Number.isNaN(examId)) return;
    try {
      setRegistrationLoading(true);
      const data = await officialExamApi.register(examId);
      setRegistration(data);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể đăng ký kỳ thi lúc này.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleOfficialCancel = async () => {
    if (examId === null || Number.isNaN(examId)) return;
    if (!confirm('Hủy đăng ký kỳ thi này?')) return;
    try {
      setRegistrationLoading(true);
      const data = await officialExamApi.cancelRegistration(examId);
      setRegistration(data);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể hủy đăng ký lúc này.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const startExam = async (options: { restart?: boolean; practice?: boolean } = {}) => {
    if (examId === null || Number.isNaN(examId)) {
      return;
    }

    try {
      setLoading(true);

      const shouldEnterPdfRoom = Boolean(preflight?.start_time && preflight?.has_exam_pdf && !options.practice);
      if (shouldEnterPdfRoom && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          alert('Bạn cần cho phép toàn màn hình để vào phòng thi PDF.');
          return;
        }
      }

      const token = sessionStorage.getItem('token');
      if (!token) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        alert('Vui lòng đăng nhập để thực hiện tính năng này!');
        router.push('/login');
        return;
      }

      const response = await examApi.startExam(examId, {
        restart: options.restart,
        practiceMode: options.practice,
        mode: options.practice ? 'practice' : options.restart ? 'restart' : 'resume',
      });

      const nextPracticeMode = Boolean(options.practice || response.practiceMode);

      setExam(response.exam);
      setQuestions(response.questions);
      setAttemptId(response.attemptId);
      setStarted(true);
      setPracticeMode(nextPracticeMode);
      setCurrentQuestionIndex(0);
      setFlaggedQuestions(new Set());
      setPracticeFeedback({});
      setViolations(0);
      setShowViolation(false);
      setLastViolation('');
      setIsScreenCaptured(false);
      setTabConflict(false);
      resetViolations();
      setOfflineNotice(null);
      setQueuedSubmit(false);
      setDraftCheckedAttemptId(null);

      const restoredAnswers: Record<number, number | string> = {};
      for (const answer of response.savedAnswers || []) {
        if (answer.essay_answer) restoredAnswers[answer.question_id] = answer.essay_answer;
        else if (answer.selected_answer_id) restoredAnswers[answer.question_id] = answer.selected_answer_id;
        else if (answer.selected_answer_key) restoredAnswers[answer.question_id] = answer.selected_answer_key;
      }
      setSelectedAnswers(restoredAnswers);

      setTimeLeft(
        nextPracticeMode
          ? 0
          : response.timeLeftSeconds ?? response.exam.duration * 60
      );
    } catch (error: any) {
      console.error('Error starting exam:', error);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message || 'Không thể bắt đầu làm bài. Có thể do kết nối mạng.';

      if (errorCode === 'VIP_REQUIRED') {
        setVipError(errorMessage);
      } else {
        alert(errorMessage);
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const trackSavePromise = (promise: Promise<void>) => {
    activeSavePromisesRef.current.add(promise);
    promise.finally(() => {
      activeSavePromisesRef.current.delete(promise);
    });
    return promise;
  };

  const saveAnswerForQuestion = (
    questionId: number,
    answerKey: string,
    essayText?: string,
    requestPracticeMode = practiceMode,
  ) => {
    if (!attemptId) return Promise.resolve();

    const promise = saveAnswerOfflineAware(questionId, answerKey, 0, essayText)
      .then((saved) => {
        if (saved?.queued) {
          setOfflineNotice('Mất mạng, bài đang lưu trên máy. Khi có mạng hệ thống sẽ tự đồng bộ.');
          return;
        }
        if (requestPracticeMode && saved?.feedback) {
          setPracticeFeedback((prev) => ({
            ...prev,
            [questionId]: saved.feedback,
          }));
        }
      })
      .catch((error: any) => {
        console.error('Error saving answer:', error);
        if (!error.response) {
          setOfflineNotice('Chưa gửi được đáp án. Bài đã được giữ trên máy, hãy thử lại khi có mạng.');
        }
      });

    return trackSavePromise(promise);
  };

  const scheduleEssaySave = (save: PendingEssaySave) => {
    const existingTimer = essaySaveTimersRef.current[save.questionId];
    if (existingTimer) clearTimeout(existingTimer);

    pendingEssaySavesRef.current[save.questionId] = save;
    essaySaveTimersRef.current[save.questionId] = setTimeout(() => {
      const pending = pendingEssaySavesRef.current[save.questionId];
      delete pendingEssaySavesRef.current[save.questionId];
      delete essaySaveTimersRef.current[save.questionId];
      if (pending) {
        saveAnswerForQuestion(pending.questionId, pending.answerKey, pending.essayText, pending.practiceMode);
      }
    }, ESSAY_SAVE_DEBOUNCE_MS);
  };

  const flushPendingAnswerSaves = async () => {
    const pendingSaves = Object.values(pendingEssaySavesRef.current);
    Object.values(essaySaveTimersRef.current).forEach(clearTimeout);
    pendingEssaySavesRef.current = {};
    essaySaveTimersRef.current = {};

    if (pendingSaves.length) {
      await Promise.allSettled(
        pendingSaves.map((save) =>
          saveAnswerForQuestion(save.questionId, save.answerKey, save.essayText, save.practiceMode),
        ),
      );
    }

    const activeSaves = Array.from(activeSavePromisesRef.current);
    if (activeSaves.length) {
      await Promise.allSettled(activeSaves);
    }
  };

  const handleAnswerSelect = async (answerId: number, answerKey: string, essayText?: string) => {
    if (!attemptId || submitting || tabConflict) return;

    const question = questions[currentQuestionIndex];
    if (!question) return;

    const questionId = question.id;
    const isEssayAnswer = essayText !== undefined;

    setSelectedAnswers((prev) => {
      const next = { ...prev };
      if (isEssayAnswer) {
        if ((essayText || '').trim()) next[questionId] = essayText || '';
        else delete next[questionId];
      } else {
        next[questionId] = answerId;
      }
      return next;
    });

    if (isEssayAnswer) {
      scheduleEssaySave({
        questionId,
        answerKey,
        essayText: essayText || '',
        practiceMode,
      });
      return;
    }

    await saveAnswerForQuestion(questionId, answerKey, undefined, practiceMode);
  };

  const handlePdfAnswerSelect = async (question: Question, answerId: number, answerKey: string) => {
    if (!attemptId || submitting || tabConflict) return;
    setSelectedAnswers((prev) => ({ ...prev, [question.id]: answerId }));
    await saveAnswerForQuestion(question.id, answerKey, undefined, false);
  };

  const togglePdfQuestionFlag = (questionId: number) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmit = async (options: { force?: boolean } = {}) => {
    if (!attemptId || submitting || submitInFlightRef.current || (tabConflict && !options.force)) return;

    if (!options.force) {
      setShowSubmitConfirm(true);
      return;
    }

    try {
      const submittingAttemptId = attemptId;
      submitInFlightRef.current = true;
      setSubmitting(true);
      setShowSubmitConfirm(false);
      await flushPendingAnswerSaves();
      if (navigator.onLine) {
        await flushQueue();
      }
      const result = await submitOfflineAware();
      if (result?.queued) {
        setQueuedSubmit(true);
        setOfflineNotice('Đã lưu lệnh nộp bài trên máy. Khi có mạng hệ thống sẽ tự gửi lại.');
        submitInFlightRef.current = false;
        setSubmitting(false);
        return;
      }
      await clearDraft();
      if (isPdfRoomExam && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      // Redirect to result page
      router.push(`/exam/${examId}/result?attemptId=${submittingAttemptId}`);
    } catch (error) {
      console.error('Error submitting exam:', error);
      submitInFlightRef.current = false;
      setSubmitting(false);
      alert('Đã có lỗi xảy ra mạng lúc Nộp. Đừng hoảng loạn, thử ấn nộp lại.');
    }
  };

  useEffect(() => {
    if (!isPdfRoomExam || violations < maxViolations || submitting || !attemptId) return;
    handleSubmit({ force: true });
  }, [attemptId, isPdfRoomExam, maxViolations, submitting, violations]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const processedQuestions = useMemo(() => {
    let currentGroup: any = null;
    return questions.map((q: any) => {
       if (q.effective_passage_text && (q.question_type === 'reading_item' || q.question_type === 'fill_blank_item')) {
          return {
            ...q,
            groupContext: {
              text: q.effective_passage_text || '',
              image: q.effective_passage_image_url || '',
              type: q.question_type === 'reading_item' ? 'reading_passage' : 'fill_blank_pool'
            }
          };
       }

       if (q.question_group_type === 'reading_passage' || q.question_group_type === 'reading_passage_start' ||
           q.question_group_type === 'fill_blank_pool' || q.question_group_type === 'fill_in_the_blank_pool_start') {
          currentGroup = {
             text: q.passage_text || '',
             image: q.passage_image_url || '',
             type: q.question_group_type
          };
       } else if (q.question_group_type === 'standard' || !q.question_group_type) {
          currentGroup = null;
       }

       if (currentGroup) {
           return { ...q, groupContext: currentGroup };
       }
       return q;
    });
  }, [questions]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-[100]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
        </div>
        <div className="absolute mt-24 font-bold text-gray-500 uppercase tracking-widest text-sm animate-pulse">
           Đang tải phòng thi...
        </div>
      </div>
    );
  }

  if (vipError) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-[100]">
        <ProUpgradeModal
          isOpen={true}
          onClose={() => router.back()}
          title="Đề thi dành cho VIP"
        />
      </div>
    );
  }

  if (!started && preflight) {
    const inProgress = preflight.in_progress_attempt;
    const totalQuestions = preflight.question_count || preflight.total_questions || 0;
    const bestScore = Number(preflight.user_best_score || 0);
    const isOfficialExam = Boolean(preflight.start_time);
    const registrationStatus = registration?.status;
    const isApproved = registrationStatus === 'approved' || registrationStatus === 'checked_in';
    const canStartOfficialExam = !isOfficialExam || isApproved;
    const languageReady = Boolean((isOfficialExam && preflight.has_exam_pdf) || (examLanguage && explanationLanguage));
    const leaderboardAvailable = !isOfficialExam || Boolean(
      preflight.end_time && Date.now() > new Date(preflight.end_time).getTime()
    );

    return (
      <InkResultBackground>
      <div className="min-h-screen px-4 py-4 sm:py-6">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => router.back()}
            className={`mb-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${inkResultButtonPanel} text-[#6f563f] hover:bg-[#fff8ec] hover:text-[#d52a1e]`}
          >
            <FiChevronLeft size={18} /> Quay lại
          </button>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:items-start">
          <div className={`overflow-hidden rounded-3xl transition-all ${inkResultPanel}`}>
            <div className="border-b border-[#ead9bd]/75 p-5 sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-600">
                {preflight.subject_name || 'CSCA'}
              </p>
              <h1 className={`text-2xl font-black leading-tight sm:text-3xl ${inkResultTitle}`}>
                {preflight.title}
              </h1>
              {preflight.description && (
                <p className={`mt-2 line-clamp-2 max-w-2xl text-sm leading-6 ${inkResultMuted}`}>
                  {preflight.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 sm:p-5">
              {[
                { label: 'Số câu', value: totalQuestions || '-' },
                { label: 'Thời gian', value: `${preflight.duration || 0} phút` },
                { label: 'Mức khó', value: preflight.difficulty_level || preflight.overall_difficulty || '-' },
                { label: 'Đã làm', value: `${preflight.user_attempt_count || 0} lượt` },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl p-3 ${inkResultSoftPanel}`}>
                  <p className="text-xs font-bold uppercase text-[#9d8a77]">{item.label}</p>
                  <p className={`mt-1 text-lg font-black ${inkResultTitle}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-[#ead9bd]/75 p-4 sm:p-5">
              {!isOfficialExam && (
                <>
              <div className={`mb-4 rounded-3xl p-4 sm:p-5 ${inkResultSoftPanel}`}>
                <p className={`mb-3 flex items-center gap-1.5 text-sm font-black ${inkResultTitle}`}>
                  <span>🎨</span> Chọn ngôn ngữ hiển thị đề thi:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { mode: 'zh', label: '🇨🇳 Tiếng Trung' },
                    { mode: 'en', label: '🇬🇧 Tiếng Anh' },
                  ].map((opt) => (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => setExamLanguage(opt.mode)}
                      className={`px-4 py-2.5 text-xs font-black rounded-2xl border-2 transition-all duration-200 shadow-sm ${
                        examLanguage === opt.mode
                          ? 'scale-105 border-[#d52a1e] bg-[#d52a1e] text-white shadow-[0_4px_14px_rgba(213,42,30,0.18)]'
                          : 'border-[#ead9bd]/85 bg-[#fffaf2]/92 text-[#6f563f] hover:border-[#d8bd94] hover:bg-[#fff8ec]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`mb-4 rounded-3xl p-4 sm:p-5 ${inkResultSoftPanel}`}>
                <p className={`mb-3 flex items-center gap-1.5 text-sm font-black ${inkResultTitle}`}>
                  <span>💡</span> Chọn ngôn ngữ hiển thị lời giải:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { lang: 'vi', label: '🇻🇳 Tiếng Việt thui' },
                    { lang: 'en', label: '🇬🇧 Tiếng Anh nè' },
                    { lang: 'zh', label: '🇨🇳 Tiếng Trung nha' },
                    { lang: 'vi_en', label: '🇻🇳🇬🇧 Song ngữ Việt Anh' },
                    { lang: 'vi_zh', label: '🇻🇳🇨🇳 Song ngữ Việt Trung' },
                    { lang: 'en_zh', label: '🇬🇧🇨🇳 Song ngữ Anh Trung' },
                    { lang: 'vi_en_zh', label: '🌐 Full 3 thứ tiếng lun!' },
                  ].map((opt) => (
                    <button
                      key={opt.lang}
                      type="button"
                      onClick={() => setExplanationLanguage(opt.lang)}
                      className={`px-4 py-2.5 text-xs font-black rounded-2xl border-2 transition-all duration-200 shadow-sm ${
                        explanationLanguage === opt.lang
                          ? 'scale-105 border-[#d52a1e] bg-[#d52a1e] text-white shadow-[0_4px_14px_rgba(213,42,30,0.18)]'
                          : 'border-[#ead9bd]/85 bg-[#fffaf2]/92 text-[#6f563f] hover:border-[#d8bd94] hover:bg-[#fff8ec]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
                </>
              )}

              <div className="mb-3 rounded-2xl border border-[#ead9bd]/80 bg-[#fff7ec]/75 p-3 text-sm text-[#6f563f]">
                <span className="font-black">Điểm tốt nhất:</span> {bestScore ? bestScore.toFixed(1) : 'Chưa có'}
                {inProgress && (
                  <span className="ml-0 mt-2 block sm:ml-3 sm:mt-0 sm:inline">
                    Đang làm dở: {inProgress.answered_count || 0}/{totalQuestions || '?'} câu
                  </span>
                )}
              </div>

              {isOfficialExam && (
                <div className={`mb-3 rounded-2xl border p-3 text-sm ${
                  isApproved
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : registrationStatus === 'registered'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">
                        Trạng thái đăng ký: {registrationStatus === 'approved' ? 'Đã duyệt' :
                          registrationStatus === 'checked_in' ? 'Đã check-in' :
                          registrationStatus === 'registered' ? 'Đã đăng ký' :
                          registrationStatus === 'cancelled' ? 'Đã hủy' : 'Chưa đăng ký'}
                      </p>
                      <p className="mt-1">
                        Giờ thi: {preflight.start_time ? new Date(preflight.start_time).toLocaleString('vi-VN') : 'Chưa đặt'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(!registrationStatus || registrationStatus === 'cancelled') && (
                        <button
                          onClick={handleOfficialRegister}
                          disabled={registrationLoading}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {registrationLoading ? 'Đang xử lý...' : 'Đăng ký'}
                        </button>
                      )}
                      {(registrationStatus === 'registered' || registrationStatus === 'approved') && (
                        <button
                          onClick={handleOfficialCancel}
                          disabled={registrationLoading}
                          className="rounded-xl border border-current px-4 py-2 text-xs font-black hover:bg-white/70 disabled:opacity-60"
                        >
                          {registrationLoading ? 'Đang xử lý...' : 'Hủy đăng ký'}
                        </button>
                      )}
                      {isApproved && (
                        <button
                          onClick={() => router.push(`/exam/${examId}/ticket`)}
                          className="rounded-xl bg-white px-4 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"
                        >
                          Vé dự thi
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                {inProgress ? (
                  <>
                    <button
                      onClick={() => startExam()}
                      disabled={loading || !canStartOfficialExam || !languageReady}
                      className="disabled:cursor-not-allowed inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#d52a1e] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[rgba(213,42,30,0.18)] hover:bg-[#b9231a] disabled:opacity-60"
                    >
                      <FiPlay size={18} /> Tiếp tục bài đang làm
                    </button>
                    <button
                      onClick={() => startExam({ restart: true })}
                      disabled={loading || !canStartOfficialExam || !languageReady}
                      className="disabled:cursor-not-allowed inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#ead9bd]/85 bg-[#fffaf2]/92 px-5 py-2.5 text-sm font-black text-[#6f563f] hover:bg-[#fff8ec] disabled:opacity-60"
                    >
                      <FiRotateCcw size={18} /> Làm lại từ đầu
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startExam()}
                    disabled={loading || !canStartOfficialExam || !languageReady}
                      className="disabled:cursor-not-allowed inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#d52a1e] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[rgba(213,42,30,0.18)] hover:bg-[#b9231a] disabled:opacity-60"
                  >
                    <FiPlay size={18} /> Bắt đầu làm bài
                  </button>
                )}
                {!isOfficialExam && (
                <button
                  onClick={() => startExam({ practice: true })}
                  disabled={loading || !languageReady}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#c99722] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[rgba(201,151,34,0.18)] hover:bg-[#a97b17] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiBookOpen size={18} /> Luyện tập không tính giờ
                </button>
                )}
              </div>
              {!languageReady && (
                <p className="mt-4 text-center text-sm font-bold text-rose-500 flex items-center justify-center gap-1.5 animate-pulse">
                  <FiAlertCircle size={16} /> Vui lòng chọn ngôn ngữ đề thi và lời giải để bắt đầu nha!
                </p>
              )}
            </div>
          </div>

          {leaderboardAvailable ? (
            <OfficialExamLeaderboard
              entries={preflightLeaderboard}
              examTitle={preflight.title}
              loading={preflightLeaderboardLoading}
              compact
              className="lg:sticky lg:top-4"
              badgeLabel="Bảng xếp hạng đề thi"
              scopeLabel="Riêng đề này"
              noRoomLabel="Luyện đề tự do"
              emptyTitle="Chưa có xếp hạng"
              emptyDescription="Khi có người nộp bài, 10 kết quả tốt nhất của đề này sẽ hiện ở đây."
            />
          ) : (
            <div className={`rounded-3xl p-6 text-center lg:sticky lg:top-4 ${inkResultPanel}`}>
              <FiShield className="mx-auto mb-3 text-3xl text-indigo-600" />
              <h2 className={`text-lg font-black ${inkResultTitle}`}>Bảng xếp hạng đang được khóa</h2>
              <p className={`mt-2 text-sm font-semibold leading-6 ${inkResultMuted}`}>
                Kết quả của kỳ thi này chỉ hiển thị sau khi kỳ thi kết thúc.
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
      </InkResultBackground>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <FiAlertCircle className="text-red-500 mb-6" size={80} />
        <h2 className="text-2xl font-black text-gray-800 mb-2">Đề thi bị lỗi hoặc không tồn tại</h2>
        <p className="text-gray-500 mb-8 max-w-sm text-center">Chúng tôi không thể lấy dữ liệu câu hỏi từ hệ thống. Hãy báo cáo Admin.</p>
        <button
          onClick={() => router.back()}
          className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:shadow-xl transition-all"
        >
          Trở lại an toàn
        </button>
      </div>
    );
  }

  const baseLanguageMode = normalizeExamLanguageMode(exam?.language_mode);
  const activeLanguageMode = examLanguage || baseLanguageMode;
  const currentQuestion = processedQuestions[currentQuestionIndex] as any;
  const currentQuestionAnswer = selectedAnswers[currentQuestion?.id];
  const questionText = getExamText({
    vi: currentQuestion?.question_text,
    zh: currentQuestion?.question_text_cn,
    en: currentQuestion?.question_text_en,
  }, activeLanguageMode);
  const currentFeedback = practiceFeedback[currentQuestion?.id];
  const feedbackAnswerText = getExamText({
    vi: currentFeedback?.correct_answer_text,
    zh: currentFeedback?.correct_answer_text_cn,
    en: currentFeedback?.correct_answer_text_en,
  }, activeLanguageMode);
  const feedbackExplanationText = getExamText({
    vi: currentFeedback?.explanation,
    zh: currentFeedback?.explanation_cn,
    en: currentFeedback?.explanation_en,
  }, explanationLanguage === 'all' ? baseLanguageMode : (explanationLanguage || baseLanguageMode));
  const answeredCount = questions.reduce(
    (count, question) => count + (hasAnsweredValue(selectedAnswers[question.id]) ? 1 : 0),
    0,
  );
  const progressPercent = (answeredCount / questions.length) * 100;
  const isTimeCritical = !practiceMode && timeLeft < 300; // less than 5 min
  const displayedQuestionIndexes = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => {
      const isAnswered = hasAnsweredValue(selectedAnswers[q.id]);
      if (navFilter === 'answered') return isAnswered;
      if (navFilter === 'unanswered') return !isAnswered;
      if (navFilter === 'flagged') return flaggedQuestions.has(q.id);
      return true;
    });
  const toggleFlag = () => {
    if (!currentQuestion?.id) return;
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  };

  if (isPdfRoomExam) {
    return (
      <div className="fixed inset-0 z-[90] bg-slate-950">
        <AiAnalyzingOverlay open={submitting} mode="submit" />
        <PdfRoomExamWorkspace
          exam={exam}
          questions={questions}
          selectedAnswers={selectedAnswers}
          flaggedQuestions={flaggedQuestions}
          timeLeft={timeLeft}
          userName={user?.full_name || 'Thí sinh'}
          violations={violations}
          maxViolations={maxViolations}
          submitting={submitting}
          tabConflict={tabConflict}
          onSelectAnswer={handlePdfAnswerSelect}
          onToggleFlag={togglePdfQuestionFlag}
          onSubmit={() => handleSubmit()}
        />

        {!submitting && showViolation && (
          <ViolationWarning
            count={violations}
            maxViolations={maxViolations}
            onClose={handleViolationClose}
          />
        )}

        {showSubmitConfirm && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><FiSend size={21} /></div>
                <div><h2 className="text-lg font-black text-slate-950">Nộp bài thi?</h2><p className="text-sm font-semibold text-slate-500">Nộp thành công xong bạn mới rời được phòng thi.</p></div>
              </div>
              <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Đã làm <strong className="text-slate-950">{answeredCount}/{questions.length}</strong> câu · Còn <strong className="text-slate-950">{formatTime(timeLeft)}</strong>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowSubmitConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Kiểm tra lại</button>
                <button type="button" onClick={() => handleSubmit({ force: true })} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">Nộp ngay</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`exam-content-text min-h-screen bg-[#f8fafc] selection:bg-indigo-200 ${practiceMode ? '' : 'exam-protected'}`}
      style={practiceMode ? undefined : {
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <AiAnalyzingOverlay open={submitting} mode={practiceMode ? 'practice' : 'exam'} />

      {!practiceMode && tabConflict && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <FiAlertCircle size={28} />
            </div>
            <h2 className="text-xl font-black text-slate-950">Bài này đang mở ở tab khác</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Để tránh hai bản nháp ghi đè nhau, tab này đang tạm khóa thao tác. Đóng tab kia hoặc bấm tiếp tục ở đây.
            </p>
            <button
              type="button"
              onClick={claimAttemptTabLock}
              className="mt-5 w-full rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white hover:bg-amber-700"
            >
              Tiếp tục ở tab này
            </button>
          </div>
        </div>
      )}

      {/* Screen Capture Shield - covers content when screenshot detected */}
      {!practiceMode && isScreenCaptured && (
        <div className="exam-capture-shield" onClick={() => setIsScreenCaptured(false)}>
          <div className="exam-capture-shield-content">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <FiShield size={32} className="text-red-400" />
            </div>
            <h3>Phát hiện hành vi chụp màn hình</h3>
            <p>Nội dung đề thi đã bị ẩn. Nhấn để tiếp tục làm bài.</p>
            <button
              onClick={() => setIsScreenCaptured(false)}
              className="px-6 py-2.5 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Tiếp tục làm bài
            </button>
          </div>
        </div>
      )}

      {/* Watermark overlay - user identity stamped across exam */}
      {mounted && !practiceMode && (
        <div className="fixed inset-0 pointer-events-none z-[45] overflow-hidden" aria-hidden="true" style={{ opacity: 0.04 }}>
          <div className="absolute inset-0" style={{ transform: 'rotate(-35deg)', transformOrigin: 'center center' }}>
            {Array.from({ length: 12 }).map((_, row) => (
              <div key={row} className="flex whitespace-nowrap" style={{ marginTop: row === 0 ? '-10%' : '80px' }}>
                {Array.from({ length: 8 }).map((_, col) => (
                  <span
                    key={col}
                    className="text-gray-900 font-bold text-lg mx-16 select-none"
                    style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
                  >
                    {user?.full_name || 'CSCA'} • ID:{user?.id || '?'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* FOCUS TOP BAR */}
      <div className="fixed top-0 left-0 right-0 min-h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 flex items-center justify-between gap-2 px-3 py-2 sm:px-8 shadow-sm">
        {/* Left Side: Info */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white items-center justify-center shadow-inner font-black">
             {exam.title.substring(0, 1) || 'E'}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 leading-tight max-w-[42vw] sm:max-w-md truncate">
               {exam.title}
            </h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
               Câu {currentQuestionIndex + 1} / {questions.length} • Hoàn thành {answeredCount}
            </p>
          </div>
        </div>

        {/* Right Side: Tools */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-6">
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono text-base sm:text-2xl font-bold tracking-tight shadow-inner border ${
              isTimeCritical 
                ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
            <FiClock size={18} className={isTimeCritical && !practiceMode ? 'text-red-500' : 'text-slate-400'} />
            {practiceMode ? 'Luyện tập' : formatTime(timeLeft)}
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={submitting || tabConflict}
            className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-5 sm:px-8 py-2 sm:py-2.5 rounded-xl font-bold shadow-md hover:shadow-xl hover:shadow-teal-500/20 active:scale-95 transition-all outline-none disabled:opacity-60"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FiSend size={18} />
            )}
            <span className="hidden sm:inline">{submitting ? 'ĐANG NỘP' : 'NỘP BÀI KẾT THÚC'}</span>
          </button>
        </div>
        
        {/* Magic Progress Bar running along the exact bottom of Top Bar */}
        <div className="absolute bottom-0 left-0 h-[3px] bg-slate-200 w-full" />
      <div 
        className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out z-10" 
        style={{ width: `${progressPercent}%` }}
      />
    </div>

      {(isOffline || pendingCount > 0 || isSyncing || offlineNotice) && (
        <div className="fixed left-3 right-3 top-[76px] z-[55] sm:left-1/2 sm:right-auto sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2">
          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
            isOffline
              ? 'border-amber-200 bg-amber-50/95 text-amber-900'
              : pendingCount > 0 || isSyncing
                ? 'border-blue-200 bg-blue-50/95 text-blue-900'
                : 'border-emerald-200 bg-emerald-50/95 text-emerald-900'
          }`}>
            <div className="mt-0.5 shrink-0">
              {isSyncing ? <FiRefreshCw className="animate-spin" size={18} /> : <FiWifiOff size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black">
                {isOffline
                  ? 'Mất mạng, bài đang lưu trên máy'
                  : isSyncing
                    ? 'Đang đồng bộ bài làm'
                    : pendingCount > 0
                      ? `Còn ${pendingCount} thay đổi chờ đồng bộ`
                      : 'Bài làm đã được lưu'}
              </p>
              <p className="mt-0.5 leading-5">
                {offlineNotice || (pendingCount > 0
                  ? 'Đừng tắt trang trước khi hệ thống gửi xong.'
                  : 'Bạn có thể tiếp tục làm bài bình thường.')}
              </p>
            </div>
            {!isOffline && pendingCount > 0 && (
              <button
                type="button"
                onClick={() => flushQueue()}
                disabled={isSyncing}
                className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-blue-700 shadow-sm disabled:opacity-60"
              >
                Gửi lại
              </button>
            )}
          </div>
        </div>
      )}


      {/* MAIN EXAM ARENA */}
      <div 
        className="max-w-[1500px] mx-auto pt-24 pb-32 sm:pb-16 px-3 sm:px-4 md:px-8 flex flex-col lg:flex-row gap-5 lg:gap-10 transition-[filter] duration-200"
        style={{ filter: !practiceMode && isScreenCaptured ? 'blur(30px)' : 'none' }}
      >
        
        {/* Left Area: The Question Board */}
        <div className="lg:flex-1 lg:max-w-4xl max-w-full">
           <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-6 md:p-12 transition-all duration-300">
             
             {/* Question Badge */}
             <div className="flex items-center gap-3 mb-6">
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-black uppercase tracking-widest border border-indigo-200">
                   Câu Hỏi {currentQuestionIndex + 1}
                 </span>
                <button
                  type="button"
                  onClick={toggleFlag}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm font-bold transition-colors ${
                    flaggedQuestions.has(currentQuestion.id)
                      ? 'border-amber-300 bg-amber-100 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <FiFlag size={15} />
                  {flaggedQuestions.has(currentQuestion.id) ? 'Đã đánh dấu' : 'Đánh dấu'}
                </button>
              </div>

             {/* Group Context / Passage */}
             {currentQuestion.groupContext && currentQuestion.groupContext.text && (
                <div className="mb-8 bg-amber-50/50 p-6 rounded-2xl border border-amber-200/60 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-orange-400" />
                   <RichMathText
                      value={currentQuestion.groupContext.text}
                      className="exam-content-text text-[17px] font-normal leading-[1.9] text-slate-800"
                   />
                   {currentQuestion.groupContext.image && (
                      <img src={currentQuestion.groupContext.image} alt="Passage" className="mt-5 max-w-full rounded-xl border border-amber-100 shadow-sm" />
                   )}
                </div>
             )}

             {/* Question Text */}
             <div className="exam-content-text mb-6 text-lg font-medium leading-[1.75] text-slate-800 sm:mb-8 sm:text-xl sm:leading-[1.8] md:text-[21px]">
                <RichMathText value={questionText.primary} className="exam-math-readable exam-taking-math text-inherit" />
                
                {questionText.secondary && (
                  <div className="text-lg md:text-xl font-medium text-slate-500 mt-5 pt-5 border-t border-dashed border-slate-200 leading-[1.8]">
                    <RichMathText value={questionText.secondary} className="exam-math-readable exam-taking-math text-inherit" />
                  </div>
                )}

                {questionText.tertiary && (
                  <div className="text-lg md:text-xl font-medium text-slate-400 mt-5 pt-5 border-t border-dashed border-slate-200 leading-[1.8]">
                    <RichMathText value={questionText.tertiary} className="exam-math-readable exam-taking-math text-inherit" />
                  </div>
                )}
             </div>

             {/* Question Attachments */}
             {currentQuestion.image_url && (
                <div className="mb-10 flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-white">
                  <img
                    src={currentQuestion.image_url}
                    alt="Phụ lục câu hỏi"
                    className="max-h-[400px] max-w-full rounded-xl bg-white object-contain"
                  />
                </div>
              )}

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-6">
               {currentQuestion.question_type === 'essay' || currentQuestion.question_type === 'translation' ? (
                 /* ─── Essay / Translation input ─── */
                 <div className="col-span-1 md:col-span-2">
                   <textarea
                      value={(currentQuestionAnswer as string) || ''}
                      onChange={e => {
                        if (!attemptId || submitting) return;
                        handleAnswerSelect(0, 'ESSAY', e.target.value).catch(() => {});
                      }}
                     placeholder={currentQuestion.question_type === 'translation'
                       ? 'Nhập câu dịch tiếng Trung vào đây...'
                       : 'Nhập câu trả lời tự luận vào đây...'}
                     rows={6}
                     className="w-full px-5 py-4 border-2 border-indigo-200 rounded-2xl bg-white text-base resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-gray-800 leading-relaxed shadow-sm"
                   />
                   <p className="mt-2 text-xs text-gray-400 flex items-center gap-1.5 px-1">
                     <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block" />
                     Câu trả lời được lưu tự động khi bạn gõ
                   </p>
                 </div>
               ) : (
                /* ─── Multiple-choice options ─── */
                (() => {
                  const q = currentQuestion as any;
                  const isFillBlank = q.question_type === 'fill_blank_item';
                  const groupId = isFillBlank ? q.passage_group_id : null;
                  const rawAnswers = q.answers || [];
                  const usedKeys = new Set<string>();

                  if (isFillBlank && groupId) {
                    questions.forEach((otherQuestion: any) => {
                      if (
                        otherQuestion.id === currentQuestion.id ||
                        otherQuestion.question_type !== 'fill_blank_item' ||
                        otherQuestion.passage_group_id !== groupId
                      ) {
                        return;
                      }

                      const selected = selectedAnswers[otherQuestion.id];
                      const selectedAnswer = (otherQuestion.answers || []).find((answer: any) =>
                        answer.id === selected || answer.answer_key === selected
                      );
                      if (selectedAnswer?.answer_key) {
                        usedKeys.add(selectedAnswer.answer_key);
                      }
                    });
                  }

                  // For fill_blank_item: hide options selected by other items, but keep this question's selected option visible.
                  const visibleAnswers = isFillBlank
                    ? rawAnswers.filter((a: any) =>
                        !usedKeys.has(a.answer_key) ||
                        currentQuestionAnswer === a.id ||
                        currentQuestionAnswer === a.answer_key
                      )
                    : rawAnswers;

                  // If all options are used up, show a message
                  if (isFillBlank && visibleAnswers.length === 0) {
                    return (
                      <div className="col-span-1 md:col-span-2 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 text-sm text-amber-700 text-center">
                        Tất cả các lựa chọn đã được sử dụng.
                      </div>
                    );
                  }

                  return visibleAnswers.map((answer: any, index: number) => {
                    const isSelected = currentQuestionAnswer === answer.id || currentQuestionAnswer === answer.answer_key;
                    const letter = answer.answer_key || String.fromCharCode(65 + index);
                    const answerText = getExamText({
                      vi: answer.answer_text,
                      zh: answer.answer_text_cn,
                      en: answer.answer_text_en,
                    }, activeLanguageMode);

                    return (
                      <button
                        key={answer.id}
                        onClick={() => handleAnswerSelect(answer.id, answer.answer_key)}
                        className={`relative w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 group flex items-start gap-3 sm:gap-4 outline-none ${
                            isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-[0_4px_20px_-4px_rgba(79,70,229,0.15)] ring-1 ring-indigo-600/20 dark:border-violet-400 dark:bg-violet-500/25 dark:shadow-[0_0_24px_-8px_rgba(139,92,246,0.8)] dark:ring-violet-400/50'
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-violet-400 dark:hover:bg-slate-800'
                          }`}
                      >
                        <div className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all ${
                            isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white dark:border-violet-300 dark:bg-violet-500'
                            : 'border-slate-300 text-slate-500 group-hover:border-indigo-300 group-hover:text-indigo-500 bg-white dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:group-hover:border-violet-400 dark:group-hover:text-violet-300'
                          }`}>
                          {isSelected ? <FiCheck strokeWidth={3} /> : letter}
                        </div>
                        <div className="min-w-0 flex-1 mt-0.5">
                          <RichMathText
                            value={answerText.primary}
                            className={`exam-content-text exam-math-readable exam-taking-math text-base font-medium leading-relaxed ${isSelected ? 'text-indigo-900 dark:text-violet-100' : 'text-slate-700 dark:text-slate-100'}`}
                          />
                          {answerText.secondary && (
                            <div className={`mt-2 text-sm leading-relaxed ${isSelected ? 'text-indigo-700/80 dark:text-violet-200' : 'text-slate-500 dark:text-slate-400'}`}>
                              <RichMathText value={answerText.secondary} className="exam-math-readable exam-taking-math text-inherit" />
                            </div>
                          )}
                          {answer.image_url && (
                            <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-white p-2">
                              <img src={answer.image_url} alt={`Lựa chọn ${letter}`} className="max-w-full max-h-32 object-contain mx-auto" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  });
                })()
/*
                  return (
                    <button
                      key={answer.id}
                      onClick={() => handleAnswerSelect(answer.id, answer.answer_key)}
                      className={`relative w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 group flex items-start gap-3 sm:gap-4 outline-none ${
                          isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-[0_4px_20px_-4px_rgba(79,70,229,0.15)] ring-1 ring-indigo-600/20'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 bg-white'
                        }`}
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all ${
                          isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 text-slate-500 group-hover:border-indigo-300 group-hover:text-indigo-500 bg-white'
                        }`}>
                        {isSelected ? <FiCheck strokeWidth={3} /> : letter}
                      </div>
                      <div className="min-w-0 flex-1 mt-0.5">
                        <span className={`text-base font-semibold leading-relaxed ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                           {answer.answer_text}
                        </span>
                        {answer.answer_text_cn && answer.answer_text_cn !== answer.answer_text && (
                          <div className={`mt-2 text-sm leading-relaxed ${isSelected ? 'text-indigo-700/80' : 'text-slate-500'}`}>
                             {answer.answer_text_cn}
                          </div>
                        )}
                        {answer.image_url && (
                          <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-white p-2">
                            <img src={answer.image_url} alt={`Lựa chọn ${letter}`} className="max-w-full max-h-32 object-contain mx-auto" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
*/
               )}
             </div>

             {practiceMode && currentFeedback && (
               <div className={`mt-6 rounded-2xl border p-4 ${
                 currentFeedback.is_correct
                   ? 'border-emerald-200 bg-emerald-50'
                   : 'border-red-200 bg-red-50'
               }`}>
                 <p className={`mb-2 text-sm font-black ${
                   currentFeedback.is_correct ? 'text-emerald-700' : 'text-red-700'
                 }`}>
                   {currentFeedback.is_correct ? 'Đúng' : 'Chưa đúng'}
                 </p>
                 {!currentFeedback.is_correct && (
                   <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <span className="mb-1 block">Đáp án đúng: {currentFeedback.correct_answer_key}.</span>
                      <RichMathText
                        value={feedbackAnswerText.primary}
                        className="exam-math-readable text-inherit"
                      />
                      {feedbackAnswerText.secondary && (
                        <RichMathText
                          value={feedbackAnswerText.secondary}
                          className="exam-math-readable mt-1 text-slate-500 dark:text-slate-400"
                        />
                      )}
                   </div>
                  )}
                  {(currentFeedback.explanation || currentFeedback.explanation_cn || currentFeedback.explanation_en || currentFeedback.explanation_image_url) && (
                    <div className="mt-3 rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-800">Giải thích:</p>
                      {feedbackExplanationText.primary && (
                        <>
                          <RichMathText
                            value={feedbackExplanationText.primary}
                            readableBreaks
                            className="exam-math-readable exam-taking-math text-base leading-7 text-slate-800"
                          />
                          {feedbackExplanationText.secondary && (
                            <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
                              <RichMathText
                                value={feedbackExplanationText.secondary}
                                readableBreaks
                                className="exam-math-readable exam-taking-math text-base leading-7 text-slate-500"
                              />
                            </div>
                          )}
                          {feedbackExplanationText.tertiary && (
                            <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
                              <RichMathText
                                value={feedbackExplanationText.tertiary}
                                readableBreaks
                                className="exam-math-readable exam-taking-math text-base leading-7 text-slate-400"
                              />
                            </div>
                          )}
                        </>
                      )}
                      {currentFeedback.explanation_image_url && (
                        <img
                          src={currentFeedback.explanation_image_url}
                          alt="Ảnh giải thích"
                          className="mt-3 max-h-[520px] w-full rounded-lg border border-slate-200 bg-white object-contain"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

           </div>

           {/* Mobile / Screen bottom Navigation Bar */}
           <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <FiChevronLeft size={20} /> <span className="hidden sm:inline">Câu Trước Đó</span>
              </button>

              <div className="text-slate-400 font-bold px-4">
                 {currentQuestionIndex + 1} / {questions.length}
              </div>

              <button
                onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={currentQuestionIndex === questions.length - 1}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all text-indigo-700 bg-indigo-50 active:bg-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-50"
              >
                <span className="hidden sm:inline">Câu Tiếp Theo</span> <FiChevronRight size={20} />
              </button>
           </div>
        </div>

        {/* Right Area: Nav Grid Floating Panel */}
        <div className="shrink-0 lg:w-[380px] xl:w-[420px]">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 xl:p-6 dark:border-slate-700 dark:bg-slate-900/95 lg:sticky lg:top-24">
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                 <FiGrid />
              </div>
              <h3 className="font-bold text-slate-800 tracking-tight">Biểu Đồ Câu Hỏi</h3>
            </div>
            
            <div className="mb-4 grid grid-cols-2 gap-2">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'unanswered', label: 'Chưa làm' },
                { key: 'answered', label: 'Đã làm' },
                { key: 'flagged', label: 'Đánh dấu' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setNavFilter(item.key as typeof navFilter)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                    navFilter === item.key
                      ? 'bg-slate-900 text-white dark:bg-violet-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* The Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 max-h-[40vh] lg:max-h-[62vh] overflow-y-auto px-1 custom-scrollbar">
              {displayedQuestionIndexes.map(({ q, index }) => {
                const isActive = index === currentQuestionIndex;
                const isDone = hasAnsweredValue(selectedAnswers[q.id]);
                const isFlagged = flaggedQuestions.has(q.id);

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`
                      relative aspect-square rounded-xl font-bold text-[13px] transition-all flex items-center justify-center outline-none
                      ${isActive
                        ? 'bg-slate-800 text-white shadow-lg ring-4 ring-slate-100 scale-110 z-10 dark:bg-white dark:text-slate-950 dark:ring-violet-400'
                        : isDone
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 hover:border-indigo-300 dark:border-violet-400/70 dark:bg-violet-500/25 dark:text-violet-200 dark:hover:bg-violet-500/40'
                          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800'
                      }
                      ${isFlagged && !isActive ? 'ring-2 ring-amber-300' : ''}
                    `}
                  >
                    {index + 1}
                    {isFlagged && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

             {/* Legend */}
             <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-md bg-indigo-100 border border-indigo-300"></div>
                <span className="text-xs font-semibold text-slate-600">Đã chọn</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-md bg-slate-800"></div>
                <span className="text-xs font-semibold text-slate-600">Hiện tại</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-md bg-white border border-slate-200"></div>
                <span className="text-xs font-semibold text-slate-600">Chưa làm</span>
              </div>
            </div>

          </div>
        </div>

        {/* Anti-cheat violation warning overlay */}
        {!practiceMode && showViolation && (
          <ViolationWarning
            count={violations}
            maxViolations={maxViolations}
            onClose={handleViolationClose}
          />
        )}

      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tiến độ</p>
            <p className="truncate text-sm font-black text-slate-900">
              {answeredCount}/{questions.length} câu - {practiceMode ? 'Luyện tập' : formatTime(timeLeft)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting || tabConflict}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-black text-white shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-60"
          >
            {submitting ? (
              <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <FiSend size={18} />
            )}
            Nộp bài
          </button>
        </div>
      </div>

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <FiSend size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">Nộp bài thi?</h2>
                <p className="text-sm text-slate-500">Sau khi nộp bạn không thể sửa đáp án.</p>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Đã làm</p>
                <p className="font-black text-slate-900">{answeredCount}/{questions.length}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Còn lại</p>
                <p className="font-black text-slate-900">{practiceMode ? 'Không tính giờ' : formatTime(timeLeft)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Đánh dấu</p>
                <p className="font-black text-slate-900">{flaggedQuestions.size}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting || tabConflict}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 active:bg-slate-50 disabled:opacity-60"
              >
                Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={() => handleSubmit({ force: true })}
                disabled={submitting || tabConflict}
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white active:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? 'Đang nộp...' : 'Nộp ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
