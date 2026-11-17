/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect } from 'react';
import { useOptions } from './site';

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap';
const DATA_KEYS = ['mhPalette', 'mhAccent', 'mhType', 'mhCorners', 'mhMotion'] as const;

/** Applique les options du thème (attributs data-mh-* lus par la feuille de style) et charge les polices. */
export function Layout({ children }: { children: React.ReactNode }) {
  const o = useOptions();

  useEffect(() => {
    if (document.getElementById('mh-fonts')) return;
    const link = document.createElement('link');
    link.id = 'mh-fonts';
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mh-html');
    Object.assign(root.dataset, {
      mhPalette: o.palette,
      mhAccent: o.accent,
      mhType: o.typography,
      mhCorners: o.corners,
      mhMotion: o.animations ? 'on' : 'off',
    });
    return () => {
      root.classList.remove('mh-html');
      for (const k of DATA_KEYS) delete root.dataset[k];
    };
  }, [o.palette, o.accent, o.typography, o.corners, o.animations]);

  return <div className="mh-root">{children}</div>;
}
