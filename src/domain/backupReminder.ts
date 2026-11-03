import { daysBetween, type ISODate } from './dates';

export type BackupState = {
  lastBackupAt: ISODate | null;
  /** When the first car still in the garage was added. */
  firstCarAt: ISODate | null;
  snoozedUntil: ISODate | null;
};

/**
 * The nudge to back up for someone without an account, or null: never backed up with a car
 * here for over 30 days, or the last backup over 90 days old, unless snoozed.
 */
export function backupReminder(s: BackupState, today: ISODate): string | null {
  if (!s.firstCarAt || (s.snoozedUntil && today < s.snoozedUntil)) return null;
  if (!s.lastBackupAt) {
    return daysBetween(s.firstCarAt, today) > 30
      ? 'Você ainda não fez nenhum backup. Se perder o celular, perde o histórico.'
      : null;
  }
  const days = daysBetween(s.lastBackupAt, today);
  if (days <= 90) return null;
  return `Seu último backup foi há ${Math.floor(days / 30)} meses. Se perder o celular, perde o histórico.`;
}
