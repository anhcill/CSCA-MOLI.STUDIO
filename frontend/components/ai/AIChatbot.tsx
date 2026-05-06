'use client';

import { useState, useRef, useEffect } from 'react';
import { FiSend, FiUser, FiCpu, FiZap, FiTrash2, FiCopy, FiCheck } from 'react-icons/fi';
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
    { label: 'Tại sao sai?', prompt: 'Tại sao câu tôi chọn lại sai?' },
    { label: 'Giải thích từ', prompt: 'Giải thích từ vựng khó trong bài này' },
    { label: 'Mẹo làm bài', prompt: 'Cho tôi mẹo để làm bài tốt hơn' },
    { label: 'Học gì tiếp?', prompt: 'Tôi nên học gì tiếp theo để cải thiện?' },
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
                <p key={i} className="mt-2 font-medium text-purple-800">
                    {line.replace(/^\d+[.)]\s*/, '')}
                </p>
            );
            i++;
            continue;
        }

        // Math formula lines (contain math symbols)
        if (line.match(/[=<>≤≥√∑∏π]/) && !line.match(/^[A-ZÀÁ]/)) {
            blocks.push(
                <p key={i} className="mt-1 font-mono text-sm bg-purple-50 px-2 py-1 rounded text-purple-900">
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
                <p key={i} className="mt-1">{clean}</p>
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

        try {
            const res = await authFetch('/api/ai/ask', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({
                    question: text.trim(),
                    attemptId: attemptId,
                }),
            });
            const data = await res.json();

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: data.success
                    ? data.answer
                    : data.message || 'Xin lỗi, tôi không thể trả lời lúc này. Vui lòng thử lại sau!',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch {
            const errMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: 'Đã xảy ra lỗi kết nối. Vui lòng thử lại!',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setLoading(false);
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg flex flex-col h-[70vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow-md">
                        <FiCpu className="text-white" size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm">Trợ lý AI</h3>
                        <p className="text-xs text-gray-500">
                            {examTitle ? `Phân tích: ${examTitle}` : 'DeepSeek R1'}
                        </p>
                    </div>
                </div>
                <button onClick={clearChat}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa cuộc trò chuyện">
                    <FiTrash2 size={16} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : msg.role === 'system'
                                ? 'bg-gray-200 text-gray-600'
                                : 'bg-purple-600 text-white'
                        }`}>
                            {msg.role === 'user' ? <FiUser size={14} /> : <FiCpu size={14} />}
                        </div>

                        {/* Bubble */}
                        <div className="max-w-[80%]">
                            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-sm'
                                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                            }`}>
                                {msg.role === 'ai'
                                    ? formatMessage(msg.content)
                                    : msg.content.split('\n').map((line, i) => (
                                        <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                                    ))
                                }
                            </div>

                            {/* Copy button for AI messages */}
                            {msg.role === 'ai' && (
                                <div className="flex items-center gap-1 mt-1">
                                    <button
                                        onClick={() => copyMessage(msg.content, msg.id)}
                                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 transition-colors px-1">
                                        {copiedId === msg.id ? (
                                            <>
                                                <FiCheck size={12} className="text-green-500" />
                                                <span className="text-green-500">Đã copy</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiCopy size={12} />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>
                                    <span className="text-xs text-gray-300">·</span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            )}

                            {/* Time for user messages */}
                            {msg.role === 'user' && (
                                <p className="text-xs text-gray-400 mt-1 text-right">
                                    {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                    </div>
                ))}

                {/* Loading */}
                {loading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                            <FiCpu size={14} />
                        </div>
                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs text-gray-500">AI đang suy nghĩ...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Questions */}
            <div className="px-5 pb-2">
                <div className="flex flex-wrap gap-2">
                    {QUICK_QUESTIONS.map((q, i) => (
                        <button key={i}
                            onClick={() => sendMessage(q.prompt)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors flex items-center gap-1">
                            <FiZap size={10} /> {q.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input */}
            <div className="px-5 pb-4 pt-2 border-t border-gray-100">
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
                        placeholder="Nhập câu hỏi..."
                        rows={1}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        style={{ maxHeight: '120px' }}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                        className="w-11 h-11 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md">
                        <FiSend size={16} />
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                    AI có thể sai · Kiểm chứng thông tin quan trọng
                </p>
            </div>
        </div>
    );
}
