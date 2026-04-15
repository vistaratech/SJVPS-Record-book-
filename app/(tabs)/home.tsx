import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBusinesses,
  createBusiness,
  listRegisters,
  deleteRegister,
  renameRegister,
  duplicateRegister,
  createRegister,
  type RegisterSummary,
} from '../../lib/api';
import { CATEGORIES, TEMPLATES, type Template } from '../../lib/templates';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

  // Register context menu
  const [registerMenuId, setRegisterMenuId] = useState<number | null>(null);
  const [renameRegisterModal, setRenameRegisterModal] = useState(false);
  const [renameRegisterId, setRenameRegisterId] = useState<number | null>(null);
  const [renameRegisterValue, setRenameRegisterValue] = useState('');

  // ─── Business ─────────────────────────────────────────────
  const { data: businesses, isLoading: isBusinessesLoading } = useQuery({
    queryKey: ['businesses'],
    queryFn: listBusinesses,
  });

  const createBusinessMutation = useMutation({
    mutationFn: (name: string) => createBusiness(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['businesses'] }),
  });

  const hasCreated = useRef(false);
  useEffect(() => {
    if (businesses && businesses.length === 0 && !hasCreated.current) {
      hasCreated.current = true;
      createBusinessMutation.mutate('My Business');
    }
  }, [businesses]);

  const businessId = businesses?.[0]?.id;

  // ─── Registers ────────────────────────────────────────────
  const {
    data: registers,
    isLoading: isRegistersLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['registers', businessId],
    queryFn: () => listRegisters(businessId!),
    enabled: !!businessId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRegister(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registers'] }),
  });

  // ─── Create Register from Template ────────────────────────
  const createMutation = useMutation({
    mutationFn: (template: Template) =>
      createRegister({
        businessId: businessId!,
        name: template.name,
        icon: template.icon || 'document',
        iconColor: categoryData?.color || Colors.navy,
        category: selectedCategory || 'general',
        template: template.name,
        columns: template.columns.map((c) => ({ name: c.name, type: c.type, formula: c.formula, dropdownOptions: c.dropdownOptions })),
      }),
    onSuccess: (newRegister) => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setCreatingTemplate(null);
      setSelectedCategory(null);
      router.push(`/register/${newRegister.id}`);
    },
    onError: (err: any) => {
      setCreatingTemplate(null);
      Alert.alert('Error', err.message || 'Failed to create register');
    },
  });

  const handleSelectTemplate = (template: Template) => {
    if (!businessId) {
      Alert.alert('Error', 'Business not found. Please wait and try again.');
      return;
    }
    setCreatingTemplate(template.name);
    createMutation.mutate(template);
  };

  const handleDelete = (register: RegisterSummary) => {
    Alert.alert(
      'Delete Register',
      `Delete "${register.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(register.id),
        },
      ]
    );
  };

  // ─── Rename Register ──────────────────────────────────────
  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameRegister(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setRenameRegisterModal(false);
      setRenameRegisterId(null);
      setRenameRegisterValue('');
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to rename register'),
  });

  // ─── Duplicate Register ───────────────────────────────────
  const duplicateMutation = useMutation({
    mutationFn: (id: number) => duplicateRegister(id),
    onSuccess: (newReg) => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setRegisterMenuId(null);
      router.push(`/register/${newReg.id}`);
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to duplicate register'),
  });

  // ─── Category / Template data ─────────────────────────────
  const categoryData = CATEGORIES.find((c) => c.id === selectedCategory);
  const subTemplates = selectedCategory ? TEMPLATES[selectedCategory] || [] : [];

  // ─── Filter registers ─────────────────────────────────────
  const filteredRegisters = registers?.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Float animation  ────────────────────────────────────
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 3000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── Loading ──────────────────────────────────────────────
  if (isBusinessesLoading || (isRegistersLoading && !isRefetching)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.navy} />
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* ─── Sidebar-style Header ─────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.businessRow}>
          <View style={styles.businessAvatar}>
            <Text style={styles.businessAvatarText}>
              {businesses?.[0]?.name?.[0] || 'B'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.businessName} numberOfLines={1}>
              {businesses?.[0]?.name || 'My Business'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={Colors.muted} />
        </TouchableOpacity>

        {/* Search bar — matches web sidebar search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search register"
            placeholderTextColor={Colors.placeholder}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={18} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        {/* + Add New Register — matches web sidebar button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/templates')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={styles.addButtonText}>Add New Register</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Main Content ─────────────────────────────────── */}
      {(!filteredRegisters || filteredRegisters.length === 0) ? (
        /* ── Empty State (web "Welcome to Record Book") ─── */
        <View style={styles.emptyContainer}>
          <Animated.View style={[styles.emptyCard, { transform: [{ translateY: floatAnim }] }]}>
            <View style={[styles.floatingShape, styles.shapeBlue]} />
            <View style={[styles.floatingShape, styles.shapeRed]} />

            <View style={styles.iconCircle}>
              <Ionicons name="book" size={44} color={Colors.navy} />
            </View>

            <Text style={styles.welcomeTitle}>Welcome to SJVPS Record Book</Text>
            <Text style={styles.welcomeSub}>Tap on your register to start:</Text>

            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => router.push('/templates')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={Colors.white} />
              <Text style={styles.emptyAddBtnText}>Add New Register</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : (
        /* ── Register List (web sidebar list) ─────────── */
        <FlatList
          data={filteredRegisters}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.navy}
              colors={[Colors.navy]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.registerRow}
              onPress={() => router.push(`/register/${item.id}`)}
              onLongPress={() => setRegisterMenuId(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.registerIconBg, (item as any).iconColor && { backgroundColor: `${(item as any).iconColor}20` }]}>
                <Ionicons name={(item.icon as any) || 'document'} size={20} color={(item as any).iconColor || Colors.navy} />
              </View>
              <View style={styles.registerInfo}>
                <Text style={styles.registerName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.registerMeta}>
                  {item.entryCount} entries • {item.category}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRegisterMenuId(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="ellipsis-vertical" size={16} color={Colors.mutedLight} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Template Category Modal (matches web home.tsx Dialog) ── */}
      <Modal
        visible={!!selectedCategory}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCategory(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedCategory(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {/* Modal Header — matches web DialogHeader */}
            <View style={[styles.modalHeader, categoryData?.color && { backgroundColor: categoryData.color }]}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name={(categoryData?.icon as any) || 'folder'} size={24} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle}>
                  {categoryData?.name} Templates
                </Text>
                <Text style={styles.modalHeaderSub}>Choose a layout to get started</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* Template Cards */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.huge }}
              showsVerticalScrollIndicator={false}
            >
              {subTemplates.map((template, idx) => (
                <View key={idx} style={styles.tplCard}>
                  <View style={styles.tplCardHeader}>
                    <Ionicons name={(template.icon as any) || 'document'} size={26} color={categoryData?.color || Colors.navy} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tplName}>{template.name}</Text>
                      <Text style={styles.tplDesc}>
                        {template.description || `${template.columns.length} columns pre-configured`}
                      </Text>
                    </View>
                  </View>

                  {/* Column Chips */}
                  {template.columns.length > 0 && (
                    <View style={styles.colChipsRow}>
                      {template.columns.slice(0, 4).map((col: any, i: number) => (
                        <View key={i} style={styles.colChip}>
                          <Text style={styles.colChipIcon}>
                            {col.type === 'number' ? '#' : col.type === 'date' ? '📅' : 'T'}
                          </Text>
                          <Text style={styles.colChipText} numberOfLines={1}>{col.name}</Text>
                        </View>
                      ))}
                      {template.columns.length > 4 && (
                        <View style={[styles.colChip, { backgroundColor: Colors.borderLight }]}>
                          <Text style={styles.colChipText}>+{template.columns.length - 4} more</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Preview & Use button — green, matches web btn-success */}
                  <TouchableOpacity
                    style={styles.tplUseBtn}
                    onPress={() => handleSelectTemplate(template)}
                    disabled={!!creatingTemplate}
                    activeOpacity={0.8}
                  >
                    {creatingTemplate === template.name ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="eye-outline" size={16} color={Colors.white} />
                        <Text style={styles.tplUseBtnText}>Preview & Use</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Register Context Menu Modal ── */}
      <Modal
        visible={registerMenuId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRegisterMenuId(null)}
      >
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setRegisterMenuId(null)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>
              {filteredRegisters?.find((r) => r.id === registerMenuId)?.name || 'Register'}
            </Text>
            {/* Open */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (registerMenuId) {
                  setRegisterMenuId(null);
                  router.push(`/register/${registerMenuId}`);
                }
              }}
            >
              <Ionicons name="open-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Open Register</Text>
            </TouchableOpacity>
            {/* Rename */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (registerMenuId) {
                  const reg = filteredRegisters?.find((r) => r.id === registerMenuId);
                  setRenameRegisterId(registerMenuId);
                  setRenameRegisterValue(reg?.name || '');
                  setRegisterMenuId(null);
                  setRenameRegisterModal(true);
                }
              }}
            >
              <Ionicons name="pencil" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Rename</Text>
            </TouchableOpacity>
            {/* Duplicate */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (registerMenuId) duplicateMutation.mutate(registerMenuId);
              }}
            >
              <Ionicons name="copy-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Duplicate</Text>
            </TouchableOpacity>
            {/* Delete */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (registerMenuId) {
                  const reg = filteredRegisters?.find((r) => r.id === registerMenuId);
                  setRegisterMenuId(null);
                  if (reg) handleDelete(reg);
                }
              }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
              <Text style={styles.contextItemDanger}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Rename Register Modal ── */}
      <Modal
        visible={renameRegisterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRenameRegisterModal(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRenameRegisterModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Register</Text>
            <TextInput
              style={styles.modalInput}
              value={renameRegisterValue}
              onChangeText={setRenameRegisterValue}
              placeholder="Register name"
              placeholderTextColor={Colors.placeholder}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRenameRegisterModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, renameMutation.isPending && { opacity: 0.7 }]}
                onPress={() => {
                  if (renameRegisterId && renameRegisterValue.trim()) {
                    renameMutation.mutate({ id: renameRegisterId, name: renameRegisterValue.trim() });
                  }
                }}
                disabled={renameMutation.isPending || !renameRegisterValue.trim()}
              >
                {renameMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Rename</Text>
                )}
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES — Matching web CSS exactly
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // ── Header (web sidebar top) ────────────────────────────
  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    paddingBottom: Spacing.lg,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  businessAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessAvatarText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  businessName: {
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
    color: Colors.foreground,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.foreground,
  },
  bellBtn: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.navy,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    gap: Spacing.sm,
    ...Shadows.button,
  },
  addButtonText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },

  // ── Register List (web sidebar list) ────────────────────
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: 2,
  },
  registerIconBg: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerEmoji: {
    fontSize: 20,
  },
  registerInfo: {
    flex: 1,
  },
  registerName: {
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
    color: Colors.foreground,
  },
  registerMeta: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },

  // ── Empty State (web welcome) ───────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.huge,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderStyle: 'dashed',
    ...Shadows.card,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F6C943',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    zIndex: 2,
    borderWidth: 4,
    borderColor: '#FFF8E1',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: FontSize.md,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    zIndex: 2,
    ...Shadows.button,
  },
  emptyAddBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  floatingShape: { position: 'absolute', borderRadius: 8, opacity: 0.7 },
  shapeBlue: { width: 40, height: 40, backgroundColor: '#D0E3F5', top: 30, right: 25, transform: [{ rotate: '15deg' }] },
  shapeRed: { width: 55, height: 45, backgroundColor: '#FCD2D8', bottom: -10, left: 35, transform: [{ rotate: '-20deg' }] },

  // ── Template Modal (matches web Dialog) ─────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: Colors.navy,
    padding: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  modalHeaderSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // ── Template Card ───────────────────────────────────────
  tplCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  tplCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  tplEmoji: { fontSize: 26, marginTop: 2 },
  tplName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  tplDesc: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  colChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  colChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  colChipIcon: { fontSize: 10, color: Colors.muted },
  colChipText: { fontSize: 10, color: Colors.muted, fontWeight: FontWeight.medium },
  tplUseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.button,
  },
  tplUseBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // ── Context Menu (register management) ──────────────────
  contextOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  contextMenu: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    width: 280, ...Shadows.elevated,
  },
  contextTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.md },
  contextItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md } as any,
  contextItemText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.foreground },
  contextItemDanger: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.destructive },

  // ── Rename Register Modal (reuses modalOverlay / modalContent from template modal) ───
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.xl },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.md,
    color: Colors.foreground, marginBottom: Spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md } as any,
  modalCancelBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, alignItems: 'center',
  } as any,
  modalCancelText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.foreground },
  modalConfirmBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.navy, alignItems: 'center', ...Shadows.button,
  } as any,
  modalConfirmText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
});
