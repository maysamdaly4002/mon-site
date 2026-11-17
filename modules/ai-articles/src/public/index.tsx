/**
 * Snapify — module Articles IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { useEffect, useState } from 'react';
import { definePublicModule, type PublicPageProps, type WidgetProps } from '@snapify/sdk';
import type { Settings } from '../types';

interface Card {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  createdAt?: string;
}

function LatestWidget({ options, api, navigate }: WidgetProps<Settings, { title?: string; limit?: number }>) {
  const [items, setItems] = useState<Card[]>([]);
  useEffect(() => {
    api
      .get<{ articles: Card[] }>(`/articles?limit=${options.limit || 6}`)
      .then((r) => setItems(r.articles || []))
      .catch(() => setItems([]));
  }, [api, options.limit]);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="mb-6 text-2xl font-bold text-px-navy">{options.title || 'Articles récents'}</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => navigate(`/articles-ia/${a.slug}/`)}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-md"
          >
            {a.coverImage ? <img src={a.coverImage} alt="" className="h-40 w-full object-cover" /> : <div className="h-40 bg-gradient-to-br from-px-primary/20 to-px-navy/10" />}
            <div className="p-4">
              <h3 className="font-semibold text-px-navy">{a.title}</h3>
              {a.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{a.excerpt}</p> : null}
            </div>
          </button>
        ))}
      </div>
      {!items.length ? <p className="text-sm text-slate-500">Aucun article publié pour le moment.</p> : null}
    </section>
  );
}

function BlogPage({ settings, api, path, navigate, setMeta }: PublicPageProps<Settings>) {
  const slug = path.replace(/^\/(articles-ia|blog-ia)\/?/, '').replace(/\/$/, '');
  const [list, setList] = useState<Card[]>([]);
  const [article, setArticle] = useState<(Card & { html?: string }) | null>(null);

  useEffect(() => {
    setMeta({ title: settings.pageTitle || 'Blog', description: settings.pageIntro });
  }, [settings.pageTitle, settings.pageIntro, setMeta]);

  useEffect(() => {
    if (slug) {
      api
        .get<{ article: Card & { html: string; seoTitle?: string; seoDescription?: string } }>(`/articles/${encodeURIComponent(slug)}`)
        .then((r) => {
          setArticle(r.article);
          setMeta({ title: r.article.seoTitle || r.article.title, description: r.article.seoDescription || r.article.excerpt });
        })
        .catch(() => setArticle(null));
      return;
    }
    api
      .get<{ articles: Card[] }>('/articles?limit=24')
      .then((r) => setList(r.articles || []))
      .catch(() => setList([]));
  }, [api, slug, setMeta]);

  if (slug && article) {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <button type="button" className="mb-6 text-sm font-semibold text-px-primary" onClick={() => navigate('/articles-ia/')}>
          ← Tous les articles
        </button>
        {article.coverImage ? <img src={article.coverImage} alt="" className="mb-8 max-h-96 w-full rounded-2xl object-cover" /> : null}
        <h1 className="text-3xl font-bold text-px-navy">{article.title}</h1>
        {article.excerpt ? <p className="mt-3 text-lg text-slate-600">{article.excerpt}</p> : null}
        <div className="prose prose-slate mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: article.html || '' }} />
      </article>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-px-navy">{settings.pageTitle || 'Blog'}</h1>
      {settings.pageIntro ? <p className="mt-3 max-w-2xl text-slate-600">{settings.pageIntro}</p> : null}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => navigate(`/articles-ia/${a.slug}/`)}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-md"
          >
            {a.coverImage ? <img src={a.coverImage} alt="" className="h-40 w-full object-cover" /> : <div className="h-40 bg-gradient-to-br from-px-primary/20 to-px-navy/10" />}
            <div className="p-4">
              <h2 className="font-semibold text-px-navy">{a.title}</h2>
              {a.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{a.excerpt}</p> : null}
            </div>
          </button>
        ))}
      </div>
      {!list.length ? <p className="mt-6 text-sm text-slate-500">Aucun article publié.</p> : null}
    </div>
  );
}

export default definePublicModule<Settings>({
  page: BlogPage,
  widgets: { latest: LatestWidget },
});
