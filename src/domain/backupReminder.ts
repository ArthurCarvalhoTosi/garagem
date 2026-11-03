import { daysBetween, type ISODate } from './dates';

export type BackupState = {
  lastBackupAt: ISODate | null;
  /** When the first car still in the garage was added. */
  firstCarAt: ISODate | null;
  snoozedUntil: ISODate | null;
};

/**
 * How stale this phone's backup is ("Nunca feito", "Último há 4 meses") when it's worth a
 * nudge, or null: never backed up with a car here for over 30 days, or the last backup over
 * 90 days old, unless snoozed.
 */
export function backupReminder(s: BackupState, today: ISODate): string | null {
  if (!s.firstCarAt || (s.snoozedUntil && today < s.snoozedUntil)) return null;
  if (!s.lastBackupAt) {
    return daysBetween(s.firstCarAt, today) > 30 ? 'Nunca feito' : null;
  }
  const days = daysBetween(s.lastBackupAt, today);
  if (days <= 90) return null;
  return `Último há ${Math.floor(days / 30)} meses`;
}
