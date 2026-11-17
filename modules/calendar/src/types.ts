/**
 * Snapify — module Calendrier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
export interface Settings {
  pageTitle: string;
  pageIntro: string;
  timezone: string;
  showPast: boolean;
}

export interface CalEvent {
  title: string;
  slug: string;
  description: string;
  location: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** HH:mm ou vide */
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string;
  status: 'published' | 'draft';
}
