import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeOutDown,
  Layout, 
  SlideInUp,
  SlideInDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import {
  listBusinesses,
  createBusiness,
  listRegisters,
  deleteRegister,
  renameRegister,
  duplicateRegister,
  createRegister,
  importExcelData,
  importData,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveRegisterToFolder,
  type RegisterSummary,
  type Folder,
} from '../../lib/api';
import { CATEGORIES, TEMPLATES, type Template } from '../../lib/templates';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';
import { Skeleton } from '../../components/Skeleton';

const { width, height } = Dimensions.get('window');

// ── Reusable Premium Components ──────────────────────────────────────────────

const ActionSheet = ({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
      <Animated.View 
        entering={SlideInDown.springify().damping(20)}
        exiting={FadeOutDown}
        style={styles.actionSheet}
      >
        <View style={styles.sheetHandle} />
        {title && <Text style={styles.sheetTitle}>{title}</Text>}
        <View style={styles.sheetContent}>{children}</View>
      </Animated.View>
    </TouchableOpacity>
  </Modal>
);

const ActionItem = ({ icon, label, onPress, danger, color = Colors.navy }: { icon: string; label: string; onPress: () => void; danger?: boolean; color?: string }) => (
  <TouchableOpacity style={styles.actionItem} onPress={onPress}>
    <View style={[styles.actionIconBg, { backgroundColor: danger ? `${Colors.error}10` : `${color}10` }]}>
      <Ionicons name={icon as any} size={22} color={danger ? Colors.error : color} />
    </View>
    <Text style={[styles.actionLabel, danger && { color: Colors.error }]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={Colors.border} />
  </TouchableOpacity>
);

const PremiumModal = ({ visible, onClose, title, children, confirmLabel, onConfirm, loading }: any) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
      <Animated.View entering={FadeInDown} style={styles.premiumModal}>
        <Text style={styles.modalHeading}>{title}</Text>
        {children}
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onClose}>
            <Text style={styles.modalSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modalPrimaryBtn, loading && { opacity: 0.7 }]} 
            onPress={onConfirm}
            disabled={loading}
          >
            {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalPrimaryText}>{confirmLabel || 'Confirm'}</Text>}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>
);

const HomeSkeleton = () => (
  <View style={styles.skeletonContainer}>
    <View style={styles.skeletonHeader}>
      <Skeleton width={120} height={20} borderRadius={10} />
      <Skeleton width={44} height={44} borderRadius={22} />
    </View>
    <Skeleton width="100%" height={44} borderRadius={12} style={{ marginBottom: 30 }} />
    <View style={styles.section}>
      <Skeleton width={80} height={15} borderRadius={5} style={{ marginBottom: 15 }} />
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.skeletonItem}>
          <Skeleton width={40} height={40} borderRadius={8} />
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Skeleton width="60%" height={15} borderRadius={5} style={{ marginBottom: 8 }} />
            <Skeleton width="40%" height={10} borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  </View>
);

// ──────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // States for management modals
  const [activeRegister, setActiveRegister] = useState<RegisterSummary | null>(null);
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  
  const [renameRegModal, setRenameRegModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  
  const [moveRegModal, setMoveRegModal] = useState(false);
  
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [folderNameValue, setFolderNameValue] = useState('');
  
  const [renameFldModal, setRenameFldModal] = useState(false);
  const [renameFldValue, setRenameFldValue] = useState('');

  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});

  // ─── Queries ──────────────────────────────────────────────
  const { data: businesses, isLoading: isBusinessesLoading } = useQuery({
    queryKey: ['businesses'],
    queryFn: listBusinesses,
  });

  const createBusinessMutation = useMutation({
    mutationFn: (name: string) => createBusiness(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['businesses'] }),
  });

  useEffect(() => {
    if (businesses && businesses.length === 0) {
      createBusinessMutation.mutate('My Business');
    }
  }, [businesses]);

  const businessId = businesses?.[0]?.id;

  const { data: registers, isLoading: isRegistersLoading, isRefetching } = useQuery({
    queryKey: ['registers', businessId],
    queryFn: () => listRegisters(businessId!),
    enabled: !!businessId,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', businessId],
    queryFn: () => listFolders(businessId!),
    enabled: !!businessId,
  });

  // ─── Mutations ────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRegister(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registers', businessId] }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameRegister(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      setRenameRegModal(false);
      setActiveRegister(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => duplicateRegister(id),
    onSuccess: (newReg) => {
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      setActiveRegister(null);
      router.push(`/register/${newReg.id}`);
    },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ registerId, folderId }: { registerId: number; folderId: number | null }) => moveRegisterToFolder(registerId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      setMoveRegModal(false);
      setActiveRegister(null);
    },
  });

  const folderCreateMutation = useMutation({
    mutationFn: (name: string) => createFolder(businessId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders', businessId] });
      setCreateFolderModal(false);
      setFolderNameValue('');
    },
  });

  const folderRenameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameFolder(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders', businessId] });
      setRenameFldModal(false);
      setActiveFolder(null);
    },
  });

  const folderDeleteMutation = useMutation({
    mutationFn: (id: number) => deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders', businessId] });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      setActiveFolder(null);
    },
  });

  // ─── Handlers ─────────────────────────────────────────────
  const handlePickExcel = async () => {
    setIsAddMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
      });
      if (result.canceled || !result.assets) return;
      const file = result.assets[0];
      const bstr = await (FileSystem as any).readAsStringAsync(file.uri, { encoding: 'base64' });
      const wb = XLSX.read(bstr, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const name = file.name.replace(/\.[^/.]+$/, "");
      
      const newReg = await importExcelData(businessId!, name, data);
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      router.push(`/register/${newReg.id}`);
    } catch (err: any) {
      Alert.alert('Import Error', err.message || 'Failed to import Excel');
    }
  };

  const handleDeleteRegister = (reg: RegisterSummary) => {
    Alert.alert('Delete Register', `Delete "${reg.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(reg.id) }
    ]);
  };

  const handleDeleteFolder = (folder: Folder) => {
    Alert.alert('Delete Folder', `Delete "${folder.name}"? Registers inside will be moved out.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => folderDeleteMutation.mutate(folder.id) }
    ]);
  };

  // ─── Memoized Filters ──────────────────────────────────────
  const filteredRegisters = useMemo(() =>
    registers?.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [registers, search]
  );

  const unfiledRegisters = useMemo(() =>
    filteredRegisters?.filter(r => !(r as any).folderId) || [],
    [filteredRegisters]
  );

  const getRegistersInFolder = useCallback((fId: number) =>
    filteredRegisters?.filter(r => (r as any).folderId === fId) || [],
    [filteredRegisters]
  );

  if (isBusinessesLoading || (isRegistersLoading && !isRefetching)) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogo}>
                <Ionicons name="grid" size={20} color={Colors.navy} />
              </View>
              <View>
                <Text style={styles.brandName}>AG Trust</Text>
                <Text style={styles.brandSub}>Digital Ledger</Text>
              </View>
            </View>
          </View>
        </View>
        <HomeSkeleton />
      </View>
    );
  }

  // ─── Nested Components ────────────────────────────────────

  const RegisterItem = ({ item, isNested }: { item: RegisterSummary; isNested?: boolean }) => {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
      <Animated.View layout={Layout.springify()} style={animatedStyle}>
        <TouchableOpacity
          style={[styles.registerItem, isNested && styles.nestedItem]}
          onPress={() => router.push(`/register/${item.id}`)}
          onLongPress={() => setActiveRegister(item)}
          onPressIn={() => (scale.value = withSpring(0.97))}
          onPressOut={() => (scale.value = withSpring(1))}
          activeOpacity={0.9}
        >
          <View style={[styles.registerIconBg, (item as any).iconColor && { backgroundColor: `${(item as any).iconColor}15` }]}>
            <Ionicons name={(item.icon as any) || 'document'} size={20} color={(item as any).iconColor || Colors.navy} />
          </View>
          <View style={styles.registerInfo}>
            <Text style={styles.registerName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.registerMeta}>{item.entryCount} entries • {new Date(item.updatedAt).toLocaleDateString()}</Text>
          </View>
          <TouchableOpacity style={styles.moreBtn} onPress={() => setActiveRegister(item)}>
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.muted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setIsAddMenuOpen(false); }}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        {/* ─── Premium Header ─────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogo}>
                <Ionicons name="grid" size={20} color={Colors.navy} />
              </View>
              <View>
                <Text style={styles.brandName}>AG Trust</Text>
                <Text style={styles.brandSub}>Digital Ledger</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.addBtn, isAddMenuOpen && { backgroundColor: Colors.error }]}
              onPress={() => setIsAddMenuOpen(!isAddMenuOpen)}
            >
              <Ionicons name={isAddMenuOpen ? "close" : "add"} size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.placeholder} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search registers..."
              placeholderTextColor={Colors.placeholder}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Add Menu Dropdown ─────────────────────────── */}
        {isAddMenuOpen && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.addMenu}>
            <TouchableOpacity style={styles.addMenuItem} onPress={() => { setIsAddMenuOpen(false); router.push('/templates'); }}>
              <View style={[styles.addMenuIcon, { backgroundColor: Colors.blueLight }]}>
                <Ionicons name="add-circle" size={20} color={Colors.blue} />
              </View>
              <Text style={styles.addMenuText}>Create New</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addMenuItem} onPress={() => { setIsAddMenuOpen(false); setCreateFolderModal(true); }}>
              <View style={[styles.addMenuIcon, { backgroundColor: Colors.amberLight }]}>
                <Ionicons name="folder-add" size={20} color={Colors.amber} />
              </View>
              <Text style={styles.addMenuText}>New Folder</Text>
            </TouchableOpacity>
            <View style={styles.addMenuDivider} />
            <TouchableOpacity style={styles.addMenuItem} onPress={handlePickExcel}>
              <View style={[styles.addMenuIcon, { backgroundColor: '#E6F4EA' }]}>
                <Ionicons name="document-text" size={20} color="#107C41" />
              </View>
              <Text style={[styles.addMenuText, { color: '#107C41' }]}>Import Excel</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── Main Content ─────────────────────────────────── */}
        <ScrollView 
          style={styles.mainScroll} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {(!filteredRegisters || filteredRegisters.length === 0) && folders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Animated.View entering={FadeInDown.delay(100)} style={styles.emptyIconContainer}>
                <Ionicons name="documents-outline" size={80} color={Colors.navyLight} />
              </Animated.View>
              <Text style={styles.emptyTitle}>Your Desk is Empty</Text>
              <Text style={styles.emptyDesc}>Organize your business records efficiently with digital registers.</Text>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={() => router.push('/templates')}>
                <Text style={styles.emptyActionText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Folders Section */}
              {folders.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>FOLDERS</Text>
                  {folders.map(folder => {
                    const regs = getRegistersInFolder(folder.id);
                    const isExpanded = expandedFolders[folder.id] ?? false;
                    return (
                      <View key={folder.id} style={styles.folderGroup}>
                        <TouchableOpacity
                          style={[styles.folderHeader, isExpanded && styles.folderHeaderExpanded]}
                          onPress={() => setExpandedFolders(p => ({ ...p, [folder.id]: !isExpanded }))}
                          onLongPress={() => setActiveFolder(folder)}
                        >
                          <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={Colors.muted} />
                          <View style={styles.folderIcon}><Ionicons name="folder" size={22} color={Colors.amber} /></View>
                          <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                          <View style={styles.folderBadge}><Text style={styles.folderBadgeText}>{regs.length}</Text></View>
                          <TouchableOpacity style={styles.folderMore} onPress={() => setActiveFolder(folder)}>
                            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.muted} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                        {isExpanded && (
                          <Animated.View entering={FadeIn} style={styles.folderContent}>
                            {regs.length === 0 ? (
                              <Text style={styles.emptyHint}>Folder is empty</Text>
                            ) : (
                              regs.map(item => <RegisterItem key={item.id} item={item} isNested />)
                            )}
                          </Animated.View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* All Registers Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>REGISTERS</Text>
                {unfiledRegisters.length === 0 && folders.length > 0 ? (
                  <Text style={styles.allOrganizedHint}>All registers are organized in folders.</Text>
                ) : (
                  unfiledRegisters.map(item => <RegisterItem key={item.id} item={item} />)
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* ─── Action Sheets & Modals ────────────────────────────────────── */}

        <ActionSheet 
          visible={!!activeRegister} 
          onClose={() => setActiveRegister(null)} 
          title={activeRegister?.name}
        >
          <ActionItem icon="open-outline" label="Open Register" onPress={() => { router.push(`/register/${activeRegister?.id}`); setActiveRegister(null); }} />
          <ActionItem icon="pencil-outline" label="Rename" onPress={() => { setRenameValue(activeRegister?.name || ''); setRenameRegModal(true); setActiveRegister(null); }} />
          <ActionItem icon="copy-outline" label="Duplicate" onPress={() => { if (activeRegister) duplicateMutation.mutate(activeRegister.id); }} />
          <ActionItem icon="folder-outline" label="Move to Folder" onPress={() => { setMoveRegModal(true); setActiveRegister(null); }} />
          <View style={styles.actionDivider} />
          <ActionItem icon="trash-outline" label="Delete Register" danger onPress={() => { if (activeRegister) { handleDeleteRegister(activeRegister); setActiveRegister(null); } }} />
        </ActionSheet>

        <ActionSheet 
          visible={!!activeFolder} 
          onClose={() => setActiveFolder(null)} 
          title={activeFolder?.name}
        >
          <ActionItem icon="pencil-outline" label="Rename Folder" onPress={() => { setRenameFldValue(activeFolder?.name || ''); setRenameFldModal(true); setActiveFolder(null); }} />
          <ActionItem icon="trash-outline" label="Delete Folder" danger onPress={() => { if (activeFolder) { handleDeleteFolder(activeFolder); setActiveFolder(null); } }} />
        </ActionSheet>

        <PremiumModal
          visible={renameRegModal}
          onClose={() => setRenameRegModal(false)}
          title="Rename Register"
          confirmLabel="Save Changes"
          onConfirm={() => activeRegister && renameMutation.mutate({ id: activeRegister.id, name: renameValue.trim() })}
        >
          <TextInput style={styles.premiumInput} value={renameValue} onChangeText={setRenameValue} autoFocus placeholder="Enter new name" />
        </PremiumModal>

        <PremiumModal
          visible={createFolderModal}
          onClose={() => setCreateFolderModal(false)}
          title="New Folder"
          onConfirm={() => folderNameValue.trim() && folderCreateMutation.mutate(folderNameValue.trim())}
        >
          <TextInput style={styles.premiumInput} value={folderNameValue} onChangeText={setFolderNameValue} autoFocus placeholder="Folder name (e.g. Sales 2024)" />
        </PremiumModal>

        <PremiumModal
          visible={renameFldModal}
          onClose={() => setRenameFldModal(false)}
          title="Rename Folder"
          onConfirm={() => activeFolder && folderRenameMutation.mutate({ id: activeFolder.id, name: renameFldValue.trim() })}
        >
          <TextInput style={styles.premiumInput} value={renameFldValue} onChangeText={setRenameFldValue} autoFocus placeholder="Enter folder name" />
        </PremiumModal>

        <ActionSheet
          visible={moveRegModal}
          onClose={() => setMoveRegModal(false)}
          title={`Move "${activeRegister?.name}" to...`}
        >
          <ActionItem 
            icon="grid-outline" 
            label="Root (Unfiled)" 
            onPress={() => activeRegister && moveToFolderMutation.mutate({ registerId: activeRegister.id, folderId: null })} 
          />
          {folders.map(f => (
            <ActionItem 
              key={f.id} 
              icon="folder-outline" 
              label={f.name} 
              color={Colors.amber}
              onPress={() => activeRegister && moveToFolderMutation.mutate({ registerId: activeRegister.id, folderId: f.id })} 
            />
          ))}
        </ActionSheet>

      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.white,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadows.sm,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  brandLogo: {
    width: 42, height: 42, borderRadius: BorderRadius.md, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  brandName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.foreground },
  brandSub: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  addBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.full, backgroundColor: Colors.navy,
    justifyContent: 'center', alignItems: 'center', ...Shadows.md,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 44,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.foreground, marginLeft: Spacing.sm },
  
  addMenu: {
    position: 'absolute', top: Platform.OS === 'ios' ? 115 : 95, right: Spacing.xl,
    width: 220, backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.xs, ...Shadows.premium, zIndex: 1000, borderWidth: 1, borderColor: Colors.border,
  },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.md },
  addMenuIcon: { width: 36, height: 36, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  addMenuText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.foreground },
  addMenuDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 4 },

  mainScroll: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingBottom: 100 },
  section: { marginBottom: Spacing.xxl },
  sectionTitle: {
    fontSize: 12, fontWeight: FontWeight.bold, color: Colors.mutedLight,
    letterSpacing: 1.2, marginBottom: Spacing.md, marginLeft: 4,
  },

  registerItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  nestedItem: { marginLeft: Spacing.lg, backgroundColor: 'rgba(255,255,255,0.7)', borderStyle: 'dashed' },
  registerIconBg: { width: 40, height: 40, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  registerInfo: { flex: 1, marginLeft: Spacing.md },
  registerName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.foreground },
  registerMeta: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  moreBtn: { padding: Spacing.xs },

  folderGroup: { marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, backgroundColor: 'rgba(30, 45, 120, 0.03)', overflow: 'hidden' },
  folderHeader: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm,
  },
  folderHeaderExpanded: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  folderIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  folderName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.foreground },
  folderBadge: { backgroundColor: Colors.white, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  folderBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.muted },
  folderMore: { padding: Spacing.xs },
  folderContent: { paddingVertical: Spacing.sm },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconContainer: { width: 140, height: 140, borderRadius: 70, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl, ...Shadows.md },
  emptyTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.sm },
  emptyDesc: { fontSize: FontSize.md, color: Colors.muted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
  emptyActionBtn: { marginTop: Spacing.xxl, backgroundColor: Colors.navy, paddingHorizontal: Spacing.xxxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, ...Shadows.button },
  emptyActionText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  emptyHint: { textAlign: 'center', color: Colors.mutedLight, fontSize: FontSize.sm, paddingVertical: Spacing.lg },
  allOrganizedHint: { fontSize: FontSize.sm, color: Colors.muted, textAlign: 'center', padding: Spacing.xl, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  sheetHandle: { width: 40, height: 5, backgroundColor: Colors.border, borderRadius: 3, alignSelf: 'center', marginVertical: 12 },
  sheetTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.muted, textAlign: 'center', marginBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  sheetContent: { paddingHorizontal: Spacing.xl },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.lg },
  actionIconBg: { width: 42, height: 42, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.foreground },
  actionDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.md },

  premiumModal: { backgroundColor: Colors.white, margin: Spacing.xl, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadows.premium },
  modalHeading: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.xl },
  premiumInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.foreground, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xxl },
  modalButtons: { flexDirection: 'row', gap: Spacing.md },
  modalSecondaryBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  modalSecondaryText: { color: Colors.foreground, fontWeight: FontWeight.semibold, fontSize: FontSize.md },
  modalPrimaryBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.navy, ...Shadows.button },
  modalPrimaryText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  skeletonContainer: { padding: Spacing.xl },
  skeletonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  skeletonItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
});
