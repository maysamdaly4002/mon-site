/**
 * Snapify — module WhatsApp
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { definePublicModule, matchesPaths, type PublicModuleProps } from '@snapify/sdk';

interface Settings {
  number: string;
  defaultMessage: string;
  title: string;
  greeting: string;
  tooltip: string;
  position: 'bottom-right' | 'bottom-left';
  showOnDesktop: boolean;
  showOnMobile: boolean;
  showOnPages: string[];
}

function WhatsAppWidget({ settings, site, path }: PublicModuleProps<Settings>) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(settings.defaultMessage);

  if (!matchesPaths(settings.showOnPages, path)) return null;
  if (!settings.showOnMobile && !settings.showOnDesktop) return null;
  const phone = (settings.number || site.phoneClean).replace(/\D/g, '');
  if (phone.length < 8) return null;

  const side = settings.position === 'bottom-left' ? 'left-5' : 'right-5';
  const visibility = !settings.showOnMobile ? 'hidden lg:flex' : !settings.showOnDesktop ? 'flex lg:hidden' : 'flex';

  const send = () => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <>
      <div className={`fixed bottom-20 lg:bottom-6 ${side} z-40 ${visibility} items-center gap-2`}>
        {settings.tooltip ? (
          <div className="pointer-events-none hidden rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-px-navy shadow-lg xl:block">
            {settings.tooltip}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={`Contacter ${site.name} sur WhatsApp`}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-all duration-200 hover:scale-105 hover:bg-[#20bd5a] active:scale-95"
        >
          <span className="pointer-events-none absolute -inset-1 animate-ping rounded-full bg-[#25D366] opacity-30" />
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className={`fixed bottom-24 ${side} z-50 w-[90vw] max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl`}>
          <div className="flex items-center justify-between border-b border-slate-800 bg-px-navy p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{settings.title}</div>
                {site.slaHours ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-px-primary-light">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-px-primary-light" />
                    <span>{site.slaHours}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-1 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3 bg-px-surface p-4">
            {settings.greeting ? (
              <div className="rounded-2xl rounded-tl-xs border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 shadow-xs">{settings.greeting}</div>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="snapify-wa-message" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Votre message
              </label>
              <textarea
                id="snapify-wa-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 focus:border-[#25D366] focus:outline-hidden"
              />
            </div>
            <button
              type="button"
              onClick={send}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a]"
            >
              <span>Ouvrir dans WhatsApp</span>
              <Send className="h-3.5 w-3.5" />
            </button>
            {site.phone ? (
              <div className="text-center text-[10px] text-slate-400">
                Ligne directe : <span className="font-mono text-slate-600">{site.phone}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default definePublicModule<Settings>({ slots: { floating: WhatsAppWidget } });
