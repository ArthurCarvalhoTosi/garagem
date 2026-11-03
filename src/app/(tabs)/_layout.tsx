import { NativeTabs } from 'expo-router/native-tabs';
import { type, useTheme } from '@/ui';

// Native tabs: Material 3 navigation bar on Android, the system tab bar (Liquid Glass) on iOS.
export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <NativeTabs
      backgroundColor={c.surface}
      indicatorColor={c.navIndicator}
      rippleColor={c.line}
      iconColor={{ default: c.inkMuted, selected: c.ink }}
      labelStyle={{
        default: { fontFamily: type.caption.fontFamily, color: c.inkMuted },
        selected: { fontFamily: type.bodyStrong.fontFamily, color: c.ink },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="gauge.with.dots.needle.67percent" md="speed" />
        <NativeTabs.Trigger.Label>Painel</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="calendar.day.timeline.left" md="timeline" />
        <NativeTabs.Trigger.Label>Histórico</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
