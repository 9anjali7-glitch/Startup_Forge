import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Drawer } from 'vaul';
import { ChatPanel } from '../home_sections/ChatPanel';
import { User } from '../../App';
import { apiFetch } from '../../apiFetch';

interface MobileChatOverlayProps {
    currentUser: User;
}

export const MobileChatOverlay = ({ currentUser }: MobileChatOverlayProps) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);

    const handleChatSubmit = async (e?: React.FormEvent | string) => {
        if (typeof e !== 'string') e?.preventDefault();
        const userMsg = typeof e === 'string' ? e : chatInput;
        if (!userMsg.trim() || isChatLoading) return;

        setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';
            const res = await apiFetch(`${ragUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg, history: chatMessages.slice(-8) })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || data.error || `Assistant request failed (${res.status})`);
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.response || "I couldn't generate a reply. Please try again." }]);
        } catch (err) {
            console.error("Chat Error:", err);
            const message = err instanceof Error ? err.message : "Could not connect to the AI assistant.";
            setChatMessages(prev => [...prev, { role: 'assistant', content: `${message} Check that the RAG service is running.` }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <>
            {/* --- Floating AI Assistant Button (Left Side) --- */}
            <div className="lg:hidden fixed left-4 bottom-24 z-[90]">
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                >
                    <Sparkles className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Chat Drawer */}
            <Drawer.Root open={isChatOpen} onOpenChange={setIsChatOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[99]" onClick={() => setIsChatOpen(false)} />
                    <Drawer.Content className="bg-white flex flex-col rounded-t-[20px] h-[85vh] fixed bottom-0 left-0 right-0 z-[100] outline-none">
                        <div className="p-4 bg-white rounded-t-[20px] flex-1 flex flex-col h-full overflow-hidden">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 flex-shrink-0" />
                            <ChatPanel
                                currentUser={currentUser}
                                chatInput={chatInput}
                                setChatInput={setChatInput}
                                chatMessages={chatMessages}
                                isChatLoading={isChatLoading}
                                handleChatSubmit={handleChatSubmit}
                            />
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </>
    );
};
