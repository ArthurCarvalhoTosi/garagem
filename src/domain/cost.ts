import { addMonths, daysBetween, type ISODate } from './dates';

// Fewer days of readings make a per-km figure a guess: a single trip skews it.
const MIN_SPAN_DAYS = 90;

export type CostSummary = {
  total: number;
  thisYear: number;
  last12Months: number;
  /** Cents per km over the readings of the last 12 months, or null when they can't tell. */
  perKm: number | null;
};

/** What the car cost (cents) all told, this calendar year, the last 12 months, and per km. */
export function costSummary(
  logs: { performedAt: ISODate; costCents: number | null }[],
  readings: { readAt: ISODate; km: number }[],
  today: ISODate,
): CostSummary {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const since = addMonths(today, -12);
  const sum = (from: ISODate, to: ISODate = today) =>
    logs.reduce(
      (s, l) => (l.performedAt >= from && l.performedAt <= to ? s + (l.costCents ?? 0) : s),
      0,
    );

  // Costs between the first and last reading of the window, over the km driven between them.
  const window = readings.filter((r) => r.readAt >= since && r.readAt <= today);
  let perKm: number | null = null;
  if (window.length >= 2) {
    const first = window.reduce((a, r) =>
      r.readAt < a.readAt || (r.readAt === a.readAt && r.km < a.km) ? r : a,
    );
    const last = window.reduce((a, r) =>
      r.readAt > a.readAt || (r.readAt === a.readAt && r.km > a.km) ? r : a,
    );
    const km = last.km - first.km;
    const cost = sum(first.readAt, last.readAt);
    // Under a cent per km would read "R$ 0,00": say nothing rather than that.
    if (daysBetween(first.readAt, last.readAt) >= MIN_SPAN_DAYS && km > 0 && cost >= km)
      perKm = Math.round(cost / km);
  }

  return { total: sum('0000-01-01'), thisYear: sum(yearStart), last12Months: sum(since), perKm };
}
