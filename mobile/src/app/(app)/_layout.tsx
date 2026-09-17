import { Redirect, Stack } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
