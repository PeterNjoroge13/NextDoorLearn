import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { ArrowLeft, BellRing, KeyRound, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, ErrorNotice, Field, Header, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api, request } from '@/lib/api';
import { useData } from '@/lib/hooks';
import { colors, spacing, typography } from '@/theme';

const preferenceGroups = [
  {
    title: 'Delivery channels',
    items: [
      { key: 'emailEnabled', label: 'Email updates', help: 'Session changes and tutoring reminders.' },
      { key: 'pushEnabled', label: 'Push notifications', help: 'Alerts on devices where notifications are enabled.' },
    ],
  },
  {
    title: 'Alert categories',
    items: [
      { key: 'messagesEnabled', label: 'Messages', help: 'New messages from your tutoring connections.' },
      { key: 'connectionsEnabled', label: 'Connections and matches', help: 'Requests, responses, and waitlist matches.' },
      { key: 'sessionsEnabled', label: 'Session updates', help: 'Confirmations, schedule changes, cancellations, and notes.' },
      { key: 'remindersEnabled', label: 'Session reminders', help: 'One-day and one-hour reminders.' },
      { key: 'reviewsEnabled', label: 'Reviews', help: 'Feedback after completed tutoring sessions.' },
    ],
  },
] as const;

type PreferenceKey = typeof preferenceGroups[number]['items'][number]['key'];

export default function SettingsScreen() {
  const { clearSession } = useAuth();
  const preferences = useData<Record<PreferenceKey, boolean>>(() => request('/notifications/preferences'), []);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');

  const changePassword = async () => {
    setWorking('password');
    setError('');
    try {
      await request('/users/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
      });
      setPasswords({ current: '', next: '' });
      await clearSession();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Unable to change password');
    } finally {
      setWorking('');
    }
  };

  const updatePreference = async (key: PreferenceKey, value: boolean) => {
    setWorking(key);
    setError('');
    try {
      const updated = await request<Record<PreferenceKey, boolean>>('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ [key]: value }),
      });
      preferences.setData(updated);
      setNotice('Notification preferences saved.');
    } catch (preferenceError) {
      setError(preferenceError instanceof Error ? preferenceError.message : 'Unable to save notification preferences');
    } finally {
      setWorking('');
    }
  };

  const enablePush = async () => {
    setWorking('push');
    setError('');
    try {
      if (!Device.isDevice) throw new Error('Push notifications require a physical device.');
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error('Notification permission was not granted.');
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) throw new Error('Push notifications will activate after the first EAS project build.');
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await api.registerPushToken({ token, platform: Platform.OS, deviceName: Constants.deviceName || 'Mobile device' });
      const updated = await request<Record<PreferenceKey, boolean>>('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ pushEnabled: true }),
      });
      preferences.setData(updated);
      setNotice('Push notifications are enabled on this device.');
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'Unable to enable notifications');
    } finally {
      setWorking('');
    }
  };

  const deleteAccount = async () => {
    setWorking('delete');
    setError('');
    try {
      await api.deleteAccount(deletePassword);
      await clearSession();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete account');
    } finally {
      setWorking('');
    }
  };

  if (preferences.loading) return <LoadingState />;

  return <Screen refreshing={preferences.refreshing} onRefresh={preferences.reload}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}>
      <ArrowLeft size={22} color={colors.ink} />
    </Pressable>
    <Header eyebrow="Privacy and access" title="Account settings" subtitle="Manage security, notifications, and your account data." />
    {error || preferences.error ? <ErrorNotice message={error || preferences.error} /> : null}
    {notice ? <Card tone="brand"><Text style={s.notice}>{notice}</Text></Card> : null}

    <Card>
      <View style={s.sectionHead}><BellRing size={21} color={colors.brand} /><Text style={s.section}>Notifications</Text></View>
      <Text style={s.copy}>Routine alerts follow these choices. Password, account-security, and policy emails are always delivered.</Text>
      {preferenceGroups.map((group) => <View key={group.title} style={s.preferenceGroup}>
        <Text style={s.groupTitle}>{group.title}</Text>
        {group.items.map((item) => <View key={item.key} style={s.preferenceRow}>
          <View style={s.preferenceCopy}>
            <Text style={s.preferenceTitle}>{item.label}</Text>
            <Text style={s.preferenceHelp}>{item.help}</Text>
          </View>
          <Switch
            accessibilityLabel={item.label}
            value={Boolean(preferences.data?.[item.key])}
            onValueChange={(value) => updatePreference(item.key, value)}
            disabled={Boolean(working)}
            trackColor={{ false: colors.line, true: colors.brandSoft }}
            thumbColor={preferences.data?.[item.key] ? colors.brand : colors.muted}
          />
        </View>)}
      </View>)}
      <Button label="Enable notifications on this device" variant="secondary" onPress={enablePush} loading={working === 'push'} />
    </Card>

    <Card>
      <View style={s.sectionHead}><KeyRound size={21} color={colors.brand} /><Text style={s.section}>Change password</Text></View>
      <Field label="Current password" value={passwords.current} onChangeText={(value) => setPasswords((current) => ({ ...current, current: value }))} secureTextEntry />
      <Field label="New password" value={passwords.next} onChangeText={(value) => setPasswords((current) => ({ ...current, next: value }))} secureTextEntry />
      <Button label="Update password" variant="secondary" onPress={changePassword} loading={working === 'password'} disabled={!passwords.current || passwords.next.length < 8} />
    </Card>

    <Card tone="coral">
      <View style={s.sectionHead}><Trash2 size={21} color={colors.red} /><Text style={[s.section, s.danger]}>Delete account</Text></View>
      <Text style={s.copy}>This permanently removes your profile, conversations, connections, sessions, and account data. It cannot be undone.</Text>
      <Field label="Current password to confirm" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry />
      <Button label="Permanently delete my account" variant="danger" onPress={deleteAccount} loading={working === 'delete'} disabled={!deletePassword} />
    </Card>
  </Screen>;
}

const s = StyleSheet.create({
  back: { height: 44, justifyContent: 'center' },
  notice: { color: colors.brandStrong, fontFamily: typography.medium },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { color: colors.ink, fontFamily: typography.bold, fontSize: 17 },
  danger: { color: colors.red },
  copy: { color: colors.muted, fontFamily: typography.regular, lineHeight: 21 },
  preferenceGroup: { gap: spacing.sm, paddingTop: spacing.sm },
  groupTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 14 },
  preferenceRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { color: colors.ink, fontFamily: typography.medium, fontSize: 15 },
  preferenceHelp: { color: colors.muted, fontFamily: typography.regular, fontSize: 12, lineHeight: 17 },
});
