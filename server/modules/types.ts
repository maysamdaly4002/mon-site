/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/** Données échangées entre le gestionnaire de modules et l'administration. */
import type { AdminPageDefinition, ModuleManifest, ModuleSlot, ModuleStatusReport, PackageKind, SettingField, WidgetDefinition } from '../../sdk/index';

/** Module actif tel que transmis au site public (réglages publics uniquement). */
export interface PublicModuleDescriptor {
  id: string;
  version: string;
  slots: ModuleSlot[];
  /** Adresses affichées par le composant `page` du module. */
  routes: string[];
  /** Identifiants des widgets du bloc « Module ». */
  widgets: string[];
  script: string;
  style?: string;
  settings: Record<string, unknown>;
}

/** Thème appliqué au site (ou prévisualisé dans l'administration). */
export interface PublicThemeDescriptor {
  id: string;
  version: string;
  script: string;
  style?: string;
  settings: Record<string, unknown>;
}

export type ModuleStatusCode =
  | 'active'
  | 'disabled'
  | 'unsigned'
  | 'incompatible'
  | 'tampered'
  | 'license_missing'
  | 'license_invalid'
  | 'license_expired'
  | 'license_domain'
  | 'dependency'
  | 'error';

export type LicenseState = 'valid' | 'missing' | 'invalid' | 'expired' | 'domain' | 'dev';

export interface ModuleLicenseInfo {
  state: LicenseState;
  message: string;
  licenseId?: string;
  licensee?: string;
  plan?: string;
  domains?: string[];
  expiresAt?: string | null;
}

export interface ModuleSignatureInfo {
  valid: boolean;
  kid?: string;
  /** Module non signé accepté parce que le mode développeur est actif. */
  devUnsigned: boolean;
}

export type ModuleSummary = Pick<
  ModuleManifest,
  'id' | 'name' | 'version' | 'description' | 'author' | 'pricing' | 'category' | 'icon' | 'permissions' | 'slots'
>;

export interface InstalledModuleInfo extends ModuleSummary {
  kind: PackageKind;
  enabled: boolean;
  source: 'marketplace' | 'upload';
  installedAt: string;
  updatedAt: string;
  status: { code: ModuleStatusCode; message: string };
  signature: ModuleSignatureInfo;
  license: ModuleLicenseInfo;
  hasSettings: boolean;
  hasServer: boolean;
  routes: string[];
  widgets: WidgetDefinition[];
  adminPages: AdminPageDefinition[];
  requires: Record<string, string>;
  /** Bundle des pages d'administration, si le module est actif. */
  admin: { script: string; style?: string } | null;
}

export interface InstalledModuleDetail extends InstalledModuleInfo {
  settingsSchema: SettingField[];
  settings: Record<string, unknown>;
  report: ModuleStatusReport | null;
}

export interface InstalledThemeInfo extends InstalledModuleInfo {
  active: boolean;
  screenshot?: string;
}

export interface InstalledThemeDetail extends InstalledThemeInfo {
  settingsSchema: SettingField[];
  settings: Record<string, unknown>;
  /** Fichiers du thème pour l'aperçu, si ses vérifications sont satisfaites. */
  descriptor: PublicThemeDescriptor | null;
}

export interface CatalogEntry extends ModuleSummary {
  kind?: PackageKind;
  /** Chemin relatif au catalogue ; résolu en URL dans la liste renvoyée à l'administration. */
  screenshot?: string;
  /** Captures supplémentaires (chemins relatifs), résolues en URL côté listing. */
  gallery?: string[];
  /** Prix en millimes pour les modules `paid` (ex. 49000 = 49 DT). */
  priceMillimes?: number;
  engines: { snapify: string };
  package: string;
  sha256: string;
  size: number;
  signed: boolean;
}

export interface MarketplaceListing {
  source: 'local' | 'remote';
  url?: string;
  error?: string;
  devMode: boolean;
  modules: (CatalogEntry & {
    installedVersion: string | null;
    updateAvailable: boolean;
    compatible: boolean;
    priceLabel?: string;
    purchased?: boolean;
  })[];
}

/** Paquet vérifié en attente de confirmation par l'administrateur. */
export interface StagedPackageInfo {
  token: string;
  manifest: ModuleSummary & { kind: PackageKind; engines: { snapify: string }; hasServer: boolean; settingsCount: number; screenshot?: string };
  signature: ModuleSignatureInfo;
  license: ModuleLicenseInfo;
  compatible: boolean;
  installedVersion: string | null;
  /** `install`, `update`, `reinstall` ou `downgrade`. */
  action: 'install' | 'update' | 'reinstall' | 'downgrade';
  blockers: string[];
}
