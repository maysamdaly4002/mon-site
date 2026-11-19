import type * as T from './types';

/** Table générique : égalité sur les champs de `where`. Volontairement SANS delete — rien n'est jamais supprimé. */
export interface Table<E extends { id: string }> {
  get(id: string): Promise<E | null>;
  find(where?: Partial<E>): Promise<E[]>;
  insert(data: Omit<E, 'id' | 'createdAt'>): Promise<E>;
  update(id: string, patch: Partial<Omit<E, 'id' | 'createdAt'>>): Promise<E | null>;
}

/**
 * Seule dépendance de stockage du cœur. Trois implémentations :
 *  core/memory.ts (tests) · adapters/postgres (livrable relationnel) · adapters/snapify (collections du CMS).
 */
export interface ErpRepository {
  etablissements: Table<T.Etablissement>;
  batiments: Table<T.Batiment>;
  niveaux: Table<T.Niveau>;
  types: Table<T.TypeEquipement>;
  regles: Table<T.RegleChoix>;
  equipements: Table<T.Equipement>;
  controles: Table<T.Controle>;
  nonConformites: Table<T.NonConformite>;
  actions: Table<T.ActionCorrective>;
  exercices: Table<T.Exercice>;
  documents: Table<T.Document>;
  visites: Table<T.Visite>;
  prescriptions: Table<T.Prescription>;
  plans: Table<T.Plan>;
  positions: Table<T.Position>;
  users: Table<T.User>;
  acces: Table<T.Acces>;
  alertes: Table<T.AlerteEnvoyee>;
  /** Registre append-only : aucune méthode update/delete. */
  journal: {
    /** Lit la dernière entrée de l'établissement et insère la suivante de façon atomique (verrou) : pas de fourche possible. */
    append(etablissementId: string, build: (last: T.JournalEntry | null) => T.NewJournalEntry): Promise<T.JournalEntry>;
    list(etablissementId: string): Promise<T.JournalEntry[]>; // ordre croissant de seq
    get(id: string): Promise<T.JournalEntry | null>;
  };
  /** Exécute `fn` de façon atomique quand le stockage le permet (PostgreSQL) ; sinon séquentiellement. */
  transaction<R>(fn: (repo: ErpRepository) => Promise<R>): Promise<R>;
}
