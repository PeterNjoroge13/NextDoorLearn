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
      const destination = typeof link === 'string' ? notificationRoute(link) : '/(app)/notifications';
      router.push(destination as never);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    Notifications.getLastNotificationResponseAsync().then(openNotification).catch(() => undefined);
    return () => subscription.remove();
  }, []);
  return <AuthProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} /></AuthProvider>;
}

const notificationRoute = (link: string) => {
  if (link.startsWith('/messages')) return '/(app)/(tabs)/messages';
  if (link.startsWith('/sessions')) return '/(app)/(tabs)/schedule';
  if (link.startsWith('/requests')) return '/(app)/(tabs)/discover';
  if (link.startsWith('/profile')) return '/(app)/profile';
  return '/(app)/notifications';
};
