/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';

interface SnapifyMarkProps {
  className?: string;
  /** Couleur de l’étincelle et des pastilles de la fenêtre. */
  accent?: string;
  /** Couleur du cadre de la fenêtre. */
  frame?: string;
}

/** Pictogramme seul : une fenêtre de navigateur dans laquelle une étincelle génère le site. */
export const SnapifyMark: React.FC<SnapifyMarkProps> = ({
  className = 'w-6 h-6',
  accent = 'var(--px-primary)',
  frame = '#FFFFFF',
}) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <rect x="7" y="9" width="26" height="22" rx="4" fill="none" stroke={frame} strokeWidth="2.4" />
    <path d="M7 15.5 H33" stroke={frame} strokeWidth="2.4" />
    <circle cx="11" cy="12.3" r="1.1" fill={accent} />
    <circle cx="14.4" cy="12.3" r="1.1" fill={accent} />
    <path d="M20 18.2 L21.6 22 L25.4 23.6 L21.6 25.2 L20 29 L18.4 25.2 L14.6 23.6 L18.4 22 Z" fill={accent} />
  </svg>
);

interface SnapifyLogoProps {
  className?: string;
}

/** Pictogramme dans son badge carré sombre, utilisé en en-tête et pied de page du site public. */
export const SnapifyLogo: React.FC<SnapifyLogoProps> = ({ className = 'w-10 h-10' }) => (
  <div
    className={`flex items-center justify-center rounded-xl bg-px-navy border border-slate-700/60 shadow-sm ${className}`}
    title="Snapify — Générateur de sites web"
  >
    <SnapifyMark className="w-[70%] h-[70%]" />
  </div>
);
