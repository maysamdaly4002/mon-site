/**
 * Assistant guidé — migration SEO WP → Snapify (analyse async + polling)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Switch,
  errorMessage,
  toast,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import type { MigrationJob, Settings } from '../types';
import { t, type Lang } from './i18n';

type Step = 1 | 2 | 3 | 4;

async function fileToUpload(file: File): Promise<{ name: string; mimeType: string; content: string; encoding: 'base64' }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return { name: file.name, mimeType: file.type || 'application/octet-stream', content: btoa(binary), encoding: 'base64' };
}

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

async function hostPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method: 'PUT',
    headers: adminAuthHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Erreur ${res.status}`);
  return res.json() as Promise<T>;
}

function normPath(p: string): string {
  let x = p.startsWith('/') ? p : `/${p}`;
  if (x.length > 1 && x.endsWith('/')) x = x.slice(0, -1);
  return x || '/';
}

/** Affiche un chemin lisible (arabe, accents) même s’il arrive encore %xx. */
function displayPath(raw: unknown): string {
  const s = String(raw || '/');
  try {
    return decodeURIComponent(s);
  } catch {
    return s.replace(/%[0-9A-Fa-f]{2}/g, (m) => {
      try {
        return decodeURIComponent(m);
      } catch {
        return m;
      }
    });
  }
}

function displayOrDash(raw: unknown, empty = '—'): string {
  const s = String(raw || '').trim();
  return s || empty;
}

function readableFromJob(job: MigrationJob): string {
  const n = job.stats.pages + job.stats.posts + job.stats.products + job.stats.terms;
  const src = job.connectors.filter((c) => c.found).map((c) => c.name);
  const parts = [`${n.toLocaleString('fr-FR')} contenus`, `${job.stats.redirects} redirections`, `${job.stats.coveragePct} % récupérable`];
  if (src.length) parts.push(src.slice(0, 4).join(', '));
  return parts.join(' · ');
}

export function WizardPage({ api, settings }: AdminPageProps<Settings>) {
  const lang = (settings.uiLang || 'fr') as Lang;
  const copy = t(lang);
  const rtl = lang === 'ar';

  const [step, setStep] = useState<Step>(1);
  const [siteUrl, setSiteUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [expert, setExpert] = useState(false);
  const [wpUser, setWpUser] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [ftpHost, setFtpHost] = useState('');
  const [ftpUser, setFtpUser] = useState('');
  const [ftpPass, setFtpPass] = useState('');
  const [ftpRoot, setFtpRoot] = useState('/public_html');
  const [ftpSecure, setFtpSecure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [job, setJob] = useState<MigrationJob | null>(null);
  const [readable, setReadable] = useState('');
  const [applyOpts, setApplyOpts] = useState({ updateSeo: true, addRedirects: true, createMissingDrafts: false });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = useMemo(
    () => [
      { n: 1 as const, label: copy.step1 },
      { n: 2 as const, label: copy.step2 },
      { n: 3 as const, label: copy.step3 },
      { n: 4 as const, label: copy.step4 },
    ],
    [copy]
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const cancel = async () => {
    stopPoll();
    setAnalyzing(false);
    if (!job) {
      setStep(1);
      return;
    }
    try {
      await api.post(`/jobs/${job.id}/cancel`);
      toast.message(copy.cancel);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setJob(null);
    setStep(1);
  };

  const downloadPlugin = async () => {
    try {
      const r = await api.get<{ filename: string; content: string }>('/exporter-plugin');
      const blob = new Blob([r.content], { type: 'application/x-php' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const startPolling = (jobId: string) => {
    stopPoll();
    setAnalyzing(true);
    setStep(2);
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const r = await api.get<{ job: MigrationJob }>(`/jobs/${jobId}`);
          setJob(r.job);
          if (r.job.status === 'ready') {
            stopPoll();
            setAnalyzing(false);
            setReadable(readableFromJob(r.job));
            setApplyOpts(r.job.apply);
            toast.success(copy.analyzeOk);
          } else if (r.job.status === 'failed' || r.job.status === 'cancelled') {
            stopPoll();
            setAnalyzing(false);
            toast.error(r.job.progress.message || copy.analyzeFail);
          }
        } catch (e) {
          stopPoll();
          setAnalyzing(false);
          toast.error(errorMessage(e));
        }
      })();
    }, 1200);
  };

  const analyze = async () => {
    const url = siteUrl.trim();
    if (!url && !files.length) {
      toast.error(copy.needUrl);
      return;
    }
    setBusy(true);
    try {
      const uploaded = [];
      for (const f of files) uploaded.push(await fileToUpload(f));
      const r = await api.post<{ job: MigrationJob; polling?: boolean }>('/analyze', {
        siteUrl: url,
        files: uploaded,
        wpUser: wpUser.trim() || undefined,
        wpAppPassword: wpAppPassword.trim() || undefined,
        ftp:
          ftpHost.trim() && ftpUser.trim()
            ? {
                host: ftpHost.trim(),
                user: ftpUser.trim(),
                password: ftpPass,
                root: ftpRoot.trim() || '/',
                secure: ftpSecure,
              }
            : undefined,
      });
      setWpAppPassword('');
      setFtpPass('');
      setJob(r.job);
      if (r.job.status === 'ready') {
        setReadable(readableFromJob(r.job));
        setApplyOpts(r.job.apply);
        setStep(2);
        toast.success(copy.analyzeOk);
      } else {
        startPolling(r.job.id);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const autofix = async (actionId: string) => {
    if (!job) return;
    setBusy(true);
    try {
      const r = await api.post<{ job: MigrationJob }>(`/jobs/${job.id}/autofix`, { actionId });
      setJob(r.job);
      toast.success(copy.fix);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runMigrate = async () => {
    if (!job) return;
    setBusy(true);
    setStep(4);
    try {
      await api.post(`/jobs/${job.id}/start`, { apply: applyOpts });
      const plan = await api.get<{
        seoUpdates: { path: string; seo: Record<string, unknown>; title: string }[];
        redirects: { from: string; to: string; permanent: boolean }[];
      }>(`/jobs/${job.id}/apply-plan`);

      let done = 0;
      let errors = 0;
      const errList: string[] = [];
      const total =
        (applyOpts.updateSeo ? plan.seoUpdates.length : 0) + (applyOpts.addRedirects ? plan.redirects.length : 0) || 1;

      type PageRow = { id: string; path: string; seo: Record<string, unknown>; title: string };
      let pages: PageRow[] = [];
      let posts: PageRow[] = [];
      try {
        pages = await hostGet<PageRow[]>('/pages');
      } catch {
        /* */
      }
      try {
        posts = await hostGet<PageRow[]>('/posts');
      } catch {
        posts = [];
      }
      const byPath = new Map<string, { id: string; kind: 'page' | 'post'; seo: Record<string, unknown> }>();
      for (const p of pages) byPath.set(normPath(p.path), { id: p.id, kind: 'page', seo: p.seo });
      for (const p of posts) byPath.set(normPath(p.path), { id: p.id, kind: 'post', seo: p.seo });

      if (applyOpts.updateSeo) {
        for (const u of plan.seoUpdates) {
          const hit = byPath.get(normPath(u.path));
          if (!hit) {
            done++;
            await api.post(`/jobs/${job.id}/progress`, { done, errors, message: `Ignoré (absent) ${u.path}` });
            continue;
          }
          try {
            await hostPut(`/${hit.kind === 'page' ? 'pages' : 'posts'}/${hit.id}`, { seo: { ...hit.seo, ...u.seo } });
          } catch (e) {
            errors++;
            errList.push(`${u.path}: ${e instanceof Error ? e.message : 'erreur'}`);
          }
          done++;
          if (done % 5 === 0) {
            const mid = await api.post<{ job: MigrationJob }>(`/jobs/${job.id}/progress`, { done, errors, message: copy.applying });
            setJob(mid.job);
          }
        }
      }

      if (applyOpts.addRedirects) {
        try {
          const snap = await hostGet<{ redirects?: { from: string; to: string; permanent: boolean }[] }>('/snapshot');
          const list = snap.redirects || [];
          const map = new Map(list.map((r) => [normPath(r.from), r]));
          for (const r of plan.redirects) {
            map.set(normPath(r.from), { from: normPath(r.from), to: r.to, permanent: r.permanent !== false });
            done++;
          }
          await hostPut('/redirects', { redirects: [...map.values()] });
        } catch (e) {
          errors++;
          errList.push(`redirections: ${e instanceof Error ? e.message : 'erreur'}`);
        }
      }

      const report = {
        migrated: plan.seoUpdates.length,
        redirectsAdded: plan.redirects.length,
        missing: plan.seoUpdates.filter((u) => !byPath.has(normPath(u.path))).length,
        errors: errList,
        dnsChecklist: [
          'Pointez le domaine WordPress vers ce serveur Snapify (DNS A/AAAA).',
          'Activez HTTPS (certificat).',
          'Dans Google Search Console : sitemap Snapify + inspection d’URL clés.',
          'Surveillez les 404 pendant 30 jours dans Historique.',
        ],
      };
      const fin = await api.post<{ job: MigrationJob }>(`/jobs/${job.id}/progress`, {
        done: total,
        errors,
        message: 'Terminé',
        report,
      });
      setJob(fin.job);
      toast.success(copy.done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = async () => {
    if (!job) return;
    try {
      const r = await api.get<{ filename: string; csv: string }>(`/jobs/${job.id}/report`);
      const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const analyzePct = job?.status === 'analyzing' ? Math.min(99, job.progress.done || 5) : 0;

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.sub}
        actions={
          step > 1 || analyzing || busy ? (
            <Button variant="ghost" onClick={() => void cancel()}>
              {copy.cancel}
            </Button>
          ) : undefined
        }
      />

      {/* Stepper */}
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((s) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li
              key={s.n}
              className={`rounded-xl border px-2 py-3 text-center ${
                active
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wide opacity-70">{s.n}/4</div>
              <div className="mt-0.5 text-sm font-semibold">{s.label}</div>
            </li>
          );
        })}
      </ol>

      {/* Écran 1 — Connexion */}
      {step === 1 && (
        <Card className="space-y-5 p-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-teal-50/60 p-4 ring-1 ring-slate-200/80">
            <p className="text-sm font-semibold text-slate-900">{copy.howTitle}</p>
            <ol className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">1</span>
                {copy.how1}
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">2</span>
                {copy.how2}
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">3</span>
                {copy.how3}
              </li>
            </ol>
          </div>

          <Field label={copy.siteUrl} hint={copy.siteHint}>
            <Input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={copy.sitePh}
              className="text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void analyze();
              }}
            />
          </Field>

          <Button loading={busy || analyzing} onClick={() => void analyze()} className="w-full sm:w-auto">
            {analyzing ? copy.analyzing : copy.analyze}
          </Button>

          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
              onClick={() => setAdvanced((v) => !v)}
            >
              <span>{copy.advanced}</span>
              <span className="text-slate-400">{advanced ? '▴' : '▾'}</span>
            </button>
            <p className="mt-1 text-xs text-slate-500">{copy.advancedHint}</p>

            {advanced && (
              <div className="mt-4 space-y-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
                <Field label={copy.wpUser}>
                  <Input value={wpUser} onChange={(e) => setWpUser(e.target.value)} autoComplete="username" />
                </Field>
                <Field label={copy.wpPass} hint={copy.wpPassHelp}>
                  <Input
                    type="password"
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>

                <div className="border-t border-amber-200/60 pt-3">
                  <p className="text-sm font-semibold text-slate-800">{copy.ftpTitle}</p>
                  <p className="mb-3 text-xs text-slate-600">{copy.ftpHint}</p>
                  <div className="space-y-3">
                    <Field label={copy.ftpHost}>
                      <Input value={ftpHost} onChange={(e) => setFtpHost(e.target.value)} placeholder="ftp.monsite.tn" />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={copy.ftpUser}>
                        <Input value={ftpUser} onChange={(e) => setFtpUser(e.target.value)} />
                      </Field>
                      <Field label={copy.ftpPass}>
                        <Input type="password" value={ftpPass} onChange={(e) => setFtpPass(e.target.value)} autoComplete="new-password" />
                      </Field>
                    </div>
                    <Field label={copy.ftpRoot}>
                      <Input value={ftpRoot} onChange={(e) => setFtpRoot(e.target.value)} />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={ftpSecure} onChange={(e) => setFtpSecure(e.target.checked)} />
                      {copy.ftpSecure}
                    </label>
                  </div>
                </div>

                <Alert tone="info" title={copy.downloadPlugin}>
                  <p className="mb-3 text-sm">{copy.pluginHelp}</p>
                  <Button size="sm" onClick={() => void downloadPlugin()}>
                    {copy.downloadPlugin}
                  </Button>
                </Alert>

                <button type="button" className="text-sm font-semibold text-slate-600" onClick={() => setExpert((v) => !v)}>
                  {expert ? '▴' : '▾'} {copy.expert}
                </button>
                {expert && (
                  <Field label={copy.upload} hint={copy.uploadHelp}>
                    <input
                      type="file"
                      multiple
                      accept=".xml,.csv,.json,.txt,.htaccess,.html"
                      onChange={(e) => setFiles([...(e.target.files || [])])}
                    />
                    {files.length > 0 && (
                      <p className="mt-2 text-sm text-slate-600">{files.map((f) => f.name).join(', ')}</p>
                    )}
                  </Field>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Écran 2 — Analyse / résultat */}
      {step === 2 && job && (
        <Card className="space-y-5 p-6">
          {(analyzing || job.status === 'analyzing') && (
            <div className="space-y-3">
              <Alert tone="info" title={copy.analyzing}>
                <p className="text-sm">{job.progress.message || copy.analyzingHint}</p>
                <p className="mt-1 text-xs text-slate-500">{copy.analyzingHint}</p>
              </Alert>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-teal-600 transition-all duration-500" style={{ width: `${analyzePct}%` }} />
              </div>
              <p className="text-center text-xs font-medium text-slate-500">{analyzePct} %</p>
            </div>
          )}

          {job.status === 'failed' && (
            <Alert tone="danger" title={copy.analyzeFail}>
              <p className="mb-3 text-sm">{job.progress.message}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setStep(1);
                    setAdvanced(true);
                  }}
                >
                  {copy.retry}
                </Button>
                <Button variant="ghost" onClick={() => void cancel()}>
                  {copy.startOver}
                </Button>
              </div>
            </Alert>
          )}

          {job.status === 'ready' && (
            <>
              <Alert tone="success" title={copy.analyzeOk}>
                <p className="text-sm">{readable}</p>
              </Alert>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label={copy.contents} value={String(job.stats.pages + job.stats.posts + job.stats.products)} />
                <Stat label={copy.redirects} value={String(job.stats.redirects)} />
                <Stat label={copy.coverage} value={`${job.stats.coveragePct} %`} />
              </div>
              {job.connectors.some((c) => c.found) && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">{copy.foundSources}</p>
                  <ul className="flex flex-wrap gap-2">
                    {job.connectors
                      .filter((c) => c.found)
                      .map((c) => (
                        <li key={c.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          ✓ {c.name}
                          {c.detail ? ` · ${c.detail}` : ''}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => setStep(3)}>{copy.next}</Button>
                <Button variant="ghost" onClick={() => setStep(1)}>
                  {copy.back}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Écran 3 — Aperçu */}
      {step === 3 && job && job.status === 'ready' && (
        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
            <div className="shrink-0 text-3xl font-semibold tabular-nums tracking-tight text-emerald-800">
              {job.stats.coveragePct}
              <span className="text-lg font-semibold"> %</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900">{copy.coverage}</p>
              <p className="mt-0.5 text-sm leading-snug text-emerald-900/80">{copy.migrateHint}</p>
            </div>
          </div>

          {job.issues.length > 0 && (
            <div className="space-y-2">
              {job.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 flex-1 text-slate-700">{issue.message}</span>
                  {issue.action ? (
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => void autofix(issue.action!.id)}>
                      {copy.fix}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{copy.beforeAfter}</h3>
            <div className="space-y-3">
              {job.preview.map((p, i) => {
                const beforePath = displayPath(p.before.path);
                const afterPath = displayPath(p.after.path);
                return (
                  <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      <PreviewCol
                        tone="before"
                        label="Avant (WordPress)"
                        path={beforePath}
                        title={displayOrDash(p.before.seoTitle, 'Sans titre')}
                        meta={displayOrDash(p.before.metaDescription, 'Sans description')}
                      />
                      <PreviewCol
                        tone="after"
                        label="Après (Snapify)"
                        path={afterPath}
                        title={displayOrDash(p.after.seoTitle, 'Sans titre')}
                        meta={displayOrDash(p.after.metaDescription, 'Sans description')}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-slate-800"
              onClick={() => setExpert((v) => !v)}
            >
              <span>Options expertes</span>
              <span className="text-slate-400">{expert ? '▴' : '▾'}</span>
            </button>
            {expert && (
              <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <Switch
                  label="Mettre à jour les titres / meta"
                  checked={applyOpts.updateSeo}
                  onChange={(v) => setApplyOpts((o) => ({ ...o, updateSeo: v }))}
                />
                <Switch
                  label="Ajouter les redirections 301"
                  checked={applyOpts.addRedirects}
                  onChange={(v) => setApplyOpts((o) => ({ ...o, addRedirects: v }))}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button loading={busy} onClick={() => void runMigrate()}>
              {copy.migrate}
            </Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              {copy.back}
            </Button>
          </div>
        </Card>
      )}

      {/* Écran 4 — Migration */}
      {step === 4 && job && (
        <Card className="space-y-5 p-6">
          {job.status !== 'done' ? (
            <Alert tone="info" title={copy.applying}>
              <p className="text-sm">
                {job.progress.done} / {job.progress.total} — {job.progress.message}
              </p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all"
                  style={{ width: `${Math.min(100, Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100))}%` }}
                />
              </div>
            </Alert>
          ) : (
            <>
              <Alert tone="success" title={copy.done}>
                <p className="text-sm">
                  {job.report?.migrated ?? 0} contenus · {job.report?.redirectsAdded ?? 0} redirections ·{' '}
                  {job.report?.missing ?? 0} chemins absents de Snapify
                </p>
              </Alert>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-2 font-semibold text-slate-900">{copy.dnsTitle}</h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                  {(job.report?.dnsChecklist || []).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </div>
              {(job.report?.errors?.length || 0) > 0 && (
                <Alert tone="warning" title="Quelques points à revoir">
                  <ul className="text-sm">
                    {job.report!.errors.slice(0, 8).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void downloadReport()}>{copy.report}</Button>
                <Button variant="ghost" onClick={() => void cancel()}>
                  {copy.startOver}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function PreviewCol({
  tone,
  label,
  path,
  title,
  meta,
}: {
  tone: 'before' | 'after';
  label: string;
  path: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5 p-3">
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${tone === 'after' ? 'text-teal-700' : 'text-slate-500'}`}>
        {label}
      </div>
      <p className="truncate font-mono text-[11px] text-slate-500" title={path} dir="auto">
        {path}
      </p>
      <p className="break-words text-sm font-medium leading-snug text-slate-900" dir="auto">
        {title}
      </p>
      <p className="break-words text-xs leading-relaxed text-slate-600" dir="auto">
        {meta}
      </p>
    </div>
  );
}
