import type { Activity, Company, Contact, ContactQuery, Deal, NewActivity, NewCompany, NewContact, NewDeal, Page, Stage } from './types';

/**
 * Seule dépendance de stockage du cœur métier. Deux implémentations :
 *  - adapters/postgres  : schéma relationnel + migrations (livrable de l'épreuve)
 *  - adapters/snapify   : collections ctx.db.collection() du CMS
 * (+ core/memory.ts pour les tests.)
 */
export interface CrmRepository {
  contacts: {
    list(q: Required<Pick<ContactQuery, 'page' | 'size'>> & ContactQuery): Promise<Page<Contact>>;
    get(id: string): Promise<Contact | null>;
    findByEmail(email: string): Promise<Contact | null>;
    insert(c: NewContact): Promise<Contact>;
    update(id: string, patch: Partial<NewContact>): Promise<Contact | null>;
    /** Supprime aussi les affaires et l'historique du contact. */
    remove(id: string): Promise<boolean>;
    countBySource(): Promise<Record<string, number>>;
  };
  companies: {
    list(q: { q?: string; page: number; size: number }): Promise<Page<Company>>;
    get(id: string): Promise<Company | null>;
    insert(c: NewCompany): Promise<Company>;
    update(id: string, patch: Partial<NewCompany>): Promise<Company | null>;
    /** Détache les contacts (company_id = null), ne les supprime pas. */
    remove(id: string): Promise<boolean>;
  };
  deals: {
    list(f: { contactId?: string; stage?: Stage }): Promise<Deal[]>; // trié par position puis date
    get(id: string): Promise<Deal | null>;
    insert(d: NewDeal): Promise<Deal>;
    update(id: string, patch: Partial<NewDeal>): Promise<Deal | null>;
    remove(id: string): Promise<boolean>;
  };
  activities: {
    listByContact(contactId: string): Promise<Activity[]>; // plus récentes d'abord
    insert(a: NewActivity): Promise<Activity>;
  };
  tags: { list(): Promise<string[]> };
}
