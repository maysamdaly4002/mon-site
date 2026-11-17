/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { MenuItemDto, WidgetInstance } from '../../../sdk/content';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { ModuleWidgetBlock } from '../../modules/ModuleHost';

function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function MenuLinks({ items, navigate }: { items: MenuItemDto[]; navigate: (path: string) => void }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((it) => (
        <li key={it.id}>
          <a
            href={it.path}
            className={it.highlight ? 'font-semibold text-[var(--px-primary,#00C6BA)]' : 'text-[var(--px-muted,#64748B)] hover:text-[var(--px-text,#0B1528)]'}
            target={it.openInNewTab ? '_blank' : undefined}
            rel={it.openInNewTab ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              if (!it.openInNewTab && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                navigate(it.path);
              }
            }}
          >
            {it.label}
          </a>
          {it.children?.length ? (
            <ul className="mt-2 space-y-1 border-l border-[var(--px-border,#E3E8EE)] pl-3">
              {it.children.map((c) => (
                <li key={c.id}>
                  <a
                    href={c.path}
                    className="text-[var(--px-muted,#64748B)] hover:text-[var(--px-text,#0B1528)]"
                    onClick={(e) => {
                      if (!c.openInNewTab && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        navigate(c.path);
                      }
                    }}
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type PostMeta = { slug: string; title: string; excerpt?: string; publishedAt?: string };

function RecentPostsWidget({ widget, navigate }: { widget: WidgetInstance; navigate: (path: string) => void }) {
  const limit = Math.max(1, Math.min(Number(widget.data.limit) || 5, 20));
  const [posts, setPosts] = useState<PostMeta[]>([]);
  useEffect(() => {
    let alive = true;
    void fetch('/api/public/posts')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PostMeta[]) => alive && setPosts(Array.isArray(list) ? list.slice(0, limit) : []))
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, [limit]);
  if (!posts.length) return null;
  return (
    <ul className="space-y-3 text-sm">
      {posts.map((p) => (
        <li key={p.slug}>
          <a
            href={`/blog/${p.slug}/`}
            className="font-medium text-[var(--px-text,#0B1528)] hover:text-[var(--px-primary,#00C6BA)]"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                navigate(`/blog/${p.slug}/`);
              }
            }}
          >
            {p.title}
          </a>
          {p.excerpt ? <p className="mt-1 text-[var(--px-muted,#64748B)] line-clamp-2">{p.excerpt}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function SearchWidget({ navigate }: { navigate: (path: string) => void }) {
  const [q, setQ] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        if (term) navigate(`/blog/?s=${encodeURIComponent(term)}`);
        else navigate('/blog/');
      }}
    >
      <input
        type="search"
        name="s"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher…"
        className="min-w-0 flex-1 rounded-lg border border-[var(--px-border,#E3E8EE)] bg-white px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-lg bg-[var(--px-primary,#00C6BA)] px-3 py-2 text-sm font-medium text-white">
        OK
      </button>
    </form>
  );
}

function WidgetBody({ widget, navigate }: { widget: WidgetInstance; navigate: (path: string) => void }) {
  const cfg = useSiteConfig();
  switch (widget.kind) {
    case 'text': {
      const body = String(widget.data.body ?? widget.data.text ?? '');
      const paragraphs = body.split(/\n{2,}/).filter(Boolean);
      return (
        <div className="prose prose-sm max-w-none text-[var(--px-muted,#64748B)]">
          {paragraphs.length
            ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
            : body
              ? <p>{body}</p>
              : null}
        </div>
      );
    }
    case 'html': {
      const html = stripScripts(String(widget.data.html ?? ''));
      if (!html.trim()) return null;
      return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case 'menu': {
      const menuId = String(widget.data.menuId ?? '');
      const menu = cfg?.menus.find((m) => m.id === menuId);
      if (!menu?.items.length) return null;
      return <MenuLinks items={menu.items} navigate={navigate} />;
    }
    case 'recent_posts':
      return <RecentPostsWidget widget={widget} navigate={navigate} />;
    case 'search':
      return <SearchWidget navigate={navigate} />;
    case 'module': {
      const moduleId = String(widget.data.module ?? '');
      const widgetName = String(widget.data.widget ?? '');
      const options = (widget.data.options && typeof widget.data.options === 'object' ? widget.data.options : {}) as Record<string, unknown>;
      if (!moduleId || !widgetName) return null;
      return <ModuleWidgetBlock moduleId={moduleId} widget={widgetName} options={options} />;
    }
    default:
      return null;
  }
}

/** Affiche une zone de widgets déclarée dans la configuration publique du site. */
export function WidgetAreaHost({
  areaId,
  navigate,
  className,
}: {
  areaId: string;
  navigate: (path: string) => void;
  className?: string;
}) {
  const cfg = useSiteConfig();
  const area = useMemo(() => cfg?.widgetAreas?.find((a) => a.id === areaId), [cfg?.widgetAreas, areaId]);
  if (!area?.widgets.length) return null;
  return (
    <div className={className} data-widget-area={areaId}>
      {area.widgets.map((widget: WidgetInstance) => (
        <div key={widget.id} className="widget mb-8 last:mb-0" data-widget={widget.id} data-widget-kind={widget.kind}>
          {widget.title ? <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--px-text,#0B1528)]">{widget.title}</h3> : null}
          <WidgetBody widget={widget} navigate={navigate} />
        </div>
      ))}
    </div>
  );
}
