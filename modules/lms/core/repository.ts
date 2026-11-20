import type * as T from './types';

/** Table générique : égalité sur les champs de `where`. Volontairement SANS delete — rien n'est jamais supprimé. */
export interface Table<E extends { id: string }> {
  get(id: string): Promise<E | null>;
  find(where?: Partial<E>): Promise<E[]>;
  insert(data: Omit<E, 'id' | 'createdAt'>): Promise<E>;
  update(id: string, patch: Partial<Omit<E, 'id' | 'createdAt'>>): Promise<E | null>;
}

/** Seule dépendance de stockage du cœur : mémoire (tests), PostgreSQL (livrable relationnel), collections Snapify (CMS). */
export interface LmsRepository {
  users: Table<T.User>;
  courses: Table<T.Course>;
  chapters: Table<T.Chapter>;
  lessons: Table<T.Lesson>;
  quizzes: Table<T.Quiz>;
  questions: Table<T.Question>;
  enrollments: Table<T.Enrollment>;
  progressions: Table<T.Progression>;
  tentatives: Table<T.Tentative>;
  certificats: Table<T.Certificat>;
  /** Atomique quand le stockage le permet (PostgreSQL) ; sinon séquentiel. */
  transaction<R>(fn: (repo: LmsRepository) => Promise<R>): Promise<R>;
}
