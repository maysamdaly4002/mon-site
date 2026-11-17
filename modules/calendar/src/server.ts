/**
 * Snapify — module Calendrier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { defineServerModule, type ModuleRequest, type ServerContext, type StoredRecord } from '@snapify/sdk';
import type { CalEvent, Settings } from './types';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const events = ctx.db.collection<CalEvent>('events');

    function cleanEvent(input: unknown, current?: StoredRecord<CalEvent>): CalEvent {
      const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
      const title = str(b.title ?? current?.title, 160);
      if (!title) throw ctx.error(422, 'Le titre est obligatoire.');
      const date = str(b.date ?? current?.date, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw ctx.error(422, 'Date invalide (AAAA-MM-JJ).');
      const slug = slugify(str(b.slug, 80) || `${title}-${date}`) || `event-${date}`;
      return {
        title,
        slug,
        description: str(b.description, 5000),
        location: str(b.location, 200),
        date,
        startTime: str(b.startTime, 5),
        endTime: str(b.endTime, 5),
        allDay: b.allDay === true || (!str(b.startTime, 5) && !current?.startTime),
        color: str(b.color, 20) || '#00C6BA',
        status: b.status === 'draft' ? 'draft' : 'published',
      };
    }

    const publicRow = (e: StoredRecord<CalEvent>) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      description: e.description,
      location: e.location,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      allDay: e.allDay,
      color: e.color,
    });

    ctx.http.get('/events', async (req) => {
      const from = str(req.query.from, 10);
      const to = str(req.query.to, 10);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const { items } = await events.find({
        where: { status: 'published' },
        orderBy: [{ field: 'date', dir: 'asc' }, { field: 'startTime', dir: 'asc' }],
        limit: 500,
      });
      let list = items;
      if (from) list = list.filter((e) => e.date >= from);
      if (to) list = list.filter((e) => e.date <= to);
      if (!ctx.settings().showPast) {
        const today = new Date().toISOString().slice(0, 10);
        list = list.filter((e) => e.date >= today);
      }
      return { events: list.slice(0, limit).map(publicRow) };
    });

    ctx.http.get('/events/:slug', async (req) => {
      const e = await events.findOne({ slug: req.params.slug, status: 'published' });
      if (!e) throw ctx.error(404, 'Événement introuvable');
      return { event: publicRow(e) };
    });

    ctx.http.get('/widget/upcoming', async (req) => {
      const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
      const today = new Date().toISOString().slice(0, 10);
      const { items } = await events.find({
        where: { status: 'published' },
        orderBy: [{ field: 'date', dir: 'asc' }],
        limit: 200,
      });
      return { events: items.filter((e) => e.date >= today).slice(0, limit).map(publicRow) };
    });

    ctx.admin.get('/events', async () => {
      const { items, total } = await events.find({
        orderBy: [{ field: 'date', dir: 'desc' }],
        limit: 500,
      });
      return { events: items, total };
    });

    ctx.admin.get('/events/:id', async (req) => {
      const e = await events.get(req.params.id);
      if (!e) throw ctx.error(404, 'Événement introuvable');
      return { event: e };
    });

    ctx.admin.post('/events', async (req: ModuleRequest) => {
      const data = cleanEvent(req.body);
      const other = await events.findOne({ slug: data.slug });
      if (other) throw ctx.error(409, `L’adresse « ${data.slug} » est déjà utilisée.`);
      const e = await events.insert(data);
      return { event: e };
    });

    ctx.admin.put('/events/:id', async (req) => {
      const current = await events.get(req.params.id);
      if (!current) throw ctx.error(404, 'Événement introuvable');
      const data = cleanEvent(req.body, current);
      const other = await events.findOne({ slug: data.slug });
      if (other && other.id !== current.id) throw ctx.error(409, `L’adresse « ${data.slug} » est déjà utilisée.`);
      const e = await events.update(current.id, data);
      return { event: e };
    });

    ctx.admin.delete('/events/:id', async (req) => {
      if (!(await events.delete(req.params.id))) throw ctx.error(404, 'Événement introuvable');
      return { ok: true };
    });

    ctx.admin.status(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [all, upcoming] = await Promise.all([
        events.count({ where: { status: 'published' } }),
        events.count({ where: { status: 'published' }, filters: [{ field: 'date', op: 'gte', value: today }] }),
      ]);
      return {
        stats: [
          { label: 'Événements publiés', value: all },
          { label: 'À venir', value: upcoming },
        ],
      };
    });
  },
});
