import { useRef, useState, type ChangeEvent } from 'react';
import { Monitor, Smartphone, TriangleAlert, Upload } from 'lucide-react';
import { Button, Field, Input, Modal, Textarea, toast, useConfirm } from '@snapify/sdk/admin';
import { EXTENDED_TAGS, activeTags, findUnknownTags, renderMergeTags, sampleValues } from './mergeTags';
import { parseImportedHtml } from './htmlTools';
import { WysiwygEditor, type WysiwygHandle } from './WysiwygEditor';

export type Draft = { id?: string; subject: string; htmlBody: string };

const FOOTER = `<p style="color:#64748b;font-size:13px">Vous recevez cet e-mail à l’adresse {{email}}.<br><a href="{{desinscription}}">Se désinscrire</a></p>`;

export const TEMPLATES = [
  {
    id: 'newsletter',
    label: 'Newsletter',
    html: `<h1>Titre de la campagne</h1>
<p>Bonjour {{prenom}},</p>
<p>Voici notre actualité du mois.</p>
<h2>Première nouvelle</h2>
<p>Quelques lignes pour présenter le sujet.</p>
<h2>Deuxième nouvelle</h2>
<p>Quelques lignes pour présenter le sujet.</p>
<hr>
${FOOTER}`,
  },
  {
    id: 'annonce',
    label: 'Annonce',
    html: `<h1>Une nouveauté pour vous</h1>
<p>Bonjour {{prenom}},</p>
<p>Nous avons le plaisir de vous annoncer…</p>
<p><a href="https://" style="display:inline-block;padding:12px 24px;background:#00a89d;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">Découvrir</a></p>
<hr>
${FOOTER}`,
  },
  {
    id: 'promo',
    label: 'Promotion',
    html: `<h1>Offre à durée limitée</h1>
<p>Bonjour {{prenom}},</p>
<p>Profitez de <strong>–20 %</strong> jusqu’au …</p>
<ul>
  <li>Avantage n° 1</li>
  <li>Avantage n° 2</li>
</ul>
<p><a href="https://" style="display:inline-block;padding:12px 24px;background:#00a89d;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">J’en profite</a></p>
<hr>
${FOOTER}`,
  },
];

const SUBJECT_MAX = 60;

type Props = {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  saving: boolean;
  testEmail: string;
  setTestEmail: (v: string) => void;
  onSave: () => void;
  onSendTest: () => void;
  onClose: () => void;
};

type Mode = 'edit' | 'code' | 'preview';
type Device = 'desktop' | 'mobile';

const MODES: { id: Mode; label: string }[] = [
  { id: 'edit', label: 'Éditeur' },
  { id: 'code', label: 'Code HTML' },
  { id: 'preview', label: 'Aperçu' },
];

export function CampaignEditor({ draft, onChange, saving, testEmail, setTestEmail, onSave, onSendTest, onClose }: Props) {
  const confirm = useConfirm();
  const initial = useRef(draft);
  const editor = useRef<WysiwygHandle>(null);
  const codeBox = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [note, setNote] = useState<string | null>(null);

  const dirty = draft.subject !== initial.current.subject || draft.htmlBody !== initial.current.htmlBody;
  const unknown = findUnknownTags(draft.htmlBody);
  const subjectLen = draft.subject.length;
  const bodyUntouched = !draft.htmlBody.trim() || TEMPLATES.some((t) => t.html === draft.htmlBody);

  const close = async () => {
    if (dirty && !(await confirm({ title: 'Abandonner les modifications ?', message: 'Les changements non enregistrés seront perdus.', confirmLabel: 'Abandonner', danger: true }))) return;
    onClose();
  };

  /** Insère une variable à l'endroit du curseur (éditeur visuel ou code). */
  const insertTag = (tag: string) => {
    if (mode === 'edit') return editor.current?.insertText(tag);
    const ta = codeBox.current?.querySelector('textarea');
    const body = draft.htmlBody;
    const s = ta?.selectionStart ?? body.length;
    const e = ta?.selectionEnd ?? body.length;
    onChange({ htmlBody: body.slice(0, s) + tag + body.slice(e) });
    requestAnimationFrame(() => {
      const t = codeBox.current?.querySelector('textarea');
      if (!t) return;
      t.focus();
      t.setSelectionRange(s + tag.length, s + tag.length);
    });
  };

  const applyTemplate = async (html: string) => {
    if (!bodyUntouched && !(await confirm({ title: 'Remplacer le contenu ?', message: 'Le contenu actuel sera remplacé par le modèle.', confirmLabel: 'Remplacer' }))) return;
    setNote(null);
    onChange({ htmlBody: html });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 1_500_000) return void toast.error('Fichier trop volumineux (1,5 Mo maximum).');
    if (!bodyUntouched && !(await confirm({ title: 'Remplacer le contenu ?', message: `Le contenu actuel sera remplacé par « ${file.name} ».`, confirmLabel: 'Remplacer' }))) return;
    const { html, title, localImages } = parseImportedHtml(await file.text());
    if (!html) return void toast.error('Ce fichier ne contient aucun contenu.');
    onChange({ htmlBody: html, ...(!draft.subject.trim() && title ? { subject: title } : {}) });
    setNote(
      localImages > 0
        ? `« ${file.name} » importé. ${localImages} image(s) utilisent un chemin local sur votre ordinateur : elles ne s’afficheront pas dans l’e-mail. Remplacez-les par des adresses https://.`
        : `« ${file.name} » importé.`,
    );
    setMode('edit');
  };

  const previewDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0}
body{background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.6;font-size:15px}
.wrap{max-width:600px;margin:0 auto;background:#fff;padding:24px;box-sizing:border-box;min-height:100vh}
img{max-width:100%;height:auto}a{color:#00a89d}h1{font-size:24px;line-height:1.25}h2{font-size:19px}
</style></head><body><div class="wrap">${
    renderMergeTags(draft.htmlBody || '', sampleValues()) || '<p style="color:#94a3b8">Rien à afficher pour le moment.</p>'
  }</div></body></html>`;

  const isMobile = device === 'mobile';

  return (
    <Modal title={draft.id ? 'Modifier la campagne' : 'Nouvelle campagne'} open onClose={() => void close()} size="lg">
      <div className="grid gap-4">
        <div>
          <Field label="Objet">
            <Input
              value={draft.subject}
              placeholder="Ex. Notre actualité de novembre"
              onChange={({ target: { value: v } }) => onChange({ subject: v })}
            />
          </Field>
          <p className={`mt-1 text-xs ${subjectLen > SUBJECT_MAX ? 'text-amber-600' : 'text-slate-500'}`}>
            {subjectLen}/{SUBJECT_MAX} caractères{subjectLen > SUBJECT_MAX ? ' · risque d’être coupé dans la boîte de réception' : ''}
          </p>
        </div>

        {/* ---- Modèles + import ---- */}
        <div className="flex flex-wrap items-center gap-2">
          {!draft.id ? (
            <>
              <span className="text-sm font-medium text-slate-700">Modèle</span>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void applyTemplate(t.html)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand-500 hover:text-brand-700"
                >
                  {t.label}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-slate-200" />
            </>
          ) : null}
          <input ref={fileInput} type="file" accept=".html,.htm,text/html" className="hidden" onChange={(e) => void onFile(e)} />
          <Button variant="ghost" icon={Upload} onClick={() => fileInput.current?.click()}>
            Importer un fichier HTML
          </Button>
        </div>

        {note ? (
          <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
            <p className="flex-1">{note}</p>
            <button type="button" className="text-sky-700 underline" onClick={() => setNote(null)}>
              Fermer
            </button>
          </div>
        ) : null}

        {/* ---- Onglets ---- */}
        <div role="tablist" className="inline-flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={
                'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                (mode === m.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800')
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'edit' ? (
          <WysiwygEditor ref={editor} value={draft.htmlBody} onChange={(html) => onChange({ htmlBody: html })} />
        ) : null}

        {mode === 'code' ? (
          <div ref={codeBox}>
            <Textarea
              rows={18}
              value={draft.htmlBody}
              onChange={({ target: { value: v } }) => onChange({ htmlBody: v })}
              className="font-mono text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Pour les utilisateurs avancés. Les scripts sont retirés dans l’éditeur et dans l’aperçu.</p>
          </div>
        ) : null}

        {mode === 'preview' ? (
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Aperçu avec des valeurs d’exemple</p>
              <div className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
                {([['desktop', Monitor, 'Ordinateur'], ['mobile', Smartphone, 'Mobile']] as const).map(([id, Icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={device === id}
                    onClick={() => setDevice(id)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${device === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <div
                className={
                  'mx-auto overflow-hidden bg-white transition-[width] duration-200 ' +
                  (isMobile ? 'rounded-[28px] border-[8px] border-slate-800 shadow-lg' : 'rounded-lg border border-slate-300 shadow-sm')
                }
                style={{ width: isMobile ? 375 : '100%', maxWidth: isMobile ? 375 : 720 }}
              >
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">Objet :</span>{' '}
                  {draft.subject || <em className="text-slate-400">(vide)</em>}
                </div>
                <iframe
                  key={device}
                  title="Aperçu de la campagne"
                  sandbox=""
                  srcDoc={previewDoc}
                  className="block h-[520px] w-full border-0 bg-white"
                />
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Le pied de page réel (désinscription) est ajouté à l’envoi.
            </p>
          </div>
        ) : null}

        {/* ---- Variables ---- */}
        {mode !== 'preview' ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Variables · insérées à l’emplacement du curseur</p>
            <div className="flex flex-wrap gap-2">
              {activeTags().map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertTag(`{{${key}}}`)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs text-slate-800 hover:bg-slate-100"
                >
                  {`{{${key}}}`}
                </button>
              ))}
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
              {activeTags().map(({ key, label }) => (
                <li key={key}>
                  <code className="font-mono">{`{{${key}}}`}</code> → {label}
                </li>
              ))}
              {EXTENDED_TAGS ? (
                <li>
                  <code className="font-mono">{'{{prenom|cher abonné}}'}</code> → texte de secours si le prénom est vide
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {unknown.length > 0 ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Variable non reconnue, elle apparaîtra telle quelle dans l’e-mail :{' '}
              {unknown.map((u) => (
                <code key={u} className="mr-1 font-mono">{u}</code>
              ))}
            </p>
          </div>
        ) : null}

        {draft.id ? (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Envoyer un test à">
                <Input value={testEmail} placeholder="vous@exemple.tn" onChange={({ target: { value: v } }) => setTestEmail(v)} />
              </Field>
            </div>
            <Button variant="ghost" onClick={onSendTest}>
              Envoyer le test
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Enregistrez la campagne pour pouvoir envoyer un e-mail de test.</p>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => void close()}>
          Annuler
        </Button>
        <Button loading={saving} disabled={!draft.subject.trim()} onClick={onSave}>
          Enregistrer
        </Button>
      </div>
    </Modal>
  );
}
