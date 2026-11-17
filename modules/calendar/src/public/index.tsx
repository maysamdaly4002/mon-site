/**
 * Snapify — module Calendrier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { definePublicModule, type PublicPageProps, type WidgetProps } from '@snapify/sdk';
import type { Settings } from '../types';

interface EventCard {
  id: string;
  title: string;
  slug: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string;
}

function useEvents(api: PublicPageProps['api'], query: string) {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ events: EventCard[] }>(`/events?${query}`)
      .then((r) => {
        if (!cancelled) setEvents(r.events || []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, query]);
  return { events, loading };
}

function formatDay(date: string) {
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return date;
  }
}

function EventList({ events, navigate }: { events: EventCard[]; navigate: (p: string) => void }) {
  if (!events.length) return <p className="text-sm text-slate-500">Aucun événement pour le moment.</p>;
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => navigate(`/agenda/${e.slug}/`)}
            className="flex w-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-px-primary/40 hover:shadow-md"
          >
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: e.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-px-primary">{formatDay(e.date)}</div>
              <div className="mt-1 font-semibold text-px-navy">{e.title}</div>
              <div className="mt-1 text-sm text-slate-500">
                {e.allDay ? 'Journée entière' : `${e.startTime || '—'} – ${e.endTime || '—'}`}
                {e.location ? ` · ${e.location}` : ''}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MonthWidget({ options, api, navigate }: WidgetProps<Settings, { title?: string }>) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  const { events } = useEvents(api, `from=${from}&to=${to}&limit=100`);
  const byDay = useMemo(() => {
    const map = new Map<string, EventCard[]>();
    for (const e of events) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const startPad = new Date(y, m, 1).getDay(); // 0 Sun
  const pad = (startPad + 6) % 7; // Monday-first
  const cells: (number | null)[] = [...Array(pad).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-px-navy">{options.title || 'Calendrier'}</h2>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border p-2" onClick={() => setCursor(new Date(y, m - 1, 1))} aria-label="Mois précédent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-36 text-center text-sm font-semibold capitalize">
            {cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" className="rounded-lg border p-2" onClick={() => setCursor(new Date(y, m + 1, 1))} aria-label="Mois suivant">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="aspect-square rounded-xl bg-slate-50/50" />;
          const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = byDay.get(key) || [];
          return (
            <button
              key={key}
              type="button"
              onClick={() => dayEvents[0] && navigate(`/agenda/${dayEvents[0].slug}/`)}
              className={`aspect-square rounded-xl border p-1 text-sm transition ${dayEvents.length ? 'border-px-primary/30 bg-px-primary/5 font-semibold text-px-navy' : 'border-transparent bg-white text-slate-600'}`}
            >
              <div>{day}</div>
              {dayEvents.length ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-px-primary" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function UpcomingWidget({ options, api, navigate }: WidgetProps<Settings, { title?: string; limit?: number; buttonLabel?: string }>) {
  const { events, loading } = useEvents(api, `limit=${options.limit || 5}`);
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-px-navy">{options.title || 'À venir'}</h2>
        {options.buttonLabel ? (
          <button type="button" className="text-sm font-semibold text-px-primary" onClick={() => navigate('/agenda/')}>
            {options.buttonLabel}
          </button>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-slate-500">Chargement…</p> : <EventList events={events} navigate={navigate} />}
    </section>
  );
}

function AgendaPage({ settings, api, path, navigate, setMeta, search }: PublicPageProps<Settings>) {
  const slug = path.replace(/^\/(agenda|calendrier)\/?/, '').replace(/\/$/, '');
  const monthQ = new URLSearchParams(search).get('mois');
  const [detail, setDetail] = useState<EventCard | null>(null);

  useEffect(() => {
    setMeta({ title: settings.pageTitle || 'Agenda', description: settings.pageIntro });
  }, [settings.pageTitle, settings.pageIntro, setMeta]);

  useEffect(() => {
    if (!slug) {
      setDetail(null);
      return;
    }
    api
      .get<{ event: EventCard }>(`/events/${encodeURIComponent(slug)}`)
      .then((r) => {
        setDetail(r.event);
        setMeta({ title: r.event.title });
      })
      .catch(() => setDetail(null));
  }, [api, slug, setMeta]);

  const { events, loading } = useEvents(api, monthQ ? `from=${monthQ}-01&to=${monthQ}-31&limit=100` : 'limit=50');

  if (slug && detail) {
    return (
      <article className="mx-auto max-w-2xl px-4 py-12">
        <button type="button" onClick={() => navigate('/agenda/')} className="mb-6 text-sm font-semibold text-px-primary">
          ← Retour à l’agenda
        </button>
        <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-px-primary">
          <CalendarDays className="h-4 w-4" />
          {formatDay(detail.date)}
        </div>
        <h1 className="text-3xl font-bold text-px-navy">{detail.title}</h1>
        <p className="mt-2 text-slate-600">
          {detail.allDay ? 'Journée entière' : `${detail.startTime || '—'} – ${detail.endTime || '—'}`}
        </p>
        {detail.location ? (
          <p className="mt-2 flex items-center gap-2 text-slate-600">
            <MapPin className="h-4 w-4" /> {detail.location}
          </p>
        ) : null}
        {detail.description ? <div className="prose prose-slate mt-8 max-w-none whitespace-pre-wrap">{detail.description}</div> : null}
      </article>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-px-navy">{settings.pageTitle || 'Agenda'}</h1>
      {settings.pageIntro ? <p className="mt-3 text-slate-600">{settings.pageIntro}</p> : null}
      <div className="mt-8">{loading ? <p className="text-sm text-slate-500">Chargement…</p> : <EventList events={events} navigate={navigate} />}</div>
    </div>
  );
}

export default definePublicModule<Settings>({
  page: AgendaPage,
  widgets: {
    upcoming: UpcomingWidget,
    month: MonthWidget,
  },
});
