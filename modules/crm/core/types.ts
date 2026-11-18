export const STAGES = ['nouveau', 'qualifie', 'proposition', 'gagne', 'perdu'] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ['nouveau', 'qualifie', 'proposition'];
export const ACTIVITY_TYPES = ['note', 'call', 'email'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Company {
  id: string;
  name: string;
  website: string;
  phone: string;
  address: string;
  createdAt: string;
}
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  companyId: string | null;
  source: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
export interface Deal {
  id: string;
  contactId: string;
  title: string;
  stage: Stage;
  amount: number;
  expectedClose: string | null; // AAAA-MM-JJ
  position: number; // ordre dans la colonne du kanban
  createdAt: string;
}
export interface Activity {
  id: string;
  contactId: string;
  type: ActivityType;
  note: string;
  occurredAt: string;
}
export interface Page<T> {
  items: T[];
  total: number;
}
export interface ContactQuery {
  q?: string;
  companyId?: string;
  source?: string;
  tag?: string;
  page?: number;
  size?: number;
}
export type NewContact = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
export type NewCompany = Omit<Company, 'id' | 'createdAt'>;
export type NewDeal = Omit<Deal, 'id' | 'createdAt'>;
export type NewActivity = Omit<Activity, 'id'>;
