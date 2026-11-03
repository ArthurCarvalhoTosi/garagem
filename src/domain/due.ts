import { addDays, addMonths, daysBetween, type ISODate } from './dates';
import { dailyRate, projectOdometer, type OdometerReading } from './odometer';

export type Urgency = 'critical' | 'attention' | 'ok';

export interface ItemSchedule {
  intervalKm: number | null;
  intervalMonths: number | null;
  baselineKm: number;
  baselineDate: ISODate;
}

export interface Due {
  dueDate: ISODate | null;
  daysLeft: number | null;
  dueKm: number | null;
  kmLeft: number | null;
  /** Which limit sets dueDate. A 'km' date is an estimate from the average km/day. */
  dueBy: 'km' | 'time' | null;
  urgency: Urgency;
}

export function computeDue(
  item: ItemSchedule,
  readings: OdometerReading[],
  monthlyEstimate: number,
  today: ISODate,
): Due {
  const timeDate =
    item.intervalMonths != null ? addMonths(item.baselineDate, item.intervalMonths) : null;

  let kmDate: ISODate | null = null;
  let dueKm: number | null = null;
  let kmLeft: number | null = null;
  if (item.intervalKm != null) {
    dueKm = item.baselineKm + item.intervalKm;
    kmLeft = dueKm - projectOdometer(readings, monthlyEstimate, today);
    const rate = dailyRate(readings, monthlyEstimate, today);
    if (rate > 0)
      kmDate = addDays(today, kmLeft <= 0 ? Math.floor(kmLeft / rate) : Math.ceil(kmLeft / rate));
    else if (kmLeft <= 0) kmDate = today; // rate 0 and km still ahead: never reached, no date
  }

  // A tie goes to km: with the km already passed, the item is overdue even if the calendar says today.
  const dueBy =
    kmDate !== null && (timeDate === null || kmDate <= timeDate)
      ? 'km'
      : timeDate !== null
        ? 'time'
        : null;
  const dueDate = dueBy === 'km' ? kmDate : timeDate;
  const daysLeft = dueDate ? daysBetween(today, dueDate) : null;
  return { dueDate, daysLeft, dueKm, kmLeft, dueBy, urgency: urgencyOf(daysLeft, kmLeft) };
}

/**
 * How much of the interval is used up, 0 to 1, by whichever limit is further along (the one that
 * comes first). Past the limit it stays at 1. `null` for an item without an interval.
 */
export function lifeUsed(item: ItemSchedule, due: Due, today: ISODate): number | null {
  const parts: number[] = [];
  if (item.intervalKm != null && item.intervalKm > 0 && due.kmLeft !== null)
    parts.push(1 - due.kmLeft / item.intervalKm);
  if (item.intervalMonths != null && item.intervalMonths > 0) {
    const span = daysBetween(item.baselineDate, addMonths(item.baselineDate, item.intervalMonths));
    parts.push(daysBetween(item.baselineDate, today) / span);
  }
  if (parts.length === 0) return null;
  return Math.min(1, Math.max(0, ...parts));
}

const atMost = (v: number | null, limit: number) => v != null && v <= limit;

export function urgencyOf(daysLeft: number | null, kmLeft: number | null): Urgency {
  if (atMost(daysLeft, 15) || atMost(kmLeft, 500)) return 'critical';
  if (atMost(daysLeft, 45) || atMost(kmLeft, 1500)) return 'attention';
  return 'ok';
}
