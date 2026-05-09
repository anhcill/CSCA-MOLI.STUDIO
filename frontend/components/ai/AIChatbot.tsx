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
    { label: 'Tại sao sai?', prompt: 'Tại sao câu tôi chọn lại sai?', emoji: '❓' },
    { label: 'Giải thích từ vựng', prompt: 'Giải thích từ vựng khó trong bài này', emoji: '📖' },
    { label: 'Mẹo làm bài', prompt: 'Cho tôi mẹo để làm bài tốt hơn', emoji: '💡' },
    { label: 'Học gì tiếp?', prompt: 'Tôi nên học gì tiếp theo để cải thiện?', emoji: '🎯' },
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

export default function AIChatbot({ attemptId, examTitle }: AIChatbotProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'ai',
            content: 'Chào bạn! Tôi là trợ lý AI học tập. Bạn có thể hỏi tôi về bài thi, từ vựng, mẹo làm bài. Hãy đặt câu hỏi nhé!',
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

            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let fullContent = '';
            let charCount = 0;

            setIsStreaming(true);

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    const chunk = decoder.decode(value, { stream: !done });
                    const lines = chunk.split('\n');

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
                                fullContent = parsed.error;
                                done = true;
                                break;
                            }
                        } catch {
                            // skip malformed JSON
                        }
                    }
                }
            }
        } catch {
            setMessages(prev => prev.map(m =>
                m.id === tempAiId
                    ? { ...m, content: 'Đã xảy ra lỗi kết nối. Vui lòng thử lại!' }
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
        <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white rounded-t-2xl shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                        <FiCpu className="text-white" size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-base">Trợ lý AI</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            {examTitle ? (
                                <>
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                                    {examTitle}
                                </>
                            ) : (
                                <>
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full inline-block" />
                                    Hệ thống AI
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <button onClick={clearChat}
                    className="flex items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all text-sm">
                    <FiTrash2 size={14} />
                    <span>Xóa chat</span>
                </button>
            </div>

            {/* Main content: Messages + Quick Questions Sidebar */}
            <div className="flex flex-1 overflow-hidden">

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-gray-50/50">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

                            {/* Avatar */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                msg.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'
                                    : msg.role === 'system'
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-200'
                            }`}>
                                {msg.role === 'user' ? <FiUser size={15} /> : <FiCpu size={15} />}
                            </div>

                            {/* Bubble */}
                            <div className="max-w-[75%]">
                                {/* Sender name */}
                                <p className={`text-xs font-medium mb-1 ${msg.role === 'user' ? 'text-right text-blue-600' : 'text-purple-600'}`}>
                                    {msg.role === 'user' ? 'Bạn' : 'Trợ lý AI'}
                                </p>

                                <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                                    msg.role === 'user'
                                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm'
                                        : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                                }`}>
                                    {msg.role === 'ai'
                                        ? formatMessage(msg.content)
                                        : msg.content.split('\n').map((line, i) => (
                                            <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                                        ))
                                    }
                                    {/* Typing cursor */}
                                    {msg.role === 'ai' && isStreaming && messages[messages.length - 1]?.id === msg.id && (
                                        <span className="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 animate-pulse align-middle" />
                                    )}
                                </div>

                                {/* Copy + Time row for AI messages */}
                                {msg.role === 'ai' && (
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

                    {/* Loading */}
                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-200">
                                <FiCpu size={15} />
                            </div>
                            <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span className="text-sm text-gray-500">AI đang suy nghĩ...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Questions Sidebar */}
                <div className="w-64 border-l border-gray-100 bg-white p-4 flex flex-col shrink-0 overflow-y-auto">
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
            <div className="px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl shrink-0">
                <div className="flex gap-3 items-end">
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
                        rows={2}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                        style={{ maxHeight: '120px' }}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                        className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg hover:shadow-purple-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
                        <FiSend size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
