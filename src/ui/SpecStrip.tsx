import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { radius, space, useTheme } from './theme';

export type SpecItem = { key: string; icon: IconName; label: string; value: string | null };

type Props = { items: SpecItem[]; onEdit: () => void };

/** The pocket cheat sheet: one row per spec, values big enough to read at the pump. */
export function SpecStrip({ items, onEdit }: Props) {
  const { c } = useTheme();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedKey) return;
    const t = setTimeout(() => setCopiedKey(null), 1500);
    return () => clearTimeout(t);
  }, [copiedKey]);

  // Nothing filled in: one invitation instead of a row of empty slots.
  if (items.every((i) => !i.value)) {
    return (
      <View style={styles.invite}>
        <AppText color="inkMuted">
          {`Guarde ${listOf(items.map((i) => i.label.toLowerCase()))} para consultar no posto.`}
        </AppText>
        <View style={styles.start}>
          <Button variant="secondary" label="Adicionar" icon="plus" onPress={onEdit} />
        </View>
      </View>
    );
  }

  const copy = async (item: SpecItem & { value: string }) => {
    await Clipboard.setStringAsync(item.value);
    AccessibilityInfo.announceForAccessibility('Copiado');
    setCopiedKey(item.key);
  };

  return (
    <View>
      <View style={[styles.box, { borderColor: c.line, backgroundColor: c.surface }]}>
        {items.map((item, i) => {
          const { value } = item;
          const rowStyle = ({ pressed }: { pressed: boolean }) => [
            styles.row,
            i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
            pressed && { backgroundColor: c.line },
          ];
          const icon = <Icon name={item.icon} size={22} color={c.inkMuted} />;

          if (!value) {
            return (
              <Pressable
                key={item.key}
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: Adicionar`}
                style={rowStyle}
              >
                {icon}
                <AppText color="inkMuted" style={styles.label}>
                  {item.label}
                </AppText>
                <AppText variant="bodyStrong" color="primary">
                  Adicionar
                </AppText>
              </Pressable>
            );
          }

          const copied = copiedKey === item.key;
          return (
            <Pressable
              key={item.key}
              onLongPress={() => copy({ ...item, value })}
              accessibilityLabel={`${item.label}: ${value}`}
              accessibilityHint="Toque longo para copiar"
              accessibilityActions={[{ name: 'longpress', label: 'Copiar' }]}
              onAccessibilityAction={() => copy({ ...item, value })}
              style={rowStyle}
            >
              {icon}
              <AppText color={copied ? 'ok' : 'inkMuted'} style={styles.label}>
                {copied ? 'Copiado' : item.label}
              </AppText>
              <AppText variant="number" style={styles.value}>
                {value}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.end}>
        <Button variant="quiet" label="Editar" icon="pencil" onPress={onEdit} />
      </View>
    </View>
  );
}

// "a, b, c e d"
function listOf(words: string[]) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} e ${words.at(-1)}`;
}

const styles = StyleSheet.create({
  invite: { gap: space.m },
  start: { alignItems: 'flex-start' },
  box: { borderWidth: 1, borderRadius: radius.plaque, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.m,
    minHeight: 52,
    paddingVertical: space.s,
    paddingHorizontal: space.m,
  },
  label: { flex: 1, minWidth: 96 },
  value: { flexShrink: 1, textAlign: 'right' },
  end: { alignItems: 'flex-end' },
});
