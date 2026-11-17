/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect } from 'react';
import { useOptions } from './site';

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap';

/** Applique les options du thème (attributs data-dg-* lus par la feuille de style) et charge les polices. */
export function Layout({ children }: { children: React.ReactNode }) {
  const o = useOptions();

  useEffect(() => {
    if (document.getElementById('dg-fonts')) return;
    const link = document.createElement('link');
    link.id = 'dg-fonts';
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dg-html');
    Object.assign(root.dataset, {
      dgPalette: o.palette,
      dgAccent: o.accent,
      dgType: o.typography,
      dgCorners: o.corners,
      dgMotion: o.animations ? 'on' : 'off',
    });
    return () => {
      root.classList.remove('dg-html');
      for (const k of ['dgPalette', 'dgAccent', 'dgType', 'dgCorners', 'dgMotion']) delete root.dataset[k];
    };
  }, [o.palette, o.accent, o.typography, o.corners, o.animations]);

  return <div className="dg-root">{children}</div>;
}
