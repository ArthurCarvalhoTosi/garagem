import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useAccount } from '@/account';
import { useDb } from '@/db/provider';
import { backupPrefsQuery, readBackupPrefs, snoozeBackupReminder, vehiclesQuery } from '@/db/repo';
import { addDays, backupReminder, type ISODate } from '@/domain';
import { Notice } from '@/ui';

/**
 * Without an account the phone holds the only copy: nudges a backup on the dashboard when the
 * last one is old or there never was one. With an account, the cloud already keeps a copy.
 */
export function BackupReminder({ today }: { today: ISODate }) {
  const db = useDb();
  const account = useAccount(db);
  const prefs = useLiveQuery(backupPrefsQuery(db));
  const cars = useLiveQuery(vehiclesQuery(db));

  if (account.status !== 'signed-out' || !prefs.updatedAt || !cars.updatedAt) return null;
  const status = backupReminder(
    { ...readBackupPrefs(prefs.data), firstCarAt: cars.data[0]?.createdAt.slice(0, 10) ?? null },
    today,
  );
  if (!status) return null;

  return (
    <Notice
      icon="backup"
      tone="attention"
      title="Backup"
      lines={[status, 'Se perder o celular, perde o histórico.']}
      actions={[
        { label: 'Fazer backup', onPress: () => router.push('/backup') },
        {
          label: 'Agora não',
          // Losing this only means the strip shows again on the next open.
          onPress: () => void snoozeBackupReminder(db, addDays(today, 30)).catch(() => {}),
        },
      ]}
    />
  );
}
