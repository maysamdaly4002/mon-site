/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { BLOCK_CATALOG, BLOCK_CATEGORIES, BLOCK_KINDS } from '../../../server/cms/blockCatalog';
import type { BlockKind } from '../../../server/cms/blocks';
import type { BlockPattern, CmsBlock } from '../../../server/cms/types';
import { api } from '../lib/api';
import { Modal } from '../ui/overlays';
import { Button, cx, Input } from '../ui/primitives';
import { BLOCK_ICONS } from './blockSchemas';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cloneIds = (blocks: CmsBlock[]): CmsBlock[] =>
  blocks.map((b) => ({ ...structuredClone(b), id: `b-${crypto.randomUUID().slice(0, 8)}` }));

export function BlockLibrary({
  open,
  onClose,
  onPick,
  onPickBlocks,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: BlockKind) => void;
  /** Insertion d’un modèle (plusieurs blocs). */
  onPickBlocks?: (blocks: CmsBlock[]) => void;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [patterns, setPatterns] = useState<BlockPattern[]>([]);

  useEffect(() => {
    if (!open) return;
    void api.blockPatterns().then(setPatterns).catch(() => setPatterns([]));
  }, [open]);

  const kinds = useMemo(
    () =>
      BLOCK_KINDS.filter((k) => {
        const m = BLOCK_CATALOG[k];
        if (cat !== 'all' && cat !== 'patterns' && m.category !== cat) return false;
        if (cat === 'patterns') return false;
        return !q || norm(`${m.label} ${m.description}`).includes(norm(q));
      }),
    [q, cat]
  );

  const filteredPatterns = useMemo(
    () => patterns.filter((p) => !q || norm(`${p.name} ${p.description || ''}`).includes(norm(q))),
    [patterns, q]
  );

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Ajouter un bloc" description="Choisissez une section ou un modèle enregistré.">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un bloc…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {[{ id: 'all', label: 'Tous' }, ...BLOCK_CATEGORIES, { id: 'patterns', label: 'Modèles' }].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={cx('rounded-full px-3 py-1 text-[13px] font-medium transition', cat === c.id ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1 scrollbar-thin">
        {cat === 'patterns' || cat === 'all' ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Modèles enregistrés</p>
            {filteredPatterns.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPatterns.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onPickBlocks?.(cloneIds(p.blocks));
                      onClose();
                      setQ('');
                    }}
                    className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                      <Bookmark className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{p.name}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">
                        {p.description || `${p.blocks.length} bloc${p.blocks.length > 1 ? 's' : ''}`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Aucun modèle. Enregistrez la structure d’une page depuis l’inspecteur (bouton « Enregistrer comme modèle »).
              </p>
            )}
          </div>
        ) : null}

        {cat !== 'patterns'
          ? BLOCK_CATEGORIES.map((c) => {
              const list = kinds.filter((k) => BLOCK_CATALOG[k].category === c.id);
              if (!list.length) return null;
              return (
                <div key={c.id}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((k) => {
                      const m = BLOCK_CATALOG[k];
                      const Icon = BLOCK_ICONS[m.icon] || Search;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            onPick(k);
                            onClose();
                            setQ('');
                          }}
                          className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-sky-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:from-brand-500 group-hover:to-brand-600 group-hover:text-white">
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                            <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{m.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          : null}
        {!kinds.length && cat !== 'patterns' && !filteredPatterns.length ? (
          <p className="py-10 text-center text-sm text-slate-500">Aucun bloc ne correspond à « {q} ».</p>
        ) : null}
      </div>
      {cat === 'patterns' && patterns.length ? (
        <div className="mt-3 border-t border-slate-100 pt-3 text-right">
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!window.confirm('Supprimer tous les modèles ?')) return;
              await api.saveBlockPatterns([]);
              setPatterns([]);
            }}
          >
            Vider les modèles
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
