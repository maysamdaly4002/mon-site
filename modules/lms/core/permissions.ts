import { forbidden } from './errors';
import type { Actor, Course, Role } from './types';

export type Permission = 'read' | 'course.write' | 'enroll.manage' | 'learn' | 'users.manage';
const PERMS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>(['read', 'course.write', 'enroll.manage', 'learn', 'users.manage']),
  instructeur: new Set<Permission>(['read', 'course.write', 'enroll.manage', 'learn']), // ses propres cours uniquement (voir canManageCourse)
  apprenant: new Set<Permission>(['read', 'learn']),
  auditeur: new Set<Permission>(['read']), // lecture seule
};
export const can = (a: Actor, p: Permission) => PERMS[a.role]?.has(p) ?? false;
/** Administrateur : tous les cours ; instructeur : seulement les siens. */
export const canManageCourse = (a: Actor, c: Pick<Course, 'instructeurId'>) => a.role === 'admin' || (a.role === 'instructeur' && c.instructeurId === a.id);
/** Voit-il tout (administrateur, auditeur) ? */
export const seesAll = (a: Actor) => a.role === 'admin' || a.role === 'auditeur';

export function authorize(a: Actor, p: Permission) {
  if (!can(a, p)) throw forbidden('Droits insuffisants pour cette action');
}
export function authorizeCourse(a: Actor, p: Permission, c: Pick<Course, 'instructeurId'>) {
  authorize(a, p);
  if (!canManageCourse(a, c)) throw forbidden('Ce cours ne fait pas partie de votre périmètre');
}
