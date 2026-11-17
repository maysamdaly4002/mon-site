/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import type { BlogPost, CmsPage } from '../server/cms/types';
import type { SiteConfigPayload } from '../sdk/content';
import type { PublicThemeDescriptor } from '../server/modules/types';

/**
 * Mode aperçu : le site est chargé dans une iframe du backoffice (`?cms-preview=1`).
 * Le backoffice envoie la page et/ou la configuration en cours d'édition par postMessage ;
 * rien n'est enregistré, et seuls les messages de la même origine sont acceptés.
 */
export const IS_PREVIEW =
  typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(window.location.search).has('cms-preview');

export interface PreviewMessage {
  type: 'snapify:preview';
  page?: CmsPage | null;
  /** Article en cours d’édition (aperçu /blog/:slug/). */
  post?: BlogPost | null;
  site?: Partial<SiteConfigPayload>;
  /** Thème à prévisualiser (installé, pas forcément actif) et options en cours de réglage. */
  theme?: { descriptor: PublicThemeDescriptor; settings?: Record<string, unknown> } | null;
  selectedBlockId?: string | null;
  scrollToBlockId?: string | null;
  /** Incrémenté à chaque demande de défilement, même vers le même bloc. */
  scrollNonce?: number;
}

type Listener = (msg: PreviewMessage) => void;
const listeners = new Set<Listener>();
let last: PreviewMessage | null = null;

if (IS_PREVIEW) {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const msg = e.data as PreviewMessage;
    if (msg?.type !== 'snapify:preview') return;
    last = { ...last, ...msg };
    listeners.forEach((l) => l(last!));
  });
  window.parent.postMessage({ type: 'snapify:preview-ready' }, window.location.origin);
}

export function usePreviewState(): PreviewMessage | null {
  const [state, setState] = useState<PreviewMessage | null>(last);
  useEffect(() => {
    if (!IS_PREVIEW) return;
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

export function notifyEditor(message: { type: 'snapify:block-click'; id: string } | { type: 'snapify:height'; height: number }) {
  if (IS_PREVIEW) window.parent.postMessage(message, window.location.origin);
}
