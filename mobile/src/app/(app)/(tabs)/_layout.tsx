import { Tabs } from 'expo-router';
import { CalendarDays, Compass, Home, Inbox, MessageCircle, MoreHorizontal, Users } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { colors, typography } from '@/theme';

export default function TabsLayout() {
  const { user } = useAuth(); const tutor = user?.role === 'tutor';
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 82, paddingTop: 8, paddingBottom: 18, backgroundColor: colors.surface, borderTopColor: colors.line }, tabBarLabelStyle: { fontFamily: typography.medium, fontSize: 11 } }}>
    <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
    <Tabs.Screen name="discover" options={{ title: tutor ? 'Requests' : 'Tutors', tabBarIcon: ({ color, size }) => tutor ? <Inbox size={size} color={color} /> : <Compass size={size} color={color} /> }} />
    <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} /> }} />
    <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} /> }} />
    <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => tutor ? <Users size={size} color={color} /> : <MoreHorizontal size={size} color={color} /> }} />
  </Tabs>;
}
