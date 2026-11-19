import { forbidden } from './errors';
import type { Actor, Role } from './types';

export type Permission = 'read' | 'etab.create' | 'structure.write' | 'equipement.write' | 'controle.write' | 'nc.write' | 'registre.write' | 'exercice.write' | 'visite.write' | 'plan.write' | 'regles.write' | 'users.manage';
const ALL: Permission[] = ['read', 'etab.create', 'structure.write', 'equipement.write', 'controle.write', 'nc.write', 'registre.write', 'exercice.write', 'visite.write', 'plan.write', 'regles.write', 'users.manage'];
const PERMS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(ALL),
  exploitant: new Set<Permission>(['read', 'structure.write', 'equipement.write', 'controle.write', 'nc.write', 'registre.write', 'exercice.write', 'visite.write', 'plan.write']),
  technicien: new Set<Permission>(['read', 'controle.write', 'registre.write']), // prestataire externe : contrôle + intervention
  auditeur: new Set<Permission>(['read']), // lecture seule
};

export const can = (a: Actor, p: Permission) => PERMS[a.role]?.has(p) ?? false;
export const canAccess = (a: Actor, etablissementId: string) => a.etablissementIds === '*' || a.etablissementIds.includes(etablissementId);

/** Un seul point de contrôle : rôle (que peut-il faire ?) ET périmètre (sur quel établissement ?). */
export function authorize(a: Actor, p: Permission, etablissementId?: string) {
  if (!can(a, p)) throw forbidden('Droits insuffisants pour cette action');
  if (etablissementId !== undefined && !canAccess(a, etablissementId)) throw forbidden('Cet établissement ne fait pas partie de votre périmètre');
}
