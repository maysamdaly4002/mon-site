/**
 * Snapify — thème Preveris
 * © 2026 Hamdi Ayari — hamdi.ayari@novalabs.tn
 */
import React, { useEffect } from 'react';
import { useOptions } from './site';

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap';

export function Layout({ children }: { children: React.ReactNode }) {
  const o = useOptions();

  useEffect(() => {
    if (document.getElementById('pv-fonts')) return;
    const link = document.createElement('link');
    link.id = 'pv-fonts';
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('pv-html');
    Object.assign(root.dataset, {
      pvPalette: o.palette || 'brand',
      pvAccent: o.accent || 'brand',
      pvType: o.typography || 'modern',
      pvCorners: o.corners || 'round',
      pvMotion: o.animations !== false ? 'on' : 'off',
      pvGlass: o.glass !== false ? 'on' : 'off',
    });
    return () => {
      root.classList.remove('pv-html');
      for (const k of ['pvPalette', 'pvAccent', 'pvType', 'pvCorners', 'pvMotion', 'pvGlass']) delete root.dataset[k];
    };
  }, [o.palette, o.accent, o.typography, o.corners, o.animations, o.glass]);

  return <div className="pv-root">{children}</div>;
}
