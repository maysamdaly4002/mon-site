import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, Bold, Heading2, Image as ImageIcon, Italic, Link2, List, ListOrdered,
  Minus, MousePointerClick, Pilcrow, Redo2, Underline, Undo2, Unlink,
} from 'lucide-react';
import { escapeHtml, sanitizeHtml } from './htmlTools';

export type WysiwygHandle = { insertText: (text: string) => void };

const EDITOR_CSS = `
html,body{margin:0;background:#f1f5f9}
body{padding:16px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.6;font-size:15px}
#root{max-width:640px;margin:0 auto;background:#fff;padding:24px;min-height:340px;outline:none;border-radius:6px}
#root:empty::before{content:'Écrivez votre message…';color:#94a3b8}
img{max-width:100%;height:auto}a{color:#00a89d}
h1{font-size:24px;line-height:1.25}h2{font-size:19px}
hr{border:0;border-top:1px solid #e2e8f0;margin:20px 0}ul,ol{padding-left:22px}
`;

const shell = (inner: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${EDITOR_CSS}</style></head><body><div id="root" contenteditable="true" spellcheck="true">${inner}</div></body></html>`;

const BUTTON_STYLE =
  'display:inline-block;padding:12px 24px;background:#00a89d;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold';

type Props = { value: string; onChange: (html: string) => void };

/**
 * Éditeur de texte visuel (gras, listes, liens, images…) dans un iframe isolé :
 * les styles d'un e-mail importé ne peuvent pas déborder sur l'administration.
 */
export const WysiwygEditor = forwardRef<WysiwygHandle, Props>(function WysiwygEditor({ value, onChange }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const last = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [srcDoc] = useState(() => shell(sanitizeHtml(value)));
  const [ready, setReady] = useState(false);

  const doc = () => frame.current?.contentDocument ?? null;
  const root = () => doc()?.getElementById('root') ?? null;

  const emit = () => {
    const r = root();
    if (!r) return;
    last.current = r.innerHTML;
    onChangeRef.current(r.innerHTML);
  };

  const handleLoad = () => {
    const d = doc();
    const r = root();
    if (!d || !r) return;
    try {
      d.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* ignoré */
    }
    r.addEventListener('input', emit);
    setReady(true);
  };

  // Contenu modifié depuis l'extérieur (modèle, import, onglet « Code HTML ») → on le recopie dans l'éditeur.
  useEffect(() => {
    if (!ready) return;
    const r = root();
    if (r && value !== last.current) {
      r.innerHTML = sanitizeHtml(value);
      last.current = value;
    }
  }, [value, ready]);

  const run = (cmd: string, arg?: string) => {
    const d = doc();
    if (!d) return;
    frame.current?.contentWindow?.focus();
    d.execCommand(cmd, false, arg);
    emit();
  };

  useImperativeHandle(ref, () => ({ insertText: (text: string) => run('insertText', text) }));

  const addLink = () => {
    const url = window.prompt('Adresse du lien', 'https://');
    if (url && url !== 'https://') run('createLink', url);
  };
  const addButton = () => {
    const label = window.prompt('Texte du bouton', 'Cliquez ici');
    if (!label) return;
    const url = window.prompt('Adresse du bouton', 'https://');
    if (!url) return;
    run('insertHTML', `<a href="${escapeHtml(url)}" style="${BUTTON_STYLE}">${escapeHtml(label)}</a>&nbsp;`);
  };
  const addImage = () => {
    const url = window.prompt('Adresse de l’image (https://…)', 'https://');
    if (url && url !== 'https://') run('insertImage', url);
  };

  const groups = [
    [
      { label: 'Annuler', icon: Undo2, act: () => run('undo') },
      { label: 'Rétablir', icon: Redo2, act: () => run('redo') },
    ],
    [
      { label: 'Gras', icon: Bold, act: () => run('bold') },
      { label: 'Italique', icon: Italic, act: () => run('italic') },
      { label: 'Souligné', icon: Underline, act: () => run('underline') },
    ],
    [
      { label: 'Titre', icon: Heading2, act: () => run('formatBlock', '<h2>') },
      { label: 'Paragraphe', icon: Pilcrow, act: () => run('formatBlock', '<p>') },
      { label: 'Liste à puces', icon: List, act: () => run('insertUnorderedList') },
      { label: 'Liste numérotée', icon: ListOrdered, act: () => run('insertOrderedList') },
    ],
    [
      { label: 'Aligner à gauche', icon: AlignLeft, act: () => run('justifyLeft') },
      { label: 'Centrer', icon: AlignCenter, act: () => run('justifyCenter') },
    ],
    [
      { label: 'Lien', icon: Link2, act: addLink },
      { label: 'Retirer le lien', icon: Unlink, act: () => run('unlink') },
      { label: 'Bouton', icon: MousePointerClick, act: addButton },
      { label: 'Image', icon: ImageIcon, act: addImage },
      { label: 'Séparateur', icon: Minus, act: () => run('insertHorizontalRule') },
    ],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-slate-200 bg-slate-50 p-1">
        {groups.map((g, i) => (
          <div key={i} className="flex items-center gap-0.5 border-r border-slate-200 pr-1 last:border-r-0">
            {g.map(({ label, icon: Icon, act }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={act}
                className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        ))}
      </div>
      <iframe
        ref={frame}
        title="Éditeur de texte"
        srcDoc={srcDoc}
        onLoad={handleLoad}
        className="block h-[440px] w-full border-0 bg-slate-100"
      />
    </div>
  );
});
