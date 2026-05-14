import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Shadows } from '../../constants/theme';

interface CalcInfo {
  colId: string;
  name: string;
  type: string;
  result: string;
}

interface CalculationBarProps {
  stats: {
    label: string;
    value: string | number;
    color?: string;
  }[];
}

export const CalculationBar: React.FC<CalculationBarProps> = ({ stats }) => {
  if (!stats || stats.length === 0) return null;

  return (
    <View style={styles.premiumCalcBar}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calcScrollContent}
      >
        {stats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={[styles.statValue, stat.color ? { color: stat.color } : null]}>
              {stat.value}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  premiumCalcBar: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 50,
  },
  calcScrollContent: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    color: Colors.navy,
    fontWeight: FontWeight.bold,
  },
});
