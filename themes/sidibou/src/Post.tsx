/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import type { BlogPost } from '@snapify/sdk/content';
import { useSiteInfo } from './site';

export function Post({ post, children }: { post: BlogPost; children: React.ReactNode }) {
  const info = useSiteInfo();
  return (
    <article className="py-10">
      <header className="max-w-3xl mx-auto px-4 mb-8">
        <p className="text-xs uppercase tracking-wider text-slate-500">Blog {info.name}</p>
        <h1 className="mt-2 text-3xl font-bold text-px-navy">{post.title}</h1>
        {post.excerpt ? <p className="mt-3 text-lg text-slate-600">{post.excerpt}</p> : null}
      </header>
      {post.coverImage ? (
        <img src={post.coverImage} alt="" className="mx-auto mb-10 max-h-96 w-full max-w-5xl rounded-2xl object-cover px-4" />
      ) : null}
      {children}
    </article>
  );
}
