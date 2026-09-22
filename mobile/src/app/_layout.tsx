import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/context/AuthContext';
import { colors } from '@/theme';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export default function RootLayout() {
  useEffect(() => {
    Notifications.setNotificationChannelAsync('default', { name: 'NextDoorLearn updates', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => undefined);
    const openNotification = (response: Notifications.NotificationResponse | null) => {
      const link = response?.notification.request.content.data?.link;
      const relatedId = response?.notification.request.content.data?.relatedId;
      const destination = typeof link === 'string' ? notificationRoute(link, relatedId) : '/(app)/notifications';
      router.push(destination as never);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    Notifications.getLastNotificationResponseAsync().then(openNotification).catch(() => undefined);
    return () => subscription.remove();
  }, []);
  return <AuthProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} /></AuthProvider>;
}

const notificationRoute = (link: string, relatedId?: unknown) => {
  const id = typeof relatedId === 'number' || (typeof relatedId === 'string' && /^\d+$/.test(relatedId))
    ? String(relatedId)
    : '';
  if (link.startsWith('/messages')) return id ? `/(app)/conversation/${id}` : '/(app)/(tabs)/messages';
  if (link.startsWith('/sessions')) return id ? `/(app)/session/${id}` : '/(app)/(tabs)/schedule';
  if (link.startsWith('/requests')) return '/(app)/(tabs)/discover';
  if (link.startsWith('/payments')) return '/(app)/payments';
  if (link.startsWith('/progress')) return '/(app)/progress';
  if (link.startsWith('/profile')) return '/(app)/profile';
  return '/(app)/notifications';
};
