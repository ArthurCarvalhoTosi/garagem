import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAccount } from '@/account';
import { useDb } from '@/db/provider';
import { backupPrefsQuery, readBackupPrefs, snoozeBackupReminder, vehiclesQuery } from '@/db/repo';
import { addDays, backupReminder, type ISODate } from '@/domain';
import { AppText, Button, space } from '@/ui';

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
  const message = backupReminder(
    { ...readBackupPrefs(prefs.data), firstCarAt: cars.data[0]?.createdAt.slice(0, 10) ?? null },
    today,
  );
  if (!message) return null;

  return (
    <View style={styles.block}>
      <AppText>{message}</AppText>
      <View style={styles.actions}>
        <Button variant="secondary" label="Fazer backup" onPress={() => router.push('/backup')} />
        <Button
          variant="quiet"
          label="Agora não"
          // Losing this only means the card shows again on the next open.
          onPress={() => snoozeBackupReminder(db, addDays(today, 30)).catch(() => {})}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.s, marginBottom: space.xxl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.xl },
});
