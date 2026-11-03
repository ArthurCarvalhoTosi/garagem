import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useDb } from '@/db/provider';
import { itemsQuery, readingsQuery, specsQuery } from '@/db/repo';
import { useCurrentVehicle } from '@/db/useCurrentVehicle';
import type { vehicles } from '@/db/schema';
import {
  buildFeed,
  dueLabel,
  formatPair,
  isProjectionStale,
  projectOdometer,
  todayISO,
} from '@/domain';
import { BackupReminder } from '@/backup/BackupReminder';
import { NotificationPrompt } from '@/notifications/NotificationPrompt';
import {
  AppText,
  Button,
  Icon,
  ItemRow,
  Odometer,
  PlateChip,
  Screen,
  Section,
  SpecStrip,
  space,
  useTheme,
} from '@/ui';

export default function Dashboard() {
  const db = useDb();
  const vehicle = useCurrentVehicle(db);
  if (vehicle === undefined) return null;
  if (!vehicle) return <Redirect href="/onboarding" />;

  // Keyed: useLiveQuery keeps the previous car's data while it reloads, so a fresh mount
  // waits for the new car instead of rolling the drums between two cars' numbers.
  return <Garage key={vehicle.id} vehicle={vehicle} />;
}

function Garage({ vehicle }: { vehicle: typeof vehicles.$inferSelect }) {
  const db = useDb();
  const { c } = useTheme();
  const readings = useLiveQuery(readingsQuery(db, vehicle.id), [vehicle.id]);
  const items = useLiveQuery(itemsQuery(db, vehicle.id), [vehicle.id]);
  const specs = useLiveQuery(specsQuery(db, vehicle.id), [vehicle.id]);
  const [showOk, setShowOk] = useState(false);
  // State, not computed per render: the compiler would reuse a stale value until the queries change.
  const [today, setToday] = useState(todayISO);

  // The app can sit in the background past midnight; pick up the new day when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(todayISO());
    });
    return () => sub.remove();
  }, []);

  const failed = readings.error ?? items.error ?? specs.error;
  if (failed) throw failed;
  // Wait for real data so the drums don't roll up from zero and the feed doesn't flash "Tudo em dia".
  if (!readings.updatedAt || !items.updatedAt || !specs.updatedAt) return null;

  const feed = buildFeed(items.data, readings.data, vehicle.monthlyKmEstimate, today);
  const needsAttention = [...feed.critical, ...feed.attention];
  const s = specs.data[0];

  const register = (itemId: string) => router.push({ pathname: '/register', params: { itemId } });
  const params = { vehicleId: vehicle.id };
  const row = ({ item, due }: (typeof feed.ok)[number]) => {
    const label = dueLabel(due);
    return (
      <ItemRow
        key={item.id}
        name={item.name}
        urgency={due.urgency}
        primary={label.primary}
        secondary={label.secondary}
        onPress={() => register(item.id)}
        action={{ label: 'Registrar troca', onPress: () => register(item.id) }}
        end={
          <Pressable
            onPress={() => router.push({ pathname: '/item', params: { itemId: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.name}`}
            style={({ pressed }) => [styles.edit, pressed && { backgroundColor: c.line }]}
          >
            <Icon name="pencil" size={24} color={c.inkMuted} />
          </Pressable>
        }
      />
    );
  };

  return (
    <Screen
      tab
      scroll
      footer={
        <Button
          variant="secondary"
          label="Ajustar KM"
          onPress={() => router.push({ pathname: '/adjust-km', params })}
        />
      }
    >
      <View style={styles.plate}>
        <PlateChip nickname={vehicle.nickname} onPress={() => router.push('/vehicles')} />
      </View>
      <View style={styles.block}>
        <Odometer km={projectOdometer(readings.data, vehicle.monthlyKmEstimate, today)} estimated />
        {isProjectionStale(readings.data, today) ? (
          <AppText color="inkMuted">
            Faz mais de 30 dias que o KM não é atualizado. Ajuste para melhorar as previsões.
          </AppText>
        ) : null}
      </View>

      <Section title="Cola de bolso">
        <SpecStrip
          items={[
            { key: 'oil', icon: 'oil', label: 'Óleo', value: s?.oilSpec ?? null },
            {
              key: 'tires',
              icon: 'car-tire-alert',
              label: 'Calibragem',
              value: formatPair(s?.tireFrontPsi, s?.tireRearPsi, 'psi'),
            },
            {
              key: 'wipers',
              icon: 'wiper',
              label: 'Palhetas',
              value: formatPair(s?.wiperDriver, s?.wiperPassenger),
            },
            { key: 'battery', icon: 'car-battery', label: 'Bateria', value: s?.battery ?? null },
          ]}
          onEdit={() => router.push({ pathname: '/specs', params })}
        />
        {/* Values from the seed: the user didn't type them, so say where they came from. */}
        {vehicle.modelRef ? (
          <AppText variant="caption" color="inkMuted">
            Valores de referência. Confira no manual do proprietário.
          </AppText>
        ) : null}
      </Section>

      {needsAttention.length > 0 ? (
        <Section title="Precisa de atenção">
          <View>{needsAttention.map(row)}</View>
        </Section>
      ) : (
        <View style={styles.block}>
          <AppText variant="lead">Tudo em dia.</AppText>
          {feed.next ? (
            <AppText color="inkMuted">
              {`Próxima: ${feed.next.item.name}, ${lowerFirst(dueLabel(feed.next.due).primary)}`}
            </AppText>
          ) : null}
        </View>
      )}

      <BackupReminder today={today} />
      <NotificationPrompt />

      {feed.ok.length > 0 ? (
        <View>
          <View style={styles.start}>
            <Button
              variant="quiet"
              label={`Em dia (${feed.ok.length})`}
              expanded={showOk}
              onPress={() => setShowOk(!showOk)}
            />
          </View>
          {showOk ? feed.ok.map(row) : null}
        </View>
      ) : null}

      <View style={styles.start}>
        <Button
          variant="quiet"
          label="Adicionar manutenção"
          onPress={() => router.push({ pathname: '/item', params })}
        />
      </View>
    </Screen>
  );
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const styles = StyleSheet.create({
  block: { gap: space.s, marginBottom: space.xxl },
  start: { alignItems: 'flex-start' },
  plate: { marginBottom: space.xl },
  edit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
