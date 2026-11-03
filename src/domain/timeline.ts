import { addMonths, daysBetween, type ISODate } from './dates';
import type { FeedEntry } from './feed';
import { formatKm } from './format';

export interface TimelineLog {
  id: string;
  itemId: string | null;
  performedAt: ISODate;
  km: number;
  costCents: number | null;
}

export interface TimelineItem {
  id: string;
  name: string;
  intervalKm: number | null;
  intervalMonths: number | null;
  startKm: number | null;
  startDate: ISODate | null;
}

/** Against the due that applied when it was done: on time, or past the limit that came first. */
export type Timing = { late: false } | { late: true; km: number } | { late: true; days: number };

export interface LogFacts {
  /** null when there's nothing to compare with (no interval, or no earlier point). */
  timing: Timing | null;
  /** Since the item's previous log; null for its first one. */
  gap: { km: number; days: number } | null;
}

/**
 * Facts for each log of each item, walking its logs in order. The previous point is the previous
 * log, or the item's marco zero for the first one when the marco comes before it (a log typed in
 * for a service before the car was added has nothing before it).
 * shortcut: uses the item's current interval for every log; if the interval was edited, older logs
 * are judged by the new one. Keeping interval history would fix it; not worth it until asked.
 */
export function logFacts(logs: TimelineLog[], items: TimelineItem[]): Map<string, LogFacts> {
  const facts = new Map<string, LogFacts>();
  const byItem = new Map(items.map((i) => [i.id, i]));
  const ordered = [...logs].sort((a, b) =>
    a.performedAt < b.performedAt ? -1 : a.performedAt > b.performedAt ? 1 : a.km - b.km,
  );
  const last = new Map<string, TimelineLog>();

  for (const log of ordered) {
    const item = log.itemId ? byItem.get(log.itemId) : undefined;
    if (!item) {
      facts.set(log.id, { timing: null, gap: null });
      continue;
    }
    const prevLog = last.get(item.id);
    const marco =
      item.startKm !== null &&
      item.startDate !== null &&
      item.startDate <= log.performedAt &&
      item.startKm <= log.km
        ? { km: item.startKm, performedAt: item.startDate }
        : null;
    const prev = prevLog ?? marco;
    facts.set(log.id, {
      timing: prev ? timingOf(item, prev, log) : null,
      gap: prevLog
        ? { km: log.km - prevLog.km, days: daysBetween(prevLog.performedAt, log.performedAt) }
        : null,
    });
    last.set(item.id, log);
  }
  return facts;
}

function timingOf(
  item: TimelineItem,
  prev: { km: number; performedAt: ISODate },
  log: TimelineLog,
): Timing | null {
  if (item.intervalKm === null && item.intervalMonths === null) return null;
  const kmOver = item.intervalKm === null ? 0 : log.km - (prev.km + item.intervalKm);
  const daysOver =
    item.intervalMonths === null
      ? 0
      : daysBetween(addMonths(prev.performedAt, item.intervalMonths), log.performedAt);
  // km is what the user sees on the panel, so it wins when both limits were passed.
  if (kmOver > 0) return { late: true, km: kmOver };
  if (daysOver > 0) return { late: true, days: daysOver };
  return { late: false };
}

function spanLabel(days: number): string {
  if (days <= 60) return days === 1 ? '1 dia' : `${days} dias`;
  const months = Math.round(days / 30.44);
  return months === 1 ? '1 mês' : `${months} meses`;
}

/** "No prazo", "1.100 km depois do previsto", "20 dias depois do previsto". */
export function timingLabel(t: Timing): string {
  if (!t.late) return 'No prazo';
  return 'km' in t
    ? `${formatKm(t.km)} depois do previsto`
    : `${spanLabel(t.days)} depois do previsto`;
}

/** "9.800 km em 12 meses"; the first log of an item reads "Primeira vez registrada". */
export function gapLabel(gap: LogFacts['gap']): string {
  if (!gap) return 'Primeira vez registrada';
  return `${formatKm(gap.km)} em ${spanLabel(gap.days)}`;
}

export interface ForecastMonth {
  /** First day of the month. */
  month: ISODate;
  cents: number;
  /** Items due that month with no price on record. */
  unknown: string[];
}

/**
 * Expected spend for this month and the next 11, using the last price paid for each item. Overdue
 * items land in this month: they're due now. Items without a price are listed, not counted as zero.
 */
export function costForecast<T extends { id: string; name: string }>(
  entries: FeedEntry<T>[],
  logs: TimelineLog[],
  today: ISODate,
): { months: ForecastMonth[]; totalCents: number } {
  const start = `${today.slice(0, 7)}-01`;
  const months: ForecastMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: addMonths(start, i),
    cents: 0,
    unknown: [],
  }));
  const lastCost = new Map<string, number>();
  const newestFirst = [...logs].sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1));
  for (const l of newestFirst) {
    if (l.itemId && l.costCents !== null && !lastCost.has(l.itemId))
      lastCost.set(l.itemId, l.costCents);
  }

  for (const { item, due } of entries) {
    if (!due.dueDate) continue;
    const when = due.dueDate < today ? start : due.dueDate;
    const i = monthIndex(start, when);
    if (i >= 12) continue;
    const cents = lastCost.get(item.id);
    if (cents === undefined) months[i].unknown.push(item.name);
    else months[i].cents += cents;
  }
  return { months, totalCents: months.reduce((sum, m) => sum + m.cents, 0) };
}

function monthIndex(start: ISODate, d: ISODate): number {
  const [y0, m0] = start.split('-').map(Number);
  const [y, m] = d.split('-').map(Number);
  return (y - y0) * 12 + (m - m0);
}

const monthYearFormat = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const monthLongFormat = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const utc = (d: ISODate) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};

/** "set. de 2027" */
export const formatMonthYear = (d: ISODate) => monthYearFormat.format(utc(d));
/** "set", for a narrow chart column. */
export const formatMonthShort = (d: ISODate) => monthFormat.format(utc(d)).replace('.', '');
/** "setembro", for screen readers. */
export const formatMonthLong = (d: ISODate) => monthLongFormat.format(utc(d));
