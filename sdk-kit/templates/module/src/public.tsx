import { useState } from 'react';
import { definePublicModule, matchesPaths, type PublicModuleProps, type WidgetProps } from '@snapify/sdk';
import type { MessageOptions, Settings } from './types';

/** Emplacement `floating` : bannière fixée en bas de l’écran. */
function Banner({ settings, path, isPreview, api }: PublicModuleProps<Settings>) {
  const [closed, setClosed] = useState(false);
  if (closed || isPreview || !settings.enabled) return null;
  if (settings.showOnPages.length && !matchesPaths(settings.showOnPages, path)) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 flex items-center gap-3 rounded-full bg-px-navy py-2 pl-5 pr-2 text-sm text-white shadow-lg">
      <button type="button" className="font-semibold" onClick={() => api.post('/click').catch(() => undefined)}>
        {settings.message}
      </button>
      <button type="button" aria-label="Fermer" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15" onClick={() => setClosed(true)}>
        ×
      </button>
    </div>
  );
}

/** Widget inséré dans une page avec le bloc « Module » de l’éditeur. */
function MessageWidget({ options, navigate }: WidgetProps<Settings, MessageOptions>) {
  return (
    <section className="mx-auto w-[min(100%-2.5rem,48rem)] rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm">
      <h2 className="text-2xl font-bold text-px-navy">{options.title}</h2>
      {options.text ? <p className="mt-3 text-slate-600">{options.text}</p> : null}
      {options.buttonLabel ? (
        <a
          href={options.buttonLink}
          className="mt-6 inline-flex rounded-full bg-px-primary px-6 py-3 font-semibold text-white hover:bg-px-primary-dark"
          onClick={(e) => {
            if (!options.buttonLink.startsWith('/')) return;
            e.preventDefault();
            navigate(options.buttonLink);
          }}
        >
          {options.buttonLabel}
        </a>
      ) : null}
    </section>
  );
}

export default definePublicModule<Settings>({
  slots: { floating: Banner },
  widgets: { message: MessageWidget },
});
