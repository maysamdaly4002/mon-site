export const CATEGORIES = ['1', '2', '3', '4', '5'] as const; // catégories ERP (1re à 5e)
export const EQUIPEMENT_STATUTS = ['en_service', 'hors_service', 'a_remplacer'] as const;
export const RESULTATS = ['conforme', 'non_conforme'] as const;
export const NC_STATUTS = ['ouverte', 'en_cours', 'levee'] as const;
export const ACTION_STATUTS = ['a_faire', 'en_cours', 'terminee'] as const;
export const ROLES = ['admin', 'exploitant', 'technicien', 'auditeur'] as const;
export const JOURNAL_TYPES = ['controle', 'non_conformite', 'action', 'levee', 'exercice', 'intervention', 'correction', 'visite', 'prescription'] as const;
export const AVIS = ['favorable', 'defavorable'] as const;
export const PRESCRIPTION_STATUTS = ['a_faire', 'en_cours', 'levee'] as const;
export const EXERCICE_TYPES = ['evacuation', 'formation'] as const;

export type Categorie = (typeof CATEGORIES)[number];
export type EquipementStatut = (typeof EQUIPEMENT_STATUTS)[number];
export type Resultat = (typeof RESULTATS)[number];
export type NcStatut = (typeof NC_STATUTS)[number];
export type ActionStatut = (typeof ACTION_STATUTS)[number];
export type Role = (typeof ROLES)[number];
export type JournalType = (typeof JOURNAL_TYPES)[number];
export type Avis = (typeof AVIS)[number];
export type PrescriptionStatut = (typeof PRESCRIPTION_STATUTS)[number];
export type ExerciceType = (typeof EXERCICE_TYPES)[number];

type Dated = { createdAt: string };
export interface Etablissement extends Dated { id: string; nom: string; adresse: string; typeActivite: string; categorie: Categorie; effectifMax: number; emailAlertes: string }
export interface Batiment extends Dated { id: string; etablissementId: string; nom: string }
export interface Niveau extends Dated { id: string; batimentId: string; etablissementId: string; nom: string; ordre: number }
export interface TypeEquipement extends Dated { id: string; code: string; libelle: string; periodiciteDefautMois: number }
/** Règle de périodicité : `categorie` = null → valable pour toutes les catégories (la règle spécifique l'emporte). */
export interface RegleChoix extends Dated { id: string; typeEquipementId: string; categorie: Categorie | null; periodiciteMois: number }
export interface Equipement extends Dated {
  id: string; etablissementId: string; niveauId: string | null; typeId: string; libelle: string; emplacement: string;
  dateMiseEnService: string; qrCode: string; statut: EquipementStatut;
  dernierControle: string | null; prochaineEcheance: string;
}
export interface Controle extends Dated { id: string; equipementId: string; etablissementId: string; date: string; resultat: Resultat; observations: string; documentId: string | null; controleur: string; auteurId: string }
export interface NonConformite extends Dated { id: string; controleId: string; equipementId: string; etablissementId: string; description: string; statut: NcStatut; leveeAt: string | null; leveeNote: string }
export interface ActionCorrective extends Dated { id: string; nonConformiteId: string; etablissementId: string; description: string; responsable: string; echeance: string; statut: ActionStatut }
export interface Exercice extends Dated { id: string; etablissementId: string; type: ExerciceType; date: string; participants: number; dureeMin: number; observations: string; recyclageMois: number | null; prochainRecyclage: string | null }
export interface Document extends Dated { id: string; etablissementId: string; nom: string; mime: string; taille: number; sha256: string; contenu: string /* base64 */ }
export interface User extends Dated { id: string; email: string; nom: string; role: Role; passwordHash: string }
/** Visite de la commission de sécurité et suivi de ses prescriptions (bonus). */
export interface Visite extends Dated { id: string; etablissementId: string; date: string; avis: Avis; president: string; observations: string; prochaineVisite: string | null }
export interface Prescription extends Dated { id: string; visiteId: string; etablissementId: string; description: string; responsable: string; echeance: string; statut: PrescriptionStatut; leveeAt: string | null }
/** Plan d'étage : une image par niveau (le fichier est un Document) ; les équipements y sont placés en pourcentages (0-100), x/y = null → non placé. */
export interface Plan extends Dated { id: string; etablissementId: string; niveauId: string; nom: string; documentId: string }
export interface Position extends Dated { id: string; planId: string; equipementId: string; etablissementId: string; x: number | null; y: number | null }
export interface Acces extends Dated { id: string; userId: string; etablissementId: string }
export interface AlerteEnvoyee extends Dated { id: string; cle: string }

/** Entrée du registre de sécurité : chaînée par hash, jamais modifiée ni supprimée. */
export interface JournalEntry {
  id: string; etablissementId: string; seq: number; type: JournalType; occurredAt: string; auteur: string;
  payload: Record<string, unknown>; corrigeId: string | null; prevHash: string; hash: string; createdAt: string;
}
export type NewJournalEntry = Omit<JournalEntry, 'id' | 'createdAt'>;

export interface Actor { id: string; nom: string; role: Role; etablissementIds: string[] | '*' }
export interface Page<T> { items: T[]; total: number }
