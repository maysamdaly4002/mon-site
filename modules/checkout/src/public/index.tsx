/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { definePublicModule, type PublicPageProps } from '@snapify/sdk';
import { CheckoutPage } from './CheckoutPage';
import { ConfirmationPage, TrackPage } from './OrderPages';
import type { Settings } from '../types';

function Router(props: PublicPageProps<Settings>) {
  switch (props.path) {
    case '/commande/merci/':
      return <ConfirmationPage {...props} />;
    case '/commande/suivi/':
      return <TrackPage {...props} />;
    default:
      return <CheckoutPage {...props} />;
  }
}

export default definePublicModule<Settings>({ page: Router });
