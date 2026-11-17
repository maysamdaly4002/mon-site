/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

interface Person {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

/** Photo du client, ou ses initiales sur fond foncé ; `className` fixe la taille et la police. */
export function CustomerAvatar({ person, className = 'h-10 w-10 text-sm' }: { person: Person; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [person.avatarUrl]);
  if (person.avatarUrl && !broken) {
    return <img src={person.avatarUrl} alt="" onError={() => setBroken(true)} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  const initials = `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase();
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-px-navy font-heading font-semibold text-white ${className}`}>
      {initials || <UserRound className="h-1/2 w-1/2" />}
    </span>
  );
}
