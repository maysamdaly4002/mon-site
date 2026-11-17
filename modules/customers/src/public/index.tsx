/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect } from 'react';
import { Heart, UserRound } from 'lucide-react';
import { definePublicModule, type PublicModuleProps, type PublicPageProps } from '@snapify/sdk';
import { COMMERCE_PATHS, getShared, useWishlist } from '@snapify/sdk/commerce';
import { Button, Container, Link, Spinner } from '@snapify/sdk/ui/commerce';
import { AddressesPage, OrderPage, OrdersPage, OverviewPage, ProfilePage, WishlistPage } from './AccountPages';
import { ForgotPage, LoginPage, RegisterPage, ResetPage, safeNext } from './AuthPages';
import { CustomerAvatar } from './Avatar';
import { api, loadMe, useMe } from './session';
import type { Settings } from '../types';

/* ------------------------------------------------------------------ */
/* Favoris : enregistrés dans le compte quand le client est connecté    */
/* ------------------------------------------------------------------ */

let syncInstalled = false;
function installWishlistSync() {
  if (syncInstalled) return;
  syncInstalled = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = '';
  window.addEventListener('snapify:wishlist-changed', (e) => {
    const ids = ((e as CustomEvent<string[]>).detail ?? []).slice();
    clearTimeout(timer);
    timer = setTimeout(() => {
      const key = ids.join(',');
      if (!getShared('customer') || key === last) return;
      last = key;
      void api.post('/wishlist', { ids }).catch(() => {
        last = '';
      });
    }, 600);
  });
}

/* ------------------------------------------------------------------ */
/* Icônes de l'en-tête                                                 */
/* ------------------------------------------------------------------ */

const ICON_BTN = 'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-current transition hover:bg-black/5';

function AccountSlot({ navigate }: PublicModuleProps<Settings>) {
  const me = useMe();
  const ids = useWishlist();
  useEffect(() => {
    installWishlistSync();
    void loadMe();
  }, []);
  return (
    <div className="flex items-center">
      <Link to={COMMERCE_PATHS.accountSection('favoris')} navigate={navigate} aria-label={`Favoris${ids.length ? ` (${ids.length})` : ''}`} className={`${ICON_BTN} hidden sm:inline-flex`}>
        <Heart className="h-[21px] w-[21px]" strokeWidth={1.8} />
        {ids.length ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-px-primary ring-2 ring-white" /> : null}
      </Link>
      <Link to={me ? COMMERCE_PATHS.account : COMMERCE_PATHS.login} navigate={navigate} aria-label={me ? `Mon compte (${me.firstName})` : 'Se connecter'} title={me ? `${me.firstName} ${me.lastName}` : 'Se connecter'} className={ICON_BTN}>
        {me ? (
          <CustomerAvatar person={me} className="h-8 w-8 text-[12px] tracking-wide" />
        ) : (
          <UserRound className="h-[22px] w-[22px]" strokeWidth={1.8} />
        )}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pages /compte/…                                                     */
/* ------------------------------------------------------------------ */

const PUBLIC_PAGES = new Set(['connexion', 'inscription', 'mot-de-passe-oublie', 'reinitialiser']);

function Redirect({ to, navigate }: { to: string; navigate: (p: string) => void }) {
  useEffect(() => navigate(to), [to, navigate]);
  return <Loading />;
}

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

function NotFound({ navigate }: { navigate: (p: string) => void }) {
  return (
    <Container className="py-24 text-center">
      <p className="font-heading text-2xl font-semibold text-px-navy">Page introuvable</p>
      <Button className="mt-6" onClick={() => navigate(COMMERCE_PATHS.account)}>
        Mon compte
      </Button>
    </Container>
  );
}

function AccountRouter(props: PublicPageProps<Settings>) {
  const me = useMe();
  useEffect(() => {
    installWishlistSync();
    void loadMe();
  }, []);

  const parts = props.path.replace(/^\/compte\/?/, '').split('/').filter(Boolean);
  const section = parts[0] ?? '';

  if (me === undefined) return <Loading />;

  if (PUBLIC_PAGES.has(section)) {
    if (me && section !== 'reinitialiser') return <Redirect to={safeNext(props.search)} navigate={props.navigate} />;
    if (section === 'connexion') return <LoginPage {...props} />;
    if (section === 'inscription') return <RegisterPage {...props} />;
    if (section === 'mot-de-passe-oublie') return <ForgotPage {...props} />;
    return <ResetPage {...props} />;
  }

  if (section === 'favoris' && parts.length === 1) return <WishlistPage {...props} me={me} />;

  if (!me) return <Redirect to={`${COMMERCE_PATHS.login}?suite=${encodeURIComponent(props.path + props.search)}`} navigate={props.navigate} />;

  if (!section) return <OverviewPage {...props} me={me} />;
  if (section === 'commandes' && parts.length === 1) return <OrdersPage {...props} me={me} />;
  if (section === 'commandes' && parts.length === 2) return <OrderPage {...props} me={me} number={decodeURIComponent(parts[1])} />;
  if (section === 'adresses' && parts.length === 1) return <AddressesPage {...props} me={me} />;
  if (section === 'profil' && parts.length === 1) return <ProfilePage {...props} me={me} />;
  return <NotFound navigate={props.navigate} />;
}

export default definePublicModule<Settings>({
  slots: { 'header-actions': AccountSlot },
  page: AccountRouter,
});
