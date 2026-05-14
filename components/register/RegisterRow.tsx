import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Shadows } from '../../constants/theme';

interface RegisterRowProps {
  entry: any;
  columns: any[];
  isSelected: boolean;
  isBulkMode: boolean;
  onToggleSelect: (id: string) => void;
  onLongPress: (id: string) => void;
  onCellChange: (entryId: string, colId: string, value: string, oldValue: string) => void;
  onDatePress: (entryId: string, colId: string, value: string) => void;
  onDropdownPress: (entryId: string, colId: string, options: string[]) => void;
}

export const RegisterRow: React.FC<RegisterRowProps> = ({
  entry,
  columns,
  isSelected,
  isBulkMode,
  onToggleSelect,
  onLongPress,
  onCellChange,
  onDatePress,
  onDropdownPress,
}) => {
  const renderCell = (col: any) => {
    const value = entry.cells?.[col.id] || '';
    const isFormula = col.type === 'formula';
    const isInteractive = col.type === 'date' || col.type === 'dropdown';

    if (isInteractive) {
      return (
        <TouchableOpacity
          key={col.id}
          style={[styles.cell, { width: col.width || 120 }]}
          onPress={() => {
            if (col.type === 'date') onDatePress(entry.id, col.id, value);
            if (col.type === 'dropdown') onDropdownPress(entry.id, col.id, col.dropdownOptions || []);
          }}
        >
          <Text style={[styles.cellText, !value && styles.placeholderText]} numberOfLines={1}>
            {value || `Select ${col.name}`}
          </Text>
          <Ionicons 
            name={col.type === 'date' ? "calendar-outline" : "chevron-down"} 
            size={14} 
            color={Colors.muted} 
          />
        </TouchableOpacity>
      );
    }

    return (
      <View key={col.id} style={[styles.cell, { width: col.width || 120 }]}>
        <TextInput
          style={[
            styles.cellInput,
            isFormula && styles.formulaInput,
            (col.type === 'number' || col.type === 'currency') && styles.rightAlign
          ]}
          value={value}
          onChangeText={(text) => onCellChange(entry.id, col.id, text, value)}
          placeholder="-"
          placeholderTextColor={Colors.placeholder}
          editable={!isFormula && !isBulkMode}
          keyboardType={col.type === 'number' || col.type === 'currency' ? 'numeric' : 'default'}
        />
      </View>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => onLongPress(entry.id)}
      onPress={() => isBulkMode && onToggleSelect(entry.id)}
      style={[
        styles.row,
        isSelected && styles.rowSelected
      ]}
    >
      <TouchableOpacity 
        style={styles.selectionArea} 
        onPress={() => onToggleSelect(entry.id)}
      >
        <Ionicons 
          name={isSelected ? "checkbox" : "square-outline"} 
          size={22} 
          color={isSelected ? Colors.navy : Colors.border} 
        />
      </TouchableOpacity>
      
      <View style={styles.cellsContainer}>
        {columns.map(renderCell)}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    height: 56,
  },
  rowSelected: {
    backgroundColor: 'rgba(30, 45, 120, 0.05)',
  },
  selectionArea: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  cellsContainer: {
    flexDirection: 'row',
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cellText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.foreground,
  },
  placeholderText: {
    color: Colors.placeholder,
    fontStyle: 'italic',
  },
  cellInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.foreground,
    height: '100%',
  },
  formulaInput: {
    color: Colors.navy,
    fontWeight: FontWeight.bold,
    backgroundColor: 'rgba(30, 45, 120, 0.02)',
  },
  rightAlign: {
    textAlign: 'right',
  },
});
