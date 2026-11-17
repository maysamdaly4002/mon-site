/**
 * Snapify — création compte client + e-mail de bienvenue (charte Snapify)
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { platformUsers } from '../db/schema';
import { escapeHtml, renderEmail, sendMail } from '../mail';
import { loadSnapshot } from '../cms/store';
import { createPlatformUser } from './auth';
import { hashPassword } from './passwords';
import type { LicenseOrder } from './licenseOrders';
import type { ClientProfile } from './clients';

function generateClientPassword(): string {
  const raw = crypto.randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
  // Lettre + chiffre obligatoires (règle plateforme)
  return `Sf${raw.slice(0, 8)}7`;
}

export function clientPortalUrl(market: 'tn' | 'fr'): string {
  if (process.env.CLIENT_PUBLIC_URL) return process.env.CLIENT_PUBLIC_URL.replace(/\/$/, '');
  // Pas de sous-domaine : espace client sur le domaine principal
  return market === 'fr' ? 'https://snapify.fr/espace-client' : 'https://snapify.tn/espace-client';
}

async function snapifyMailBrand() {
  const s = await loadSnapshot();
  return {
    ...s,
    branding: {
      ...s.branding,
      siteName: 'Snapify',
      colors: { ...(s.branding.colors || {}), primary: '#00a89d' },
    },
  };
}

/** Crée le compte plateforme si besoin ; renvoie le mot de passe en clair uniquement à la création. */
export async function ensureClientPlatformAccount(order: LicenseOrder): Promise<{
  userId: string;
  email: string;
  password: string | null;
  created: boolean;
}> {
  const email = order.email.trim().toLowerCase();
  const [existing] = await db.select().from(platformUsers).where(eq(platformUsers.email, email)).limit(1);
  if (existing) {
    return { userId: existing.id, email, password: null, created: false };
  }
  const password = generateClientPassword();
  try {
    const user = await createPlatformUser({
      email,
      password,
      displayName: order.name.slice(0, 80) || email.split('@')[0],
    });
    return { userId: user.id, email, password, created: true };
  } catch (e: unknown) {
    // Course : compte créé entre-temps
    const [again] = await db.select().from(platformUsers).where(eq(platformUsers.email, email)).limit(1);
    if (again) return { userId: again.id, email, password: null, created: false };
    throw e;
  }
}

export async function sendClientWelcomeEmail(opts: {
  name: string;
  email: string;
  password: string | null;
  domain: string;
  market: 'tn' | 'fr';
  created: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  const portal = clientPortalUrl(opts.market);
  const brand = await snapifyMailBrand();
  const first = opts.name.trim().split(/\s+/)[0] || 'bonjour';

  const credHtml = opts.created && opts.password
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px">
<tr><td style="padding:16px 18px">
<p style="margin:0 0 8px;font-size:13px;color:#0f766e;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Vos identifiants</p>
<p style="margin:0 0 6px;font-size:15px;color:#0f172a"><strong>E-mail :</strong> ${escapeHtml(opts.email)}</p>
<p style="margin:0;font-size:15px;color:#0f172a"><strong>Mot de passe :</strong> <code style="font-size:15px;background:#fff;padding:4px 8px;border-radius:6px;border:1px solid #ccfbf1">${escapeHtml(opts.password)}</code></p>
</td></tr></table>`
    : `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">Connectez-vous avec votre e-mail <strong>${escapeHtml(opts.email)}</strong> et le mot de passe de votre compte Snapify existant.</p>`;

  const { html, text } = renderEmail(brand, {
    title: opts.created ? 'Bienvenue sur Snapify' : 'Votre demande Snapify est enregistrée',
    intro: `Bonjour ${first}, merci pour votre demande concernant ${opts.domain}. Votre espace client est prêt : suivez l’avancement du projet, les paiements, les factures et le support.`,
    lines: opts.created
      ? [
          'Conservez cet e-mail : il contient vos identifiants de connexion.',
          'Vous pourrez changer le mot de passe depuis Mon profil une fois connecté(e).',
        ]
      : ['Votre demande a été ajoutée à votre espace client existant.'],
    html: credHtml,
    button: { label: 'Accéder à mon espace client', url: portal },
    outro: 'Besoin d’aide ? Répondez à cet e-mail ou ouvrez un ticket depuis l’espace client. — L’équipe Snapify · NOVALABS',
  });

  const subject = opts.created
    ? `Bienvenue sur Snapify — vos accès (${opts.domain})`
    : `Snapify — demande enregistrée (${opts.domain})`;

  return sendMail({ to: opts.email, subject, html, text, kind: 'invite' });
}

/**
 * Après création / màj fiche : provisionne le compte + envoie le mail de bienvenue
 * (mot de passe en clair uniquement si le compte vient d’être créé).
 */
export async function provisionClientAndWelcome(
  profile: ClientProfile,
  order: LicenseOrder,
  opts: { market?: 'tn' | 'fr'; forceWelcome?: boolean } = {}
): Promise<{ mailed: boolean; createdAccount: boolean }> {
  const market = opts.market || profile.market || 'tn';
  const account = await ensureClientPlatformAccount(order);

  // Lier la fiche si besoin
  if (profile.platformUserId !== account.userId) {
    const { clientProfiles } = await import('../db/schema');
    await db
      .update(clientProfiles)
      .set({ platformUserId: account.userId, updatedAt: new Date() })
      .where(eq(clientProfiles.id, profile.id));
  }

  // Éviter le spam : mail avec MDP seulement à la création ; sinon ack une fois par « première » demande
  const shouldMail = account.created || opts.forceWelcome || (profile.licenseOrderIds?.length || 0) <= 1;
  if (!shouldMail) return { mailed: false, createdAccount: account.created };

  // Si compte existant et déjà plus d’une demande, pas de re-mail sauf force
  if (!account.created && (profile.licenseOrderIds?.length || 0) > 1 && !opts.forceWelcome) {
    return { mailed: false, createdAccount: false };
  }

  const result = await sendClientWelcomeEmail({
    name: order.name || profile.name,
    email: account.email,
    password: account.password,
    domain: order.domain || profile.domain,
    market,
    created: account.created,
  });

  return { mailed: result.sent, createdAccount: account.created };
}

/** Utilisé si on doit régénérer un MDP (superadmin relance) — non exposé public. */
export async function resetClientPasswordAndMail(email: string, market: 'tn' | 'fr' = 'tn') {
  const e = email.trim().toLowerCase();
  const [user] = await db.select().from(platformUsers).where(eq(platformUsers.email, e)).limit(1);
  if (!user) throw new Error('Compte introuvable');
  const password = generateClientPassword();
  const { hash, salt } = hashPassword(password);
  await db.update(platformUsers).set({ passwordHash: hash, salt, updatedAt: new Date() }).where(eq(platformUsers.id, user.id));
  return sendClientWelcomeEmail({
    name: user.displayName,
    email: e,
    password,
    domain: 'votre projet',
    market,
    created: true,
  });
}
