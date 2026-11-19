import crypto from 'node:crypto';
import type { z } from 'zod';
import type { ErpRepository } from './repository';
import * as S from './schemas';
import { addDays, addMonths, daysBetween, isoDay, weekStart } from './dates';
import { conflict, forbidden, invalid, notFound } from './errors';
import { authorize, canAccess } from './permissions';
import { nextEntry, verifyChain, type EntryDraft } from './registre';
import { textPdf, type PdfLine } from './pdf';
import { hashPassword, signToken, verifyPassword } from './auth';
import type { Actor, Categorie, Equipement, Etablissement, JournalEntry, TypeEquipement } from './types';

export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }
export const consoleMailer: Mailer = { async send(to, subject) { console.log(`[mail simulé] → ${to} : ${subject}`); } };
export interface ServiceOptions { now?: () => Date; mailer?: Mailer; alertDays?: number; jwtSecret?: string }

export type Etat = 'ok' | 'a_venir' | 'en_retard' | 'hors_service';
const MAX_PHOTO = 1_500_000;
const paginate = <T,>(a: T[], page = 1, size = 25) => ({ items: a.slice((Math.max(1, page) - 1) * size, Math.max(1, page) * size), total: a.length });

/** Signature des formats d'image acceptés : on ne se fie pas au type MIME annoncé par le client. */
function checkImage(buf: Buffer, mime: string) {
  const ok = mime === 'image/jpeg' ? buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : mime === 'image/png' ? buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    : buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  if (!ok) throw invalid('Le fichier n’est pas une image valide');
}

export class ErpService {
  private now: () => Date;
  private mailer: Mailer;
  private alertDays: number;
  constructor(private repo: ErpRepository, private opts: ServiceOptions = {}) {
    this.now = opts.now ?? (() => new Date());
    this.mailer = opts.mailer ?? consoleMailer;
    this.alertDays = opts.alertDays ?? 30;
  }
  private today() { return isoDay(this.now()); }
  private parse<Z extends z.ZodTypeAny>(schema: Z, data: unknown): z.output<Z> {
    const r = schema.safeParse(data ?? {});
    if (!r.success) throw invalid(r.error.issues[0]?.message ?? 'Données invalides', r.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })));
    return r.data;
  }
  private async etab(id: string): Promise<Etablissement> { return (await this.repo.etablissements.get(id)) ?? (() => { throw notFound('Établissement'); })(); }
  private async equip(id: string): Promise<Equipement> { return (await this.repo.equipements.get(id)) ?? (() => { throw notFound('Équipement'); })(); }
  private journal(r: ErpRepository, d: Omit<EntryDraft, 'occurredAt'>) {
    return r.journal.append(d.etablissementId, (last) => nextEntry(last, { ...d, occurredAt: this.now().toISOString() }));
  }
  private etat(e: Equipement): Etat {
    if (e.statut === 'hors_service') return 'hors_service';
    if (e.prochaineEcheance < this.today()) return 'en_retard';
    return daysBetween(this.today(), e.prochaineEcheance) <= this.alertDays ? 'a_venir' : 'ok';
  }
  private view(e: Equipement) { return { ...e, etat: this.etat(e), joursRestants: daysBetween(this.today(), e.prochaineEcheance) }; }
  private async accessible(a: Actor): Promise<Etablissement[]> {
    return (await this.repo.etablissements.find()).filter((e) => canAccess(a, e.id)).sort((x, y) => x.nom.localeCompare(y.nom));
  }

  // ───────── Règles de périodicité (paramétrables, jamais codées en dur) ─────────
  /** Règle propre à la catégorie > règle « toutes catégories » > périodicité par défaut du type. */
  async resolveMois(r: ErpRepository, type: TypeEquipement, categorie: Categorie): Promise<number> {
    const rules = await r.regles.find({ typeEquipementId: type.id });
    return (rules.find((x) => x.categorie === categorie) ?? rules.find((x) => x.categorie === null))?.periodiciteMois ?? type.periodiciteDefautMois;
  }
  /** Échéance = dernier contrôle (sinon mise en service) + périodicité. */
  async computeEcheance(r: ErpRepository, e: Pick<Equipement, 'typeId' | 'dernierControle' | 'dateMiseEnService'>, et: Etablissement) {
    const type = await r.types.get(e.typeId);
    if (!type) throw notFound('Type d’équipement');
    return addMonths(e.dernierControle ?? e.dateMiseEnService, await this.resolveMois(r, type, et.categorie));
  }
  async listTypes(a: Actor) {
    authorize(a, 'read');
    const rules = await this.repo.regles.find();
    return (await this.repo.types.find()).map((t) => ({ ...t, regles: rules.filter((x) => x.typeEquipementId === t.id) }));
  }
  async createType(a: Actor, raw: unknown) {
    authorize(a, 'regles.write');
    const d = this.parse(S.typeInput, raw);
    if ((await this.repo.types.find({ code: d.code })).length) throw conflict('Ce code de type existe déjà');
    return this.repo.types.insert(d);
  }
  /** Crée/modifie une règle puis recalcule les échéances des équipements concernés. */
  async setRule(a: Actor, raw: unknown) {
    authorize(a, 'regles.write');
    const d = this.parse(S.regleInput, raw);
    const type = await this.repo.types.get(d.typeEquipementId);
    if (!type) throw notFound('Type d’équipement');
    return this.repo.transaction(async (r) => {
      const existing = (await r.regles.find({ typeEquipementId: d.typeEquipementId })).find((x) => x.categorie === d.categorie);
      const rule = existing ? (await r.regles.update(existing.id, { periodiciteMois: d.periodiciteMois }))! : await r.regles.insert(d);
      let recalculated = 0;
      for (const e of await r.equipements.find({ typeId: type.id })) {
        const next = await this.computeEcheance(r, e, (await r.etablissements.get(e.etablissementId))!);
        if (next !== e.prochaineEcheance) { await r.equipements.update(e.id, { prochaineEcheance: next }); recalculated++; }
      }
      return { rule, recalculated };
    });
  }

  // ───────── Établissements, bâtiments, niveaux ─────────
  async listEtablissements(a: Actor) { authorize(a, 'read'); return this.accessible(a); }
  async getEtablissement(a: Actor, id: string) {
    authorize(a, 'read', id);
    const et = await this.etab(id);
    const [bats, niveaux] = await Promise.all([this.repo.batiments.find({ etablissementId: id }), this.repo.niveaux.find({ etablissementId: id })]);
    return { etablissement: et, batiments: bats.map((b) => ({ ...b, niveaux: niveaux.filter((n) => n.batimentId === b.id).sort((x, y) => x.ordre - y.ordre) })) };
  }
  async createEtablissement(a: Actor, raw: unknown) { authorize(a, 'etab.create'); return this.repo.etablissements.insert(this.parse(S.etablissementInput, raw)); }
  async updateEtablissement(a: Actor, id: string, raw: unknown) {
    authorize(a, 'structure.write', id);
    const patch = this.parse(S.etablissementPatch, raw);
    const et = (await this.repo.etablissements.update(id, patch)) ?? (() => { throw notFound('Établissement'); })();
    if (patch.categorie) await this.recalcEtablissement(et); // une catégorie différente peut changer les périodicités
    return et;
  }
  private async recalcEtablissement(et: Etablissement) {
    for (const e of await this.repo.equipements.find({ etablissementId: et.id })) {
      const next = await this.computeEcheance(this.repo, e, et);
      if (next !== e.prochaineEcheance) await this.repo.equipements.update(e.id, { prochaineEcheance: next });
    }
  }
  async addBatiment(a: Actor, raw: unknown) {
    const d = this.parse(S.batimentInput, raw);
    authorize(a, 'structure.write', d.etablissementId);
    await this.etab(d.etablissementId);
    return this.repo.batiments.insert(d);
  }
  async addNiveau(a: Actor, raw: unknown) {
    const d = this.parse(S.niveauInput, raw);
    const b = (await this.repo.batiments.get(d.batimentId)) ?? (() => { throw notFound('Bâtiment'); })();
    authorize(a, 'structure.write', b.etablissementId);
    return this.repo.niveaux.insert({ ...d, etablissementId: b.etablissementId });
  }

  // ───────── Équipements ─────────
  async createEquipement(a: Actor, raw: unknown) {
    const d = this.parse(S.equipementInput, raw);
    authorize(a, 'equipement.write', d.etablissementId);
    const et = await this.etab(d.etablissementId);
    if (!(await this.repo.types.get(d.typeId))) throw notFound('Type d’équipement');
    if (d.niveauId) { const n = await this.repo.niveaux.get(d.niveauId); if (!n || n.etablissementId !== et.id) throw invalid('Niveau inconnu pour cet établissement'); }
    let qrCode = '';
    do { qrCode = `EQ-${crypto.randomBytes(6).toString('hex').toUpperCase()}`; } while ((await this.repo.equipements.find({ qrCode })).length);
    const base = { ...d, niveauId: d.niveauId ?? null, qrCode, dernierControle: null };
    return this.view(await this.repo.equipements.insert({ ...base, prochaineEcheance: await this.computeEcheance(this.repo, base, et) }));
  }
  async updateEquipement(a: Actor, id: string, raw: unknown) {
    const e = await this.equip(id);
    authorize(a, 'equipement.write', e.etablissementId);
    const p = this.parse(S.equipementPatch, raw);
    return this.view((await this.repo.equipements.update(id, p as never))!);
  }
  async listEquipements(a: Actor, q: { etablissementId?: string; typeId?: string; statut?: string; etat?: string; q?: string; page?: number; size?: number } = {}) {
    authorize(a, 'read', q.etablissementId);
    const allowed = new Set((await this.accessible(a)).map((e) => e.id));
    let list = (await this.repo.equipements.find()).filter((e) => allowed.has(e.etablissementId));
    if (q.etablissementId) list = list.filter((e) => e.etablissementId === q.etablissementId);
    if (q.typeId) list = list.filter((e) => e.typeId === q.typeId);
    if (q.statut) list = list.filter((e) => e.statut === q.statut);
    if (q.q) { const t = q.q.toLowerCase(); list = list.filter((e) => `${e.libelle} ${e.emplacement} ${e.qrCode}`.toLowerCase().includes(t)); }
    let views = list.map((e) => this.view(e));
    if (q.etat) views = views.filter((e) => e.etat === q.etat);
    views.sort((x, y) => x.prochaineEcheance.localeCompare(y.prochaineEcheance));
    return paginate(views, q.page, Math.min(q.size ?? 25, 100));
  }
  async getEquipement(a: Actor, id: string) {
    const e = await this.equip(id);
    authorize(a, 'read', e.etablissementId);
    const controles = (await this.repo.controles.find({ equipementId: id })).sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt));
    return { equipement: this.view(e), type: await this.repo.types.get(e.typeId), controles };
  }
  /** Résolution d'un QR scanné sur le terrain. */
  async findByQr(a: Actor, qr: string) {
    const e = (await this.repo.equipements.find({ qrCode: String(qr).trim().toUpperCase() }))[0];
    if (!e) throw notFound('Équipement (QR code)');
    return this.getEquipement(a, e.id);
  }

  // ───────── Contrôles + non-conformités + registre : une seule transaction ─────────
  async recordControle(a: Actor, raw: unknown) {
    const d = this.parse(S.controleInput, raw);
    const eq = await this.equip(d.equipementId);
    authorize(a, 'controle.write', eq.etablissementId);
    if (d.date > this.today()) throw invalid('La date du contrôle ne peut pas être dans le futur');
    if (d.date < eq.dateMiseEnService) throw invalid('Le contrôle ne peut pas précéder la mise en service');
    let photo: { buf: Buffer; sha: string } | null = null;
    if (d.photo) {
      const buf = Buffer.from(d.photo.base64, 'base64');
      if (buf.length > MAX_PHOTO) throw invalid('Photo trop lourde (1,5 Mo max)');
      checkImage(buf, d.photo.mime);
      photo = { buf, sha: crypto.createHash('sha256').update(buf).digest('hex') };
    }
    const et = await this.etab(eq.etablissementId);
    return this.repo.transaction(async (r) => {
      const doc = photo && d.photo ? await r.documents.insert({ etablissementId: eq.etablissementId, nom: d.photo.nom, mime: d.photo.mime, taille: photo.buf.length, sha256: photo.sha, contenu: d.photo.base64 }) : null;
      const controle = await r.controles.insert({ equipementId: eq.id, etablissementId: eq.etablissementId, date: d.date, resultat: d.resultat, observations: d.observations, documentId: doc?.id ?? null, controleur: d.controleur, auteurId: a.id });
      await this.journal(r, { etablissementId: eq.etablissementId, type: 'controle', auteur: `${d.controleur} (saisi par ${a.nom})`, payload: { controleId: controle.id, equipementId: eq.id, equipement: eq.libelle, qrCode: eq.qrCode, date: d.date, resultat: d.resultat, observations: d.observations, documentId: doc?.id ?? null, photoSha256: photo?.sha ?? null } });
      // Un contrôle saisi avec retard ne doit jamais faire reculer la date du dernier contrôle.
      const dernier = eq.dernierControle && eq.dernierControle > d.date ? eq.dernierControle : d.date;
      const equipement = (await r.equipements.update(eq.id, { dernierControle: dernier, prochaineEcheance: await this.computeEcheance(r, { ...eq, dernierControle: dernier }, et) }))!;
      let nonConformite = null;
      if (d.resultat === 'non_conforme') {
        nonConformite = await r.nonConformites.insert({ controleId: controle.id, equipementId: eq.id, etablissementId: eq.etablissementId, description: d.observations, statut: 'ouverte', leveeAt: null, leveeNote: '' });
        await this.journal(r, { etablissementId: eq.etablissementId, type: 'non_conformite', auteur: a.nom, payload: { nonConformiteId: nonConformite.id, controleId: controle.id, equipementId: eq.id, equipement: eq.libelle, description: d.observations } });
      }
      return { controle, nonConformite, equipement: this.view(equipement) };
    });
  }
  async listControles(a: Actor, q: { etablissementId: string; page?: number; size?: number }) {
    authorize(a, 'read', q.etablissementId);
    return paginate((await this.repo.controles.find({ etablissementId: q.etablissementId })).sort((x, y) => y.date.localeCompare(x.date)), q.page, q.size);
  }
  async getDocument(a: Actor, id: string) {
    const doc = (await this.repo.documents.get(id)) ?? (() => { throw notFound('Document'); })();
    authorize(a, 'read', doc.etablissementId);
    return { nom: doc.nom, mime: doc.mime, sha256: doc.sha256, base64: doc.contenu };
  }

  // ───────── Non-conformités et plan d'action ─────────
  async listNonConformites(a: Actor, q: { etablissementId?: string; statut?: string } = {}) {
    authorize(a, 'read', q.etablissementId);
    const allowed = new Set((await this.accessible(a)).map((e) => e.id));
    const eqs = new Map((await this.repo.equipements.find()).map((e) => [e.id, e]));
    return (await this.repo.nonConformites.find()).filter((n) => allowed.has(n.etablissementId) && (!q.etablissementId || n.etablissementId === q.etablissementId) && (!q.statut || n.statut === q.statut))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((n) => ({ ...n, equipement: eqs.get(n.equipementId)?.libelle ?? '—' }));
  }
  async getNonConformite(a: Actor, id: string) {
    const nc = (await this.repo.nonConformites.get(id)) ?? (() => { throw notFound('Non-conformité'); })();
    authorize(a, 'read', nc.etablissementId);
    return { nonConformite: nc, equipement: await this.repo.equipements.get(nc.equipementId), controle: await this.repo.controles.get(nc.controleId), actions: await this.repo.actions.find({ nonConformiteId: id }) };
  }
  async addAction(a: Actor, raw: unknown) {
    const d = this.parse(S.actionInput, raw);
    const nc = (await this.repo.nonConformites.get(d.nonConformiteId)) ?? (() => { throw notFound('Non-conformité'); })();
    authorize(a, 'nc.write', nc.etablissementId);
    if (nc.statut === 'levee') throw conflict('Cette non-conformité est déjà levée');
    return this.repo.transaction(async (r) => {
      const action = await r.actions.insert({ ...d, etablissementId: nc.etablissementId, statut: 'a_faire' });
      await r.nonConformites.update(nc.id, { statut: 'en_cours' });
      await this.journal(r, { etablissementId: nc.etablissementId, type: 'action', auteur: a.nom, payload: { actionId: action.id, nonConformiteId: nc.id, evenement: 'creation', description: d.description, responsable: d.responsable, echeance: d.echeance } });
      return action;
    });
  }
  async updateAction(a: Actor, id: string, raw: unknown) {
    const act = (await this.repo.actions.get(id)) ?? (() => { throw notFound('Action'); })();
    authorize(a, 'nc.write', act.etablissementId);
    const p = this.parse(S.actionPatch, raw);
    const nc = (await this.repo.nonConformites.get(act.nonConformiteId))!;
    if (nc.statut === 'levee') throw conflict('Cette non-conformité est déjà levée');
    return this.repo.transaction(async (r) => {
      const upd = (await r.actions.update(id, p))!;
      await this.journal(r, { etablissementId: act.etablissementId, type: 'action', auteur: a.nom, payload: { actionId: id, nonConformiteId: act.nonConformiteId, evenement: 'mise_a_jour', ...p } });
      return upd;
    });
  }
  /** Levée : possible uniquement si un plan d'action existe et que toutes ses actions sont terminées. */
  async lever(a: Actor, id: string, raw: unknown) {
    const { note } = this.parse(S.leveeInput, raw);
    const nc = (await this.repo.nonConformites.get(id)) ?? (() => { throw notFound('Non-conformité'); })();
    authorize(a, 'nc.write', nc.etablissementId);
    if (nc.statut === 'levee') throw conflict('Cette non-conformité est déjà levée');
    const actions = await this.repo.actions.find({ nonConformiteId: id });
    if (!actions.length) throw conflict('Ajoutez au moins une action corrective avant de lever la non-conformité');
    if (actions.some((x) => x.statut !== 'terminee')) throw conflict('Toutes les actions doivent être terminées avant la levée');
    return this.repo.transaction(async (r) => {
      const upd = (await r.nonConformites.update(id, { statut: 'levee', leveeAt: this.now().toISOString(), leveeNote: note }))!;
      await this.journal(r, { etablissementId: nc.etablissementId, type: 'levee', auteur: a.nom, payload: { nonConformiteId: id, equipementId: nc.equipementId, note } });
      return upd;
    });
  }

  // ───────── Registre de sécurité ─────────
  async listRegistre(a: Actor, q: { etablissementId: string; page?: number; size?: number; type?: string }) {
    authorize(a, 'read', q.etablissementId);
    const all = await this.repo.journal.list(q.etablissementId);
    const integrity = verifyChain(all);
    const corrected = new Set(all.filter((e) => e.corrigeId).map((e) => e.corrigeId));
    const rows = all.filter((e) => !q.type || e.type === q.type).reverse().map((e) => ({ ...e, corrigee: corrected.has(e.id) }));
    return { ...paginate(rows, q.page, Math.min(q.size ?? 25, 100)), integrity };
  }
  async verifyRegistre(a: Actor, etablissementId: string) {
    authorize(a, 'read', etablissementId);
    return verifyChain(await this.repo.journal.list(etablissementId));
  }
  async addIntervention(a: Actor, raw: unknown) {
    const d = this.parse(S.interventionInput, raw);
    authorize(a, 'registre.write', d.etablissementId);
    await this.etab(d.etablissementId);
    let equipement: string | null = null;
    if (d.equipementId) { const e = await this.equip(d.equipementId); if (e.etablissementId !== d.etablissementId) throw invalid('Équipement d’un autre établissement'); equipement = e.libelle; }
    return this.journal(this.repo, { etablissementId: d.etablissementId, type: 'intervention', auteur: a.nom, payload: { date: d.date, intervenant: d.intervenant, description: d.description, equipementId: d.equipementId ?? null, equipement } });
  }
  /** Corriger = ajouter une entrée liée à l'originale (qui reste intacte, auteur et date conservés). */
  async corriger(a: Actor, raw: unknown) {
    const d = this.parse(S.correctionInput, raw);
    const orig = (await this.repo.journal.get(d.entryId)) ?? (() => { throw notFound('Entrée du registre'); })();
    authorize(a, 'registre.write', orig.etablissementId);
    return this.journal(this.repo, { etablissementId: orig.etablissementId, type: 'correction', auteur: a.nom, corrigeId: orig.id, payload: { motif: d.motif, correction: d.correction, entreeCorrigee: orig.seq } });
  }
  async exportRegistrePdf(a: Actor, q: { etablissementId: string; from?: string; to?: string }) {
    authorize(a, 'read', q.etablissementId);
    const et = await this.etab(q.etablissementId);
    const all = await this.repo.journal.list(et.id);
    const integrity = verifyChain(all);
    const rows = all.filter((e) => (!q.from || e.occurredAt.slice(0, 10) >= q.from) && (!q.to || e.occurredAt.slice(0, 10) <= q.to));
    const lines: (string | PdfLine)[] = [
      { text: 'REGISTRE DE SECURITE', bold: true, size: 15 }, '',
      { text: et.nom, bold: true }, `${et.adresse} - ${et.typeActivite} - categorie ${et.categorie} - effectif max. ${et.effectifMax}`,
      `Edite le ${this.now().toISOString().slice(0, 16).replace('T', ' ')} UTC par ${a.nom} - ${rows.length} entree(s)${q.from || q.to ? ` (periode ${q.from ?? '…'} / ${q.to ?? '…'})` : ''}`,
      integrity.ok ? `Integrite : chaine de hachage verifiee (${integrity.checked} entrees, aucune alteration).` : `ALERTE INTEGRITE : ${integrity.reason} (entree n°${integrity.brokenAt}).`, '',
    ];
    for (const e of rows) {
      lines.push({ text: `#${e.seq}  ${e.occurredAt.slice(0, 19).replace('T', ' ')} UTC  [${e.type.toUpperCase()}]  ${e.auteur}`, bold: true, size: 9 });
      lines.push(...this.describe(e).map((t) => `   ${t}`), `   empreinte ${e.hash.slice(0, 16)}…`, '');
    }
    const pdf = textPdf(lines, `Registre - ${et.nom}`);
    return { filename: `registre-${et.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${this.today()}.pdf`, base64: pdf.toString('base64'), integrity };
  }
  private describe(e: JournalEntry): string[] {
    const p = e.payload as Record<string, any>;
    const o = (v: unknown) => (v == null || v === '' ? '' : String(v));
    switch (e.type) {
      case 'controle': return [`${o(p.equipement)} (${o(p.qrCode)}) - controle du ${o(p.date)} : ${p.resultat === 'conforme' ? 'CONFORME' : 'NON CONFORME'}`, ...(p.observations ? [`Observations : ${p.observations}`] : []), ...(p.photoSha256 ? [`Photo jointe (sha256 ${String(p.photoSha256).slice(0, 16)}…)`] : [])];
      case 'non_conformite': return [`Non-conformite ouverte sur ${o(p.equipement)} : ${o(p.description)}`];
      case 'action': return [`Action corrective (${o(p.evenement)}) : ${o(p.description)} ${p.responsable ? `- resp. ${p.responsable}` : ''} ${p.echeance ? `- echeance ${p.echeance}` : ''} ${p.statut ? `- statut ${p.statut}` : ''}`.replace(/\s+/g, ' ')];
      case 'levee': return ['Non-conformite levee.', ...(p.note ? [`Note : ${p.note}`] : [])];
      case 'exercice': return [`${p.type === 'formation' ? 'Formation' : 'Exercice d’evacuation'} du ${o(p.date)} - ${o(p.participants)} participant(s), ${o(p.dureeMin)} min`, ...(p.observations ? [`Observations : ${p.observations}`] : [])];
      case 'intervention': return [`Intervention du ${o(p.date)} par ${o(p.intervenant)}${p.equipement ? ` sur ${p.equipement}` : ''} : ${o(p.description)}`];
      case 'visite': return [`Visite de la commission de securite du ${o(p.date)} - avis ${p.avis === 'favorable' ? 'FAVORABLE' : 'DEFAVORABLE'}${p.president ? ` - ${p.president}` : ''}`, ...(p.observations ? [`Observations : ${p.observations}`] : []), ...((p.prescriptions as string[] | undefined) ?? []).map((x, i) => `Prescription ${i + 1} : ${x}`), ...(p.prochaineVisite ? [`Prochaine visite prevue le ${p.prochaineVisite}`] : [])];
      case 'prescription': return [`Prescription de la commission (${o(p.evenement)}) : ${o(p.description)} - resp. ${o(p.responsable)} - echeance ${o(p.echeance)} - statut ${o(p.statut)}`];
      case 'correction': return [`CORRECTION de l’entree n°${o(p.entreeCorrigee)} - motif : ${o(p.motif)}`, `Correction : ${o(p.correction)}`];
    }
  }

  // ───────── Exercices et formations (bonus) ─────────
  async addExercice(a: Actor, raw: unknown) {
    const d = this.parse(S.exerciceInput, raw);
    authorize(a, 'exercice.write', d.etablissementId);
    await this.etab(d.etablissementId);
    if (d.date > this.today()) throw invalid('La date ne peut pas être dans le futur');
    return this.repo.transaction(async (r) => {
      const ex = await r.exercices.insert({ ...d, recyclageMois: d.recyclageMois ?? null, prochainRecyclage: d.recyclageMois ? addMonths(d.date, d.recyclageMois) : null });
      await this.journal(r, { etablissementId: d.etablissementId, type: 'exercice', auteur: a.nom, payload: { exerciceId: ex.id, type: d.type, date: d.date, participants: d.participants, dureeMin: d.dureeMin, observations: d.observations } });
      return ex;
    });
  }
  async listExercices(a: Actor, etablissementId: string) {
    authorize(a, 'read', etablissementId);
    return (await this.repo.exercices.find({ etablissementId })).sort((x, y) => y.date.localeCompare(x.date)).map((e) => ({ ...e, recyclageEnRetard: !!e.prochainRecyclage && e.prochainRecyclage < this.today() }));
  }

  // ───────── Commission de sécurité : visites et prescriptions (bonus) ─────────
  async addVisite(a: Actor, raw: unknown) {
    const d = this.parse(S.visiteInput, raw);
    authorize(a, 'visite.write', d.etablissementId);
    await this.etab(d.etablissementId);
    if (d.date > this.today()) throw invalid('La date de la visite ne peut pas être dans le futur');
    if (d.prochaineVisite && d.prochaineVisite <= d.date) throw invalid('La prochaine visite doit être postérieure à la visite');
    return this.repo.transaction(async (r) => {
      const visite = await r.visites.insert({ etablissementId: d.etablissementId, date: d.date, avis: d.avis, president: d.president, observations: d.observations, prochaineVisite: d.prochaineVisite ?? null });
      const prescriptions = [];
      for (const p of d.prescriptions) prescriptions.push(await r.prescriptions.insert({ visiteId: visite.id, etablissementId: d.etablissementId, description: p.description, responsable: p.responsable, echeance: p.echeance, statut: 'a_faire', leveeAt: null }));
      await this.journal(r, { etablissementId: d.etablissementId, type: 'visite', auteur: a.nom, payload: { visiteId: visite.id, date: d.date, avis: d.avis, president: d.president, observations: d.observations, prochaineVisite: d.prochaineVisite ?? null, prescriptions: prescriptions.map((p) => p.description) } });
      return { visite, prescriptions };
    });
  }
  async addPrescription(a: Actor, raw: unknown) {
    const d = this.parse(S.prescriptionInput, raw);
    const visite = (await this.repo.visites.get(d.visiteId)) ?? (() => { throw notFound('Visite'); })();
    authorize(a, 'visite.write', visite.etablissementId);
    return this.repo.transaction(async (r) => {
      const p = await r.prescriptions.insert({ visiteId: visite.id, etablissementId: visite.etablissementId, description: d.description, responsable: d.responsable, echeance: d.echeance, statut: 'a_faire', leveeAt: null });
      await this.journal(r, { etablissementId: visite.etablissementId, type: 'prescription', auteur: a.nom, payload: { prescriptionId: p.id, visiteId: visite.id, evenement: 'ajoutee', description: p.description, responsable: p.responsable, echeance: p.echeance, statut: p.statut } });
      return p;
    });
  }
  /** Une prescription levée ne se rouvre pas (traçabilité) : en cas d'erreur, ajouter une nouvelle prescription ou une correction au registre. */
  async updatePrescription(a: Actor, id: string, raw: unknown) {
    const patch = this.parse(S.prescriptionPatch, raw);
    const p = (await this.repo.prescriptions.get(id)) ?? (() => { throw notFound('Prescription'); })();
    authorize(a, 'visite.write', p.etablissementId);
    if (p.statut === 'levee') throw conflict('Cette prescription est déjà levée');
    const upd = { ...patch, ...(patch.statut === 'levee' ? { leveeAt: this.now().toISOString() } : {}) };
    return this.repo.transaction(async (r) => {
      const n = (await r.prescriptions.update(id, upd))!;
      await this.journal(r, { etablissementId: p.etablissementId, type: 'prescription', auteur: a.nom, payload: { prescriptionId: n.id, visiteId: n.visiteId, evenement: n.statut === 'levee' ? 'levee' : 'mise_a_jour', description: n.description, responsable: n.responsable, echeance: n.echeance, statut: n.statut } });
      return n;
    });
  }
  async listVisites(a: Actor, etablissementId: string) {
    authorize(a, 'read', etablissementId);
    const [visites, prescriptions] = await Promise.all([this.repo.visites.find({ etablissementId }), this.repo.prescriptions.find({ etablissementId })]);
    const today = this.today();
    const items = visites.sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt)).map((v) => {
      const ps = prescriptions.filter((p) => p.visiteId === v.id).sort((x, y) => x.echeance.localeCompare(y.echeance));
      return { ...v, prescriptions: ps.map((p) => ({ ...p, enRetard: p.statut !== 'levee' && p.echeance < today })), ouvertes: ps.filter((p) => p.statut !== 'levee').length };
    });
    const prochaine = items[0]?.prochaineVisite ?? null;
    return { items, prochaineVisite: prochaine, prochaineVisiteEnRetard: !!prochaine && prochaine < today };
  }

  // ───────── Plans d'étage et positionnement des équipements (bonus) ─────────
  /** Dépose (ou remplace) le plan d'un niveau. L'ancien fichier reste stocké : rien n'est jamais supprimé. */
  async savePlan(a: Actor, raw: unknown) {
    const d = this.parse(S.planInput, raw);
    authorize(a, 'plan.write', d.etablissementId);
    await this.etab(d.etablissementId);
    const niveau = await this.repo.niveaux.get(d.niveauId);
    if (!niveau || niveau.etablissementId !== d.etablissementId) throw invalid('Niveau inconnu pour cet établissement');
    const buf = Buffer.from(d.image.base64, 'base64');
    if (buf.length > MAX_PHOTO) throw invalid('Image trop lourde (1,5 Mo max)');
    checkImage(buf, d.image.mime);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    return this.repo.transaction(async (r) => {
      const doc = await r.documents.insert({ etablissementId: d.etablissementId, nom: d.image.nom, mime: d.image.mime, taille: buf.length, sha256: sha, contenu: d.image.base64 });
      const existing = (await r.plans.find({ niveauId: d.niveauId }))[0];
      return existing ? (await r.plans.update(existing.id, { documentId: doc.id, nom: d.nom || existing.nom }))! : r.plans.insert({ etablissementId: d.etablissementId, niveauId: d.niveauId, nom: d.nom || niveau.nom, documentId: doc.id });
    });
  }
  async listPlans(a: Actor, etablissementId: string) {
    authorize(a, 'read', etablissementId);
    const [plans, positions, niveaux] = await Promise.all([this.repo.plans.find({ etablissementId }), this.repo.positions.find({ etablissementId }), this.repo.niveaux.find({ etablissementId })]);
    return plans.map((p) => ({
      ...p, niveau: niveaux.find((n) => n.id === p.niveauId)?.nom ?? '',
      positions: positions.filter((x) => x.planId === p.id && x.x !== null && x.y !== null).map((x) => ({ equipementId: x.equipementId, x: x.x as number, y: x.y as number })),
    })).sort((x, y) => x.niveau.localeCompare(y.niveau));
  }
  /** Place un équipement sur un plan (x/y en %), le déplace, ou le retire (x = y = null). */
  async placeEquipement(a: Actor, raw: unknown) {
    const d = this.parse(S.positionInput, raw);
    const plan = (await this.repo.plans.get(d.planId)) ?? (() => { throw notFound('Plan'); })();
    authorize(a, 'plan.write', plan.etablissementId);
    const eq = await this.equip(d.equipementId);
    if (eq.etablissementId !== plan.etablissementId) throw invalid('Équipement d’un autre établissement');
    const existing = (await this.repo.positions.find({ planId: plan.id, equipementId: eq.id }))[0];
    const pos = existing ? (await this.repo.positions.update(existing.id, { x: d.x, y: d.y }))! : await this.repo.positions.insert({ planId: plan.id, equipementId: eq.id, etablissementId: plan.etablissementId, x: d.x, y: d.y });
    return { planId: plan.id, equipementId: eq.id, x: pos.x, y: pos.y };
  }

  // ───────── Tableau de bord ─────────
  /** Équipement conforme = en service ∧ échéance non dépassée ∧ aucune non-conformité non levée. */
  async dashboard(a: Actor, etablissementId?: string) {
    authorize(a, 'read', etablissementId);
    const ets = (await this.accessible(a)).filter((e) => !etablissementId || e.id === etablissementId);
    const parEtablissement = [];
    const retards: ReturnType<ErpService['view']>[] = [];
    for (const et of ets) {
      const eqs = (await this.repo.equipements.find({ etablissementId: et.id })).filter((e) => e.statut !== 'hors_service');
      const ncs = (await this.repo.nonConformites.find({ etablissementId: et.id })).filter((n) => n.statut !== 'levee');
      const withNc = new Set(ncs.map((n) => n.equipementId));
      const late = eqs.filter((e) => this.etat(e) === 'en_retard');
      const conformes = eqs.filter((e) => this.etat(e) !== 'en_retard' && !withNc.has(e.id)).length;
      retards.push(...late.map((e) => this.view(e)));
      const prescriptionsOuvertes = (await this.repo.prescriptions.find({ etablissementId: et.id })).filter((p) => p.statut !== 'levee').length;
      parEtablissement.push({ id: et.id, nom: et.nom, prescriptionsOuvertes, equipements: eqs.length, enRetard: late.length, aVenir: eqs.filter((e) => this.etat(e) === 'a_venir').length, ncOuvertes: ncs.length, tauxConformite: eqs.length ? Math.round((conformes / eqs.length) * 100) : 100 });
    }
    const tot = parEtablissement.reduce((s, x) => ({ eq: s.eq + x.equipements, late: s.late + x.enRetard, nc: s.nc + x.ncOuvertes, presc: s.presc + x.prescriptionsOuvertes, ok: s.ok + Math.round((x.tauxConformite / 100) * x.equipements) }), { eq: 0, late: 0, nc: 0, presc: 0, ok: 0 });
    return { global: { equipements: tot.eq, enRetard: tot.late, ncOuvertes: tot.nc, prescriptionsOuvertes: tot.presc, tauxConformite: tot.eq ? Math.round((tot.ok / tot.eq) * 100) : 100 }, parEtablissement, equipementsEnRetard: retards.sort((x, y) => x.prochaineEcheance.localeCompare(y.prochaineEcheance)).slice(0, 20) };
  }

  // ───────── Alertes e-mail (tâche planifiée, idempotente) ─────────
  /**
   * Fiabilité : (1) l'échéance est stockée → un simple balayage la retrouve même si le serveur était arrêté ;
   * (2) chaque alerte a une clé unique (équipement|échéance|type[|semaine]) enregistrée APRÈS l'envoi réussi :
   *     panne SMTP → pas de clé → réessai au prochain passage ; double exécution → pas de doublon ;
   * (3) les retards sont rappelés chaque semaine jusqu'au contrôle.
   */
  async runAlerts() {
    const today = this.today(), wk = weekStart(today);
    const report = { etablissements: 0, mails: 0, alertes: 0, echecs: [] as { etablissementId: string; erreur: string }[] };
    const sent = new Set((await this.repo.alertes.find()).map((x) => x.cle));
    for (const et of await this.repo.etablissements.find()) {
      if (!et.emailAlertes) continue;
      const items: { cle: string; ligne: string }[] = [];
      for (const e of await this.repo.equipements.find({ etablissementId: et.id })) {
        if (e.statut === 'hors_service') continue;
        const etat = this.etat(e);
        if (etat === 'a_venir') items.push({ cle: `${e.id}|${e.prochaineEcheance}|avant`, ligne: `À VENIR (${e.prochaineEcheance}, dans ${daysBetween(today, e.prochaineEcheance)} j) : ${e.libelle} — ${e.emplacement || 'emplacement non précisé'}` });
        if (etat === 'en_retard') items.push({ cle: `${e.id}|${e.prochaineEcheance}|retard|${wk}`, ligne: `EN RETARD depuis le ${e.prochaineEcheance} : ${e.libelle} — ${e.emplacement || 'emplacement non précisé'}` });
      }
      for (const x of await this.repo.actions.find({ etablissementId: et.id })) {
        if (x.statut !== 'terminee' && x.echeance < today) items.push({ cle: `${x.id}|${x.echeance}|action|${wk}`, ligne: `ACTION CORRECTIVE EN RETARD (échéance ${x.echeance}, resp. ${x.responsable}) : ${x.description}` });
      }
      for (const p of await this.repo.prescriptions.find({ etablissementId: et.id })) {
        if (p.statut !== 'levee' && p.echeance < today) items.push({ cle: `${p.id}|${p.echeance}|prescription|${wk}`, ligne: `PRESCRIPTION DE LA COMMISSION EN RETARD (échéance ${p.echeance}, resp. ${p.responsable}) : ${p.description}` });
      }
      const derniere = (await this.repo.visites.find({ etablissementId: et.id })).sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt))[0];
      if (derniere?.prochaineVisite) {
        const pv = derniere.prochaineVisite;
        if (pv < today) items.push({ cle: `${derniere.id}|${pv}|visite-retard|${wk}`, ligne: `VISITE DE LA COMMISSION DÉPASSÉE (prévue le ${pv}) : planifiez-la et enregistrez-la.` });
        else if (daysBetween(today, pv) <= this.alertDays) items.push({ cle: `${derniere.id}|${pv}|visite-avant`, ligne: `VISITE DE LA COMMISSION À VENIR (${pv}, dans ${daysBetween(today, pv)} j)` });
      }
      const fresh = items.filter((i) => !sent.has(i.cle));
      if (!fresh.length) continue;
      report.etablissements++;
      try {
        await this.mailer.send(et.emailAlertes, `[Sécurité incendie] ${et.nom} : ${fresh.length} alerte(s)`, `Bonjour,\n\nÉtablissement : ${et.nom}\n\n${fresh.map((i) => `• ${i.ligne}`).join('\n')}\n\nConnectez-vous au module pour saisir les contrôles.`);
        for (const i of fresh) { await this.repo.alertes.insert({ cle: i.cle }); sent.add(i.cle); }
        report.mails++; report.alertes += fresh.length;
      } catch (e) { report.echecs.push({ etablissementId: et.id, erreur: e instanceof Error ? e.message : String(e) }); }
    }
    return report;
  }

  // ───────── Utilisateurs et authentification ─────────
  async createUser(a: Actor, raw: unknown) {
    authorize(a, 'users.manage');
    const d = this.parse(S.userInput, raw);
    if ((await this.repo.users.find({ email: d.email })).length) throw conflict('Cet e-mail est déjà utilisé');
    for (const id of d.etablissementIds) await this.etab(id);
    const u = await this.repo.users.insert({ email: d.email, nom: d.nom, role: d.role, passwordHash: hashPassword(d.password) });
    for (const etablissementId of d.etablissementIds) await this.repo.acces.insert({ userId: u.id, etablissementId });
    return { id: u.id, email: u.email, nom: u.nom, role: u.role, etablissementIds: d.etablissementIds };
  }
  async actorFor(userId: string): Promise<Actor> {
    const u = (await this.repo.users.get(userId)) ?? (() => { throw forbidden('Session invalide ou expirée'); })();
    return { id: u.id, nom: u.nom, role: u.role, etablissementIds: u.role === 'admin' ? '*' : (await this.repo.acces.find({ userId })).map((x) => x.etablissementId) };
  }
  /** Message d'erreur identique pour e-mail inconnu et mot de passe faux (pas d'énumération de comptes). */
  async login(email: string, password: string) {
    const u = (await this.repo.users.find({ email: String(email).trim().toLowerCase() }))[0];
    if (!u || !verifyPassword(String(password), u.passwordHash)) throw forbidden('Identifiants incorrects');
    const actor = await this.actorFor(u.id);
    return { token: signToken(actor, this.opts.jwtSecret ?? (() => { throw new Error('ERP_JWT_SECRET manquant'); })()), actor };
  }
}
