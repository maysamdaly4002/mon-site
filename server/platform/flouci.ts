/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import crypto from 'crypto';
import { getFlouciCredentials } from './settings';
import { HttpError } from '../http';
import { safeEqualStr } from '../security/secrets';

const FLOUCI_API = 'https://developers.flouci.com/api/v2';

export type GeneratePaymentInput = {
  amountMillimes: number;
  trackingId: string;
  successLink: string;
  failLink: string;
  webhook: string;
};

export type GeneratePaymentResult = {
  paymentId: string;
  link: string;
  raw: unknown;
};

function flouciMockAllowed() {
  return process.env.FLOUCI_MOCK === 'true' && process.env.NODE_ENV !== 'production';
}

export async function generatePayment(input: GeneratePaymentInput): Promise<GeneratePaymentResult> {
  // Mode développement sans clés réelles : lien simulé (interdit en production)
  if (flouciMockAllowed()) {
    const paymentId = `mock_${input.trackingId}`;
    return {
      paymentId,
      link: `${input.successLink}${input.successLink.includes('?') ? '&' : '?'}payment_id=${paymentId}&mock=1`,
      raw: { mock: true },
    };
  }
  if (process.env.FLOUCI_MOCK === 'true' && process.env.NODE_ENV === 'production') {
    throw new HttpError(503, 'FLOUCI_MOCK interdit en production.');
  }

  const creds = await getFlouciCredentials();
  if (!creds) throw new HttpError(503, 'Paiement Flouci non configuré (clés manquantes).');

  if (creds.publicKey === 'mock') {
    const paymentId = `mock_${input.trackingId}`;
    return {
      paymentId,
      link: `${input.successLink}${input.successLink.includes('?') ? '&' : '?'}payment_id=${paymentId}&mock=1`,
      raw: { mock: true },
    };
  }

  const res = await fetch(`${FLOUCI_API}/generate_payment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.publicKey}:${creds.privateKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(input.amountMillimes),
      developer_tracking_id: input.trackingId,
      accept_card: true,
      success_link: input.successLink,
      fail_link: input.failLink,
      webhook: input.webhook,
      webhook_version: 2,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof raw.message === 'string' ? raw.message : `Flouci HTTP ${res.status}`;
    throw new HttpError(502, msg);
  }

  const result = (raw.result || raw) as Record<string, unknown>;
  const paymentId = String(result.payment_id || result.id || '');
  const link = String(result.link || result.payment_url || result.redirect_url || '');
  if (!paymentId || !link) throw new HttpError(502, 'Réponse Flouci invalide');
  return { paymentId, link, raw };
}

/** Vérifie la signature webhook Flouci (HMAC SHA256 du corps brut). */
export function verifyFlouciSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.FLOUCI_WEBHOOK_SECRET || '';
  if (!secret) {
    // Sans secret : accepter uniquement en mock hors production
    return flouciMockAllowed();
  }
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualStr(signature.replace(/^sha256=/i, ''), expected) || safeEqualStr(signature, expected);
}

export { flouciMockAllowed };

export type FlouciWebhookEvent = {
  type: 'payment.succeeded' | 'payment.failed' | string;
  payment_id?: string;
  developer_tracking_id?: string;
  success?: boolean;
  [key: string]: unknown;
};

export function parseFlouciWebhook(body: unknown): FlouciWebhookEvent {
  const b = body as Record<string, unknown>;
  const event = (b.event || b) as Record<string, unknown>;
  const type = String(event.type || (event.success === true || event.success === 'True' ? 'payment.succeeded' : 'payment.failed'));
  return {
    type,
    payment_id: event.payment_id ? String(event.payment_id) : b.payment_id ? String(b.payment_id) : undefined,
    developer_tracking_id: event.developer_tracking_id
      ? String(event.developer_tracking_id)
      : b.developer_tracking_id
        ? String(b.developer_tracking_id)
        : undefined,
    success: type === 'payment.succeeded' || event.success === true || event.success === 'True',
    ...event,
  };
}
