/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import type { BlockKind, BlockSpacing } from '../../../server/cms/blocks';
import { resolveStyle } from '../../../server/cms/blocks';
import { ModuleWidgetBlock } from '../../modules/ModuleHost';
import { BLOCK_CATALOG, isBlockKind, withDefaults } from '../../../server/cms/blockCatalog';
import type { CmsBlock } from '../../../server/cms/types';
import type { BlockProps, BlockRenderers } from '../../../sdk/theme';
import { IS_PREVIEW, notifyEditor } from '../../preview';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { useActiveTheme } from '../../themes/ThemeHost';

class BlockBoundary extends React.Component<{ label: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(`[cms] bloc « ${this.props.label} » :`, error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return IS_PREVIEW ? <div className="mx-auto my-6 max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Le bloc « {this.props.label} » ne peut pas s'afficher : vérifiez ses champs.</div> : null;
  }
}

const SPACING: Record<BlockSpacing, string> = { none: '0', sm: '2rem', md: '3rem', lg: '4.5rem', xl: '6.5rem' };

/** Bloc « Module » : rendu par le module, l'hôte n'applique que les espacements et la visibilité. */
function ModuleBlock({ block }: { block: CmsBlock }) {
  const cfg = useSiteConfig();
  const d = withDefaults('module', block.data);
  const style = resolveStyle(block.style, BLOCK_CATALOG.module.style);
  if (style.hideOnMobile && style.hideOnDesktop && !IS_PREVIEW) return null;
  if (!d.module || !d.widget) {
    return IS_PREVIEW ? <div className="mx-auto my-6 max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Choisissez le contenu du module dans le panneau de droite.</div> : null;
  }
  const active = (cfg?.modules ?? []).some((m) => m.id === d.module && m.widgets?.includes(d.widget));
  if (!active) {
    // Module désactivé : ne pas laisser de section vide (ex. widgets boutique après off e-commerce)
    return IS_PREVIEW ? (
      <div className="mx-auto my-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Widget « {d.widget} » du module <code>{d.module}</code> inactif — masqué sur le site public.
      </div>
    ) : null;
  }
  const cls = [style.hideOnMobile && !IS_PREVIEW ? 'max-md:hidden' : '', style.hideOnDesktop && !IS_PREVIEW ? 'md:hidden' : ''].filter(Boolean).join(' ');
  return (
    <section id={style.anchor || undefined} className={cls || undefined} style={{ paddingTop: SPACING[style.paddingTop], paddingBottom: SPACING[style.paddingBottom] }}>
      <ModuleWidgetBlock moduleId={d.module} widget={d.widget} options={d.options ?? {}} />
    </section>
  );
}

function ColumnsBlock({ block }: { block: CmsBlock }) {
  const d = withDefaults('columns', block.data);
  const style = resolveStyle(block.style, BLOCK_CATALOG.columns.style);
  if (style.hideOnMobile && style.hideOnDesktop && !IS_PREVIEW) return null;
  const n = Math.min(4, Math.max(2, Number(d.columns) || 2));
  const gap = d.gap === 'sm' ? '1.5rem' : d.gap === 'lg' ? '3rem' : '2rem';
  const cells = (d.cells || []).slice(0, n);
  while (cells.length < n) cells.push({ title: '', body: '' });
  const cls = [style.hideOnMobile && !IS_PREVIEW ? 'max-md:hidden' : '', style.hideOnDesktop && !IS_PREVIEW ? 'md:hidden' : ''].filter(Boolean).join(' ');
  return (
    <section
      id={style.anchor || undefined}
      className={cls || undefined}
      style={{ paddingTop: SPACING[style.paddingTop], paddingBottom: SPACING[style.paddingBottom] }}
    >
      <div
        className="mx-auto grid max-w-6xl px-4 sm:px-6"
        style={{ gap, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {cells.map((c, i) => (
          <div key={i} className="min-w-0">
            {c.title ? <h3 className="mb-3 text-lg font-semibold text-[var(--px-text,#0B1528)]">{c.title}</h3> : null}
            {c.body ? <div className="cms-prose text-sm leading-relaxed text-[var(--px-muted,#64748B)]" dangerouslySetInnerHTML={{ __html: c.body }} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Block({ block, renderers }: { block: CmsBlock; renderers: Partial<BlockRenderers> }) {
  if (!isBlockKind(block.type)) return null;
  if (block.type === 'module') {
    return (
      <BlockBoundary label="Module">
        <ModuleBlock block={block} />
      </BlockBoundary>
    );
  }
  if (block.type === 'columns') {
    return (
      <BlockBoundary label="Colonnes">
        <ColumnsBlock block={block} />
      </BlockBoundary>
    );
  }
  const meta = BLOCK_CATALOG[block.type];
  const Comp = renderers[block.type] as React.ComponentType<BlockProps<BlockKind>> | undefined;
  if (!Comp) {
    return IS_PREVIEW ? <div className="mx-auto my-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Le thème actif n'affiche pas les blocs « {meta.label} ».</div> : null;
  }
  let style = resolveStyle(block.style, meta.style);
  if (style.hideOnMobile && style.hideOnDesktop) {
    // Bloc masqué partout : absent du site, mais visible (atténué) dans l'aperçu pour rester sélectionnable.
    if (!IS_PREVIEW) return null;
    style = { ...style, hideOnMobile: false, hideOnDesktop: false };
  }
  return (
    <BlockBoundary label={meta.label}>
      <Comp d={withDefaults(block.type, block.data)} style={style} />
    </BlockBoundary>
  );
}

/** Rendu des blocs par le thème actif ; l'hôte garde la sélection de l'aperçu et l'isolation des erreurs. */
export function BlockRenderer({ blocks, selectedId }: { blocks: CmsBlock[]; selectedId?: string | null }) {
  const { theme, key } = useActiveTheme();
  return (
    <div className="cms-blocks" key={key}>
        {blocks.map((block) =>
          IS_PREVIEW ? (
            <div
              key={block.id}
              id={`px-block-${block.id}`}
              className="px-preview-block"
              data-selected={selectedId === block.id}
              data-hidden={!!(block.style?.hideOnMobile && block.style?.hideOnDesktop)}
              onClickCapture={(e) => {
                e.preventDefault();
                notifyEditor({ type: 'snapify:block-click', id: block.id });
              }}
            >
              <span className="px-preview-label">
                {isBlockKind(block.type) ? BLOCK_CATALOG[block.type].label : block.type}
                {block.style?.hideOnMobile && block.style?.hideOnDesktop ? ' · masqué' : ''}
              </span>
              <Block block={block} renderers={theme.blocks} />
            </div>
          ) : (
            <Block key={block.id} block={block} renderers={theme.blocks} />
          )
        )}
    </div>
  );
}
