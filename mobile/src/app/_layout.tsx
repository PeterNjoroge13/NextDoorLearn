import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/context/AuthContext';
import { colors } from '@/theme';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export default function RootLayout() {
  useEffect(() => { Notifications.setNotificationChannelAsync('default', { name: 'NextDoorLearn updates', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => undefined); }, []);
  return <AuthProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} /></AuthProvider>;
}
