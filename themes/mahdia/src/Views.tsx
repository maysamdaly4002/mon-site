/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import type { BlogPost } from '@snapify/sdk/content';
import { useSnapify } from '@snapify/sdk/theme';
import { followLink, shopActive, useMenus } from './site';
import { Frame } from './kit';

export function Post({ post, children }: { post: BlogPost; children: React.ReactNode }) {
  const { info } = useSnapify();
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <article>
      <header className="mx-auto max-w-4xl px-5 pb-10 pt-14 text-center sm:px-8 sm:pt-20">
        <span className="inline-flex rounded-full bg-(--mh-paper-2) px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-(--mh-accent-text)">Le journal · {info.name}</span>
        <h1 className="mh-display mt-6 text-4xl sm:text-5xl lg:text-6xl">{post.title}</h1>
        {post.excerpt ? <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-(--mh-fg-2)">{post.excerpt}</p> : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-(--mh-fg-2)">
          {date ? <span>{date}</span> : null}
          {post.author ? <span>· {post.author}</span> : null}
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-(--mh-rule) px-2.5 py-1">
              {tag}
            </span>
          ))}
        </div>
      </header>
      {post.coverImage ? (
        <div className="mx-auto mb-6 max-w-6xl px-5 sm:px-8">
          <Frame shaped className="aspect-[21/9]">
            <img src={post.coverImage} alt="" className="h-full w-full object-cover" />
          </Frame>
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function NotFound({ navigate }: { navigate: (path: string) => void }) {
  const { cta } = useMenus();
  const shop = shopActive();
  return (
    <section className="relative overflow-hidden">
      <div className="mh-decor mh-waves -bottom-[30rem] left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 opacity-60" />
      <div className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
        <div className="mh-shape flex h-40 w-56 items-center justify-center bg-(--mh-ink) text-(--mh-on-dark)">
          <span className="mh-display text-7xl">404</span>
        </div>
        <h1 className="mh-display mt-10 text-4xl sm:text-5xl">
          Cette page a pris le <span className="mh-em">large</span>.
        </h1>
        <p className="mt-5 max-w-md text-lg text-(--mh-fg-2)">L’adresse demandée n’existe pas ou a été déplacée. {shop ? 'Retrouvez tous nos produits dans la boutique.' : 'Reprenons depuis l’accueil.'}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => followLink('/', navigate)} className="mh-btn mh-btn-outline">
            <ArrowLeft className="h-4 w-4" />
            Retour à l’accueil
          </button>
          {shop ? (
            <button type="button" onClick={() => followLink('/boutique/', navigate)} className="mh-btn mh-btn-primary">
              <Search className="h-4 w-4" />
              Voir la boutique
            </button>
          ) : (
            <button type="button" onClick={() => followLink(cta.path, navigate)} className="mh-btn mh-btn-primary">
              {cta.label}
              <ArrowRight className="mh-btn-arrow h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
