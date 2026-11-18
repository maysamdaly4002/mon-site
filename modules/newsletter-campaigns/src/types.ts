export interface Settings {
  senderName: string;
  senderEmail: string;
  publicUrl: string;
  batchSize: number;
  confirmSubject: string;
  footerText: string;
}

export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed' | 'bounced';

export interface Subscriber {
  email: string;
  firstName: string;
  status: SubscriberStatus;
  confirmToken: string;
  unsubToken: string;
  source: 'form' | 'import' | 'manual';
  consentAt: string;
  confirmedAt: string;
  unsubscribedAt: string;
  /**
   * Échecs d'envoi consécutifs lors de campagnes. Remis à 0 dès qu'un envoi réussit ;
   * l'abonné passe en statut "bounced" une fois BOUNCE_THRESHOLD atteint (voir server.ts),
   * pour qu'une adresse définitivement invalide ne soit plus jamais réessayée.
   */
  failCount: number;
}

export interface Campaign {
  subject: string;
  htmlBody: string;
  status: 'draft' | 'sending' | 'sent';
  createdAt: string;
  sentAt: string;
}

export interface SendRecord {
  campaignId: string;
  subscriberId: string;
  status: 'sent' | 'failed';
  error: string;
  at: string;
}
