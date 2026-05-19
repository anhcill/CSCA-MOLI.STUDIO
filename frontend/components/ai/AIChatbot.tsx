'use client';

import { useState, useRef, useEffect } from 'react';
import { FiSend, FiUser, FiCpu, FiTrash2, FiCopy, FiCheck, FiMessageCircle, FiZap, FiChevronRight } from 'react-icons/fi';
import { authFetch } from '@/lib/utils/authFetch';

interface Message {
    id: string;
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: string;
}

interface AIChatbotProps {
    attemptId?: number;
    examTitle?: string;
}

const QUICK_QUESTIONS = [
    { label: 'Câu sai', prompt: 'Hãy xem lại các câu tôi làm sai trong bài này và giải thích vì sao sai, vì sao đáp án đúng hợp lý.', emoji: '❓' },
    { label: 'Câu bỏ qua', prompt: 'Hãy giúp tôi xem lại các câu tôi bỏ qua, hướng dẫn cách suy luận và mẹo nhận biết lần sau.', emoji: '⏳' },
    { label: 'Câu đúng', prompt: 'Hãy chọn vài câu tôi làm đúng trong bài này và giải thích dấu hiệu nhận biết để tôi nhớ lâu hơn.', emoji: '✅' },
    { label: 'Học gì tiếp?', prompt: 'Tôi nên học gì tiếp theo để cải thiện sau bài này?', emoji: '🎯' },
];

// Format AI response into readable paragraphs
function formatMessage(text: string): React.ReactNode[] {
    if (!text) return [];
    const lines = text.split('\n').filter(l => l.trim());
    const blocks: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Skip label prefixes like "1.", "2.", "Giải thích:", etc.
        const labelPrefix = /^(Điều kiện|Giải thích|Ví dụ|Công thức|Từ mới|Từ vựng|Lời khuyên|Kết luận|Note|Ghi chú|Phân tích)[\s:：.]/i;
        if (line.match(/^\d+[.)]\s/) || line.match(labelPrefix)) {
            blocks.push(
                <p key={`label-${i}`} className="mt-3 first:mt-0 font-semibold text-purple-800 text-sm">
                    {line.replace(/^\d+[.)]\s*/, '')}
                </p>
            );
            i++;
            continue;
        }

        // Bullet points
        if (/^[—•\-\*]\s/.test(line)) {
            const bulletText = line.replace(/^[—•\-\*]\s/, '');
            if (bulletText) {
                blocks.push(
                    <div key={`b-${i}`} className="flex items-start gap-2 mt-1 first:mt-0 pl-2">
                        <span className="text-purple-400 shrink-0 mt-0.5">•</span>
                        <span className="text-gray-700 text-sm flex-1 leading-relaxed">{bulletText}</span>
                    </div>
                );
            }
            i++;
            continue;
        }

        // Math formula lines
        if (line.match(/[=<>≤≥√∑∏π→⇒∈∉⊂⊃]/) && !line.match(/^[A-ZÀÁ]/)) {
            blocks.push(
                <p key={`math-${i}`} className="mt-1 font-mono text-sm bg-purple-50 px-3 py-2 rounded-lg text-purple-900 overflow-x-auto">
                    {line}
                </p>
            );
            i++;
            continue;
        }

        // Regular content line
        if (line && !line.match(/^[-*•]\s*$/) && line.length > 0) {
            const clean = line
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/^[-•*]\s+/, '');

            blocks.push(
                <p key={`text-${i}`} className="mt-1 first:mt-0 text-sm text-gray-700 leading-relaxed">{clean}</p>
            );
        }
        i++;
    }

    return blocks;
}

function ThinkingDots({ label = 'AI đang đọc bài và chuẩn bị trả lời...' }: { label?: string }) {
    return (
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="min-w-0 text-xs text-gray-500 sm:text-sm">{label}</span>
        </div>
    );
}

export default function AIChatbot({ attemptId, examTitle }: AIChatbotProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'ai',
            content: 'Chào bạn! Tôi là trợ lý AI học tập. Bạn có thể hỏi tôi về câu đúng, câu sai, câu bỏ qua, từ vựng và mẹo làm bài. Hãy đặt câu hỏi nhé!',
            timestamp: new Date().toISOString(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const copyMessage = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            // fallback
        }
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setIsStreaming(true);

        const tempAiId = (Date.now() + 1).toString();
        const aiMsg: Message = {
            id: tempAiId,
            role: 'ai',
            content: '',
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);

        try {
            const res = await authFetch('/api/ai/ask-stream', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({
                    question: text.trim(),
                    attemptId: attemptId,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.message || errorData?.answer || 'AI đang bận. Vui lòng thử lại sau.');
            }

            if (!res.body) throw new Error('Không nhận được phản hồi từ AI');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let fullContent = '';
            let charCount = 0;
            let pending = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    pending += decoder.decode(value, { stream: !done });
                    const lines = pending.split('\n');
                    pending = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') { done = true; break; }
                        try {
                            const parsed = JSON.parse(dataStr);
                            const content = parsed?.choices?.[0]?.delta?.content;
                            if (content) {
                                charCount += content.length;
                                fullContent += content;
                                setMessages(prev => prev.map(m =>
                                    m.id === tempAiId ? { ...m, content: fullContent } : m
                                ));
                            }
                            if (parsed?.error) {
                                fullContent = typeof parsed.error === 'string'
                                    ? parsed.error
                                    : parsed.text || 'AI đang gặp lỗi khi trả lời. Vui lòng thử lại.';
                                setMessages(prev => prev.map(m =>
                                    m.id === tempAiId ? { ...m, content: fullContent } : m
                                ));
                                done = true;
                                break;
                            }
                        } catch {
                            // skip malformed JSON
                        }
                    }
                }
            }
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Đã xảy ra lỗi kết nối. Vui lòng thử lại!';
            setMessages(prev => prev.map(m =>
                m.id === tempAiId
                    ? { ...m, content: message }
                    : m
            ));
        } finally {
            setLoading(false);
            setIsStreaming(false);
            inputRef.current?.focus();
        }
    };

    const clearChat = () => {
        setMessages([{
            id: 'welcome',
            role: 'ai',
            content: 'Đã xóa cuộc trò chuyện. Hãy đặt câu hỏi mới nhé!',
            timestamp: new Date().toISOString(),
        }]);
    };

    return (
        <div className="flex h-[min(720px,calc(100dvh-140px))] min-h-[420px] flex-col sm:min-h-[500px]">

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-2xl border-b border-gray-100 bg-white px-3 py-3 sm:px-6 sm:py-4">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-200 sm:h-10 sm:w-10">
                        <FiCpu className="text-white" size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 sm:text-base">Trợ lý AI</h3>
                        <p className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-500">
                            {examTitle ? (
                                <>
                                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                                    <span className="truncate">{examTitle}</span>
                                </>
                            ) : (
                                <>
                                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                                    <span className="truncate">Hệ thống AI</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <button onClick={clearChat}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-gray-400 transition-all hover:bg-red-50 hover:text-red-500 sm:px-3 sm:text-sm">
                    <FiTrash2 size={14} />
                    <span className="hidden xs:inline sm:inline">Xóa chat</span>
                </button>
            </div>

            {/* Mobile quick questions */}
            <div className="shrink-0 border-b border-gray-100 bg-white px-3 py-2 md:hidden">
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {QUICK_QUESTIONS.map((q, i) => (
                        <button key={i}
                            onClick={() => sendMessage(q.prompt)}
                            disabled={loading}
                            className="shrink-0 rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 disabled:cursor-not-allowed disabled:opacity-50">
                            <span className="mr-1">{q.emoji}</span>{q.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main content: Messages + Quick Questions Sidebar */}
            <div className="flex flex-1 overflow-hidden">

                {/* Messages Area */}
                <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/50 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-5">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

                            {/* Avatar */}
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${
                                msg.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'
                                    : msg.role === 'system'
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-200'
                            }`}>
                                {msg.role === 'user' ? <FiUser size={15} /> : <FiCpu size={15} />}
                            </div>

                            {/* Bubble */}
                            <div className="max-w-[88%] sm:max-w-[75%]">
                                {/* Sender name */}
                                <p className={`text-xs font-medium mb-1 ${msg.role === 'user' ? 'text-right text-blue-600' : 'text-purple-600'}`}>
                                    {msg.role === 'user' ? 'Bạn' : 'Trợ lý AI'}
                                </p>

                                <div className={`break-words rounded-2xl px-3 py-2.5 text-sm leading-relaxed shadow-sm sm:px-5 sm:py-3.5 ${
                                    msg.role === 'user'
                                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm'
                                        : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                                }`}>
                                    {msg.role === 'ai'
                                        ? (msg.content ? formatMessage(msg.content) : (loading && messages[messages.length - 1]?.id === msg.id ? <ThinkingDots /> : <p className="text-sm text-gray-500">AI chưa có phản hồi. Vui lòng thử lại.</p>))
                                        : msg.content.split('\n').map((line, i) => (
                                            <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                                        ))
                                    }
                                    {/* Typing cursor */}
                                    {msg.role === 'ai' && msg.content && isStreaming && messages[messages.length - 1]?.id === msg.id && (
                                        <span className="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 animate-pulse align-middle" />
                                    )}
                                </div>

                                {/* Copy + Time row for AI messages */}
                                {msg.role === 'ai' && msg.content && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            onClick={() => copyMessage(msg.content, msg.id)}
                                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 transition-colors px-2 py-1 rounded-lg hover:bg-purple-50">
                                            {copiedId === msg.id ? (
                                                <>
                                                    <FiCheck size={12} className="text-green-500" />
                                                    <span className="text-green-600 font-medium">Đã copy</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiCopy size={12} />
                                                    <span>Copy</span>
                                                </>
                                            )}
                                        </button>
                                        <span className="text-gray-300">·</span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}

                                {/* Time for user messages */}
                                {msg.role === 'user' && (
                                    <p className="text-xs text-gray-400 mt-1.5 text-right">
                                        {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Questions Sidebar */}
                <div className="hidden w-64 shrink-0 flex-col overflow-y-auto border-l border-gray-100 bg-white p-4 md:flex">
                    <div className="mb-4">
                        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-1">
                            <FiMessageCircle size={14} className="text-purple-500" />
                            Câu hỏi nhanh
                        </h4>
                        <p className="text-xs text-gray-400">Bấm để hỏi ngay</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        {QUICK_QUESTIONS.map((q, i) => (
                            <button key={i}
                                onClick={() => sendMessage(q.prompt)}
                                disabled={loading}
                                className="group w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="mr-2">{q.emoji}</span>
                                        <span className="font-medium text-gray-700 group-hover:text-purple-700">{q.label}</span>
                                    </div>
                                    <FiChevronRight size={14} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Info box */}
                    <div className="mt-auto pt-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-700 font-medium mb-1">⚠️ Lưu ý</p>
                            <p className="text-xs text-amber-600 leading-relaxed">AI có thể sai. Hãy kiểm chứng thông tin quan trọng.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="shrink-0 rounded-b-2xl border-t border-gray-100 bg-white px-3 py-3 sm:px-6 sm:py-4">
                <div className="flex items-end gap-2 sm:gap-3">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(input);
                            }
                        }}
                        placeholder="Nhập câu hỏi cho AI..."
                        maxLength={3000}
                        rows={2}
                        className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3"
                        style={{ maxHeight: '120px' }}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white transition-all hover:shadow-lg hover:shadow-purple-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12">
                        <FiSend size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
