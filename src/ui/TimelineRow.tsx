import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space, useTheme, type ColorName } from './theme';

type Props = {
  /** Faint rail for what's forecast, solid for what happened. */
  rail: 'forecast' | 'done';
  /** The mark on the rail: hollow for a forecast, filled for a record, none for a header. */
  node?: 'hollow' | 'filled' | 'attention' | 'critical' | 'none';
  children: ReactNode;
};

const fill: Record<'filled' | 'attention' | 'critical', ColorName> = {
  filled: 'ink',
  attention: 'attentionBar',
  critical: 'critical',
};

/** One stop on the history timeline: the rail with its mark on the left, the content beside it. */
export function TimelineRow({ rail, node = 'none', children }: Props) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <View
        style={styles.gutter}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.rail, { backgroundColor: rail === 'done' ? c.ink : c.line }]} />
        {node === 'none' ? null : (
          <View
            style={[
              styles.node,
              node === 'hollow'
                ? { backgroundColor: c.bg, borderColor: c.inkMuted }
                : { backgroundColor: c[fill[node]], borderColor: c[fill[node]] },
            ]}
          />
        )}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const GUTTER = 28;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.m },
  gutter: { width: GUTTER },
  rail: { position: 'absolute', top: 0, bottom: 0, left: GUTTER / 2 - 1, width: 2 },
  node: {
    position: 'absolute',
    top: space.l + 2,
    left: GUTTER / 2 - 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  content: { flex: 1, minWidth: 0 },
});
