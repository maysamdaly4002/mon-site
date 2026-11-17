/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button, cx } from './primitives';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEscape(open, onClose);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cx('w-full rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
        {footer ? <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/30 backdrop-blur-[1px]" onMouseDown={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-3">{footer}</div> : null}
      </aside>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ Confirmation */

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => undefined);

  const confirm = useCallback((o: ConfirmOptions) => {
    setState(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current(v);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            {state?.danger ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : null}
            {state?.title}
          </span>
        }
        footer={
          <>
            <Button onClick={() => close(false)}>Annuler</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {state?.confirmLabel || 'Confirmer'}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-slate-600">{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

/* ------------------------------------------------------------------ Menu déroulant */

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Le menu est rendu dans <body> en position fixe : un tableau ou une carte en `overflow-hidden`
 * ne peut plus le couper. Il s'ouvre vers le haut quand la place manque en bas de l'écran.
 */
export function Dropdown({ trigger, children, align = 'right' }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const anchor = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect();
    const m = menu.current;
    if (!a || !m) return;
    const { offsetWidth: w, offsetHeight: h } = m;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - a.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const top = below >= h || a.top - MENU_GAP - VIEWPORT_MARGIN < h ? Math.min(a.bottom + MENU_GAP, vh - h - VIEWPORT_MARGIN) : a.top - MENU_GAP - h;
    const left = align === 'right' ? a.right - w : a.left;
    setPos({ top: Math.max(VIEWPORT_MARGIN, top), left: Math.min(Math.max(VIEWPORT_MARGIN, left), vw - w - VIEWPORT_MARGIN) });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos({ visibility: 'hidden' });
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  return (
    <div className="relative inline-flex" ref={anchor}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open
        ? createPortal(
            <div
              ref={menu}
              role="menu"
              style={pos}
              className="fixed z-[90] min-w-[190px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
              onClick={() => setOpen(false)}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function DropdownItem({ icon: Icon, children, onClick, danger }: { icon?: React.ElementType; children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm', danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100')}
    >
      {Icon ? <Icon className="h-4 w-4 opacity-70" /> : null}
      {children}
    </button>
  );
}
