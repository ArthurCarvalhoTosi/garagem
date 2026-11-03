import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { deleteRemovedPhotos, hasPhoto, readPhoto } from '@/attachments';
import { useDb } from '@/db/provider';
import { itemsQuery, logsQuery, readingsQuery, removeMaintenance } from '@/db/repo';
import type { vehicles } from '@/db/schema';
import { useCurrentVehicle } from '@/db/useCurrentVehicle';
import {
  addMonths,
  buildFeed,
  costForecast,
  costSummary,
  dueLabel,
  formatBRL,
  formatDate,
  formatKm,
  formatMonthLong,
  formatMonthShort,
  formatMonthYear,
  gapLabel,
  logFacts,
  projectOdometer,
  timingLabel,
  todayISO,
  ValidationError,
  type FeedEntry,
  type ISODate,
  type LogFacts,
} from '@/domain';
import {
  AppText,
  Button,
  FormError,
  Icon,
  MonthBars,
  PlateChip,
  Screen,
  Section,
  TimelineRow,
  radius,
  space,
  useTheme,
  type IconName,
} from '@/ui';

type Log = ReturnType<ReturnType<typeof logsQuery>['all']>[number];
type Item = ReturnType<ReturnType<typeof itemsQuery>['all']>[number];
type Reading = ReturnType<ReturnType<typeof readingsQuery>['all']>[number];
type Entry = FeedEntry<Item>;

export default function History() {
  const db = useDb();
  const vehicle = useCurrentVehicle(db);
  if (vehicle === undefined) return null;
  if (!vehicle) return <Redirect href="/onboarding" />;
  // Keyed: a fresh mount per car, so one car's photo or error never shows on another.
  return <CarHistory key={vehicle.id} vehicle={vehicle} />;
}

/**
 * The car's timeline: forecast on top (farthest first), "Hoje" in the middle, records below by
 * year, so time runs down the screen from the future into the past.
 */
function CarHistory({ vehicle }: { vehicle: typeof vehicles.$inferSelect }) {
  const db = useDb();
  const { c } = useTheme();
  const logs = useLiveQuery(logsQuery(db, vehicle.id), [vehicle.id]);
  const readings = useLiveQuery(readingsQuery(db, vehicle.id), [vehicle.id]);
  const items = useLiveQuery(itemsQuery(db, vehicle.id), [vehicle.id]);
  const [error, setError] = useState<unknown>(null);
  const [showLater, setShowLater] = useState(false);
  // State, not computed per render: the compiler would reuse a stale value until the queries change.
  const [today] = useState(todayISO);

  const failed = logs.error ?? readings.error ?? items.error;
  if (failed) throw failed;
  if (!logs.updatedAt || !readings.updatedAt || !items.updatedAt) return null;

  const params = { vehicleId: vehicle.id };
  const feed = buildFeed(items.data, readings.data, vehicle.monthlyKmEstimate, today);
  const entries = [...feed.critical, ...feed.attention, ...feed.ok];
  // The next 12 months on the rail; the rest (and items without a forecast) behind "Mais adiante".
  const horizon = addMonths(today, 12);
  const soon = entries.filter((e) => e.due.dueDate && e.due.dueDate < horizon).sort(farthestFirst);
  const later = entries
    .filter((e) => !e.due.dueDate || e.due.dueDate >= horizon)
    .sort(farthestFirst);
  const forecast = costForecast(entries, logs.data, today);
  const facts = logFacts(logs.data, items.data);
  // Logs come newest first, so the first price seen per item is the last one paid.
  const lastCost = new Map<string, number>();
  for (const l of logs.data) {
    if (l.itemId && l.costCents !== null && !lastCost.has(l.itemId))
      lastCost.set(l.itemId, l.costCents);
  }
  const unknown = forecast.months.flatMap((m) => m.unknown);
  const spokenMonths = forecast.months
    .filter((m) => m.cents > 0 || m.unknown.length > 0)
    .map((m) => {
      const parts = [
        m.cents > 0 ? formatBRL(m.cents) : null,
        m.unknown.length > 0 ? `${m.unknown.join(', ')} sem valor registrado` : null,
      ].filter(Boolean);
      return `${formatMonthLong(m.month)}: ${parts.join(', mais ')}`;
    });

  const register = (itemId: string) => router.push({ pathname: '/register', params: { itemId } });
  const edit = (log: Log) =>
    router.push({ pathname: '/register', params: { vehicleId: vehicle.id, logId: log.id } });

  const remove = (log: Log) => {
    const gone = log.photo
      ? 'O registro e a foto do comprovante serão apagados deste aparelho.'
      : 'O registro será apagado deste aparelho.';
    Alert.alert(
      'Excluir esta troca?',
      `${nameOf(log)}, ${formatDate(log.performedAt)}. ${gone} Isso não pode ser desfeito.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            try {
              await removeMaintenance(db, log.id);
              deleteRemovedPhotos(db);
            } catch (e) {
              setError(e);
            }
          },
        },
      ],
    );
  };

  const futureRow = (entry: Entry) => (
    <TimelineRow
      key={entry.item.id}
      rail="forecast"
      node={entry.due.urgency === 'ok' ? 'hollow' : entry.due.urgency}
    >
      <ForecastStop
        entry={entry}
        lastCents={lastCost.get(entry.item.id)}
        onPress={() => register(entry.item.id)}
      />
    </TimelineRow>
  );

  return (
    <Screen
      tab
      scroll
      footer={
        <Button
          label="Registrar troca"
          onPress={() => router.push({ pathname: '/pick-item', params })}
        />
      }
    >
      <View style={styles.top}>
        <PlateChip nickname={vehicle.nickname} onPress={() => router.push('/vehicles')} />
        <View style={styles.titleRow}>
          <AppText variant="display" accessibilityRole="header">
            Histórico
          </AppText>
          {logs.data.length > 0 ? (
            <Button
              variant="quiet"
              icon="share-variant"
              label="Exportar"
              accessibilityLabel="Exportar histórico"
              onPress={() => router.push({ pathname: '/dossier', params })}
            />
          ) : null}
        </View>
      </View>

      {logs.data.length > 0 ? (
        <Totals logs={logs.data} readings={readings.data} today={today} />
      ) : null}

      {spokenMonths.length > 0 ? (
        <Section title="Próximos 12 meses">
          <View style={styles.forecast}>
            {forecast.totalCents > 0 ? (
              <AppText variant="number">{`~${formatBRL(forecast.totalCents)} previstos`}</AppText>
            ) : null}
            <MonthBars
              bars={forecast.months.map((m) => ({
                key: m.month,
                label: formatMonthShort(m.month),
                cents: m.cents,
                unknown: m.unknown.length > 0,
              }))}
              accessibilityLabel={`Gasto previsto por mês. ${spokenMonths.join('. ')}.`}
            />
            <AppText variant="caption" color="inkMuted">
              {unknown.length > 0
                ? `Pelo último valor pago em cada troca. Sem valor registrado: ${unknown.join(', ')}.`
                : 'Pelo último valor pago em cada troca.'}
            </AppText>
          </View>
        </Section>
      ) : null}

      <Section title="Linha do tempo">
        <FormError error={error} />
        {later.length > 0 ? (
          <TimelineRow rail="forecast">
            <View style={styles.start}>
              <Button
                variant="quiet"
                label={
                  later.length === 1
                    ? 'Mais adiante (1 troca)'
                    : `Mais adiante (${later.length} trocas)`
                }
                expanded={showLater}
                onPress={() => setShowLater(!showLater)}
              />
            </View>
          </TimelineRow>
        ) : null}
        {showLater ? later.map(futureRow) : null}
        {soon.map(futureRow)}

        <View style={styles.today}>
          <View style={[styles.todayMark, { backgroundColor: c.primary, borderColor: c.bg }]} />
          <View style={[styles.todayText, { borderTopColor: c.primary }]} accessible>
            <AppText variant="bodyStrong" color="primary">
              Hoje
            </AppText>
            <AppText variant="number" color="primary">
              {`${formatKm(projectOdometer(readings.data, vehicle.monthlyKmEstimate, today))} estimados`}
            </AppText>
          </View>
        </View>

        {logs.data.length === 0 ? (
          <AppText style={styles.empty}>
            Nenhuma troca registrada ainda. Quando você registrar a primeira, ela aparece aqui.
          </AppText>
        ) : (
          groupByYear(logs.data).map((y) => (
            <View key={y.year}>
              <TimelineRow rail="done">
                <View style={[styles.year, { borderBottomColor: c.line }]} accessible>
                  <AppText variant="plate" accessibilityRole="header">
                    {y.year}
                  </AppText>
                  <AppText color="inkMuted">{yearSummary(y.logs)}</AppText>
                </View>
              </TimelineRow>
              {y.logs.map((log) => (
                // Keyed on the photo too: a replaced photo starts closed instead of showing the old one.
                <TimelineRow key={`${log.id}:${log.photo}`} rail="done" node="filled">
                  <LogRow
                    log={log}
                    facts={facts.get(log.id)}
                    onEdit={() => edit(log)}
                    onRemove={() => remove(log)}
                  />
                </TimelineRow>
              ))}
            </View>
          ))
        )}
      </Section>
    </Screen>
  );
}

// No forecast sorts as the farthest.
const farthestFirst = (a: Entry, b: Entry) =>
  (a.due.dueDate ?? '9999') < (b.due.dueDate ?? '9999') ? 1 : -1;

function ForecastStop({
  entry: { item, due },
  lastCents,
  onPress,
}: {
  entry: Entry;
  lastCents: number | undefined;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const label = dueLabel(due);
  // The km only when it's the limit that sets the date; otherwise it isn't reached by then.
  const when = [
    due.dueDate ? `~${formatMonthYear(due.dueDate)}` : 'Sem previsão',
    due.dueBy === 'km' && due.dueKm !== null ? formatKm(due.dueKm) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const price =
    lastCents === undefined ? 'Sem valor registrado' : `Última vez ${formatBRL(lastCents)}`;
  const urgent = due.urgency !== 'ok';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.name, when, price, urgent ? label.primary : null]
        .filter(Boolean)
        .join('. ')}
      style={({ pressed }) => [styles.stop, pressed && { backgroundColor: c.line }]}
    >
      <AppText variant="bodyStrong">{item.name}</AppText>
      <AppText color="inkMuted">{when}</AppText>
      <AppText variant="caption" color="inkMuted">
        {price}
      </AppText>
      {urgent ? (
        <View style={styles.inline}>
          <Icon
            name={due.urgency === 'critical' ? 'alert-octagon' : 'alert'}
            size={18}
            color={c[due.urgency]}
          />
          <AppText variant="bodyStrong" color={due.urgency}>
            {label.primary}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function Totals({ logs, readings, today }: { logs: Log[]; readings: Reading[]; today: ISODate }) {
  const { c } = useTheme();
  const cost = costSummary(logs, readings, today);
  // Read like a trip computer: value on top, what it measures below. Spoken label first.
  const readouts = [
    { label: 'Este ano', spoken: 'Gasto este ano', cents: cost.thisYear },
    { label: 'Últimos 12 meses', spoken: 'Gasto nos últimos 12 meses', cents: cost.last12Months },
    ...(cost.perKm === null
      ? []
      : [{ label: 'Por km', spoken: 'Custo por km', cents: cost.perKm }]),
  ];
  const count = logs.length;
  return (
    <View style={styles.totals}>
      <View style={styles.total} accessible>
        <AppText variant="caption" color="inkMuted">
          Total gasto em manutenção
        </AppText>
        <AppText variant="number">{formatBRL(cost.total)}</AppText>
        <AppText color="inkMuted">
          {count === 1 ? '1 troca registrada' : `${count} trocas registradas`}
        </AppText>
      </View>
      <View style={[styles.readouts, { borderColor: c.line }]}>
        {readouts.map((r, i) => (
          <View
            key={r.label}
            accessible
            accessibilityLabel={`${r.spoken}: ${formatBRL(r.cents)}`}
            style={[styles.readout, i > 0 && { ...styles.divided, borderLeftColor: c.line }]}
          >
            <AppText variant="number">{formatBRL(r.cents)}</AppText>
            <AppText variant="caption" color="inkMuted">
              {r.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

// Logs arrive newest first, so years and their logs keep that order.
function groupByYear(logs: Log[]) {
  const years: { year: string; logs: Log[] }[] = [];
  for (const log of logs) {
    const year = log.performedAt.slice(0, 4);
    const last = years.at(-1);
    if (last?.year === year) last.logs.push(log);
    else years.push({ year, logs: [log] });
  }
  return years;
}

function yearSummary(logs: Log[]) {
  const total = logs.reduce((sum, l) => sum + (l.costCents ?? 0), 0);
  const count = logs.length === 1 ? '1 troca' : `${logs.length} trocas`;
  return total > 0 ? `${formatBRL(total)} em ${count}` : count;
}

const nameOf = (log: Log) => log.itemName ?? 'Manutenção';

function LogRow({
  log,
  facts,
  onEdit,
  onRemove,
}: {
  log: Log;
  facts: LogFacts | undefined;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  // Decrypted photo, in memory only while this row is on screen.
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<unknown>(null);
  // createdAt is a UTC timestamp; compare its local calendar day with the service date.
  const registeredOn = todayISO(new Date(log.createdAt));
  const what = `${nameOf(log)} de ${formatDate(log.performedAt)}`;

  const togglePhoto = async () => {
    if (open || !log.photo) return setOpen(false);
    setOpen(true);
    if (photo) return;
    setPhotoError(null);
    // A photo from another phone downloads after its row: the next sync brings it.
    if (!hasPhoto(log.photo)) {
      return setPhotoError(
        new ValidationError('A foto ainda está vindo da nuvem. Tente de novo daqui a pouco.'),
      );
    }
    try {
      setPhoto(await readPhoto(log.photo));
    } catch {
      setPhotoError(new ValidationError('Não foi possível abrir a foto. Tente de novo.'));
    }
  };

  return (
    <View style={[styles.row, { borderBottomColor: c.line }]}>
      <View style={styles.main}>
        <View accessible style={styles.info}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong" style={styles.shrink}>
              {nameOf(log)}
            </AppText>
            {log.costCents != null ? (
              <AppText variant="number">{formatBRL(log.costCents)}</AppText>
            ) : null}
          </View>
          <AppText>{`${formatDate(log.performedAt)} · ${formatKm(log.km)}`}</AppText>
          {log.brandSpec ? <AppText color="inkMuted">{log.brandSpec}</AppText> : null}
          {log.notes ? <AppText color="inkMuted">{log.notes}</AppText> : null}
          {registeredOn !== log.performedAt ? (
            <AppText variant="caption" color="inkMuted">
              {`Registrado em ${formatDate(registeredOn)}`}
            </AppText>
          ) : null}
          <View style={styles.chips}>
            {facts?.timing ? (
              <Chip
                icon={facts.timing.late ? 'alert' : 'check-circle-outline'}
                color={facts.timing.late ? 'attention' : 'ok'}
                label={timingLabel(facts.timing)}
              />
            ) : null}
            {facts && log.itemId ? <Chip icon="ruler" label={gapLabel(facts.gap)} /> : null}
            {log.photo ? <Chip icon="receipt" label="Com comprovante" /> : null}
          </View>
        </View>
        <IconButton icon="pencil" label={`Editar ${what}`} onPress={onEdit} />
        <IconButton icon="trash-can-outline" label={`Excluir ${what}`} onPress={onRemove} />
      </View>
      {log.photo ? (
        <View style={styles.start}>
          <Button
            variant="quiet"
            label={open ? 'Ocultar foto' : 'Ver foto'}
            accessibilityLabel={`${open ? 'Ocultar' : 'Ver'} foto do comprovante de ${what}`}
            expanded={open}
            onPress={togglePhoto}
          />
        </View>
      ) : null}
      {open ? (
        photo ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${photo}` }}
            // Decrypted: never into the image cache on disk.
            cachePolicy="none"
            contentFit="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Foto do comprovante de ${what}`}
            style={[styles.photo, { backgroundColor: c.surface, borderColor: c.line }]}
          />
        ) : photoError ? (
          <FormError error={photoError} />
        ) : (
          <AppText color="inkMuted">Abrindo a foto…</AppText>
        )
      ) : null}
    </View>
  );
}

/** A fact about a record on a small plaque; color is never the only cue (icon and words). */
function Chip({
  icon,
  label,
  color = 'inkMuted',
}: {
  icon: IconName;
  label: string;
  color?: 'ok' | 'attention' | 'inkMuted';
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.chip, { borderColor: c.line }]}>
      <Icon name={icon} size={16} color={c[color]} />
      <AppText variant="caption" color={color}>
        {label}
      </AppText>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: c.line }]}
    >
      <Icon name={icon} size={24} color={c.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { gap: space.l, marginBottom: space.xl },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s,
  },
  totals: { marginBottom: space.xxl },
  total: { gap: space.xs, marginBottom: space.l },
  readouts: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: space.m,
  },
  readout: { flex: 1, gap: space.xs, paddingRight: space.m },
  divided: { borderLeftWidth: 1, paddingLeft: space.m },
  forecast: { gap: space.m },
  stop: { gap: 2, paddingVertical: space.m },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  today: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 56 },
  todayMark: { width: 28, height: 28, borderRadius: 14, borderWidth: 6 },
  todayText: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.s,
    borderTopWidth: 2,
    paddingTop: space.s,
  },
  empty: { marginTop: space.m },
  year: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.s,
    paddingTop: space.l,
    paddingBottom: space.xs,
    borderBottomWidth: 1,
  },
  row: { gap: space.xs, paddingVertical: space.m, borderBottomWidth: 1 },
  main: { flexDirection: 'row', alignItems: 'flex-start' },
  info: { flex: 1, gap: space.xs },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space.s,
  },
  shrink: { flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.s,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: radius.plaque,
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  start: { alignItems: 'flex-start' },
  photo: { height: 320, borderWidth: 1, borderRadius: radius.plaque },
});
