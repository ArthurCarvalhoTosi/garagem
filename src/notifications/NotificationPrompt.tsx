import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { useDb } from '@/db/provider';
import { answerNotificationPrompt, notificationPromptQuery } from '@/db/repo';
import { Notice } from '@/ui';
import { rescheduleDigest, setupNotifications } from './scheduler';

/**
 * Explains the Saturday reminder before the system asks, on the dashboard, once the user has a car
 * and sees what it tracks. Answered either way, it never shows again; a refusal changes nothing else.
 */
export function NotificationPrompt() {
  const db = useDb();
  const answered = useLiveQuery(notificationPromptQuery(db));
  const [askable, setAskable] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let live = true;
    // Not `undetermined`: Android 13+ reports a never-asked permission as denied (notifications off).
    Notifications.getPermissionsAsync().then(
      (p) => live && setAskable(!p.granted && p.canAskAgain),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  if (!askable || !answered.updatedAt || answered.data.length > 0) return null;

  const close = () => {
    setAskable(false);
    // Losing this only means the card shows again on the next open.
    answerNotificationPrompt(db).catch(() => {});
  };
  const enable = async () => {
    if (asking) return;
    setAsking(true);
    try {
      await setupNotifications();
      const p = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true },
      });
      if (p.granted) await rescheduleDigest();
    } catch {
      // The app works the same without reminders.
    }
    close();
  };

  return (
    <Notice
      icon="bell"
      title="Quer um lembrete aos sábados?"
      lines={[
        'Aos sábados, às 9h, o Garagem avisa quais trocas estão chegando nos seus carros. Se estiver tudo em dia, ele não avisa.',
      ]}
      actions={[
        { label: 'Ativar lembretes', loading: asking, onPress: enable },
        { label: 'Agora não', disabled: asking, onPress: close },
      ]}
    />
  );
}
