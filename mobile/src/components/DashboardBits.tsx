import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, Chip } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import type { Session, Tutor } from '@/types';

export function Stat({ icon: Icon, value, label, tone = 'brand' }: { icon: LucideIcon; value: string | number; label: string; tone?: 'brand' | 'coral' | 'gold' | 'blue' }) {
  const palette = tone === 'coral' ? [colors.coralSoft, colors.coral] : tone === 'gold' ? [colors.goldSoft, colors.gold] : tone === 'blue' ? [colors.blueSoft, colors.blue] : [colors.brandSoft, colors.brand];
  return <View style={styles.stat}><View style={[styles.statIcon, { backgroundColor: palette[0] }]}><Icon size={18} color={palette[1]} /></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export function SessionCard({ session }: { session: Session }) {
  const date = new Date(`${session.scheduled_date}T12:00:00`);
  return <Card style={styles.itemCard}><View style={styles.date}><Text style={styles.month}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.day}>{date.getDate()}</Text></View><View style={styles.itemCopy}><Text style={styles.itemTitle} numberOfLines={2}>{session.title}</Text><Text style={styles.meta} numberOfLines={2}>{session.start_time?.slice(0, 5)} – {session.end_time?.slice(0, 5)} · {session.tutor_name || session.student_name || session.subject || 'Tutoring'}</Text>{session.session_timezone ? <Text style={styles.timezone} numberOfLines={1}>{session.session_timezone}</Text> : null}</View><Chip label={session.confirmation_status === 'pending' ? 'Pending' : session.status} tone={session.confirmation_status === 'pending' ? 'gold' : 'brand'} /></Card>;
}

export function TutorCard({ tutor }: { tutor: Tutor }) {
  return <Card style={styles.itemCard}><Avatar uri={tutor.avatar_url} name={tutor.name} size={52} /><View style={styles.itemCopy}><Text style={styles.itemTitle}>{tutor.name}</Text><Text style={styles.meta} numberOfLines={1}>{tutor.headline || tutor.subjects?.join(' · ') || 'Community tutor'}</Text><View style={styles.inline}><Text style={styles.rating}>★ {Number(tutor.averageRating || 0).toFixed(1)}</Text><Text style={styles.price}>{Number(tutor.hourly_rate || 0) === 0 ? 'Volunteer' : `$${tutor.hourly_rate}/hr`}</Text></View></View></Card>;
}

const styles = StyleSheet.create({ stat: { flex: 1, minWidth: 130, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: spacing.md, gap: 3 }, statIcon: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, statValue: { color: colors.ink, fontFamily: typography.bold, fontSize: 23 }, statLabel: { color: colors.muted, fontFamily: typography.regular, fontSize: 12 }, itemCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, date: { width: 48, height: 54, borderRadius: 7, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, month: { color: colors.brand, fontFamily: typography.bold, fontSize: 10 }, day: { color: colors.ink, fontFamily: typography.bold, fontSize: 20 }, itemCopy: { flex: 1, minWidth: 0, gap: 4 }, itemTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 15 }, meta: { color: colors.muted, fontFamily: typography.regular, fontSize: 12, lineHeight: 17 }, timezone: { color: colors.brandStrong, fontFamily: typography.medium, fontSize: 10 }, inline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, rating: { color: colors.gold, fontFamily: typography.medium, fontSize: 12 }, price: { color: colors.brandStrong, fontFamily: typography.medium, fontSize: 12 } });
