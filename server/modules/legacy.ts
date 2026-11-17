/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Modules installés d'office au premier démarrage, avec reprise des réglages de l'époque
 * où WhatsApp et l'assistant IA faisaient partie du cœur du CMS (clés `whatsapp` et `ai`
 * de site_settings, supprimées après migration).
 */
type Legacy = Record<string, unknown> | undefined;

export interface OfficialModule {
  id: string;
  legacyKey: string;
  settings: (legacy: Legacy) => Record<string, unknown>;
  enabled: (legacy: Legacy) => boolean;
}

const pick = (src: Legacy, keys: string[]) => Object.fromEntries(keys.filter((k) => src && k in src).map((k) => [k, src![k]]));

export const OFFICIAL_MODULES: OfficialModule[] = [
  {
    id: 'novalabs.whatsapp',
    legacyKey: 'whatsapp',
    settings: (l) => pick(l, ['number', 'defaultMessage', 'showOnMobile', 'showOnDesktop', 'position']),
    enabled: (l) => l?.enabled !== false,
  },
  {
    id: 'novalabs.ai-chat',
    legacyKey: 'ai',
    settings: (l) => {
      const out: Record<string, unknown> = pick(l, ['model', 'temperature', 'maxMessagesPerSession', 'maxSessionsPerDayPerIp', 'maxTokensPerDayGlobal']);
      const override = typeof l?.systemInstructionOverride === 'string' ? l.systemInstructionOverride.trim() : '';
      if (override) out.systemInstruction = override;
      if (Array.isArray(l?.showOnPages)) out.showOnPages = l.showOnPages;
      return out;
    },
    enabled: (l) => l?.enabled !== false,
  },
];

export const LEGACY_KEYS = OFFICIAL_MODULES.map((m) => m.legacyKey);
