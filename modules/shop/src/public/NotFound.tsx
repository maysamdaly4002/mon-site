/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { PackageSearch } from 'lucide-react';
import { COMMERCE_PATHS } from '@snapify/sdk/commerce';
import { Button, Container, EmptyState } from '@snapify/sdk/ui/commerce';

export function NotFound({ navigate }: { navigate: (p: string) => void }) {
  return (
    <Container className="py-20">
      <EmptyState
        icon={PackageSearch}
        title="Page introuvable"
        text="Ce produit ou cette catégorie n’existe pas ou n’est plus en ligne."
        action={<Button onClick={() => navigate(COMMERCE_PATHS.shop)}>Retour à la boutique</Button>}
      />
    </Container>
  );
}
