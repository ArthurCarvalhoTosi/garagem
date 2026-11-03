import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAccount } from '@/account';
import { useDb } from '@/db/provider';
import { backupPrefsQuery, readBackupPrefs, snoozeBackupReminder, vehiclesQuery } from '@/db/repo';
import { addDays, backupReminder, type ISODate } from '@/domain';
import { ItemRow, space } from '@/ui';

/**
 * Without an account the phone holds the only copy: nudges a backup on the dashboard when the
 * last one is old or there never was one. With an account, the cloud already keeps a copy.
 * Drawn as an urgency row, like a maintenance item: the data needs looking after too.
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
    <View style={styles.block}>
      <ItemRow
        name="Backup"
        urgency="attention"
        primary={status}
        secondary="Se perder o celular, perde o histórico."
        actions={[
          { label: 'Fazer backup', onPress: () => router.push('/backup') },
          {
            label: 'Agora não',
            // Losing this only means the row shows again on the next open.
            onPress: () => void snoozeBackupReminder(db, addDays(today, 30)).catch(() => {}),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: space.xxl },
});
