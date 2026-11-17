/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { defineServerModule, type ModuleCookie, type ModuleRequest, type ServerContext, type StoredRecord } from '@snapify/sdk';
import { isEmail, isPhone, MODULE_IDS, validateAddress, type CheckoutServices, type CustomerIdentity, type CustomerServices, type SavedAddress } from '@snapify/sdk/commerce';
import type { Customer, Me, Session, Settings } from './types';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = 'sm_customer';
const MIN_PASSWORD = 8;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_ADDRESSES = 10;
const AVATAR_MAX_BYTES = 512 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 8;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const body = (req: ModuleRequest) => (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {});
const normEmail = (v: unknown) => str(v, 254).toLowerCase();

async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(key, expected);
}

/** Mot de passe factice : une connexion sur un e-mail inconnu prend autant de temps qu'une vraie. */
let dummyHash: Promise<string> | null = null;

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const customers = ctx.db.collection<Customer>('customers');
    const sessions = ctx.db.collection<Session>('sessions');
    const s = () => ctx.settings();
    const checkout = () => ctx.use<CheckoutServices>(MODULE_IDS.checkout);
    const failures = new Map<string, { n: number; until: number }>();
    dummyHash ??= hashPassword(randomBytes(12).toString('hex'));

    const toMe = (c: StoredRecord<Customer>): Me => ({
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      avatarUrl: c.avatarUrl ?? '',
      addresses: c.addresses,
      wishlist: c.wishlist,
      createdAt: c.createdAt,
    });

    async function current(cookies: Record<string, string>): Promise<StoredRecord<Customer> | null> {
      const token = cookies[COOKIE];
      if (!token || token.length > 100) return null;
      const session = await sessions.get(sha256(token));
      if (!session || session.expiresAt < new Date().toISOString()) return null;
      const c = await customers.get(session.customerId);
      return c && c.status === 'active' ? c : null;
    }

    const requireCustomer = async (req: ModuleRequest) => {
      const c = await current(req.cookies);
      if (!c) throw ctx.error(401, 'Votre session a expiré : reconnectez-vous.');
      return c;
    };

    async function openSession(c: StoredRecord<Customer>, req: ModuleRequest, remember: boolean): Promise<ModuleCookie> {
      const token = randomBytes(32).toString('base64url');
      const days = remember ? s().sessionDays : 1;
      await sessions.insert({ customerId: c.id, expiresAt: new Date(Date.now() + days * 86400_000).toISOString(), ip: req.ip, userAgent: req.userAgent.slice(0, 200) }, { id: sha256(token) });
      await customers.update(c.id, { lastLoginAt: new Date().toISOString() });
      return { name: COOKIE, value: token, ...(remember ? { maxAgeSec: days * 86400 } : {}) };
    }

    async function closeSessions(customerId: string) {
      for (;;) {
        const { items } = await sessions.find({ where: { customerId }, limit: 200 });
        if (!items.length) return;
        for (const x of items) await sessions.delete(x.id);
      }
    }

    const mergeWishlist = (a: string[], b: unknown) => [...new Set([...a, ...(Array.isArray(b) ? b.filter((x): x is string => typeof x === 'string' && x.length <= 64) : [])])].slice(0, 200);

    function checkPassword(pw: string) {
      if (pw.length < MIN_PASSWORD) throw ctx.error(422, `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
      if (pw.length > 200) throw ctx.error(422, 'Mot de passe trop long.');
    }

    const siteUrl = () => (ctx.site().publicUrl || '').replace(/\/+$/, '');

    async function sendReset(c: StoredRecord<Customer>) {
      const token = randomBytes(32).toString('base64url');
      await customers.update(c.id, { resetHash: sha256(token), resetExpires: new Date(Date.now() + RESET_TTL_MS).toISOString() });
      const url = `${siteUrl()}/compte/reinitialiser/?t=${token}`;
      const mail = ctx.mail.render({
        title: 'Réinitialisation de votre mot de passe',
        intro: `Bonjour ${c.firstName}, vous avez demandé à choisir un nouveau mot de passe pour votre compte client.`,
        button: { label: 'Choisir un nouveau mot de passe', url },
        outro: 'Ce lien est valable une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail.',
      });
      return ctx.mail.send({ to: c.email, subject: `${ctx.site().name} — nouveau mot de passe`, ...mail });
    }

    const services: CustomerServices = {
      current: async (cookies): Promise<CustomerIdentity | null> => {
        const c = await current(cookies);
        return c ? { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, addresses: c.addresses } : null;
      },
    };
    ctx.provide(services);

    const timer = setInterval(() => {
      void sessions.find({ filters: [{ field: 'expiresAt', op: 'lt', value: new Date().toISOString() }], limit: 500 }).then(({ items }) => Promise.all(items.map((x) => sessions.delete(x.id)))).catch(() => undefined);
      const now = Date.now();
      for (const [k, v] of failures) if (v.until < now) failures.delete(k);
    }, 60 * 60 * 1000);
    timer.unref?.();

    /* ---------------------------------------------------------------- Session */

    ctx.http.get('/me', async (req) => {
      const c = await current(req.cookies);
      return { customer: c ? toMe(c) : null };
    });

    ctx.http.post('/register', async (req) => {
      if (!s().allowRegistration) throw ctx.error(403, 'Les inscriptions sont fermées pour le moment.');
      const b = body(req);
      const email = normEmail(b.email);
      const firstName = str(b.firstName, 60);
      const lastName = str(b.lastName, 60);
      const phone = str(b.phone, 24);
      const password = typeof b.password === 'string' ? b.password : '';
      if (!firstName || !lastName) throw ctx.error(422, 'Indiquez votre prénom et votre nom.');
      if (!isEmail(email)) throw ctx.error(422, 'Adresse e-mail invalide.');
      if ((s().requirePhone || phone) && !isPhone(phone)) throw ctx.error(422, 'Numéro de téléphone invalide.');
      checkPassword(password);
      const c = await ctx.lock(`register:${email}`, async () => {
        if (await customers.findOne({ email })) throw ctx.error(409, 'Un compte existe déjà avec cette adresse e-mail : connectez-vous ou réinitialisez votre mot de passe.');
        return customers.insert({ email, firstName, lastName, phone, passwordHash: await hashPassword(password), addresses: [], wishlist: mergeWishlist([], b.wishlist), status: 'active', lastLoginAt: '', notes: '' });
      });
      const cookie = await openSession(c, req, b.remember !== false);
      if (s().welcomeEmail) {
        const mail = ctx.mail.render({
          title: `Bienvenue, ${firstName} !`,
          intro: s().welcomeText,
          button: { label: 'Accéder à mon espace client', url: `${siteUrl()}/compte/` },
        });
        void ctx.mail.send({ to: email, subject: `Bienvenue sur ${ctx.site().name}`, ...mail });
      }
      return ctx.http.reply({ customer: toMe((await customers.get(c.id))!) }, { status: 201, cookies: [cookie] });
    });

    ctx.http.post('/login', async (req) => {
      const b = body(req);
      const email = normEmail(b.email);
      const password = typeof b.password === 'string' ? b.password.slice(0, 200) : '';
      const key = `${email}|${req.ip}`;
      const f = failures.get(key);
      if (f && f.n >= LOGIN_MAX_FAILS && f.until > Date.now()) throw ctx.error(429, 'Trop de tentatives : réessayez dans quelques minutes ou réinitialisez votre mot de passe.');
      const c = email ? await customers.findOne({ email }) : null;
      const ok = c ? await verifyPassword(password, c.passwordHash) : (await verifyPassword(password, await dummyHash!), false);
      if (!c || !ok) {
        failures.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + LOGIN_WINDOW_MS });
        throw ctx.error(401, 'E-mail ou mot de passe incorrect.');
      }
      if (c.status !== 'active') throw ctx.error(403, 'Ce compte est désactivé. Contactez-nous pour plus d’informations.');
      failures.delete(key);
      const wishlist = mergeWishlist(c.wishlist, b.wishlist);
      if (wishlist.length !== c.wishlist.length) await customers.update(c.id, { wishlist });
      const cookie = await openSession(c, req, b.remember !== false);
      return ctx.http.reply({ customer: toMe((await customers.get(c.id))!) }, { cookies: [cookie] });
    });

    ctx.http.post('/logout', async (req) => {
      const token = req.cookies[COOKIE];
      if (token) await sessions.delete(sha256(token));
      return ctx.http.reply({ ok: true }, { cookies: [{ name: COOKIE, value: '', maxAgeSec: 0 }] });
    });

    ctx.http.post('/password/forgot', async (req) => {
      const email = normEmail(body(req).email);
      if (!isEmail(email)) throw ctx.error(422, 'Adresse e-mail invalide.');
      const c = await customers.findOne({ email });
      if (c && c.status === 'active') {
        const last = c.resetExpires ? new Date(c.resetExpires).getTime() - RESET_TTL_MS : 0;
        if (Date.now() - last > 60_000) await sendReset(c);
      }
      // Réponse identique que le compte existe ou non.
      return { ok: true };
    });

    ctx.http.post('/password/reset', async (req) => {
      const b = body(req);
      const token = str(b.token, 100);
      const password = typeof b.password === 'string' ? b.password : '';
      checkPassword(password);
      const c = token ? await customers.findOne({ resetHash: sha256(token) }) : null;
      if (!c || !c.resetExpires || c.resetExpires < new Date().toISOString()) throw ctx.error(400, 'Ce lien n’est plus valable : demandez-en un nouveau.');
      await customers.update(c.id, { passwordHash: await hashPassword(password), resetHash: '', resetExpires: '' });
      await closeSessions(c.id);
      const cookie = await openSession(c, req, true);
      return ctx.http.reply({ customer: toMe((await customers.get(c.id))!) }, { cookies: [cookie] });
    });

    /* ---------------------------------------------------------------- Compte */

    ctx.http.post('/profile', async (req) => {
      const c = await requireCustomer(req);
      const b = body(req);
      const firstName = str(b.firstName, 60);
      const lastName = str(b.lastName, 60);
      const phone = str(b.phone, 24);
      const email = normEmail(b.email ?? c.email);
      if (!firstName || !lastName) throw ctx.error(422, 'Indiquez votre prénom et votre nom.');
      if (phone && !isPhone(phone)) throw ctx.error(422, 'Numéro de téléphone invalide.');
      if (!isEmail(email)) throw ctx.error(422, 'Adresse e-mail invalide.');
      if (email !== c.email) {
        if (!(await verifyPassword(typeof b.password === 'string' ? b.password : '', c.passwordHash))) throw ctx.error(403, 'Mot de passe actuel incorrect : il est demandé pour changer d’adresse e-mail.');
        const other = await customers.findOne({ email });
        if (other && other.id !== c.id) throw ctx.error(409, 'Cette adresse e-mail est déjà utilisée par un autre compte.');
      }
      const updated = await customers.update(c.id, { firstName, lastName, phone, email });
      return { customer: toMe(updated!) };
    });

    ctx.http.post('/avatar', async (req) => {
      const c = await requireCustomer(req);
      if (!s().avatars) throw ctx.error(403, 'Les photos de profil sont désactivées sur ce site.');
      const b = body(req);
      const url = await ctx.files.saveImage({ dataBase64: str(b.dataBase64, 3_000_000), mimeType: str(b.mimeType, 30) }, { prefix: 'avatar', maxBytes: AVATAR_MAX_BYTES });
      const updated = await customers.update(c.id, { avatarUrl: url });
      await ctx.files.delete(c.avatarUrl);
      return { customer: toMe(updated!) };
    });

    ctx.http.post('/avatar/delete', async (req) => {
      const c = await requireCustomer(req);
      const updated = await customers.update(c.id, { avatarUrl: '' });
      await ctx.files.delete(c.avatarUrl);
      return { customer: toMe(updated!) };
    });

    ctx.http.post('/password', async (req) => {
      const c = await requireCustomer(req);
      const b = body(req);
      if (!(await verifyPassword(typeof b.current === 'string' ? b.current : '', c.passwordHash))) throw ctx.error(403, 'Mot de passe actuel incorrect.');
      const next = typeof b.next === 'string' ? b.next : '';
      checkPassword(next);
      await customers.update(c.id, { passwordHash: await hashPassword(next) });
      await closeSessions(c.id);
      const cookie = await openSession(c, req, true);
      return ctx.http.reply({ ok: true }, { cookies: [cookie] });
    });

    ctx.http.post('/addresses', async (req) => {
      const c = await requireCustomer(req);
      const b = body(req);
      const { value, errors } = validateAddress(b.address);
      const first = Object.values(errors)[0];
      if (first) throw ctx.error(422, first);
      const id = typeof b.id === 'string' && c.addresses.some((a) => a.id === b.id) ? b.id : randomBytes(6).toString('base64url');
      const exists = c.addresses.some((a) => a.id === id);
      if (!exists && c.addresses.length >= MAX_ADDRESSES) throw ctx.error(422, `${MAX_ADDRESSES} adresses au maximum.`);
      const makeDefault = b.isDefault === true || c.addresses.length === 0;
      const entry: SavedAddress = { ...value, id, label: str(b.label, 40) || 'Adresse', isDefault: makeDefault || (exists && !!c.addresses.find((a) => a.id === id)?.isDefault) };
      let addresses = exists ? c.addresses.map((a) => (a.id === id ? entry : a)) : [...c.addresses, entry];
      if (entry.isDefault) addresses = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
      const updated = await customers.update(c.id, { addresses });
      return { addresses: updated!.addresses, id };
    });

    ctx.http.post('/addresses/:id/delete', async (req) => {
      const c = await requireCustomer(req);
      let addresses = c.addresses.filter((a) => a.id !== req.params.id);
      if (addresses.length && !addresses.some((a) => a.isDefault)) addresses = addresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
      const updated = await customers.update(c.id, { addresses });
      return { addresses: updated!.addresses };
    });

    ctx.http.post('/addresses/:id/default', async (req) => {
      const c = await requireCustomer(req);
      if (!c.addresses.some((a) => a.id === req.params.id)) throw ctx.error(404, 'Adresse introuvable');
      const updated = await customers.update(c.id, { addresses: c.addresses.map((a) => ({ ...a, isDefault: a.id === req.params.id })) });
      return { addresses: updated!.addresses };
    });

    ctx.http.post('/wishlist', async (req) => {
      const c = await requireCustomer(req);
      const wishlist = mergeWishlist([], body(req).ids);
      await customers.update(c.id, { wishlist });
      return { wishlist };
    });

    ctx.http.get('/overview', async (req) => {
      const c = await requireCustomer(req);
      const co = checkout();
      const [stats, recent] = co ? await Promise.all([co.customerStats(c.id), co.ordersForCustomer(c.id, { limit: 3 })]) : [null, null];
      return { stats, recent: recent?.items ?? [], ordersEnabled: !!co };
    });

    ctx.http.get('/orders', async (req) => {
      const c = await requireCustomer(req);
      const co = checkout();
      if (!co) return { items: [], total: 0, ordersEnabled: false };
      const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
      const r = await co.ordersForCustomer(c.id, { limit: 10, offset: (page - 1) * 10 });
      return { ...r, ordersEnabled: true };
    });

    ctx.http.get('/orders/:number', async (req) => {
      const c = await requireCustomer(req);
      const order = await checkout()?.orderForCustomer(c.id, str(req.params.number, 40));
      if (!order) throw ctx.error(404, 'Commande introuvable');
      return { order };
    });

    ctx.http.post('/delete-account', async (req) => {
      const c = await requireCustomer(req);
      if (!(await verifyPassword(typeof body(req).password === 'string' ? (body(req).password as string) : '', c.passwordHash))) throw ctx.error(403, 'Mot de passe incorrect.');
      await closeSessions(c.id);
      await customers.delete(c.id);
      await ctx.files.delete(c.avatarUrl);
      return ctx.http.reply({ ok: true }, { cookies: [{ name: COOKIE, value: '', maxAgeSec: 0 }] });
    });

    /* ---------------------------------------------------------------- Administration */

    ctx.admin.get('/customers', async (req) => {
      const q = req.query;
      const size = Math.min(500, Math.max(1, Math.floor(Number(q.size)) || 25));
      const page = Math.max(1, Math.floor(Number(q.page)) || 1);
      const text = str(q.q, 100);
      const { items, total } = await customers.find({
        where: q.status === 'active' || q.status === 'disabled' ? { status: q.status } : undefined,
        search: text ? { fields: ['email', 'firstName', 'lastName', 'phone'], text } : undefined,
        orderBy: [{ field: q.sort === 'name' ? 'lastName' : 'createdAt', dir: q.sort === 'name' ? 'asc' : 'desc' }],
        limit: size,
        offset: (page - 1) * size,
      });
      const co = checkout();
      const stats = co ? await Promise.all(items.map((c) => co.customerStats(c.id))) : [];
      return {
        items: items.map((c, i) => ({ id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, avatarUrl: c.avatarUrl ?? '', status: c.status, createdAt: c.createdAt, lastLoginAt: c.lastLoginAt, city: c.addresses.find((a) => a.isDefault)?.city ?? '', orders: stats[i]?.orders ?? 0, spent: stats[i]?.spent ?? 0 })),
        total,
        ordersEnabled: !!co,
      };
    });

    ctx.admin.get('/customers/:id', async (req) => {
      const c = await customers.get(req.params.id);
      if (!c) throw ctx.error(404, 'Client introuvable');
      const co = checkout();
      const [stats, orders] = co ? await Promise.all([co.customerStats(c.id), co.ordersForCustomer(c.id, { limit: 50 })]) : [null, null];
      const { passwordHash: _p, resetHash: _r, resetExpires: _e, ...safe } = c;
      return { customer: { ...safe, wishlistCount: c.wishlist.length }, stats, orders: orders?.items ?? [], ordersEnabled: !!co };
    });

    ctx.admin.put('/customers/:id', async (req) => {
      const c = await customers.get(req.params.id);
      if (!c) throw ctx.error(404, 'Client introuvable');
      const b = body(req);
      const firstName = str(b.firstName, 60) || c.firstName;
      const lastName = str(b.lastName, 60) || c.lastName;
      const phone = str(b.phone, 24);
      if (phone && !isPhone(phone)) throw ctx.error(422, 'Numéro de téléphone invalide.');
      const status = b.status === 'disabled' ? 'disabled' : 'active';
      await customers.update(c.id, { firstName, lastName, phone, status, notes: str(b.notes, 4000) });
      if (status === 'disabled') await closeSessions(c.id);
      return { ok: true };
    });

    ctx.admin.post('/customers/:id/reset-link', async (req) => {
      const c = await customers.get(req.params.id);
      if (!c) throw ctx.error(404, 'Client introuvable');
      const r = await sendReset(c);
      if (!r.sent) throw ctx.error(502, `E-mail non envoyé : ${r.reason || 'vérifiez la configuration SMTP dans Paramètres > E-mails.'}`);
      return { ok: true };
    });

    ctx.admin.post('/customers/:id/avatar/delete', async (req) => {
      const c = await customers.get(req.params.id);
      if (!c) throw ctx.error(404, 'Client introuvable');
      await customers.update(c.id, { avatarUrl: '' });
      await ctx.files.delete(c.avatarUrl);
      return { ok: true };
    });

    ctx.admin.delete('/customers/:id', async (req) => {
      const c = await customers.get(req.params.id);
      await closeSessions(req.params.id);
      if (!c || !(await customers.delete(c.id))) throw ctx.error(404, 'Client introuvable');
      await ctx.files.delete(c.avatarUrl);
      return { ok: true };
    });

    ctx.admin.status(async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [total, month] = await Promise.all([customers.count(), customers.count({ filters: [{ field: 'createdAt', op: 'gte', value: monthStart.toISOString() }] })]);
      return { stats: [{ label: 'Clients inscrits', value: total }, { label: 'Nouveaux ce mois-ci', value: month }] };
    });

    return () => clearInterval(timer);
  },
});
