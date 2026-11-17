/**
 * Snapify — module Articles IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Switch,
  Textarea,
  errorMessage,
  toast,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import type { Settings } from '../types';

export function GeneratePage({ api, settings, navigate, canConfigure }: AdminPageProps<Settings>) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState(settings.defaultTone || 'pro');
  const [lang, setLang] = useState(settings.defaultLang || 'fr');
  const [words, setWords] = useState('800');
  const [generateImage, setGenerateImage] = useState(settings.generateImages !== false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!topic.trim()) {
      toast.error('Indiquez un sujet.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<{ article: { id: string; title: string } }>('/generate', {
        topic: topic.trim(),
        tone,
        lang,
        words: Number(words) || 800,
        generateImage,
      });
      toast.success(`Brouillon créé : ${r.article.title}`);
      navigate('/m/novalabs.ai-articles/articles', { absolute: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Générer un article"
        description={`Fournisseur actif : ${settings.provider === 'anthropic' ? 'Claude' : settings.provider === 'gemini' ? 'Gemini' : 'ChatGPT'}.`}
      />

      {!settings.apiKey ? (
        <div className="mb-6">
          <Alert tone="warning">
            Aucune clé API configurée. {canConfigure ? 'Ouvrez les réglages du module pour la saisir.' : 'Demandez à un administrateur de configurer la clé.'}
          </Alert>
        </div>
      ) : null}

      <Card className="max-w-2xl space-y-4 p-6">
        <Field label="Sujet de l’article">
          <Textarea
            value={topic}
            rows={3}
            placeholder="Ex. : Comment choisir une pompe à chaleur en Tunisie ?"
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ton">
            <Select
              value={tone}
              onChange={setTone}
              options={[
                { value: 'pro', label: 'Professionnel' },
                { value: 'friendly', label: 'Convivial' },
                { value: 'expert', label: 'Expert' },
              ]}
            />
          </Field>
          <Field label="Langue">
            <Select
              value={lang}
              onChange={setLang}
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'ar', label: 'Arabe' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Field>
          <Field label="Longueur (mots)">
            <Input type="number" min={200} max={3000} value={words} onChange={(e) => setWords(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={generateImage} onChange={setGenerateImage} />
          <span className="text-sm text-slate-700">Générer une image de couverture</span>
        </div>
        <Button icon={Sparkles} loading={busy} onClick={() => void run()}>
          {busy ? 'Génération en cours…' : 'Générer l’article'}
        </Button>
        <p className="text-xs text-slate-500">
          L’article est enregistré en brouillon. Vous pourrez le relire, modifier et publier depuis « Articles ».
        </p>
      </Card>
    </div>
  );
}
