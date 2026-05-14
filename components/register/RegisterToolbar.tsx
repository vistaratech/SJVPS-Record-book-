import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Shadows, BorderRadius } from '../../constants/theme';

interface RegisterToolbarProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onFilterPress: () => void;
  onStatsPress: () => void;
  onAddRow: () => void;
  activeFiltersCount: number;
  showStats: boolean;
  bulkMode: boolean;
  onBulkDelete: () => void;
  onSelectAll: () => void;
  onCancelBulk: () => void;
  selectedCount: number;
}

export const RegisterToolbar: React.FC<RegisterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  onFilterPress,
  onStatsPress,
  onAddRow,
  activeFiltersCount,
  showStats,
  bulkMode,
  onBulkDelete,
  onSelectAll,
  onCancelBulk,
  selectedCount,
}) => {
  if (bulkMode) {
    return (
      <View style={[styles.modernToolbar, styles.bulkToolbar]}>
        <TouchableOpacity style={styles.bulkCloseBtn} onPress={onCancelBulk}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.bulkInfo}>
          <Text style={styles.bulkCount}>{selectedCount} selected</Text>
        </View>
        <View style={styles.toolbarActions}>
          <TouchableOpacity 
            style={styles.toolBtnGhost} 
            onPress={onSelectAll}
          >
            <Text style={styles.toolBtnGhostText}>Select All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolBtn, styles.deleteBtn]} 
            onPress={onBulkDelete}
            disabled={selectedCount === 0}
          >
            <Ionicons name="trash-outline" size={20} color={selectedCount > 0 ? Colors.white : 'rgba(255,255,255,0.4)'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.modernToolbar}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search entries..."
          placeholderTextColor={Colors.placeholder}
        />
      </View>
      <View style={styles.toolbarActions}>
        <TouchableOpacity 
          style={[styles.toolBtn, activeFiltersCount > 0 && styles.toolBtnActive]} 
          onPress={onFilterPress}
        >
          <Ionicons name="filter" size={20} color={activeFiltersCount > 0 ? Colors.white : Colors.navy} />
          {activeFiltersCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{activeFiltersCount}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toolBtn, showStats && styles.toolBtnActive]} 
          onPress={onStatsPress}
        >
          <Ionicons name="stats-chart" size={20} color={showStats ? Colors.white : Colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.addBtnPrimary} 
          onPress={onAddRow}
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modernToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.navy,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toolBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  addBtnPrimary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  bulkToolbar: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  bulkInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bulkCount: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  deleteBtn: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  bulkCloseBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
  toolBtnGhost: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  toolBtnGhostText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
});
