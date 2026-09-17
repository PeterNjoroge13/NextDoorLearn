import { Redirect } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return <Redirect href={user ? '/(app)/(tabs)/home' : '/(auth)/welcome'} />;
}
