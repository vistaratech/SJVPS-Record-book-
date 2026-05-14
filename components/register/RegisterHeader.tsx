import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';

interface RegisterHeaderProps {
  title: string;
  isSyncing: boolean;
  onBack: () => void;
  onTitlePress: () => void;
  onSharePress: () => void;
  onMenuPress: () => void;
}

export const RegisterHeader: React.FC<RegisterHeaderProps> = ({
  title,
  isSyncing,
  onBack,
  onTitlePress,
  onSharePress,
  onMenuPress,
}) => {
  return (
    <View style={styles.premiumHeader}>
      <View style={styles.headerMain}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.titleGroup}>
          <TouchableOpacity style={styles.titleContainer} onPress={onTitlePress}>
            <Text style={styles.premiumTitle} numberOfLines={1}>{title}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <View style={styles.syncStatus}>
            <View style={[styles.syncDot, { backgroundColor: isSyncing ? '#FFD700' : '#4CAF50' }]} />
            <Text style={styles.syncText}>{isSyncing ? 'Syncing...' : 'Saved to Cloud'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconButton} onPress={onSharePress}>
          <Ionicons name="share-outline" size={22} color={Colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
          <Ionicons name="ellipsis-vertical" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  premiumHeader: {
    backgroundColor: Colors.navy,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: 40,
    height: 100,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
  titleGroup: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  premiumTitle: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  syncText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: FontWeight.medium,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconButton: {
    padding: Spacing.sm,
  },
});
