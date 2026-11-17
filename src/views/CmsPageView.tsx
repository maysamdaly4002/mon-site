/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect } from 'react';
import type { CmsPage } from '../../server/cms/types';
import { BlockRenderer } from '../components/cms/BlockRenderer';
import { useActiveTheme } from '../themes/ThemeHost';

export function CmsPageView({
  page,
  selectedBlockId,
  scrollToBlockId,
  scrollNonce,
}: {
  page: CmsPage;
  selectedBlockId?: string | null;
  scrollToBlockId?: string | null;
  scrollNonce?: number;
}) {
  useEffect(() => {
    if (!scrollToBlockId) return;
    const el = document.getElementById(`px-block-${scrollToBlockId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }, [scrollToBlockId, scrollNonce]);

  const { theme } = useActiveTheme();
  const blocks = <BlockRenderer blocks={page.blocks} selectedId={selectedBlockId} />;
  return theme.Page ? <theme.Page page={page}>{blocks}</theme.Page> : blocks;
}
