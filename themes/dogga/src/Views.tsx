/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { BlogPost } from '@snapify/sdk/content';
import { useSnapify } from '@snapify/sdk/theme';
import { followLink, useMenus } from './site';
import { Eyebrow, Frame } from './kit';

export function Post({ post, children }: { post: BlogPost; children: React.ReactNode }) {
  const { info } = useSnapify();
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <article>
      <header className="mx-auto max-w-4xl px-5 pb-12 pt-16 text-center sm:px-8 sm:pt-24">
        <Eyebrow className="justify-center">Journal · {info.name}</Eyebrow>
        <h1 className="dg-display mt-6 text-5xl sm:text-6xl lg:text-7xl">{post.title}</h1>
        {post.excerpt ? <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-(--dg-fg-2)">{post.excerpt}</p> : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs uppercase tracking-[0.16em] text-(--dg-fg-2)">
          {date ? <span>{date}</span> : null}
          {post.author ? <span>· {post.author}</span> : null}
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-(--dg-rule) px-2.5 py-1 normal-case tracking-normal">
              {tag}
            </span>
          ))}
        </div>
      </header>
      {post.coverImage ? (
        <div className="mx-auto mb-6 max-w-6xl px-5 sm:px-8">
          <Frame className="aspect-[21/9]">
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
  return (
    <section className="relative overflow-hidden">
      <div className="dg-decor dg-rings -bottom-[34rem] left-1/2 h-[64rem] w-[64rem] -translate-x-1/2 opacity-70" />
      <div className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
        <div className="dg-arch flex h-56 w-44 items-center justify-center bg-(--dg-ink) text-[#f5f0e8]">
          <span className="dg-display text-7xl">404</span>
        </div>
        <h1 className="dg-display mt-10 text-5xl sm:text-6xl">
          Cette page s’est <em className="dg-em">égarée</em>.
        </h1>
        <p className="mt-5 max-w-md text-lg text-(--dg-fg-2)">L’adresse demandée n’existe pas ou a été déplacée. Reprenons depuis l’entrée principale.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => followLink('/', navigate)} className="dg-btn dg-btn-outline">
            <ArrowLeft className="h-4 w-4" />
            Retour à l’accueil
          </button>
          <button type="button" onClick={() => followLink(cta.path, navigate)} className="dg-btn dg-btn-primary">
            {cta.label}
            <ArrowRight className="dg-btn-arrow h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
