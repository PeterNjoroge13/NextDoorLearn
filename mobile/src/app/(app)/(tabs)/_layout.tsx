import { Tabs } from 'expo-router';
import { CalendarDays, Compass, Home, Inbox, MessageCircle, MoreHorizontal, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, typography } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth(); const tutor = user?.role === 'tutor';
  return <Tabs screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: colors.brandStrong, tabBarInactiveTintColor: colors.muted, tabBarActiveBackgroundColor: colors.brandSoft, tabBarStyle: { height: 68 + insets.bottom, paddingTop: 8, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1 }, tabBarItemStyle: { minHeight: 50, marginHorizontal: 2, borderRadius: 7 }, tabBarLabelStyle: { fontFamily: typography.medium, fontSize: 10 } }}>
    <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
    <Tabs.Screen name="discover" options={{ title: tutor ? 'Requests' : 'Tutors', tabBarIcon: ({ color, size }) => tutor ? <Inbox size={size} color={color} /> : <Compass size={size} color={color} /> }} />
    <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} /> }} />
    <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} /> }} />
    <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => tutor ? <Users size={size} color={color} /> : <MoreHorizontal size={size} color={color} /> }} />
  </Tabs>;
}
