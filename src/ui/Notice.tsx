import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { radius, space, useTheme } from './theme';

type Action = { label: string; onPress: () => void; loading?: boolean; disabled?: boolean };

type Props = {
  icon: IconName;
  title: string;
  lines: string[];
  /** The first is the main one. */
  actions: Action[];
  /** Attention for something at risk (no backup); otherwise a plain offer. */
  tone?: 'attention' | 'offer';
};

/** An ask that can wait, at the end of a screen: one outlined strip, never a second hero. */
export function Notice({ icon, title, lines, actions, tone = 'offer' }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { borderColor: c.line }]}>
      <Icon name={icon} size={24} color={tone === 'attention' ? c.attention : c.primary} />
      <View style={styles.body}>
        {/* One screen-reader stop; at risk says so in words, not only with the icon's color. */}
        <View
          accessible
          accessibilityLabel={[title, tone === 'attention' ? 'Atenção' : null, ...lines]
            .filter(Boolean)
            .join('. ')}
          style={styles.text}
        >
          <AppText variant="bodyStrong">{title}</AppText>
          {lines.map((line) => (
            <AppText key={line} color="inkMuted">
              {line}
            </AppText>
          ))}
        </View>
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button
              key={a.label}
              variant="quiet"
              label={a.label}
              loading={a.loading}
              disabled={a.disabled}
              onPress={a.onPress}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.m,
    padding: space.l,
    paddingBottom: space.s,
    borderWidth: 1,
    borderRadius: radius.button,
    marginBottom: space.xl,
  },
  body: { flex: 1, gap: space.xs },
  text: { gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl },
});
