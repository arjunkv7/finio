import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDS } from '../hooks/useDS';
import PageHeader from '../components/PageHeader';
import {
  getAllNotifications,
  markAllNotificationsRead,
  AppNotification,
} from '../db/queries/notificationQueries';

const ICON_MAP: Record<string, string> = {
  sms_detected: 'message-text-outline',
  budget_warning: 'alert-outline',
  budget_exceeded: 'alert-circle-outline',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const ds         = useDS();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    const all = await getAllNotifications();
    setItems(all);
    await markAllNotificationsRead();
  }, []);

  useEffect(() => { load(); }, [load]);

  const styles = makeStyles(ds);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const iconName = ICON_MAP[item.type] ?? 'bell-outline';
    const isUnread = item.is_read === 0;
    return (
      <View style={[styles.row, isUnread && styles.rowUnread]}>
        <View style={[styles.iconWrap, { backgroundColor: ds.surface.elevated }]}>
          <MaterialCommunityIcons name={iconName as any} size={20} color={ds.primary} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, isUnread && { color: ds.text.primary }]}>
            {item.title}
          </Text>
          <Text style={styles.rowBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
        </View>
        {isUnread && <View style={[styles.dot, { backgroundColor: ds.primary }]} />}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: ds.surface.screen }]}>
      <PageHeader title="Notifications" onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          items.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={48} color={ds.text.muted} />
            <Text style={[styles.emptyText, { color: ds.text.muted }]}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

function makeStyles(ds: any) {
  return StyleSheet.create({
    root:       { flex: 1 },
    list:       { paddingHorizontal: 16, paddingTop: 8 },
    listEmpty:  { flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 6,
      backgroundColor: ds.surface.card,
    },
    rowUnread: {
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowText:  { flex: 1, gap: 2 },
    rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: ds.text.secondary },
    rowBody:  { fontFamily: 'Inter_400Regular', fontSize: 13, color: ds.text.secondary, lineHeight: 18 },
    rowTime:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: ds.text.muted, marginTop: 2 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
      flexShrink: 0,
    },
    empty:      { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
    emptyText:  { fontFamily: 'Inter_500Medium', fontSize: 15 },
  });
}
