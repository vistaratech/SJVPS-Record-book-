import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  // Import JSON modal
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importDataString, setImportDataString] = useState('');

  // Folder system
  const [folderCreateModal, setFolderCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderMenuId, setFolderMenuId] = useState<number | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renameFolderModal, setRenameFolderModal] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [moveToFolderRegisterId, setMoveToFolderRegisterId] = useState<number | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

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

  // ─── Folders ──────────────────────────────────────────────
  const { data: folders = [] } = useQuery({
    queryKey: ['folders', businessId],
    queryFn: () => listFolders(businessId!),
    enabled: !!businessId,
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(businessId!, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folders', businessId] }); setFolderCreateModal(false); setNewFolderName(''); },
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameFolder(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folders', businessId] }); setRenameFolderModal(false); },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => deleteFolder(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folders', businessId] }); queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); setFolderMenuId(null); },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ registerId, folderId }: { registerId: number; folderId: number | null }) => moveRegisterToFolder(registerId, folderId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); setMoveToFolderRegisterId(null); setRegisterMenuId(null); },
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

  // ─── Import Excel ──────────────────────────────────────────
  const excelMutation = useMutation({
    mutationFn: async ({ name, data }: { name: string; data: any[] }) => {
      const reg = await importExcelData(businessId!, name, data);
      return reg;
    },
    onSuccess: (newReg) => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      router.push(`/register/${newReg.id}`);
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to import Excel data'),
  });

  const importMutation = useMutation({
    mutationFn: (jsonData: string) => importData(businessId!, jsonData),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setImportModalVisible(false);
      setImportDataString('');
      Alert.alert('Success', 'Data imported successfully');
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to import JSON data'),
  });

  const handlePickExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/comma-separated-values'
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      const bstr = await (FileSystem as any).readAsStringAsync(file.uri, { encoding: 'base64' });
      
      const wb = XLSX.read(bstr, { type: 'base64' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      
      const name = file.name.replace(/\.[^/.]+$/, "");
      excelMutation.mutate({ name, data });
    } catch (err: any) {
      Alert.alert('Import Error', 'Failed to read or parse the selected file.');
    }
  };

  // ─── Category / Template data ─────────────────────────────
  const categoryData = CATEGORIES.find((c) => c.id === selectedCategory);
  const subTemplates = selectedCategory ? TEMPLATES[selectedCategory] || [] : [];

  // ─── Filter registers (memoised) ────────────────────────────
  const filteredRegisters = useMemo(() =>
    registers?.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [registers, search]
  );

  // Derived: registers grouped by folder (memoised)
  const unfiledRegisters = useMemo(() =>
    filteredRegisters?.filter(r => !(r as any).folderId) || [],
    [filteredRegisters]
  );
  const folderRegisters = useCallback((fId: number) =>
    filteredRegisters?.filter(r => (r as any).folderId === fId) || [],
    [filteredRegisters]
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
        <View style={styles.sidebarBrand}>
          <View style={styles.sidebarBrandGroup}>
            <View style={styles.sidebarBrandNameRow}>
              <View style={styles.sidebarBrandLogo}>
                <Text style={{ fontWeight: 'bold', color: Colors.navy, fontSize: 16 }}>AG</Text>
              </View>
              <Text style={styles.sidebarBrandName}>AG Trust</Text>
            </View>
            <Text style={styles.sidebarBrandSub}>Trusted Partners</Text>
          </View>
        </View>

        <View style={styles.sidebarAddSection}>
          <TouchableOpacity
            style={styles.sidebarAddBtn}
            onPress={() => setIsAddMenuOpen(!isAddMenuOpen)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={Colors.white} />
            <Text style={styles.sidebarAddBtnText}>Add</Text>
          </TouchableOpacity>

          {isAddMenuOpen && (
            <View style={styles.addDropdown}>
              <TouchableOpacity style={styles.addDropdownItem} onPress={() => { setIsAddMenuOpen(false); router.push('/templates'); }}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.navy} />
                <Text style={styles.addDropdownText}>New Register</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addDropdownItem} onPress={() => { setIsAddMenuOpen(false); setFolderCreateModal(true); }}>
                <Ionicons name="folder-outline" size={16} color={Colors.navy} />
                <Text style={styles.addDropdownText}>New File</Text>
              </TouchableOpacity>
              <View style={styles.addDropdownDivider} />
              <TouchableOpacity style={styles.addDropdownItem} onPress={() => { setIsAddMenuOpen(false); handlePickExcel(); }}>
                {excelMutation.isPending ? <ActivityIndicator size="small" color="#107c41" /> : <Ionicons name="document-text-outline" size={16} color="#107c41" />}
                <Text style={[styles.addDropdownText, { color: '#107c41' }]}>Input Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addDropdownItem} onPress={() => { setIsAddMenuOpen(false); setImportModalVisible(true); }}>
                <Ionicons name="code-slash-outline" size={16} color="#f59e0b" />
                <Text style={[styles.addDropdownText, { color: '#f59e0b' }]}>Input JSON</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Search */}
        <View style={styles.sidebarSearch}>
          <Ionicons name="search" size={14} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search register"
            placeholderTextColor={Colors.placeholder}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close" size={14} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </View>

      {/* ─── Main Content ─────────────────────────────────── */}
      {(!filteredRegisters || filteredRegisters.length === 0) ? (
        /* ── Empty State (web "Welcome to Record Book") ─── */
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-checkmark" size={100} color={Colors.navy} style={{ marginBottom: 24 }} />
          <Text style={styles.welcomeTitle}>Welcome to AG Trust</Text>
          <Text style={styles.welcomeSub}>Create your first register by selecting a template, starting from scratch, or uploading Excel data.</Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/templates')}>
              <Ionicons name="add" size={16} color={Colors.white} />
              <Text style={styles.emptyBtnText}>Add New Register</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emptyBtn, styles.emptyBtnSecondary]} onPress={handlePickExcel}>
              <Ionicons name="cloud-upload-outline" size={16} color={Colors.foreground} />
              <Text style={[styles.emptyBtnText, { color: Colors.foreground }]}>{excelMutation.isPending ? 'Importing...' : 'Import Excel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── Register List with Folders (web sidebar) ─── */
        <ScrollView
          style={{ flex: 1, backgroundColor: Colors.white }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Folders */}
          {folders.map(folder => {
            const regsInFolder = folderRegisters(folder.id);
            const isExpanded = expandedFolders[folder.id] ?? true;
            return (
              <View key={`folder-${folder.id}`} style={styles.sidebarFolderGroup}>
                <TouchableOpacity
                  style={styles.sidebarFolderHeader}
                  onPress={() => setExpandedFolders(prev => ({ ...prev, [folder.id]: !isExpanded }))}
                  onLongPress={() => setFolderMenuId(folder.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={14} color={Colors.muted} style={{ width: 16 }} />
                  <Ionicons name="folder" size={16} color={Colors.navy} />
                  <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                  <TouchableOpacity onPress={() => setFolderMenuId(folder.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.muted }}>⋮</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.sidebarFolderChildren}>
                    {regsInFolder.length === 0 ? (
                      <Text style={styles.emptyFolderText}>Empty folder</Text>
                    ) : (
                      regsInFolder.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.registerItem, { paddingLeft: 44 }]}
                          onPress={() => router.push(`/register/${item.id}`)}
                          onLongPress={() => setRegisterMenuId(item.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.registerIconBg, (item as any).iconColor && { backgroundColor: `${(item as any).iconColor}20` }]}>
                            <Ionicons name={(item.icon as any) || 'document'} size={16} color={(item as any).iconColor || Colors.navy} />
                          </View>
                          <View style={styles.registerInfo}>
                            <Text style={styles.registerName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.registerMeta}>{item.entryCount} entries • {new Date(item.updatedAt).toLocaleDateString()}</Text>
                          </View>
                          <TouchableOpacity onPress={() => setRegisterMenuId(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.muted }}>⋮</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.unassignedZone}>
            <Text style={styles.unassignedLabel}>UNASSIGNED</Text>
            {unfiledRegisters.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.registerItem}
                onPress={() => router.push(`/register/${item.id}`)}
                onLongPress={() => setRegisterMenuId(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.registerIconBg, (item as any).iconColor && { backgroundColor: `${(item as any).iconColor}20` }]}>
                  <Ionicons name={(item.icon as any) || 'document'} size={16} color={(item as any).iconColor || Colors.navy} />
                </View>
                <View style={styles.registerInfo}>
                  <Text style={styles.registerName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.registerMeta}>{item.entryCount} entries • {new Date(item.updatedAt).toLocaleDateString()}</Text>
                  {item.lastActivity ? <Text style={[styles.registerMeta, { fontStyle: 'italic', marginTop: 2 }]} numberOfLines={1}>{item.lastActivity}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => setRegisterMenuId(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.muted }}>⋮</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
            <TouchableOpacity style={styles.contextItem} onPress={() => { if (registerMenuId) duplicateMutation.mutate(registerMenuId); }}>
              <Ionicons name="copy-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Duplicate</Text>
            </TouchableOpacity>
            {/* Move to Folder */}
            {folders.length > 0 && (
              <TouchableOpacity
                style={styles.contextItem}
                onPress={() => { if (registerMenuId) { setMoveToFolderRegisterId(registerMenuId); setRegisterMenuId(null); } }}
              >
                <Ionicons name="folder-outline" size={18} color={Colors.navy} />
                <Text style={styles.contextItemText}>Move to Folder</Text>
              </TouchableOpacity>
            )}
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

      {/* ─── Import JSON Modal ─────────────────────────────── */}
      <Modal visible={importModalVisible} transparent animationType="slide" onRequestClose={() => setImportModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setImportModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Import Data</Text>
              <Text style={{ fontSize: FontSize.sm, color: Colors.muted, marginBottom: Spacing.sm }}>Paste Record Book JSON data here</Text>
              <TextInput
                style={[styles.modalInput, { height: 120, textAlignVertical: 'top' }]}
                value={importDataString}
                onChangeText={setImportDataString}
                placeholder="[{...}]"
                placeholderTextColor={Colors.placeholder}
                multiline
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setImportModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, importMutation.isPending && { opacity: 0.7 }]}
                  onPress={() => {
                    if (importDataString.trim()) {
                      importMutation.mutate(importDataString.trim());
                    }
                  }}
                  disabled={importMutation.isPending || !importDataString.trim()}
                >
                  {importMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.modalConfirmText}>Import</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Create Folder Modal ── */}
      <Modal visible={folderCreateModal} transparent animationType="slide" onRequestClose={() => setFolderCreateModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFolderCreateModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Folder</Text>
              <TextInput
                style={styles.modalInput}
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Folder name"
                placeholderTextColor={Colors.placeholder}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setFolderCreateModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, !newFolderName.trim() && { opacity: 0.5 }]}
                  onPress={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                >
                  {createFolderMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.modalConfirmText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Rename Folder Modal ── */}
      <Modal visible={renameFolderModal} transparent animationType="slide" onRequestClose={() => setRenameFolderModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRenameFolderModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename Folder</Text>
              <TextInput
                style={styles.modalInput}
                value={renameFolderValue}
                onChangeText={setRenameFolderValue}
                placeholder="Folder name"
                placeholderTextColor={Colors.placeholder}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRenameFolderModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, !renameFolderValue.trim() && { opacity: 0.5 }]}
                  onPress={() => renameFolderId && renameFolderValue.trim() && renameFolderMutation.mutate({ id: renameFolderId, name: renameFolderValue.trim() })}
                  disabled={!renameFolderValue.trim() || renameFolderMutation.isPending}
                >
                  {renameFolderMutation.isPending ? (
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

      {/* ── Move to Folder Modal ── */}
      <Modal visible={moveToFolderRegisterId !== null} transparent animationType="fade" onRequestClose={() => setMoveToFolderRegisterId(null)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setMoveToFolderRegisterId(null)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>Move to Folder</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => { if (moveToFolderRegisterId) moveToFolderMutation.mutate({ registerId: moveToFolderRegisterId, folderId: null }); }}>
              <Ionicons name="document-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>No Folder (Root)</Text>
            </TouchableOpacity>
            {folders.map(f => (
              <TouchableOpacity key={f.id} style={styles.contextItem} onPress={() => { if (moveToFolderRegisterId) moveToFolderMutation.mutate({ registerId: moveToFolderRegisterId, folderId: f.id }); }}>
                <Ionicons name="folder" size={18} color="#f59e0b" />
                <Text style={styles.contextItemText}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Folder Context Menu ── */}
      <Modal visible={folderMenuId !== null} transparent animationType="fade" onRequestClose={() => setFolderMenuId(null)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setFolderMenuId(null)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>{folders.find(f => f.id === folderMenuId)?.name || 'Folder'}</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              const f = folders.find(fl => fl.id === folderMenuId);
              if (f) { setRenameFolderId(f.id); setRenameFolderValue(f.name); setFolderMenuId(null); setRenameFolderModal(true); }
            }}>
              <Ionicons name="pencil" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              if (folderMenuId) {
                Alert.alert('Delete Folder', 'Delete this folder? Registers will be moved to root.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteFolderMutation.mutate(folderMenuId) },
                ]);
              }
            }}>
              <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
              <Text style={styles.contextItemDanger}>Delete</Text>
            </TouchableOpacity>
          </View>
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
  sidebarBrand: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 16,
    flexDirection: 'column',
  },
  sidebarBrandGroup: { flexDirection: 'column' },
  sidebarBrandNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sidebarBrandLogo: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 2,
  },
  sidebarBrandName: { color: Colors.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  sidebarBrandSub: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },

  sidebarAddSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.white,
    zIndex: 10,
  },
  sidebarAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    height: 40,
    backgroundColor: Colors.navy,
    borderRadius: 8,
    width: '100%',
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  sidebarAddBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  addDropdown: {
    position: 'absolute', top: 56, left: 12, width: 220,
    backgroundColor: Colors.white, borderRadius: 8,
    padding: 6, ...Shadows.elevated,
    borderWidth: 1, borderColor: Colors.border,
    zIndex: 100,
  },
  addDropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8,
  },
  addDropdownText: {
    fontSize: 14, fontWeight: '600', color: Colors.foreground,
  },
  addDropdownDivider: {
    height: 1, backgroundColor: Colors.borderLight, marginVertical: 4,
  },
  sidebarSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.foreground,
    marginLeft: 8,
  },

  // ── Register List (web sidebar list) ────────────────────
  listContent: {
    paddingBottom: 100,
  },
  sidebarFolderGroup: {
    marginBottom: 4,
  },
  sidebarFolderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  folderName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 13,
    color: Colors.navy,
  },
  sidebarFolderChildren: {
    paddingBottom: 4,
  },
  emptyFolderText: {
    fontSize: 12,
    color: Colors.muted,
    paddingVertical: 4,
    paddingLeft: 44,
    fontStyle: 'italic',
  },
  registerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  registerIconBg: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(27,42,74,0.08)',
  },
  registerInfo: {
    flex: 1,
  },
  registerName: {
    fontWeight: '600',
    fontSize: 13,
    color: Colors.foreground,
  },
  registerMeta: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  unassignedZone: {
    paddingBottom: 20,
    minHeight: 100,
    marginTop: 16,
  },
  unassignedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
  },

  // ── Empty State (web welcome) ───────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: Colors.white,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: 16,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 460,
  },
  emptyActions: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 300,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.navy,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    ...Shadows.button,
  },
  emptyBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBtnSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },

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

  // ── Import Button ─────────────────────────────────────────
  importTopButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  importTopButtonText: {
    color: Colors.navy,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
});
