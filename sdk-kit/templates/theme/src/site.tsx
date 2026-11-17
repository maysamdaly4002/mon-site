import type { MouseEvent, ReactNode } from 'react';
import { isPreviewMode, useSnapify } from '@snapify/sdk/theme';
import { applyTokens, type ButtonData, type MenuItemDto } from '@snapify/sdk/content';

/** Options du thème (snapify.theme.json → settings), réglées dans Apparence › Personnaliser. */
export interface ThemeOptions {
  headerStyle: 'light' | 'dark';
  stickyHeader: boolean;
  footerText: string;
}

export const useOptions = () => useSnapify<ThemeOptions>().settings;

/** Remplace {{nom}}, {{telephone}}… par les coordonnées du site. */
export function useText() {
  const { tokens } = useSnapify();
  return (text: string | undefined) => applyTokens(text, tokens);
}

export function useMenu(id: 'primary' | 'footer'): MenuItemDto[] {
  const { site } = useSnapify();
  return site.menus.find((m) => m.id === id)?.items ?? [];
}

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const isInternal = (href: string) => href.startsWith('/') && !href.startsWith('//');

/** Lien du site : navigation sans rechargement pour les adresses internes, nouvel onglet sinon. */
export function SiteLink({ href, newTab, className, children }: { href: string; newTab?: boolean; className?: string; children: ReactNode }) {
  const { navigate } = useSnapify();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (newTab || !isInternal(href) || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navigate(href);
    window.scrollTo({ top: 0 });
  };
  const external = newTab || /^https?:\/\//.test(href);
  if (external && isPreviewMode()) return <span className={className}>{children}</span>;
  return (
    <a href={href} onClick={onClick} className={className} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

export function Buttons({ buttons, className }: { buttons: ButtonData[]; className?: string }) {
  const t = useText();
  if (!buttons.length) return null;
  return (
    <div className={cx('flex flex-wrap gap-3', className)}>
      {buttons.map((b) => (
        <SiteLink key={b.id} href={b.link} newTab={b.newTab} className={cx('st-btn', b.variant === 'primary' ? 'st-btn-primary' : 'st-btn-outline')}>
          {t(b.label)}
        </SiteLink>
      ))}
    </div>
  );
}
