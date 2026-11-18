import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, Search, type LucideIcon } from 'lucide-react';

/* ---------- Pastille de statut (point + libellé) ---------- */

export type Tone = 'green' | 'amber' | 'blue' | 'slate' | 'red';

const TONES: Record<Tone, { pill: string; dot: string }> = {
  green: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  amber: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  blue: { pill: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  slate: { pill: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  red: { pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${t.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

/* ---------- Onglets de filtre avec compteur ---------- */

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ' +
              (active
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-800')
            }
          >
            {t.label} ({t.count})
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Champ de recherche ---------- */

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </div>
  );
}

/* ---------- Carte autour du tableau ---------- */

export function TableCard({ toolbar, children }: { toolbar: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">{toolbar}</div>
      <div className="overflow-x-auto border-t border-slate-100">{children}</div>
    </div>
  );
}

/* ---------- Menu « ⋯ » en fin de ligne ---------- */

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
};

export function RowMenu({ items }: { items: MenuItem[] }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const visible = items.filter((i) => !i.hidden);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-row-menu]')) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  if (!visible.length) return null;

  const toggle = () => {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const right = window.innerWidth - r.right;
    const flip = r.bottom + visible.length * 40 + 16 > window.innerHeight;
    setPos(flip ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        data-row-menu
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={toggle}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {pos ? (
        <div
          data-row-menu
          role="menu"
          style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, right: pos.right }}
          className="z-50 min-w-[11rem] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {visible.map(({ label, icon: Icon, onClick, danger }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setPos(null);
                onClick();
              }}
              className={
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ' +
                (danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50')
              }
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
