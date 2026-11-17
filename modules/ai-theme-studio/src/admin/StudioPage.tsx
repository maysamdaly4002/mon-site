/**
 * Atelier — brief → génération → prévisualisation → application (identité + AI Canvas + accueil)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
  Switch,
  Textarea,
  errorMessage,
  toast,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { AI_CANVAS_THEME_ID, type GenerationRecord, type Settings, type ThemeSpec } from '../types';

type Meta = {
  market?: 'tn' | 'fr';
  examples: { id: string; title: string; prompt: string }[];
  tips: string[];
  placeholder?: string;
  canvasThemeId: string;
  hasApiKey: boolean;
  provider: string;
  lang: string;
  autoApplyHome: boolean;
};

/** Appels CMS hôte : le backoffice Snapify authentifie via Bearer (localStorage), pas via cookie. */
function adminAuthHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  try {
    const token = localStorage.getItem('snapify_admin_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  return headers;
}

async function hostGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/admin${path}`, { headers: adminAuthHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Erreur ${res.status}`);
  return res.json() as Promise<T>;
}

async function hostSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: adminAuthHeaders(true),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Erreur ${res.status}`);
  return res.json() as Promise<T>;
}

function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <span className="h-8 w-8 shrink-0 rounded-md border border-black/10" style={{ background: color }} />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate font-mono text-xs text-slate-800">{color}</div>
      </div>
    </div>
  );
}

export function StudioPage({ api, settings }: AdminPageProps<Settings>) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [prompt, setPrompt] = useState('');
  const [showTips, setShowTips] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [gen, setGen] = useState<GenerationRecord | null>(null);
  const [opts, setOpts] = useState({ branding: true, theme: true, home: true, activateCanvas: true });

  useEffect(() => {
    void (async () => {
      try {
        const m = await api.get<Meta>('/meta');
        setMeta(m);
        setOpts((o) => ({ ...o, home: m.autoApplyHome !== false }));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    })();
  }, [api]);

  const spec: ThemeSpec | undefined = gen?.spec;
  const colors = useMemo(() => (spec ? Object.entries(spec.branding.colors) : []), [spec]);

  const generate = async () => {
    if (!meta?.hasApiKey) {
      toast.error('Ajoutez votre clé API dans les réglages du module.');
      return;
    }
    setBusy(true);
    setGen(null);
    try {
      let siteHint = '';
      try {
        const snap = await hostGet<{ branding?: { siteName?: string; tagline?: string } }>('/snapshot');
        if (snap.branding?.siteName) siteHint = `${snap.branding.siteName} — ${snap.branding.tagline || ''}`;
      } catch {
        /* ignore */
      }
      const r = await api.post<{ generation: GenerationRecord }>('/generate', {
        prompt,
        lang: settings.defaultLang || meta?.lang || 'fr',
        siteHint,
      });
      let current = r.generation;
      setGen(current);

      // Poll jusqu’à ready / failed (max ~3 min)
      const started = Date.now();
      while (current.status === 'pending' && Date.now() - started < 180_000) {
        await new Promise((res) => setTimeout(res, 1500));
        const poll = await api.get<{ generation: GenerationRecord }>(`/generations/${current.id}`);
        current = poll.generation;
        setGen(current);
      }

      if (current.status === 'ready') toast.success('Proposition prête');
      else if (current.status === 'failed') toast.error(current.error || 'Génération échouée');
      else toast.error('Délai dépassé — réessayez ou simplifiez le brief.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!gen?.spec) return;
    setApplying(true);
    const s = gen.spec;
    try {
      if (opts.branding) {
        await hostSend('PUT', '/branding', {
          siteName: s.siteName,
          tagline: s.tagline,
          colors: s.branding.colors,
          fonts: s.branding.fonts,
        });
      }

      if (opts.theme || opts.activateCanvas) {
        const themes = await hostGet<{ themes: { id: string; active?: boolean }[] }>('/themes');
        const canvasId = meta?.canvasThemeId || AI_CANVAS_THEME_ID;
        const installed = themes.themes.some((t) => t.id === canvasId);
        if (!installed) {
          toast.error(
            `Installez d’abord le thème « AI Canvas » (${canvasId}) depuis Apparence › Thèmes, puis réessayez.`
          );
          setApplying(false);
          return;
        }
        if (opts.activateCanvas) {
          await hostSend('POST', `/themes/${encodeURIComponent(canvasId)}/activate`);
        }
        if (opts.theme) {
          await hostSend('PUT', `/themes/${encodeURIComponent(canvasId)}/settings`, {
            settings: s.themeSettings,
          });
        }
      }

      if (opts.home) {
        const pages = await hostGet<{ id: string; path: string; title: string; blocks?: unknown[] }[]>('/pages');
        const home =
          pages.find((p) => p.path === '/' || p.path === '') ||
          pages.find((p) => /accueil|home/i.test(p.title)) ||
          pages[0];
        if (!home) throw new Error('Aucune page trouvée pour appliquer l’accueil.');
        const blocks = s.homeBlocks.map((b, i) => ({
          id: `ai_${Date.now().toString(36)}_${i}`,
          type: b.type,
          data: b.data,
          style: b.style || {},
        }));
        await hostSend('PUT', `/pages/${home.id}`, { blocks, contentSource: 'cms' });
      }

      await api.post(`/generations/${gen.id}/mark-applied`, {
        branding: opts.branding,
        theme: opts.theme || opts.activateCanvas,
        home: opts.home,
      });
      toast.success('Appliqué — ouvrez l’éditeur visuel pour peaufiner.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Atelier thème IA"
        description="Un prompt → identité visuelle Snapify + thème AI Canvas (25 blocs) + page d’accueil éditable."
      />

      {!meta?.hasApiKey && (
        <Alert tone="warning" title="Clé API manquante">
          <p className="text-sm">
            Ouvrez les réglages du module et collez une clé OpenAI, Claude ou Gemini. Elle reste sur le serveur.
          </p>
        </Alert>
      )}

      <Card className="space-y-4 p-6">
        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-teal-50/50 p-4 ring-1 ring-slate-200/80">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
            onClick={() => setShowTips((v) => !v)}
          >
            <span>Comment bien prompter ?</span>
            <span className="text-slate-400">{showTips ? '▴' : '▾'}</span>
          </button>
          {showTips && (
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              {(meta?.tips || []).map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-teal-600">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">Exemples prêts à l’emploi</p>
          <div className="flex flex-wrap gap-2">
            {(meta?.examples || []).map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setPrompt(ex.prompt)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
              >
                {ex.title}
              </button>
            ))}
          </div>
        </div>

        <Field label="Votre brief" hint="Secteur, ville, ambiance, public, action principale.">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder={
              meta?.placeholder ||
              (meta?.market === 'fr'
                ? 'Ex. Clinique dentaire à Lyon : confiance, blanc et bleu doux, prise de RDV évidente…'
                : 'Ex. Clinique dentaire à Sousse : confiance, blanc et bleu doux, prise de RDV évidente…')
            }
          />
        </Field>

        <Button loading={busy} onClick={() => void generate()} disabled={prompt.trim().length < 12}>
          {busy
            ? gen?.status === 'pending'
              ? 'L’IA compose le thème…'
              : 'Génération…'
            : 'Générer mon thème'}
        </Button>
        {busy && gen?.status === 'pending' ? (
          <p className="text-xs text-teal-700">En cours (souvent 30–90 s) — textes, structure, images…</p>
        ) : null}
        <p className="text-xs text-slate-500">
          Fournisseur : {meta?.provider || settings.provider}
          {settings.generateImages !== false ? ' · images IA si dispo' : ' · images stock'} · thème{' '}
          <strong>AI Canvas</strong> (25 blocs).
        </p>
      </Card>

      {spec && (
        <Card className="space-y-5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Proposition</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">{spec.siteName}</h2>
            <p className="mt-1 text-slate-600">{spec.tagline}</p>
            <p className="mt-2 text-sm text-slate-500">
              {spec.industry} · {spec.mood}
            </p>
            {spec.rationale ? <p className="mt-3 text-sm leading-relaxed text-slate-700">{spec.rationale}</p> : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Identité visuelle</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {colors.map(([k, v]) => (
                <ColorSwatch key={k} label={k} color={v} />
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Titres : <strong>{spec.branding.fonts.heading}</strong> · Texte :{' '}
              <strong>{spec.branding.fonts.body}</strong>
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Réglages AI Canvas</h3>
            <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              <li>Boutons : {spec.themeSettings.buttonShape}</li>
              <li>Arrondi cartes : {spec.themeSettings.cardRadius}px</li>
              <li>Densité : {spec.themeSettings.density}</li>
              <li>Animations : {spec.themeSettings.animations ? 'oui' : 'non'}</li>
            </ul>
          </div>

          {(() => {
            const hero = spec.homeBlocks.find((b) => b.type === 'hero');
            const heroImg = String((hero?.data as { mainImage?: string })?.mainImage || '');
            const heroBtns = Array.isArray((hero?.data as { buttons?: { label?: string; variant?: string }[] })?.buttons)
              ? ((hero!.data as { buttons: { label?: string; variant?: string }[] }).buttons)
              : [];
            return (
              <div className="space-y-3">
                {heroImg ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <img src={heroImg} alt="Aperçu hero" className="h-44 w-full object-cover sm:h-56" />
                  </div>
                ) : null}
                {heroBtns.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {heroBtns.map((btn, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          btn.variant === 'secondary' || btn.variant === 'light'
                            ? 'border border-slate-300 bg-white text-slate-800'
                            : 'bg-teal-700 text-white'
                        }`}
                      >
                        {btn.label || 'Bouton'}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })()}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Page d’accueil ({spec.homeBlocks.length} blocs)</h3>
            <ol className="space-y-1.5">
              {spec.homeBlocks.map((b, i) => {
                const img =
                  String((b.data as { mainImage?: string }).mainImage || '') ||
                  String((b.data as { image?: string }).image || '');
                return (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    {img ? <img src={img} alt="" className="h-8 w-12 shrink-0 rounded object-cover" /> : null}
                    <span className="font-mono text-xs text-teal-800">{b.type}</span>
                    <span className="truncate text-slate-600">
                      {String((b.data as { title?: string }).title || (b.data as { question?: string }).question || '—')}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <Switch
              label="Appliquer l’identité visuelle (couleurs & polices)"
              checked={opts.branding}
              onChange={(v) => setOpts((o) => ({ ...o, branding: v }))}
            />
            <Switch
              label="Activer le thème AI Canvas"
              description="Requis pour un rendu 100 % compatible éditeur (25 blocs)."
              checked={opts.activateCanvas}
              onChange={(v) => setOpts((o) => ({ ...o, activateCanvas: v }))}
            />
            <Switch
              label="Enregistrer les réglages du thème"
              checked={opts.theme}
              onChange={(v) => setOpts((o) => ({ ...o, theme: v }))}
            />
            <Switch
              label="Remplacer les blocs de la page d’accueil"
              description="Les blocs restent éditables dans l’éditeur visuel ensuite."
              checked={opts.home}
              onChange={(v) => setOpts((o) => ({ ...o, home: v }))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button loading={applying} onClick={() => void apply()}>
              Appliquer sur mon site
            </Button>
            <Button variant="ghost" onClick={() => setGen(null)}>
              Nouvelle génération
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
