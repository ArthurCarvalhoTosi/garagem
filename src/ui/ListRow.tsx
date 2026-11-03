import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { space, useTheme } from './theme';

type Props = { icon: IconName; label: string; description?: string; onPress: () => void };

/** A full-width row that opens another screen, for lists of places to go (Ajustes). */
export function ListRow({ icon, label, description, onPress }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.line : c.surface, borderBottomColor: c.line },
      ]}
    >
      <Icon name={icon} size={24} color={c.inkMuted} />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" color="inkMuted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-right" size={24} color={c.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 56,
    paddingVertical: space.m,
    paddingHorizontal: space.l,
    borderBottomWidth: 1,
  },
  text: { flex: 1 },
});
