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
  lifeUsed,
  projectOdometer,
  todayISO,
} from '@/domain';
import { BackupReminder } from '@/backup/BackupReminder';
import { NotificationPrompt } from '@/notifications/NotificationPrompt';
import {
  AppText,
  Button,
  Icon,
  InstrumentPanel,
  ItemRow,
  PlateChip,
  Screen,
  Section,
  SpecStrip,
  space,
  useTheme,
  type IconName,
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
  // Every item, worst first: the plan for the car stays in view, not behind a toggle.
  const entries = [...needsAttention, ...feed.ok];
  const urgencyOf = new Map(entries.map((e) => [e.item.id, e.due.urgency]));
  const s = specs.data[0];

  const register = (itemId: string) => router.push({ pathname: '/register', params: { itemId } });
  const params = { vehicleId: vehicle.id };

  const worst = needsAttention[0];
  const more = needsAttention.length - 1;
  const status = worst
    ? {
        urgency: worst.due.urgency,
        text: `${worst.item.name}, ${lowerFirst(dueLabel(worst.due).primary)}`,
        detail:
          more === 0
            ? null
            : more === 1
              ? 'Mais 1 troca precisa de atenção.'
              : `Mais ${more} trocas precisam de atenção.`,
      }
    : {
        urgency: 'ok' as const,
        text: 'Tudo em dia.',
        detail: feed.next
          ? `Próxima: ${feed.next.item.name}, ${lowerFirst(dueLabel(feed.next.due).primary)}`
          : null,
      };

  return (
    <Screen
      tab
      scroll
      footer={
        <View style={styles.footer}>
          <View style={styles.grow}>
            <Button
              label="Registrar troca"
              onPress={() => router.push({ pathname: '/pick-item', params })}
            />
          </View>
          <Button
            variant="secondary"
            label="Ajustar KM"
            onPress={() => router.push({ pathname: '/adjust-km', params })}
          />
        </View>
      }
    >
      <View style={styles.plate}>
        <PlateChip nickname={vehicle.nickname} onPress={() => router.push('/vehicles')} />
      </View>
      <View style={styles.block}>
        <InstrumentPanel
          km={projectOdometer(readings.data, vehicle.monthlyKmEstimate, today)}
          estimated
          // In creation order, so a light never moves when its urgency changes.
          lights={items.data.map((item) => ({
            key: item.id,
            icon: telltaleIcon[item.templateKey ?? ''] ?? 'wrench',
            urgency: urgencyOf.get(item.id) ?? 'ok',
          }))}
          status={status}
        />
        {isProjectionStale(readings.data, today) ? (
          <AppText color="inkMuted">
            Faz mais de 30 dias que o KM não é atualizado. Ajuste para melhorar as previsões.
          </AppText>
        ) : null}
      </View>

      {entries.length > 0 ? (
        <Section title="Próximas trocas">
          <View>
            {entries.map(({ item, due }) => {
              const label = dueLabel(due);
              return (
                <ItemRow
                  key={item.id}
                  name={item.name}
                  urgency={due.urgency}
                  primary={label.primary}
                  secondary={label.secondary}
                  life={lifeUsed(item, due, today)}
                  onPress={() => register(item.id)}
                  action={{ label: 'Registrar troca', onPress: () => register(item.id) }}
                  end={
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/item', params: { itemId: item.id } })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${item.name}`}
                      style={({ pressed }) => [styles.edit, pressed && { backgroundColor: c.line }]}
                    >
                      <Icon name="pencil" size={24} color={c.inkMuted} />
                    </Pressable>
                  }
                />
              );
            })}
          </View>
          <View style={styles.start}>
            <Button
              variant="quiet"
              icon="plus"
              label="Adicionar manutenção"
              onPress={() => router.push({ pathname: '/item', params })}
            />
          </View>
        </Section>
      ) : (
        <View style={[styles.block, styles.start]}>
          <Button
            variant="secondary"
            icon="plus"
            label="Adicionar manutenção"
            onPress={() => router.push({ pathname: '/item', params })}
          />
        </View>
      )}

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

      {/* Asks that can wait sit after the car's own information. */}
      <BackupReminder today={today} />
      <NotificationPrompt />
    </Screen>
  );
}

// Lights for the presets; an item the user created gets the generic wrench.
const telltaleIcon: Partial<Record<string, IconName>> = {
  oil: 'oil',
  air_filters: 'air-filter',
  tire_rotation: 'car-tire-alert',
  brakes: 'car-brake-alert',
  timing_belt: 'timing-belt',
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const styles = StyleSheet.create({
  block: { gap: space.s, marginBottom: space.xxl },
  start: { alignItems: 'flex-start' },
  plate: { marginBottom: space.l },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: space.m },
  grow: { flexGrow: 1 },
  edit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
