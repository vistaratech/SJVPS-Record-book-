import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, TextInput, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Shadows, BorderRadius } from '../../constants/theme';
import { Column } from '../../lib/api';

interface FilterCondition {
  columnId: string;
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'empty' | 'not_empty';
  value: string;
}

interface FilterWizardProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterCondition[]) => void;
  columns: Column[];
  initialFilters?: FilterCondition[];
}

const { width } = Dimensions.get('window');

export const FilterWizard: React.FC<FilterWizardProps> = ({
  visible,
  onClose,
  onApply,
  columns,
  initialFilters = [],
}) => {
  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState<FilterCondition[]>(initialFilters);
  const [currentFilter, setCurrentFilter] = useState<Partial<FilterCondition>>({});

  const operators = [
    { label: 'Contains', value: 'contains', icon: 'search' },
    { label: 'Equals', value: 'equals', icon: 'pause' },
    { label: 'Greater Than', value: 'gt', icon: 'chevron-forward' },
    { label: 'Less Than', value: 'lt', icon: 'chevron-back' },
    { label: 'Empty', value: 'empty', icon: 'square-outline' },
    { label: 'Not Empty', value: 'not_empty', icon: 'square' },
  ] as const;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const addFilter = () => {
    if (currentFilter.columnId && currentFilter.operator) {
      setFilters([...filters, currentFilter as FilterCondition]);
      setCurrentFilter({});
      setStep(1);
    }
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const applyFilters = () => {
    onApply(filters);
    onClose();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Column</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.chipGrid}>
                {columns.map((col) => (
                  <TouchableOpacity
                    key={col.id}
                    style={[
                      styles.wizardChip,
                      currentFilter.columnId === col.id.toString() && styles.wizardChipActive
                    ]}
                    onPress={() => {
                      setCurrentFilter({ ...currentFilter, columnId: col.id.toString() });
                      handleNext();
                    }}
                  >
                    <Ionicons 
                      name="list-outline" 
                      size={18} 
                      color={currentFilter.columnId === col.id.toString() ? Colors.white : Colors.navy} 
                    />
                    <Text style={[
                      styles.wizardChipText,
                      currentFilter.columnId === col.id.toString() && styles.wizardChipTextActive
                    ]}>
                      {col.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose Operator</Text>
            <View style={styles.chipGrid}>
              {operators.map((op) => (
                <TouchableOpacity
                  key={op.value}
                  style={[
                    styles.wizardChip,
                    currentFilter.operator === op.value && styles.wizardChipActive
                  ]}
                  onPress={() => {
                    setCurrentFilter({ ...currentFilter, operator: op.value });
                    if (op.value === 'empty' || op.value === 'not_empty') {
                      // Skip step 3 for these
                      setStep(3);
                    } else {
                      handleNext();
                    }
                  }}
                >
                  <Ionicons 
                    name={op.icon as any} 
                    size={18} 
                    color={currentFilter.operator === op.value ? Colors.white : Colors.navy} 
                  />
                  <Text style={[
                    styles.wizardChipText,
                    currentFilter.operator === op.value && styles.wizardChipTextActive
                  ]}>
                    {op.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Enter Value</Text>
            {(currentFilter.operator === 'empty' || currentFilter.operator === 'not_empty') ? (
              <View style={styles.noValueContainer}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                <Text style={styles.noValueText}>No value needed for this condition</Text>
              </View>
            ) : (
              <TextInput
                style={styles.wizardInput}
                value={currentFilter.value || ''}
                onChangeText={(text) => setCurrentFilter({ ...currentFilter, value: text })}
                placeholder="Type filter value..."
                placeholderTextColor={Colors.placeholder}
                autoFocus
              />
            )}
            <TouchableOpacity 
              style={[styles.addFilterBtn, (!currentFilter.value && currentFilter.operator !== 'empty' && currentFilter.operator !== 'not_empty') && styles.disabledBtn]} 
              onPress={addFilter}
              disabled={!currentFilter.value && currentFilter.operator !== 'empty' && currentFilter.operator !== 'not_empty'}
            >
              <Text style={styles.addFilterBtnText}>Add to active filters</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Filter Wizard</Text>
              <Text style={styles.subtitle}>Step {step} of 3</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
          </View>

          {/* Current Active Filters */}
          {filters.length > 0 && (
            <View style={styles.activeFiltersSection}>
              <View style={styles.activeHeader}>
                <Text style={styles.activeLabel}>Active Filters ({filters.length})</Text>
                <TouchableOpacity onPress={() => setFilters([])}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeScroll}>
                {filters.map((f, idx) => {
                  const col = columns.find(c => c.id.toString() === f.columnId);
                  return (
                    <View key={idx} style={styles.activeFilterChip}>
                      <Text style={styles.activeFilterText}>
                        {col?.name}: {f.operator} {f.value && `"${f.value}"`}
                      </Text>
                      <TouchableOpacity onPress={() => removeFilter(idx)} style={styles.removeChipBtn}>
                        <Ionicons name="close-circle" size={16} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.content}>
            {renderStep()}
          </View>

          <View style={styles.footer}>
            {step > 1 ? (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={Colors.navy} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{ width: 80 }} />}

            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Apply All</Text>
              <Ionicons name="checkmark-done" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 31, 58, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    minHeight: '60%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.navy,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.surface,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.navy,
  },
  activeFiltersSection: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearAllText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.error,
  },
  activeScroll: {
    flexDirection: 'row',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeFilterText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: FontWeight.medium,
  },
  removeChipBtn: {
    marginLeft: 6,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    marginBottom: Spacing.lg,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  wizardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    minWidth: (width - 64) / 2,
  },
  wizardChipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  wizardChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.navy,
  },
  wizardChipTextActive: {
    color: Colors.white,
  },
  wizardInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.navy,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noValueContainer: {
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  noValueText: {
    color: Colors.muted,
    textAlign: 'center',
  },
  addFilterBtn: {
    backgroundColor: Colors.navy,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
    ...Shadows.button,
  },
  addFilterBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnText: {
    color: Colors.navy,
    fontWeight: FontWeight.bold,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
    ...Shadows.button,
  },
  applyBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
});
