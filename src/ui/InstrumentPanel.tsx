import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import type { Urgency } from './ItemRow';
import { Odometer } from './Odometer';
import { radius, space, useTheme, type ColorName } from './theme';

export type Telltale = { key: string; icon: IconName; urgency: Urgency };

type Props = {
  km: number;
  estimated?: boolean;
  /** One light per maintenance item, in a fixed order, like the lights on a real panel. */
  lights: Telltale[];
  /** The panel's sentence: the worst item, or the all-clear. It is what screen readers get. */
  status: { urgency: Urgency; text: string; detail?: string | null };
};

const IGNITION_MS = 1200;
// Once per app launch, not every time the Painel remounts (switching cars, coming back to the tab).
let ignitionDone = false;

const lit: Record<Urgency, ColorName> = {
  critical: 'telltaleRed',
  attention: 'telltaleAmber',
  ok: 'telltaleOff',
};
// Same shapes as ItemRow, so the panel and the list read the same way.
const statusIcon: Record<Urgency, IconName> = {
  critical: 'alert-octagon',
  attention: 'alert',
  ok: 'check-circle-outline',
};
const statusInk: Record<Urgency, ColorName> = {
  critical: 'telltaleRed',
  attention: 'telltaleAmber',
  ok: 'panelInk',
};

/**
 * The dashboard's cluster: drums, telltale lights and a status sentence on a dark panel. On the
 * first open the lights run the ignition check: all on for a moment, then only the ones that count.
 */
export function InstrumentPanel({ km, estimated = false, lights, status }: Props) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [ignition, setIgnition] = useState(() => !ignitionDone && !reduceMotion);

  useEffect(() => {
    ignitionDone = true;
    if (!ignition) return;
    const t = setTimeout(() => setIgnition(false), IGNITION_MS);
    return () => clearTimeout(t);
  }, [ignition]);

  return (
    <View style={[styles.panel, { backgroundColor: c.panel, borderColor: c.panelRule }]}>
      <Odometer km={km} estimated={estimated} />
      {lights.length > 0 ? (
        <View
          testID="telltales"
          style={[styles.lights, { borderColor: c.panelRule }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {lights.map((l) => (
            <View key={l.key} testID={`telltale-${l.key}`} style={styles.light}>
              <Icon
                name={l.icon}
                size={28}
                color={ignition ? c.telltaleAmber : c[lit[l.urgency]]}
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.status} accessible>
        <Icon name={statusIcon[status.urgency]} size={22} color={c[statusInk[status.urgency]]} />
        <View style={styles.statusText}>
          <AppText variant="status" color={statusInk[status.urgency]}>
            {status.text}
          </AppText>
          {status.detail ? <AppText color="panelMuted">{status.detail}</AppText> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: space.l,
    gap: space.l,
  },
  lights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: space.s,
    paddingVertical: space.m,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  light: { minWidth: 40, alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  statusText: { flex: 1, gap: space.xs },
});
