/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useState } from 'react';
import type { BlogPost } from '../../server/cms/types';
import { BlockRenderer } from '../components/cms/BlockRenderer';
import { useActiveTheme } from '../themes/ThemeHost';

export function BlogPostView({
  slug,
  onNavigate,
  previewPost,
  selectedBlockId,
}: {
  slug: string;
  onNavigate: (path: string) => void;
  previewPost?: BlogPost | null;
  selectedBlockId?: string | null;
}) {
  const [post, setPost] = useState<BlogPost | null>(previewPost ?? null);
  const [error, setError] = useState(false);
  const { theme } = useActiveTheme();

  useEffect(() => {
    if (previewPost) {
      setPost(previewPost);
      setError(false);
      return;
    }
    let alive = true;
    setPost(null);
    setError(false);
    fetch(`/api/public/posts/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('404');
        return r.json();
      })
      .then((p) => alive && setPost(p))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [slug, previewPost]);

  if (error) {
    return (
      <div className="py-20 text-center">
        <p>Article introuvable.</p>
        <button type="button" className="mt-4 text-px-primary-dark underline" onClick={() => onNavigate('/')}>
          Accueil
        </button>
      </div>
    );
  }
  if (!post) return <div className="py-20 text-center text-slate-500">Chargement…</div>;

  const blocks = <BlockRenderer blocks={post.blocks} selectedId={selectedBlockId} />;
  if (theme.Post) return <theme.Post post={post}>{blocks}</theme.Post>;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{post.title}</h1>
      {blocks}
    </article>
  );
}
