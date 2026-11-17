/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useOptions } from './site';

const BUTTON_RADIUS = { pill: '9999px', rounded: '0.75rem', square: '0.25rem' } as const;

/** Applique les options du thème à tout le site. */
export function Layout({ children }: { children: React.ReactNode }) {
  const options = useOptions();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sb-btn-radius', BUTTON_RADIUS[options.buttonShape] ?? BUTTON_RADIUS.pill);
    root.style.setProperty('--sb-card-radius', `${Math.min(Math.max(Number(options.cardRadius) || 0, 0), 32)}px`);
    root.classList.toggle('sb-no-motion', !options.animations);
    return () => {
      root.style.removeProperty('--sb-btn-radius');
      root.style.removeProperty('--sb-card-radius');
      root.classList.remove('sb-no-motion');
    };
  }, [options.buttonShape, options.cardRadius, options.animations]);

  useEffect(() => {
    if (!options.backToTop) return;
    const onScroll = () => setShowTop(window.scrollY > 900);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [options.backToTop]);

  return (
    <>
      {children}
      {options.backToTop && showTop ? (
        <button
          type="button"
          aria-label="Revenir en haut de la page"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 left-1/2 z-40 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-px-border bg-white/95 text-px-navy shadow-lg backdrop-blur transition hover:bg-px-navy hover:text-white lg:bottom-6"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      ) : null}
    </>
  );
}
