import type { ReactNode } from 'react';
import type { BlogPost } from '@snapify/sdk/content';
import { SiteLink } from './site';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

export function Post({ post, children }: { post: BlogPost; children: ReactNode }) {
  return (
    <article>
      <header className="st-container max-w-3xl space-y-4 pt-16">
        <SiteLink href="/blog/" className="text-sm font-semibold text-px-primary">
          ← Tous les articles
        </SiteLink>
        <h1 className="text-4xl font-bold leading-tight">{post.title}</h1>
        {post.excerpt ? <p className="text-lg opacity-80">{post.excerpt}</p> : null}
        <p className="text-sm opacity-60">
          {[post.author, post.publishedAt ? dateFormat.format(new Date(post.publishedAt)) : null].filter(Boolean).join(' · ')}
        </p>
        {post.coverImage ? <img src={post.coverImage} alt="" className="w-full rounded-2xl object-cover" /> : null}
      </header>
      {children}
    </article>
  );
}

export function NotFound({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="st-container py-32 text-center">
      <h1 className="text-4xl font-bold">Page introuvable</h1>
      <p className="mt-4 opacity-70">Cette adresse n’existe pas ou plus.</p>
      <button type="button" className="st-btn st-btn-primary mt-8" onClick={() => navigate('/')}>
        Retour à l’accueil
      </button>
    </div>
  );
}
