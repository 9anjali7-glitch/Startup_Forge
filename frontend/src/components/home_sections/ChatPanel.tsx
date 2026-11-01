import React, { useEffect, useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { User } from '../../App';
import { apiFetch } from '../../apiFetch';

const suggestedQuestions = [
    'I’m new here. How do I navigate StartupForge?',
    'How do I find investors for my startup?',
    'What is the difference between a direct and indirect conflict?',
    'Explain SAFE, dilution, and runway in simple terms.'
];

interface ChatPanelProps {
    currentUser: User;
    chatInput: string;
    setChatInput: (val: string) => void;
    chatMessages: { role: 'user' | 'assistant', content: string }[];
    isChatLoading: boolean;
    handleChatSubmit: (e?: React.FormEvent | string) => void;
}

export const ChatPanel = ({
    currentUser,
    chatInput,
    setChatInput,
    chatMessages,
    isChatLoading,
    handleChatSubmit
}: ChatPanelProps) => {
    const [aiProvider, setAiProvider] = useState<'checking' | 'gemini' | 'ollama' | 'mistral' | 'profile_search' | 'offline'>('checking');

    useEffect(() => {
        let active = true;
        const checkProvider = async () => {
            try {
                const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';
                const response = await apiFetch(`${ragUrl}/health`, { signal: AbortSignal.timeout(4000) });
                if (!response.ok) throw new Error(`Health check failed (${response.status})`);
                const health = await response.json();
                if (active) setAiProvider(health.ai_provider || 'profile_search');
            } catch {
                if (active) setAiProvider('offline');
            }
        };
        checkProvider();
        const timer = window.setInterval(checkProvider, 15000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

    const providerLabel = {
        checking: 'CHECKING',
        ollama: 'LOCAL AI ONLINE',
        mistral: 'AI ONLINE',
        profile_search: 'GUIDE + SEARCH',
        gemini: 'GEMINI FREE',
        offline: 'SERVICE OFFLINE'
    }[aiProvider];

    return (
        <div style={{ flex: 22 }} className="flex flex-col bg-white rounded-2xl shadow-soft border border-slate-300 overflow-hidden flex-shrink-0 min-w-0 h-full">
            <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-800">
                    <Sparkles className="w-4 h-4 fill-slate-800 text-slate-800" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">
                    <b>AI Assistant</b> |
                    <span className={`text-[10px] font-medium ml-2 px-2 py-0.5 rounded-full ${aiProvider === 'gemini' || aiProvider === 'ollama' || aiProvider === 'mistral' ? 'text-emerald-700 bg-emerald-50' : aiProvider === 'offline' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50'}`}><b>{providerLabel}</b></span>
                </h3>
            </div>

            <div className="flex-1 bg-gray-50/30 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
                        <div className="w-16 h-16 bg-white border border-dashed border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                            <Sparkles className="w-8 h-8 text-indigo-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-600">{aiProvider === 'gemini' || aiProvider === 'ollama' || aiProvider === 'mistral' ? 'AI assistant ready' : aiProvider === 'offline' ? 'Assistant service is offline' : 'Profile search is available'}</p>
                        <p className="text-xs mt-1 text-slate-400 max-w-[260px]">Ask how to use StartupForge, explore founder and investor profiles, understand conflict checks, or get plain-language explanations of fundraising terms. General education only; verify deal-specific questions with a qualified adviser.</p>
                        <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-[420px]">
                            {suggestedQuestions.map((prompt) => (
                                <button key={prompt} type="button" onClick={() => handleChatSubmit(prompt)} disabled={isChatLoading}
                                    className="text-[11px] text-indigo-700 bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 rounded-full px-3 py-2 transition-colors disabled:opacity-50">
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>

                            {/* Assistant Avatar */}
                            {msg.role === 'assistant' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                    <Sparkles className="w-4 h-4 text-indigo-600" />
                                </div>
                            )}

                            {/* Message Bubble */}
                            <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-slate-900 text-white rounded-br-sm'
                                : 'bg-white border border-slate-100 text-slate-700 rounded-bl-sm icon-message'
                                }`}>
                                {msg.role === 'user' ? (
                                    msg.content
                                ) : (
                                    <ReactMarkdown
                                        components={{
                                            strong: ({ node, ...props }) => <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                                            li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                )}
                            </div>

                            {/* User Avatar */}
                            {msg.role === 'user' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden">
                                    <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
                                </div>
                            )}
                        </div>
                    ))
                )}

                {/* Loading Indicator */}
                {isChatLoading && (
                    <div className="flex items-end gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                            <div className="flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                            </div>
                        </div>
                    </div>
                )}

                {chatMessages.length > 0 && !isChatLoading && (
                    <div className="ml-11 mt-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Try another question</p>
                        <div className="flex flex-wrap gap-2">
                            {suggestedQuestions.map((prompt) => (
                                <button key={prompt} type="button" onClick={() => handleChatSubmit(prompt)}
                                    className="text-[11px] text-indigo-700 bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 rounded-full px-3 py-2 transition-colors">
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-slate-100 bg-white/50 backdrop-blur-sm flex-shrink-0">
                <form onSubmit={handleChatSubmit} className="relative flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder={aiProvider === 'gemini' || aiProvider === 'ollama' || aiProvider === 'mistral' ? 'Ask the AI assistant...' : 'Ask a question or search founders and investors...'}
                            className="w-full pl-14 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all font-medium text-slate-800 placeholder:text-slate-400 shadow-sm group-hover:bg-white group-hover:shadow-md"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isChatLoading || !chatInput.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-full hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center w-8 h-8 hover:scale-105 active:scale-95"
                        >
                            <Send className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
