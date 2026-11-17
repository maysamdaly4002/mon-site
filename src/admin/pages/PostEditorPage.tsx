/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TagInput } from '../ui/TagInput';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, History, Layers, Lock, Search, Settings2 } from 'lucide-react';
import type { BlogPost } from '../../../server/cms/types';
import { api, type PostWithScore } from '../lib/api';
import { useAsync, useEditable } from '../lib/hooks';
import { fmtDateTime, slugify } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { publicUrl, useSite } from '../context/SiteContext';
import { Alert, Button, cx, ErrorState, Field, Input, Kbd, ScoreDot, Select, Spinner, StatusBadge } from '../ui/primitives';
import { ImageField } from '../ui/media';
import { Modal } from '../ui/overlays';
import { SaveBar } from '../ui/SaveBar';
import { BlocksPanel } from '../editor/BlocksPanel';
import { SeoPanel } from '../editor/SeoPanel';
import { fromLocalInput, RevisionsDrawer, toLocalInput } from '../editor/EditorBits';
import { DeviceSwitch, PreviewFrame, type Device } from '../editor/PreviewFrame';

function PostSettings({
  post,
  set,
  readOnly,
  canPublish,
  onRevisions,
}: {
  post: PostWithScore;
  set: (p: Partial<BlogPost>) => void;
  readOnly: boolean;
  canPublish: boolean;
  onRevisions: () => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <Field label="Titre">
        <Input value={post.title} disabled={readOnly} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Extrait" counter={{ value: post.excerpt.length, max: 300 }}>
        <Input value={post.excerpt} disabled={readOnly} onChange={(e) => set({ excerpt: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Statut">
          <Select
            value={post.status}
            disabled={readOnly || !canPublish}
            onChange={(v) => set({ status: v as BlogPost['status'] })}
            options={[
              { value: 'draft', label: 'Brouillon' },
              { value: 'published', label: 'Publié' },
              { value: 'scheduled', label: 'Planifié' },
            ]}
          />
        </Field>
        <Field label="Auteur">
          <Input value={post.author || ''} disabled={readOnly} onChange={(e) => set({ author: e.target.value })} />
        </Field>
      </div>
      {post.status === 'scheduled' ? (
        <Field label="Publication planifiée">
          <Input type="datetime-local" disabled={readOnly || !canPublish} value={toLocalInput(post.scheduledAt)} onChange={(e) => set({ scheduledAt: fromLocalInput(e.target.value) })} />
        </Field>
      ) : (
        <Field label="Date de publication">
          <Input type="datetime-local" disabled={readOnly || !canPublish} value={toLocalInput(post.publishedAt)} onChange={(e) => set({ publishedAt: fromLocalInput(e.target.value) })} />
        </Field>
      )}
      <Field label="Adresse (slug)" hint={`/blog/${post.slug}/`}>
        <Input value={post.slug} disabled={readOnly} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} onBlur={() => set({ slug: slugify(post.slug) })} />
      </Field>
      <Field label="Étiquettes">
        <div className={readOnly ? 'pointer-events-none opacity-70' : undefined}>
          <TagInput value={post.tags} onChange={(tags) => set({ tags })} />
        </div>
      </Field>
      <Field label="Image à la une">
        <div className={readOnly ? 'pointer-events-none opacity-70' : undefined}>
          <ImageField value={post.coverImage} onChange={(url) => set({ coverImage: url || undefined })} aspect="aspect-[16/10]" />
        </div>
      </Field>
      <dl className="space-y-2 rounded-xl border border-slate-200 p-4 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-slate-500">Dernière modification</dt>
          <dd className="text-slate-800">{fmtDateTime(post.updatedAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Score SEO</dt>
          <dd>
            <ScoreDot score={post.seoScore} />
          </dd>
        </div>
      </dl>
      <Button className="w-full justify-center" icon={History} onClick={onRevisions}>
        Historique des versions
      </Button>
    </div>
  );
}

export default function PostEditorPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const { site, reload: reloadSite } = useSite();
  const { data, error, loading, reload } = useAsync(async () => {
    const post = (await api.posts()).find((p) => p.id === id);
    if (!post) throw new Error('Cet article n’existe pas ou a été supprimé.');
    return post;
  }, [id]);
  const save = useCallback(
    async (p: PostWithScore) => {
      const saved = await api.updatePost(p.id, { ...p, seo: { ...p.seo, slug: p.slug } });
      void reloadSite();
      return saved;
    },
    [reloadSite]
  );
  const ed = useEditable<PostWithScore>(data, save, { successMessage: 'Article enregistré' });
  const [revOpen, setRevOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [tab, setTab] = useState<'blocks' | 'post'>('blocks');
  const [device, setDevice] = useState<Device>('desktop');
  const [selected, setSelected] = useState<string | null>(null);
  const [scroll, setScroll] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const post = ed.value;
  const payload = useMemo(
    () => ({
      post: post || null,
      selectedBlockId: selected,
      scrollToBlockId: scroll.id,
      scrollNonce: scroll.n,
    }),
    [post, selected, scroll]
  );
  const select = useCallback((blockId: string | null, doScroll = false) => {
    setSelected(blockId);
    if (blockId && doScroll) setScroll((s) => ({ id: blockId, n: s.n + 1 }));
  }, []);

  if (error) {
    return (
      <div className="pt-10">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (loading || !post || !data) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-50">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const canPublish = can('posts.publish');
  const readOnly = !can('posts.edit') || (!canPublish && data.status !== 'draft');
  const seoOnly = readOnly && can('seo.edit');
  const set = (p: Partial<BlogPost>) => ed.patch(p as Partial<PostWithScore>);
  const url = publicUrl(site, `/blog/${post.slug}/`);
  const saveLabel = post.status === 'published' ? 'Mettre à jour' : post.status === 'scheduled' ? 'Planifier' : 'Enregistrer le brouillon';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3">
        <Link to="/posts" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" title="Tous les articles">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-slate-900">{post.title || 'Sans titre'}</h1>
            <StatusBadge status={post.status} />
          </div>
          <p className="truncate text-xs text-slate-500">/blog/{post.slug}/</p>
        </div>
        <div className="mx-auto hidden md:block">
          <DeviceSwitch value={device} onChange={setDevice} />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {ed.dirty ? (
            <span className="hidden items-center gap-1.5 text-xs text-amber-700 lg:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Non enregistré · <Kbd>Ctrl S</Kbd>
            </span>
          ) : null}
          <Button size="sm" icon={Search} onClick={() => setSeoOpen(true)}>
            SEO
          </Button>
          {post.status === 'published' ? (
            <a href={url} target="_blank" rel="noreferrer">
              <Button size="sm" icon={ExternalLink} className="hidden sm:inline-flex">
                Voir
              </Button>
            </a>
          ) : null}
          <Button size="sm" variant="secondary" loading={ed.saving} disabled={!ed.dirty} onClick={() => void ed.commit()}>
            {saveLabel}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-full max-w-[400px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 p-1.5">
            {(
              [
                ['blocks', 'Blocs', Layers],
                ['post', 'Article', Settings2],
              ] as const
            ).map(([k, label, I]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cx('flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition', tab === k ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800')}
              >
                <I className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {readOnly ? (
            <div className="shrink-0 border-b border-slate-200 p-2">
              <Alert tone="warning" icon={Lock} title="Lecture seule">
                {!can('posts.edit')
                  ? 'Votre rôle ne permet pas de modifier les articles.'
                  : 'Cet article n’est plus un brouillon : seul un utilisateur autorisé à publier peut le modifier.'}
                {seoOnly ? ' Vous pouvez toutefois ajuster son référencement.' : ''}
              </Alert>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            {tab === 'blocks' ? (
              <BlocksPanel blocks={post.blocks} onChange={(blocks) => set({ blocks })} selectedId={selected} onSelect={select} readOnly={readOnly} />
            ) : (
              <div className="h-full overflow-y-auto scrollbar-thin">
                <PostSettings post={post} set={set} readOnly={readOnly} canPublish={canPublish} onRevisions={() => setRevOpen(true)} />
              </div>
            )}
          </div>
        </aside>

        <main className="relative hidden min-w-0 flex-1 md:block">
          <PreviewFrame
            path={`/blog/${data.slug}/`}
            payload={payload}
            device={device}
            onBlockClick={(blockId) => {
              setTab('blocks');
              select(blockId);
            }}
          />
        </main>
      </div>

      <Modal open={seoOpen} onClose={() => setSeoOpen(false)} size="xl" title="Référencement (SEO)">
        <SeoPanel
          seo={post.seo}
          onChange={(seo) => set({ seo })}
          blocks={post.blocks}
          kind="post"
          extraText={post.excerpt}
          url={url}
          siteName={site?.branding.siteName || 'Snapify'}
          defaultOgImage={post.coverImage || site?.settings.seo.defaultOgImage}
          slugLocked
          readOnly={readOnly && !seoOnly}
        />
      </Modal>
      <SaveBar dirty={ed.dirty} saving={ed.saving} onSave={ed.commit} onReset={ed.reset} blocker={ed.blocker} />
      <RevisionsDrawer
        open={revOpen}
        onClose={() => setRevOpen(false)}
        load={() => api.postRevisions(post.id)}
        restore={(rev) => api.restorePost(post.id, rev)}
        onRestored={() => void reload()}
      />
    </div>
  );
}
