import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listBusinesses, createRegister } from '../../lib/api';
import { CATEGORIES, TEMPLATES, type Template } from '../../lib/templates';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');
const containerWidth = Platform.OS === 'web' ? Math.min(width, 800) : width;

// Helper to get icon name for a column type
function getColumnTypeIcon(type: string): string {
  switch (type) {
    case 'number': return 'calculator';
    case 'date': return 'calendar';
    case 'dropdown': return 'chevron-down-circle';
    case 'formula': return 'flask';
    default: return 'text';
  }
}

export default function TemplatePickerScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const queryClient = useQueryClient();
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const { data: businesses } = useQuery({
    queryKey: ['businesses'],
    queryFn: listBusinesses,
  });

  const businessId = businesses?.[0]?.id;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const templates = categoryId ? TEMPLATES[categoryId] || [] : [];

  const createMutation = useMutation({
    mutationFn: (template: Template) =>
      createRegister({
        businessId: businessId!,
        name: template.name,
        icon: template.icon || 'document',
        iconColor: (category as any)?.color || Colors.navy,
        category: categoryId || 'general',
        template: template.name,
        columns: template.columns.map((c) => ({
          name: c.name,
          type: c.type,
          formula: c.formula,
          dropdownOptions: c.dropdownOptions,
        })),
      }),
    onSuccess: (newRegister) => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setCreatingId(null);
      // Navigate directly to the new register
      router.replace(`/register/${newRegister.id}`);
    },
    onError: (err: any) => {
      setCreatingId(null);
      Alert.alert('Error', err.message || 'Failed to create register');
    },
  });

  const handleSelectTemplate = (template: Template) => {
    if (!businessId) {
      Alert.alert('No Business', 'Please create a business first from the Dashboard before using templates.');
      return;
    }
    setCreatingId(template.name);
    createMutation.mutate(template);
  };

  return (
    <View style={styles.container}>
      {/* Category Header */}
      <View style={[styles.header, !!(category as any)?.color && { backgroundColor: (category as any).color }]}>
        <View style={styles.headerIconBg}>
           <Ionicons name={(category?.icon as any) || 'folder'} size={24} color={Colors.white} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{category?.name} Templates</Text>
          <Text style={styles.headerSubtitle}>
            {templates.length} templates • Tap to create register instantly
          </Text>
        </View>
      </View>

      {/* Template List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && { alignSelf: 'center', width: containerWidth }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={Colors.mutedLight} />
            <Text style={styles.emptyTitle}>No templates in this category</Text>
            <Text style={styles.emptySubtitle}>You can create a blank register from the Dashboard</Text>
          </View>
        ) : (
          <View style={styles.templateGrid}>
            {templates.map((template, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.templateCard}
                onPress={() => handleSelectTemplate(template)}
                disabled={!!creatingId}
                activeOpacity={0.7}
              >
                <View style={styles.templateHeader}>
                  <View style={[styles.templateIconBg, { backgroundColor: `${(category as any)?.color || Colors.navy}15` }]}>
                    <Ionicons
                      name={(template.icon as any) || 'document'}
                      size={24}
                      color={(category as any)?.color || Colors.navy}
                    />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDesc}>
                      {template.description || `${template.columns.length} columns pre-configured`}
                    </Text>
                  </View>
                </View>

                {/* Column Preview — show ALL columns */}
                {template.columns.length > 0 && (
                  <View style={styles.columnsPreview}>
                    {template.columns.map((col, i) => (
                      <View key={i} style={styles.columnChip}>
                        <Ionicons
                           name={getColumnTypeIcon(col.type) as any}
                           size={11}
                           color={col.type === 'formula' ? Colors.navy : Colors.muted}
                        />
                        <Text style={[styles.columnChipText, col.type === 'formula' && styles.columnChipFormula]} numberOfLines={1}>
                          {col.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Button */}
                <View style={[styles.templateAction, !!(category as any)?.color && { backgroundColor: (category as any).color }]}>
                  {creatingId === template.name ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={18} color={Colors.white} />
                      <Text style={styles.templateActionText}>Use This Template</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.navy,
    padding: Spacing.xxl,
    paddingTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIconBg: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.huge,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  templateGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap',
    gap: Spacing.md,
  },
  templateCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Platform.OS === 'web' ? 0 : 0,
    width: Platform.OS === 'web' ? '48%' : '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  templateIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  templateDesc: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  columnsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  columnChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  columnChipText: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: FontWeight.medium,
  },
  columnChipFormula: {
    color: Colors.navy,
    fontWeight: FontWeight.bold,
  },
  templateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.button,
  },
  templateActionText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
