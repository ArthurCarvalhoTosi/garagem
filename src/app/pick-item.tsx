import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDb } from '@/db/provider';
import { itemsQuery, readingsQuery, vehiclesQuery } from '@/db/repo';
import { buildFeed, dueLabel, todayISO } from '@/domain';
import { AppText, Button, ItemRow, Screen, space } from '@/ui';

/** "Registrar troca" from the Painel footer: pick which maintenance was done, then register it. */
export default function PickItem() {
  const db = useDb();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const cars = useLiveQuery(vehiclesQuery(db));
  const items = useLiveQuery(itemsQuery(db, vehicleId), [vehicleId]);
  const readings = useLiveQuery(readingsQuery(db, vehicleId), [vehicleId]);
  const [today] = useState(todayISO);

  const failed = cars.error ?? items.error ?? readings.error;
  if (failed) throw failed;
  const vehicle = cars.data.find((v) => v.id === vehicleId);
  if (!cars.updatedAt || !items.updatedAt || !readings.updatedAt || !vehicle) return null;

  const feed = buildFeed(items.data, readings.data, vehicle.monthlyKmEstimate, today);
  // Replace, not push: on iOS a pushed screen would open underneath this sheet.
  const pick = (itemId: string) => router.replace({ pathname: '/register', params: { itemId } });

  return (
    <Screen scroll>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Qual troca você fez?
      </AppText>
      <View>
        {[...feed.critical, ...feed.attention, ...feed.ok].map(({ item, due }) => (
          <ItemRow
            key={item.id}
            name={item.name}
            urgency={due.urgency}
            primary={dueLabel(due).primary}
            onPress={() => pick(item.id)}
          />
        ))}
      </View>
      <View style={styles.start}>
        <Button
          variant="quiet"
          icon="plus"
          label="Outra manutenção"
          onPress={() => router.replace({ pathname: '/item', params: { vehicleId } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.l },
  start: { alignItems: 'flex-start', marginTop: space.s },
});
