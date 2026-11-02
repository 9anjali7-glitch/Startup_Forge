import { useEffect, useState } from 'react';
import { MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { User } from '../App';
import { apiFetch } from '../apiFetch';

type AssistantTurn = { role: 'user' | 'assistant'; content: string; chatReply?: string };

const CHAT_REPLY_MARKER = '[CHAT_REPLY]';

function parseAssistantReply(raw: string) {
  const markerIndex = raw.indexOf(CHAT_REPLY_MARKER);
  if (markerIndex < 0) return { content: raw.trim(), chatReply: '' };
  return {
    content: raw.slice(0, markerIndex).trim() || 'Here’s a message you can review and edit before using:',
    chatReply: raw.slice(markerIndex + CHAT_REPLY_MARKER.length).trim(),
  };
}

const promptOptions = [
  'What should I do after no reply?',
  'Explain my startup clearly to this investor',
  'What’s a good way to ask for a short intro meeting?',
  'Help me think through an investor’s question',
  'I need help discussing a conflict or concern',
  'How can I ask for feedback on my pitch?',
  'Help me plan next steps after an offer',
  'Write a short reply in this chat',
];

interface AiChatComposerProps {
  currentUser: User;
  recipientName: string;
  conversation: { role: 'user' | 'assistant'; content: string }[];
  onClose: () => void;
  onUseInChat: (draft: string) => void;
}

export const AiChatComposer = ({ currentUser, recipientName, conversation, onClose, onUseInChat }: AiChatComposerProps) => {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hostedModel, setHostedModel] = useState<string | null>(null);

  useEffect(() => {
    const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';
    fetch(`${ragUrl}/health`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.assistant_provider === 'openai') setHostedModel('ChatGPT');
        else if (data?.assistant_provider === 'gemini' || data?.gemini_configured) setHostedModel('Gemini');
        else if (data?.mistral_configured) setHostedModel('Mistral');
        else setHostedModel('');
      })
      .catch(() => setHostedModel(null));
  }, []);

  const askAi = async (question: string) => {
    const content = question.trim();
    if (!content || isLoading) return;
    const nextTurns: AssistantTurn[] = [...turns, { role: 'user', content }];
    setTurns(nextTurns);
    setInput('');
    setIsLoading(true);
    try {
      const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';
      const recentChat = conversation.slice(-8).map(message => `${message.role === 'user' ? currentUser.name : recipientName}: ${message.content}`).join('\n');
      const context = `I am ${currentUser.name}, ${currentUser.headline || 'a StartupForge member'}, chatting with ${recipientName}.${recentChat ? ` Recent conversation:\n${recentChat}` : ''}`;
      const response = await apiFetch(`${ragUrl}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          userContext: context,
          history: turns.slice(-8),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || `Assistant request failed (${response.status})`);
      const rawReply = typeof data.response === 'string' ? data.response.trim() : '';
      if (!rawReply) throw new Error('The assistant returned an empty response.');
      const parsed = parseAssistantReply(rawReply);
      setTurns(items => [...items, { role: 'assistant', content: parsed.content, chatReply: parsed.chatReply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The assistant could not respond.';
      setTurns(items => [...items, { role: 'assistant', content: `I couldn’t reach the AI service just now (${message}). Please try again in a moment. Your chat message has not been changed.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:h-[min(780px,90vh)] sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="ai-chat-title">
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><Sparkles className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 id="ai-chat-title" className="font-bold text-slate-900">Talk it through with AI</h2>
              <p className={`truncate text-xs ${hostedModel ? 'text-slate-500' : 'text-amber-700'}`}>
                {hostedModel ? `${hostedModel} AI · nothing is sent unless you send it` : hostedModel === '' ? 'Add a Gemini or ChatGPT API key to enable AI answers' : 'Checking AI connection…'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-900" aria-label="Close AI assistant"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          {turns.length === 0 ? (
            <div className="mx-auto max-w-xl py-2 text-center sm:py-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm"><Sparkles className="h-7 w-7" /></div>
              <h3 className="text-lg font-bold text-slate-900">What would you like help with?</h3>
              <p className="mt-1 text-sm text-slate-500">Ask a question, explain what happened, or choose a starter. I’ll talk it through with you; ask for a reply whenever you want one.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {promptOptions.map(prompt => <button key={prompt} type="button" disabled={isLoading} onClick={() => void askAi(prompt)} className="rounded-full border border-indigo-100 bg-white px-3 py-2 text-left text-xs font-medium text-indigo-800 transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">{prompt}</button>)}
              </div>
            </div>
          ) : turns.map((turn, index) => (
            <div key={`${turn.role}-${index}`} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[82%] ${turn.role === 'user' ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-100 bg-white text-slate-700'}`}>
                <p className="whitespace-pre-wrap">{turn.content}</p>
                {turn.role === 'assistant' && 'chatReply' in turn && turn.chatReply && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={() => onUseInChat(turn.chatReply)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"><MessageSquare className="h-3.5 w-3.5" />Use as chat reply</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm"><span className="mr-2 inline-flex gap-1 align-middle"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:240ms]" /></span>Thinking…</div></div>}
        </div>

        <footer className="border-t border-slate-100 bg-white p-3 sm:p-4">
          <form onSubmit={event => { event.preventDefault(); void askAi(input); }} className="flex items-end gap-2">
            <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void askAi(input); } }} placeholder="Tell me what’s going on…" rows={2} className="max-h-36 min-h-12 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
            <button type="submit" disabled={!input.trim() || isLoading} aria-label="Send to AI" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400"><Send className="h-4 w-4" /></button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-400">This is a private AI conversation. It won’t change or send your message unless you choose a reply.</p>
        </footer>
      </section>
    </div>
  );
};
