import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { radius, space, useTheme } from './theme';

export type MonthBar = {
  key: string;
  /** Short month under the bar ("nov"). */
  label: string;
  cents: number;
  /** Something is due but has no price on record: an outlined "?" instead of a bar. */
  unknown: boolean;
};

type Props = { bars: MonthBar[]; accessibilityLabel: string };

const PLOT = 96;
const reais = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * One column per month, bar height by amount, value on top of the months that have one. A single
 * series, so no legend; the spoken label carries every value.
 */
export function MonthBars({ bars, accessibilityLabel }: Props) {
  const { c } = useTheme();
  const max = Math.max(1, ...bars.map((b) => b.cents));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.plot}>
        {bars.map((b) => {
          const height = b.cents > 0 ? Math.max(4, Math.round((PLOT * b.cents) / max)) : 0;
          return (
            <View key={b.key} testID={`bar-${b.key}`} style={styles.column}>
              <AppText variant="caption" numberOfLines={1} style={styles.value}>
                {b.cents > 0 ? reais.format(b.cents / 100) : b.unknown ? '?' : ''}
              </AppText>
              {b.cents > 0 ? (
                <View style={[styles.bar, { height, backgroundColor: c.primary }]} />
              ) : b.unknown ? (
                <View style={[styles.bar, styles.unknown, { borderColor: c.inkMuted }]} />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={[styles.axis, { backgroundColor: c.line }]} />
      <View style={styles.labels}>
        {bars.map((b) => (
          <AppText key={b.key} variant="caption" color="inkMuted" style={styles.label}>
            {b.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', height: PLOT + 22, gap: 2 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { fontSize: 11, marginBottom: 2 },
  bar: { width: 14, borderTopLeftRadius: radius.drum, borderTopRightRadius: radius.drum },
  unknown: { height: 22, borderWidth: 1.5, borderStyle: 'dashed', borderBottomWidth: 0 },
  axis: { height: 1 },
  labels: { flexDirection: 'row', gap: 2, marginTop: space.xs },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
});
