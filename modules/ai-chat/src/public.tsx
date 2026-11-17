/**
 * Snapify — module Chat IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, RefreshCw, Send, X } from 'lucide-react';
import { definePublicModule, matchesPaths, type ModuleApiError, type PublicModuleProps } from '@snapify/sdk';

interface Settings {
  title: string;
  subtitle: string;
  avatar: string;
  welcome: string;
  quickQuestions: string;
  placeholder: string;
  contactLabel: string;
  contactPath: string;
  position: 'bottom-left' | 'bottom-right';
  showOnPages: string[];
}

interface Message {
  id: number;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function Avatar({ src, className }: { src: string; className: string }) {
  return src ? <img src={src} alt="" aria-hidden="true" className={`rounded-full object-cover ${className}`} /> : <span className={`rounded-full bg-px-primary ${className}`} />;
}

function ChatWidget({ settings, path, isPreview, navigate, api }: PublicModuleProps<Settings>) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, sender: 'ai', text: settings.welcome, time: 'Maintenant' }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  if (isPreview || !matchesPaths(settings.showOnPages, path)) return null;

  const side = settings.position === 'bottom-right' ? 'right-5' : 'left-5';
  const questions = settings.quickQuestions
    .split('\n')
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 6);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    const history = messages.slice(1).slice(-8).map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
    setMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text: question, time: now() }]);
    setInput('');
    setLoading(true);
    let reply: string;
    try {
      reply = (await api.post<{ reply: string }>('/chat', { prompt: question, history })).reply;
    } catch (e) {
      const err = e as ModuleApiError;
      reply = err.status && err.status < 500 ? err.message : 'L’assistant est momentanément indisponible. Contactez-nous directement, nous vous répondrons rapidement.';
    }
    setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply, time: now() }]);
    setLoading(false);
  };

  return (
    <>
      <div className={`fixed bottom-20 lg:bottom-6 ${side} z-40 flex items-center gap-2`}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={`Ouvrir ${settings.title}`}
          className="relative flex h-14 items-center gap-2.5 rounded-full border border-white/10 bg-px-navy pl-1.5 pr-4 text-white shadow-2xl transition-all duration-200 hover:scale-105 hover:bg-slate-900 active:scale-95"
        >
          <span className="relative shrink-0">
            <Avatar src={settings.avatar} className="block h-11 w-11 border-2 border-px-primary/70" />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-px-navy bg-px-primary-light" />
          </span>
          <span className="hidden pr-1 text-left sm:block">
            <span className="block text-xs font-semibold leading-tight text-white">{settings.title}</span>
            <span className="mt-0.5 block text-[10px] font-medium leading-none text-px-primary-light">{settings.subtitle}</span>
          </span>
        </button>
      </div>

      {open ? (
        <div className={`fixed bottom-24 ${side} z-50 flex h-[600px] max-h-[80vh] w-[92vw] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:w-[420px]`}>
          <div className="flex items-center justify-between border-b border-slate-800 bg-px-navy p-4 text-white">
            <div className="flex items-center gap-3">
              <span className="relative shrink-0">
                <Avatar src={settings.avatar} className="block h-10 w-10 border border-white/20" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-px-navy bg-px-primary-light" />
              </span>
              <div>
                <div className="text-sm font-semibold text-white">{settings.title}</div>
                <div className="text-[11px] text-slate-400">{settings.subtitle}</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {questions.length ? (
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap border-b border-slate-200 bg-px-surface px-4 py-2.5">
              {questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex-1 space-y-3.5 overflow-y-auto bg-slate-50/50 p-4" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.sender === 'ai' ? <Avatar src={settings.avatar} className="mt-0.5 h-7 w-7 shrink-0 shadow-2xs" /> : null}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.sender === 'user' ? 'rounded-tr-xs bg-px-navy text-white' : 'rounded-tl-xs border border-slate-200/80 bg-white text-slate-800 shadow-2xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <span className="mt-1 block text-right text-[10px] text-slate-400">{m.time}</span>
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2.5 p-2 text-xs italic text-slate-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-px-primary-dark" />
                <span>L’assistant rédige sa réponse…</span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="space-y-2 border-t border-slate-200 bg-white p-3">
            {settings.contactLabel && settings.contactPath ? (
              <div className="flex justify-end px-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(settings.contactPath);
                  }}
                  className="flex items-center gap-1 font-semibold text-px-primary-dark hover:underline"
                >
                  <span>{settings.contactLabel}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder={settings.placeholder}
                value={input}
                maxLength={2000}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-px-primary focus:outline-hidden"
              />
              <button
                type="submit"
                aria-label="Envoyer"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-px-navy text-white transition-colors hover:bg-px-primary hover:text-px-navy disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default definePublicModule<Settings>({ slots: { floating: ChatWidget } });
