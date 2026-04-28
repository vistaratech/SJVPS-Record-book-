// History Page — matches web HistoryPage.tsx
// Shows a timeline of all audit log entries: register creates, deletes, renames, column/row changes
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  listBusinesses,
  listHistory,
  type HistoryEntry,
} from '../lib/api';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../constants/theme';

function getActionIcon(action: string): { icon: string; color: string } {
  const a = action.toLowerCase();
  if (a.includes('create')) return { icon: 'add-circle', color: '#10b981' };
  if (a.includes('delete')) return { icon: 'trash', color: '#ef4444' };
  if (a.includes('rename')) return { icon: 'pencil', color: '#3b82f6' };
  if (a.includes('row')) return { icon: 'list', color: '#f59e0b' };
  if (a.includes('column')) return { icon: 'grid', color: '#8b5cf6' };
  if (a.includes('folder') || a.includes('file')) return { icon: 'folder', color: '#06b6d4' };
  return { icon: 'time', color: '#64748b' };
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function HistoryScreen() {
  const { data: businesses } = useQuery({
    queryKey: ['businesses'],
    queryFn: listBusinesses,
  });
  const businessId = businesses?.[0]?.id;

  const { data: history, isLoading } = useQuery({
    queryKey: ['history', businessId],
    queryFn: () => listHistory(businessId!),
    enabled: !!businessId,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ─── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>History Log</Text>
          <Text style={styles.headerSubtitle}>Track all changes and modifications</Text>
        </View>
      </View>

      {/* ─── Content ────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.navy} />
        </View>
      ) : !history || history.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="time-outline" size={48} color={Colors.mutedLight} />
          </View>
          <Text style={styles.emptyText}>No history entries found yet.</Text>
          <Text style={styles.emptySubtext}>Actions like creating, renaming, or deleting registers will appear here.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.timeline}>
          {history.map((entry: HistoryEntry, idx: number) => {
            const { icon, color } = getActionIcon(entry.action);
            const isLast = idx === history.length - 1;

            return (
              <View key={entry.id} style={styles.timelineRow}>
                {/* Left: icon + connector */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.iconCircle, { borderColor: color }]}>
                    <Ionicons name={icon as any} size={18} color={color} />
                  </View>
                  {!isLast && <View style={styles.connector} />}
                </View>

                {/* Right: card */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.actionBadge, { backgroundColor: `${color}15` }]}>
                      <Text style={[styles.actionBadgeText, { color }]}>{entry.action}</Text>
                    </View>
                    <View style={styles.timestampRow}>
                      <Ionicons name="calendar-outline" size={11} color={Colors.mutedLight} />
                      <Text style={styles.timestamp}>{formatTimestamp(entry.timestamp)}</Text>
                    </View>
                  </View>

                  <Text style={styles.details}>{entry.details}</Text>

                  <View style={styles.metaRow}>
                    {entry.userName && (
                      <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={12} color={Colors.muted} />
                        <Text style={styles.metaText}>{entry.userName}</Text>
                      </View>
                    )}
                    {entry.registerName && (
                      <View style={styles.metaItem}>
                        <Ionicons name="document-outline" size={12} color={Colors.muted} />
                        <Text style={styles.metaText}>{entry.registerName}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: Colors.white,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 13, color: Colors.muted, marginTop: 2,
  },

  // ── Empty ───────────────────────────────────────────────
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: 16, fontWeight: '600', color: Colors.muted, marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13, color: Colors.mutedLight, textAlign: 'center', lineHeight: 20,
  },

  // ── Timeline ────────────────────────────────────────────
  timeline: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 40,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1,
  },
  connector: {
    flex: 1, width: 2,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  actionBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timestampRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  timestamp: {
    fontSize: 11, color: Colors.mutedLight,
  },
  details: {
    fontSize: 14, color: '#1e293b', lineHeight: 21,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row', gap: Spacing.lg,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingTop: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  metaText: {
    fontSize: 11, color: Colors.muted,
  },
});
