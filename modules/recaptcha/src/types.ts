/**
 * Snapify — module Google reCAPTCHA
 * © 2026 Hamdi Ayari — hamdi.ayari@novalabs.tn
 */
export interface Settings {
  enabled: boolean;
  version: 'v2' | 'v3';
  siteKey: string;
  secretKey: string;
  v3Action: string;
  v3MinScore: number;
}

export type PublicRecaptcha = {
  siteKey: string;
  version: 'v2' | 'v3';
  action: string;
};
