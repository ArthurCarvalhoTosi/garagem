import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { radius, space, useTheme } from './theme';

type Props = { nickname: string; onPress: () => void };

/**
 * The car's nickname on a little Mercosul-style plate (white body, blue band) that opens the car list.
 * A plate is white in any theme, so its colors don't follow the palette.
 */
export function PlateChip({ nickname, onPress }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Trocar de carro. Atual: ${nickname}`}
      // The plate is shorter than 48dp: the slop keeps the touch target at the minimum.
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.plate,
        { backgroundColor: c.plateBody, borderColor: c.plateInk },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.band, { backgroundColor: c.plateBand }]} />
      <View style={styles.body}>
        <AppText variant="plate" numberOfLines={1} style={[styles.name, { color: c.plateInk }]}>
          {nickname}
        </AppText>
        <Icon name="chevron-down" size={20} color={c.plateBand} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 1.5,
    borderRadius: radius.plaque,
    overflow: 'hidden',
  },
  band: { height: 8 },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.m,
    paddingRight: space.s,
    paddingVertical: 2,
  },
  name: { flexShrink: 1 },
  pressed: { opacity: 0.82 },
});
