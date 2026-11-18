/**
 * Module Campagnes newsletter — partie serveur (POC).
 * Abonnés et campagnes sont stockés dans les collections du module (permission "database").
 * L'envoi passe par l'API HTTPS de Brevo (permissions "env:BREVO_API_KEY" et "net:api.brevo.com").
 */
import { defineServerModule, type ServerContext, type StoredRecord } from '@snapify/sdk';
import type { Campaign, SendRecord, Settings, Subscriber } from './types';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const token = () => `${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`.replace(/-/g, '');
const now = () => new Date().toISOString();

/** Anti-abus : délai minimum avant de renvoyer un e-mail de confirmation au même abonné en attente. */
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
/** Nombre d'échecs d'envoi consécutifs avant de considérer une adresse comme rejetée (bounce). */
const BOUNCE_THRESHOLD = 3;
/**
 * Garde-fou mémoire pour la boucle d'envoi : on charge au plus ce nombre d'enregistrements
 * en une fois. Le module SDK ne documente pas de pagination par curseur pour `find()`, donc
 * on dimensionne dynamiquement la limite sur le vrai total (`count()`) plutôt que sur une
 * valeur fixe — c'est ce qui causait des abonnés oubliés ou des doublons d'envoi au-delà de 500.
 */
const MAX_BATCH_LOOKUP = 20000;

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const subs = ctx.db.collection<Subscriber>('subscribers');
    const campaigns = ctx.db.collection<Campaign>('campaigns');
    const sends = ctx.db.collection<SendRecord>('sends');

    const base = () => (ctx.settings().publicUrl || '').replace(/\/+$/, '');
    const unsubUrl = (s: StoredRecord<Subscriber>) => `${base()}/newsletter/desinscription/?token=${s.unsubToken}`;

    /** Envoi d'un e-mail via Brevo. Lève une erreur si l'API refuse. */
    async function sendMail(to: { email: string; name?: string }, subject: string, html: string, unsub?: string) {
      const apiKey = ctx.env('BREVO_API_KEY');
      if (!apiKey) throw ctx.error(500, 'Clé BREVO_API_KEY absente de l\'environnement du serveur.');
      const s = ctx.settings();
      const res = await ctx.fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: s.senderName, email: s.senderEmail },
          to: [{ email: to.email, ...(to.name ? { name: to.name } : {}) }],
          subject,
          htmlContent: html,
          ...(unsub ? { headers: { 'List-Unsubscribe': `<${unsub}>` } } : {}),
        }),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        throw new Error(`Brevo ${res.status} : ${detail}`);
      }
    }

    function render(c: { subject: string; htmlBody: string }, s: StoredRecord<Subscriber>) {
      const footer = escapeHtml(ctx.settings().footerText || '');
      const link = unsubUrl(s);
      const prenom = escapeHtml(s.firstName || '');
      const email = escapeHtml(s.email || '');
      // Variables : {{prenom}}, {{person}}, {{email}}, {{desinscription}}
      const body = c.htmlBody
        .replace(/\{\{\s*prenom\s*\}\}/gi, prenom)
        .replace(/\{\{\s*person\s*\}\}/gi, prenom)
        .replace(/\{\{\s*email\s*\}\}/gi, email)
        .replace(/\{\{\s*desinscription\s*\}\}/gi, link);
      return `${body}<hr style="border:none;border-top:1px solid #ddd;margin:32px 0 12px"><p style="font-size:12px;color:#777">${footer}<br><a href="${link}">Se désinscrire</a></p>`;
    }

    // ---------- Public : inscription, confirmation, désinscription ----------

    ctx.http.post('/subscribe', async (req) => {
      const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      if (str(b.website, 100)) return { ok: true }; // champ piège anti-robots
      const email = str(b.email, 200).toLowerCase();
      if (!EMAIL.test(email)) throw ctx.error(422, 'Adresse e-mail invalide.');
      const firstName = str(b.firstName, 80);
      let s = await subs.findOne({ email });
      if (s && s.status === 'active') return { ok: true }; // ne révèle rien

      // Anti-abus : si une confirmation a déjà été envoyée récemment, on ne la renvoie pas.
      // Sans ce délai, n'importe qui peut spammer la boîte de quelqu'un en rappelant cette
      // route en boucle avec son adresse.
      if (s && s.status === 'pending' && s.consentAt && Date.now() - new Date(s.consentAt).getTime() < RESEND_COOLDOWN_MS) {
        return { ok: true };
      }

      if (s) {
        s = await subs.update(s.id, {
          status: 'pending',
          firstName: firstName || s.firstName,
          confirmToken: token(),
          consentAt: now(),
          unsubscribedAt: '',
          failCount: 0, // une ré-inscription après désinscription ou bounce repart à zéro
        });
      } else {
        s = await subs.insert({
          email, firstName, status: 'pending', confirmToken: token(), unsubToken: token(),
          source: 'form', consentAt: now(), confirmedAt: '', unsubscribedAt: '', failCount: 0,
        });
      }
      const link = `${base()}/newsletter/confirmer/?token=${s.confirmToken}`;
      const html = `<p>Bonjour${firstName ? ` ${escapeHtml(firstName)}` : ''},</p><p>Confirmez votre inscription à la newsletter en cliquant ici :</p><p><a href="${link}">Confirmer mon inscription</a></p><p style="font-size:12px;color:#777">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`;
      try {
        await sendMail({ email, name: firstName }, ctx.settings().confirmSubject, html);
      } catch (e) {
        ctx.log.error?.(String(e));
        throw ctx.error(502, 'Impossible d\'envoyer l\'e-mail de confirmation pour le moment.');
      }
      return { ok: true };
    });

    ctx.http.post('/confirm', async (req) => {
      const t = str((req.body as Record<string, unknown> | undefined)?.token, 100);
      const s = t ? await subs.findOne({ confirmToken: t }) : null;
      if (!s) throw ctx.error(404, 'Lien de confirmation invalide ou expiré.');
      if (s.status !== 'active') await subs.update(s.id, { status: 'active', confirmedAt: now(), confirmToken: '' });
      return { ok: true };
    });

    ctx.http.post('/unsubscribe', async (req) => {
      const t = str((req.body as Record<string, unknown> | undefined)?.token, 100);
      const s = t ? await subs.findOne({ unsubToken: t }) : null;
      if (!s) throw ctx.error(404, 'Lien de désinscription invalide.');
      if (s.status !== 'unsubscribed') await subs.update(s.id, { status: 'unsubscribed', unsubscribedAt: now() });
      return { ok: true };
    });

    // ---------- Admin : abonnés ----------

    ctx.admin.get('/subscribers', async () => {
      const { items, total } = await subs.find({ orderBy: [{ field: 'email', dir: 'asc' }], limit: 500 });
      return { subscribers: items.map(({ confirmToken, unsubToken, ...rest }) => rest), total };
    });

    ctx.admin.post('/subscribers/import', async (req) => {
      const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const lines = str(b.text, 200000).split(/\r?\n/);
      let added = 0, skipped = 0, invalid = 0;
      for (const line of lines) {
        const m = line.match(/[^\s,;"]+@[^\s,;"]+\.[^\s,;"]{2,}/);
        if (!line.trim()) continue;
        if (!m) { invalid++; continue; }
        const email = m[0].toLowerCase();
        if (await subs.findOne({ email })) { skipped++; continue; }
        await subs.insert({
          email, firstName: '', status: 'active', confirmToken: '', unsubToken: token(),
          source: 'import', consentAt: '', confirmedAt: now(), unsubscribedAt: '', failCount: 0,
        });
        added++;
      }
      return { added, skipped, invalid };
    });

    ctx.admin.delete('/subscribers/:id', async (req) => {
      if (!(await subs.delete(req.params.id))) throw ctx.error(404, 'Abonné introuvable');
      return { ok: true };
    });

    // ---------- Admin : campagnes ----------

    ctx.admin.get('/campaigns', async () => {
      const { items } = await campaigns.find({ orderBy: [{ field: 'createdAt', dir: 'desc' }], limit: 200 });
      const rows = await Promise.all(
        items.map(async (c) => ({
          ...c,
          sent: await sends.count({ where: { campaignId: c.id, status: 'sent' } }),
          failed: await sends.count({ where: { campaignId: c.id, status: 'failed' } }),
        })),
      );
      return { campaigns: rows };
    });

    ctx.admin.post('/campaigns', async (req) => {
      const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const subject = str(b.subject, 200);
      const htmlBody = str(b.htmlBody, 100000);
      if (!subject) throw ctx.error(422, 'L\'objet est obligatoire.');
      if (!htmlBody) throw ctx.error(422, 'Le contenu est obligatoire.');
      return { campaign: await campaigns.insert({ subject, htmlBody, status: 'draft', createdAt: now(), sentAt: '' }) };
    });

    ctx.admin.put('/campaigns/:id', async (req) => {
      const c = await campaigns.get(req.params.id);
      if (!c) throw ctx.error(404, 'Campagne introuvable');
      if (c.status !== 'draft') throw ctx.error(409, 'Une campagne déjà envoyée ne peut plus être modifiée.');
      const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const subject = str(b.subject, 200) || c.subject;
      const htmlBody = str(b.htmlBody, 100000) || c.htmlBody;
      return { campaign: await campaigns.update(c.id, { subject, htmlBody }) };
    });

    ctx.admin.delete('/campaigns/:id', async (req) => {
      if (!(await campaigns.delete(req.params.id))) throw ctx.error(404, 'Campagne introuvable');
      return { ok: true };
    });

    ctx.admin.post('/campaigns/:id/test', async (req) => {
      const c = await campaigns.get(req.params.id);
      if (!c) throw ctx.error(404, 'Campagne introuvable');
      const email = str((req.body as Record<string, unknown> | undefined)?.email, 200).toLowerCase();
      if (!EMAIL.test(email)) throw ctx.error(422, 'Adresse de test invalide.');
      const fake = { id: 'test', email, firstName: 'Test', status: 'active', unsubToken: 'test' } as StoredRecord<Subscriber>;
      try {
        await sendMail({ email }, `[TEST] ${c.subject}`, render(c, fake));
      } catch (e) {
        throw ctx.error(502, String(e instanceof Error ? e.message : e));
      }
      return { ok: true };
    });

    /**
     * Envoie un lot (taille réglable) puis renvoie ce qu'il reste. L'admin rappelle la route
     * jusqu'à 0.
     *
     * Correction du bug de pagination : auparavant les deux requêtes ci-dessous plafonnaient à
     * `limit: 500`. Au-delà de 500 abonnés actifs, certains n'étaient jamais sélectionnés ; au-delà
     * de 500 envois déjà effectués pour cette campagne, les plus anciens disparaissaient de `done`
     * et les abonnés correspondants recevaient la campagne une seconde fois. On lit maintenant le
     * vrai total via `count()` et on l'utilise comme limite (plafonné à MAX_BATCH_LOOKUP pour rester
     * raisonnable en mémoire).
     */
    ctx.admin.post('/campaigns/:id/send', async (req) => {
      const c = await campaigns.get(req.params.id);
      if (!c) throw ctx.error(404, 'Campagne introuvable');
      if (c.status === 'sent') throw ctx.error(409, 'Cette campagne est déjà envoyée.');
      if (c.status === 'draft') await campaigns.update(c.id, { status: 'sending' });

      const [activeTotal, doneTotal] = await Promise.all([
        subs.count({ where: { status: 'active' } }),
        sends.count({ where: { campaignId: c.id } }),
      ]);
      const { items: active } = await subs.find({
        where: { status: 'active' },
        limit: Math.min(MAX_BATCH_LOOKUP, Math.max(1, activeTotal)),
      });
      const { items: done } = await sends.find({
        where: { campaignId: c.id },
        limit: Math.min(MAX_BATCH_LOOKUP, Math.max(1, doneTotal)),
      });
      const doneIds = new Set(done.map((d) => d.subscriberId));
      const todo = active.filter((s) => !doneIds.has(s.id));
      const batch = todo.slice(0, Math.max(1, Math.min(100, Number(ctx.settings().batchSize) || 40)));

      let sent = 0, failed = 0;
      for (let i = 0; i < batch.length; i += 5) {
        await Promise.all(
          batch.slice(i, i + 5).map(async (s) => {
            let rec: Omit<SendRecord, 'at'> = { campaignId: c.id, subscriberId: s.id, status: 'sent', error: '' };
            try {
              await sendMail({ email: s.email, name: s.firstName }, c.subject, render(c, s), unsubUrl(s));
              sent++;
              if (s.failCount) await subs.update(s.id, { failCount: 0 });
            } catch (e) {
              rec = { ...rec, status: 'failed', error: String(e instanceof Error ? e.message : e).slice(0, 300) };
              failed++;
              const failCount = (s.failCount || 0) + 1;
              // Au bout de BOUNCE_THRESHOLD échecs consécutifs, on bascule l'abonné en "bounced" :
              // il sort du filtre status:'active' et ne sera plus jamais réessayé automatiquement.
              await subs.update(s.id, failCount >= BOUNCE_THRESHOLD ? { failCount, status: 'bounced' } : { failCount });
            }
            await sends.insert({ ...rec, at: now() });
          }),
        );
      }
      const remaining = todo.length - batch.length;
      if (remaining <= 0) await campaigns.update(c.id, { status: 'sent', sentAt: now() });
      return { sent, failed, remaining: Math.max(0, remaining) };
    });

    ctx.admin.status(async () => {
      const [active, pending, unsub, bounced, sentCampaigns] = await Promise.all([
        subs.count({ where: { status: 'active' } }),
        subs.count({ where: { status: 'pending' } }),
        subs.count({ where: { status: 'unsubscribed' } }),
        subs.count({ where: { status: 'bounced' } }),
        campaigns.count({ where: { status: 'sent' } }),
      ]);
      const alerts = ctx.env('BREVO_API_KEY') ? [] : [{ level: 'warning', message: 'BREVO_API_KEY manquante : aucun e-mail ne partira.' }];
      return {
        stats: [
          { label: 'Abonnés actifs', value: active },
          { label: 'En attente', value: pending },
          { label: 'Désinscrits', value: unsub },
          { label: 'Adresses en échec (bounce)', value: bounced },
          { label: 'Campagnes envoyées', value: sentCampaigns },
        ],
        alerts,
      };
    });
  },
});
