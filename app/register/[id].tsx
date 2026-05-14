// Register Spreadsheet View — full-featured Excel-like mobile experience
// Implements: search filter, sort, filter modal, calculation bar, multi-page,
// CSV download, share, date picker, dropdown editor, column rename, row duplication,
// bulk select/delete, and frozen serial column
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Share,
  Animated,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRegister,
  addColumn,
  deleteColumn,
  renameColumn,
  updateColumnDropdownOptions,
  duplicateColumn,
  moveColumn,
  changeColumnType,
  clearColumnData,
  insertColumn,
  freezeColumn,
  hideColumn,
  addEntry,
  updateEntry,
  deleteEntry,
  duplicateEntry,
  bulkDeleteEntries,
  restoreEntry,
  restoreColumn,
  bulkRestoreEntries,
  addPage,
  renamePage,
  deletePage,
  deleteRegister,
  duplicateRegister,
  renameRegister,
  generateShareLink,
  addSharedUser,
  removeSharedUser,
  generateCSV,
  calculateColumnStats,
  evaluateFormula,
  type Column,
  type Entry,
  type Page,
  type ColumnStats,
  type SharedUser,
} from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';
import { RegisterHeader } from '../../components/register/RegisterHeader';
import { RegisterToolbar } from '../../components/register/RegisterToolbar';
import { CalculationBar } from '../../components/register/CalculationBar';
import { RegisterRow } from '../../components/register/RegisterRow';
import { FilterWizard } from '../../components/register/FilterWizard';
import { ExportService } from '../../lib/export';

const COL_WIDTH = 150;
const SERIAL_COL_WIDTH = 50;
const CHECKBOX_COL_WIDTH = 40;
const MIN_MOCK_ROWS = 7;

type SortDirection = 'asc' | 'desc' | null;
type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max';

interface FilterCondition {
  columnId: string;
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'empty' | 'not_empty';
  value: string;
}

// ─── SKELETON LOADER ─────────────────────────────────────────
const RegisterSkeleton = memo(function RegisterSkeleton() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      {/* Fake Header */}
      <View style={{ backgroundColor: '#f4f7ff', borderBottomWidth: 1, borderBottomColor: '#dce4f5', height: Platform.OS === 'ios' ? 100 : 56, paddingTop: Platform.OS === 'ios' ? 48 : 0, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
         <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#dce4f5', marginRight: Spacing.md }} />
         <View style={{ flex: 1 }}>
            <View style={{ width: 140, height: 32, borderRadius: 8, backgroundColor: '#dce4f5' }} />
         </View>
      </View>
      {/* Fake Toolbar */}
      <View style={{ backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm }}>
        <View style={{ width: 120, height: 34, borderRadius: 4, backgroundColor: Colors.surface }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
           <View style={{ width: 40, height: 26, borderRadius: 4, backgroundColor: Colors.surface }} />
           <View style={{ width: 60, height: 26, borderRadius: 4, backgroundColor: Colors.borderLight }} />
        </View>
      </View>
      {/* Fake Grid */}
      <Animated.View style={{ flex: 1, opacity: pulseAnim }}>
         {/* Headers */}
         <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: Colors.border }}>
            <View style={{ width: CHECKBOX_COL_WIDTH, height: 44, borderRightWidth: 1, borderRightColor: Colors.border }} />
            <View style={{ width: SERIAL_COL_WIDTH, height: 44, backgroundColor: Colors.borderLight, borderRightWidth: 1, borderRightColor: Colors.border }} />
            <View style={{ width: COL_WIDTH, height: 44, backgroundColor: Colors.white, borderRightWidth: 1, borderRightColor: Colors.border }} />
            <View style={{ width: COL_WIDTH, height: 44, backgroundColor: Colors.white, borderRightWidth: 1, borderRightColor: Colors.border }} />
         </View>
         {/* Rows */}
         {[1, 2, 3, 4, 5, 6, 7].map(i => (
           <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, minHeight: 44 }}>
             <View style={{ width: CHECKBOX_COL_WIDTH, borderRightWidth: 1, borderRightColor: Colors.border }} />
             <View style={{ width: SERIAL_COL_WIDTH, backgroundColor: Colors.borderLight, borderRightWidth: 1, borderRightColor: Colors.border }} />
             <View style={{ width: COL_WIDTH, backgroundColor: Colors.white, borderRightWidth: 1, borderRightColor: Colors.border, padding: 12 }}>
                <View style={{ width: '80%', height: 12, backgroundColor: Colors.surface, borderRadius: 2 }} />
             </View>
             <View style={{ width: COL_WIDTH, backgroundColor: Colors.white, borderRightWidth: 1, borderRightColor: Colors.border, padding: 12 }}>
                <View style={{ width: '60%', height: 12, backgroundColor: Colors.surface, borderRadius: 2 }} />
             </View>
           </View>
         ))}
      </Animated.View>
    </View>
  );
});

export default function RegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const registerId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const { data: register, isLoading } = useQuery({
    queryKey: ['register', registerId],
    queryFn: () => getRegister(registerId),
    enabled: !!registerId,
  });

  // ─── State ────────────────────────────────────────────────
  const [localEntries, setLocalEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Column modal
  const [newColumnModal, setNewColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<string>('text');
  const [newColumnDropdownOptions, setNewColumnDropdownOptions] = useState('');
  const [newColumnFormula, setNewColumnFormula] = useState('');

  // Context menus
  const [columnMenuId, setColumnMenuId] = useState<number | null>(null);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);

  // Rename column
  const [renameColumnModal, setRenameColumnModal] = useState(false);
  const [renameColumnId, setRenameColumnId] = useState<number | null>(null);
  const [renameColumnValue, setRenameColumnValue] = useState('');

  // Change type
  const [changeTypeModal, setChangeTypeModal] = useState(false);
  const [changeTypeValue, setChangeTypeValue] = useState('text');

  // Insert column
  const [insertColModal, setInsertColModal] = useState<'left' | 'right' | null>(null);

  // Layout features
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<number>>(new Set());

  // Sort state
  const [sortColumnId, setSortColumnId] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Filter state
  const [filterModal, setFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  
  const [calcModal, setCalcModal] = useState(false);
  const [calcColumnId, setCalcColumnId] = useState<string | null>(null);
  const [selectedCalcType, setSelectedCalcType] = useState<Record<string, CalcType>>({});
  const [showStats, setShowStats] = useState(false);

  // Bulk selection
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode);
    setSelectedRows(new Set());
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
    if (newSelected.size === 0) setIsBulkMode(false);
  };

  const handleLongPressRow = (id: string) => {
    setIsBulkMode(true);
    handleSelectRow(id);
  };

  const [shareModal, setShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharePhone, setSharePhone] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');

  const [dropdownModal, setDropdownModal] = useState(false);
  const [dropdownEntryId, setDropdownEntryId] = useState<number | null>(null);
  const [dropdownColumnId, setDropdownColumnId] = useState<string | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);

  const [dateModal, setDateModal] = useState(false);
  const [dateEntryId, setDateEntryId] = useState<number | null>(null);
  const [dateColumnId, setDateColumnId] = useState<string | null>(null);
  const [dateYear, setDateYear] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');

  const [pageMenuVisible, setPageMenuVisible] = useState(false);
  const [renamePageModal, setRenamePageModal] = useState(false);
  const [renamePageId, setRenamePageId] = useState<number | null>(null);
  const [renamePageValue, setRenamePageValue] = useState('');

  const [dropdownConfigModal, setDropdownConfigModal] = useState(false);
  const [dropdownConfigColumnId, setDropdownConfigColumnId] = useState<number | null>(null);
  const [dropdownConfigOptions, setDropdownConfigOptions] = useState('');

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [registerMenu, setRegisterMenu] = useState(false);

  const horizontalScrollRef = useRef<ScrollView>(null);

  const undoStack = useRef<any[]>([]);
  const redoStack = useRef<any[]>([]);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (register?.entries) {
      setLocalEntries(register.entries);
    }
  }, [register?.entries]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['register', registerId] });

  const addEntryMutation = useMutation({
    mutationFn: () => addEntry(registerId, {}, activePageIndex),
    onSuccess: () => invalidate(),
  });

  const addColumnMutation = useMutation({
    mutationFn: (data: { name: string; type: any; options?: string[] }) => 
      addColumn(registerId, data.name, data.type, data.options),
    onSuccess: () => invalidate(),
  });

  const renameColumnMutation = useMutation({
    mutationFn: (data: { columnId: string; newName: string }) => 
      renameColumn(registerId, data.columnId, data.newName),
    onSuccess: () => invalidate(),
  });

  const duplicateColumnMutation = useMutation({
    mutationFn: (columnId: string) => duplicateColumn(registerId, columnId),
    onSuccess: () => invalidate(),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => deleteColumn(registerId, columnId),
    onSuccess: () => invalidate(),
  });

  const moveColumnMutation = useMutation({
    mutationFn: (data: { columnId: string; direction: 'left' | 'right' }) => 
      moveColumn(registerId, data.columnId, data.direction),
    onSuccess: () => invalidate(),
  });

  const clearColumnDataMutation = useMutation({
    mutationFn: (columnId: string) => clearColumnData(registerId, columnId),
    onSuccess: () => invalidate(),
  });

  const updateDropdownOptionsMutation = useMutation({
    mutationFn: (data: { columnId: string; options: string[] }) => 
      updateColumnDropdownOptions(registerId, data.columnId, data.options),
    onSuccess: () => invalidate(),
  });

  const duplicateEntryMutation = useMutation({
    mutationFn: (entryId: number) => duplicateEntry(registerId, entryId),
    onSuccess: () => invalidate(),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => deleteEntry(registerId, entryId),
    onSuccess: () => invalidate(),
  });

  const addPageMutation = useMutation({
    mutationFn: (name: string) => addPage(registerId, name),
    onSuccess: () => invalidate(),
  });

  const renamePageMutation = useMutation({
    mutationFn: (data: { pageId: number; newName: string }) => 
      renamePage(registerId, data.pageId, data.newName),
    onSuccess: () => invalidate(),
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => deletePage(registerId, pageId),
    onSuccess: () => invalidate(),
  });

  const renameRegisterMutation = useMutation({
    mutationFn: (newName: string) => renameRegister(registerId, newName),
    onSuccess: () => invalidate(),
  });

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete ${selectedRows.size} entries?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const idsToDelete = Array.from(selectedRows).map(id => parseInt(id));
              await bulkDeleteEntries(registerId, idsToDelete);
              setLocalEntries(prev => prev.filter(e => !selectedRows.has(e.id.toString())));
              setSelectedRows(new Set());
              setIsBulkMode(false);
              setIsSyncing(true);
              invalidate();
              setTimeout(() => setIsSyncing(false), 1000);
            } catch (error) {
              Alert.alert("Error", "Failed to delete entries");
            }
          }
        }
      ]
    );
  };

  const handleExportCSV = async () => {
    if (!register) return;
    try {
      setIsSyncing(true);
      await ExportService.exportToCSV(register, filteredEntries);
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export CSV');
    } finally {
      setIsSyncing(false);
      setRegisterMenu(false);
    }
  };

  const handleExportExcel = async () => {
    if (!register) return;
    try {
      setIsSyncing(true);
      await ExportService.exportToExcel(register, filteredEntries);
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export Excel');
    } finally {
      setIsSyncing(false);
      setRegisterMenu(false);
    }
  };

  const handleExportPDF = async () => {
    if (!register) return;
    try {
      setIsSyncing(true);
      await ExportService.exportToPDF(register, filteredEntries);
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export PDF');
    } finally {
      setIsSyncing(false);
      setRegisterMenu(false);
    }
  };

  const handleCellChange = useCallback(
    (entryId: number, columnId: string, newValue: string, oldValue: string) => {
      if (newValue === oldValue) return;
      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? { ...entry, cells: { ...entry.cells, [columnId]: newValue } }
            : entry
        )
      );
      updateEntry(registerId, entryId, { [columnId]: newValue });
    },
    [registerId]
  );

  const handleDateSelect = () => {
    if (dateEntryId && dateColumnId) {
      const formattedDate = `${dateYear}-${dateMonth.padStart(2, '0')}-${dateDay.padStart(2, '0')}`;
      handleCellChange(dateEntryId, dateColumnId, formattedDate, '');
      setDateModal(false);
    }
  };

  const handleGenerateShareLink = async () => {
    try {
      const link = await generateShareLink(registerId);
      setShareLink(link);
    } catch {
      Alert.alert('Error', 'Failed to generate share link');
    }
  };

  const handleNativeShare = async () => {
    if (!shareLink) return;
    try {
      await Share.share({
        message: `Check out this record book: ${shareLink}`,
        url: shareLink,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  if (isLoading) {
    return <RegisterSkeleton />;
  }

  if (!register) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={Colors.destructive} />
        <Text style={styles.errorTitle}>Register not found</Text>
      </View>
    );
  }

  const columns = register.columns || [];
  const pages = register.pages || [{ id: 1, name: 'Page 1', index: 0 }];
  const currentPage = pages[activePageIndex];

  // ─── Filter & Sort Logic ─────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let result = localEntries.filter(e => (e.pageIndex || 0) === activePageIndex);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(entry => 
        columns.some(col => (entry.cells?.[col.id] || '').toLowerCase().includes(q))
      );
    }

    if (activeFilters.length > 0) {
      result = result.filter(entry =>
        activeFilters.every(f => {
          const rawVal = entry.cells?.[f.columnId] || '';
          const val = rawVal.toString().toLowerCase();
          const filterVal = f.value.toLowerCase();
          
          switch (f.operator) {
            case 'contains':
              return val.includes(filterVal);
            case 'equals':
              return val === filterVal;
            case 'gt':
              return !isNaN(parseFloat(val)) && parseFloat(val) > parseFloat(filterVal);
            case 'lt':
              return !isNaN(parseFloat(val)) && parseFloat(val) < parseFloat(filterVal);
            case 'gte':
              return !isNaN(parseFloat(val)) && parseFloat(val) >= parseFloat(filterVal);
            case 'lte':
              return !isNaN(parseFloat(val)) && parseFloat(val) <= parseFloat(filterVal);
            case 'empty':
              return val.trim() === '';
            case 'not_empty':
              return val.trim() !== '';
            default:
              return true;
          }
        })
      );
    }

    if (sortColumnId && sortDirection) {
      result = [...result].sort((a, b) => {
        const aVal = a.cells?.[sortColumnId] || '';
        const bVal = b.cells?.[sortColumnId] || '';
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    return result;
  }, [localEntries, activePageIndex, search, activeFilters, sortColumnId, sortDirection, columns]);

  // ─── Stats Logic ──────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    return columns
      .filter(col => col.type === 'number' || col.type === 'currency')
      .map(col => {
        const stats = calculateColumnStats(filteredEntries, col.id.toString());
        return {
          label: col.name,
          value: col.type === 'currency' ? formatCurrency(stats.sum) : stats.sum.toFixed(2),
        };
      });
  }, [filteredEntries, columns]);

  const handleAddRow = () => {
    addEntryMutation.mutate();
  };

  // ════════════════════════════════════════════════════════════
  return (
    <>
      <Stack.Screen
        options={{
          title: register.name,
          headerShown: false,
        }}
      />

      <RegisterHeader
        title={register.name}
        isSyncing={isSyncing}
        onBack={() => router.back()}
        onTitlePress={() => {
          setRenamePageValue(register.name);
          setRenamePageId(-1); // Use -1 to indicate Register Rename
          setRenamePageModal(true);
        }}
        onSharePress={() => {
          setShareModal(true);
          handleGenerateShareLink();
        }}
        onMenuPress={() => setRegisterMenu(true)}
      />

      <FilterWizard
        visible={filterModal}
        onClose={() => setFilterModal(false)}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setActiveFilters(newFilters);
        }}
        columns={columns}
        initialFilters={filters}
      />

      <RegisterToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        onFilterPress={() => setFilterModal(true)}
        onStatsPress={() => setShowStats(!showStats)}
        onAddRow={handleAddRow}
        activeFiltersCount={activeFilters.length}
        showStats={showStats}
        bulkMode={isBulkMode}
        onBulkDelete={handleBulkDelete}
        onSelectAll={() => {
          const allIds = filteredEntries.map(e => e.id.toString());
          setSelectedRows(new Set(allIds));
        }}
        onCancelBulk={() => setIsBulkMode(false)}
        selectedCount={selectedRows.size}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {columns.length === 0 ? (
          <View style={styles.emptyColumns}>
            <Ionicons name="bar-chart" size={48} color={Colors.navy} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyTitle}>No columns yet</Text>
            <Text style={styles.emptySub}>Add columns to start entering data</Text>
            <TouchableOpacity style={styles.addFirstColBtn} onPress={() => setNewColumnModal(true)}>
              <Ionicons name="add" size={18} color={Colors.white} />
              <Text style={styles.addFirstColText}>Add First Column</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={filteredEntries}
              keyExtractor={(item) => item.id.toString()}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <RegisterRow
                  entry={item}
                  columns={columns}
                  isSelected={selectedRows.has(item.id.toString())}
                  isBulkMode={isBulkMode}
                  onToggleSelect={(id) => handleSelectRow(id.toString())}
                  onLongPress={(id) => handleLongPressRow(id.toString())}
                  onCellChange={handleCellChange}
                  onDatePress={(entryId, colId, value) => {
                    setDateEntryId(entryId);
                    setDateColumnId(colId);
                    setDateModal(true);
                  }}
                  onDropdownPress={(entryId, colId, options) => {
                    setDropdownEntryId(entryId);
                    setDropdownColumnId(colId);
                    setDropdownOptions(options);
                    setDropdownModal(true);
                  }}
                />
              )}
            />
            {showStats && (
              <CalculationBar stats={summaryStats} />
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── MODALS ──────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* ─── Add Column Modal ────────────────────────────── */}
      <Modal visible={newColumnModal} transparent animationType="slide" onRequestClose={() => setNewColumnModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNewColumnModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Column</Text>

            <Text style={styles.modalLabel}>Column Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newColumnName}
              onChangeText={setNewColumnName}
              placeholder="e.g., Amount"
              placeholderTextColor={Colors.placeholder}
              autoFocus
            />

            <Text style={styles.modalLabel}>Column Type</Text>
            <View style={styles.typeRow}>
              {(['text', 'number', 'currency', 'date', 'dropdown', 'formula'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, newColumnType === type && styles.typeChipActive]}
                  onPress={() => setNewColumnType(type)}
                >
                  <Ionicons
                    name={
                      type === 'currency' ? 'cash' :
                      type === 'number' ? 'calculator' :
                      type === 'date' ? 'calendar' :
                      type === 'dropdown' ? 'chevron-down-circle' :
                      type === 'formula' ? 'flask' :
                      'text'
                    }
                    size={14}
                    color={newColumnType === type ? Colors.white : Colors.muted}
                  />
                  <Text style={[styles.typeChipText, newColumnType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newColumnType === 'dropdown' && (
              <>
                <Text style={styles.modalLabel}>Dropdown Options (comma-separated)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newColumnDropdownOptions}
                  onChangeText={setNewColumnDropdownOptions}
                  placeholder="e.g., Active, Inactive, Pending"
                  placeholderTextColor={Colors.placeholder}
                />
              </>
            )}

            {newColumnType === 'formula' && (
              <>
                <Text style={styles.modalLabel}>Formula Expression</Text>
                <TextInput
                  style={[styles.modalInput, styles.formulaInput]}
                  value={newColumnFormula}
                  onChangeText={setNewColumnFormula}
                  placeholder="e.g., {Marks}/{Full Marks}*100"
                  placeholderTextColor={Colors.placeholder}
                  autoCapitalize="none"
                />
                <View style={styles.formulaHint}>
                  <Ionicons name="information-circle" size={14} color={Colors.muted} />
                  <Text style={styles.formulaHintText}>
                    Use {'{'+'Column Name'+'}'} to reference columns. Supports +, -, *, / operators.
                  </Text>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setNewColumnModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, addColumnMutation.isPending && { opacity: 0.7 }]}
                onPress={() => addColumnMutation.mutate()}
                disabled={addColumnMutation.isPending || !newColumnName.trim()}
              >
                {addColumnMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Add Column</Text>
                )}
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ─── Column Context Menu (Enhanced) ──────────────────────── */}
      <Modal visible={columnMenuId !== null} transparent animationType="fade" onRequestClose={() => setColumnMenuId(null)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setColumnMenuId(null)} activeOpacity={1}>
          <ScrollView
            style={[styles.contextMenu, { maxHeight: '80%' }]}
            contentContainerStyle={{ paddingBottom: Spacing.xl }}
            bounces={false}
          >
            <View style={styles.contextTitleContainer}>
              <Text style={styles.contextTitleMain}>
                {columns.find((c) => c.id === columnMenuId)?.name}
              </Text>
              <View style={styles.contextTypeBadge}>
                <Text style={styles.contextTypeBadgeText}>
                  {columns.find((c) => c.id === columnMenuId)?.type.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Section: Sort */}
            <Text style={styles.contextSectionLabel}>SORT</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => { setSortColumnId(columnMenuId!); setSortDirection('asc'); setColumnMenuId(null); }}>
              <Ionicons name="arrow-up" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Sort A → Z</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => { setSortColumnId(columnMenuId!); setSortDirection('desc'); setColumnMenuId(null); }}>
              <Ionicons name="arrow-down" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Sort Z → A</Text>
            </TouchableOpacity>

            <View style={styles.contextDivider} />

            {/* Section: Edit */}
            <Text style={styles.contextSectionLabel}>EDIT</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              setRenameColumnId(columnMenuId!); setRenameColumnValue(columns.find((c) => c.id === columnMenuId)?.name || '');
              setRenameColumnModal(true); setColumnMenuId(null);
            }}>
              <Ionicons name="pencil" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Rename Column</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              setChangeTypeValue(columns.find((c) => c.id === columnMenuId)?.type || 'text');
              setChangeTypeModal(true); setColumnMenuId(null);
            }}>
              <Ionicons name="swap-horizontal" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Change Column Type</Text>
            </TouchableOpacity>

            {columns.find((c) => c.id === columnMenuId)?.type === 'dropdown' && (
              <TouchableOpacity style={styles.contextItem} onPress={() => {
                setDropdownConfigColumnId(columnMenuId!);
                setDropdownConfigOptions(columns.find((c) => c.id === columnMenuId)?.dropdownOptions?.join(', ') || '');
                setDropdownConfigModal(true); setColumnMenuId(null);
              }}>
                <Ionicons name="list" size={16} color={Colors.navy} />
                <Text style={styles.contextItemText}>Edit Dropdown Options</Text>
              </TouchableOpacity>
            )}

            <View style={styles.contextDivider} />

            {/* Section: Insert / Copy */}
            <Text style={styles.contextSectionLabel}>INSERT & COPY</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              setInsertColModal('left'); setColumnMenuId(null);
            }}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Insert Column Left</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              setInsertColModal('right'); setColumnMenuId(null);
            }}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Insert Column Right</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => duplicateColumnMutation.mutate(columnMenuId!)}>
              <Ionicons name="copy-outline" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Duplicate Column</Text>
            </TouchableOpacity>

            <View style={styles.contextDivider} />

            {/* Section: Arrange */}
            <Text style={styles.contextSectionLabel}>ARRANGE</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => moveColumnMutation.mutate({ colId: columnMenuId!, dir: 'left' })}>
              <Ionicons name="chevron-back" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Move Column Left</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => moveColumnMutation.mutate({ colId: columnMenuId!, dir: 'right' })}>
              <Ionicons name="chevron-forward" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Move Column Right</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              const frozen = frozenColumns.has(columnMenuId!);
              const newSet = new Set(frozenColumns);
              if (frozen) newSet.delete(columnMenuId!); else newSet.add(columnMenuId!);
              setFrozenColumns(newSet);
              freezeColumn(registerId, columnMenuId!, !frozen);
              setColumnMenuId(null);
            }}>
              <Ionicons name={frozenColumns.has(columnMenuId!) ? "pin-outline" : "pin"} size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>{frozenColumns.has(columnMenuId!) ? 'Unfreeze' : 'Freeze'} Column</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              const newSet = new Set(hiddenColumns);
              newSet.add(columnMenuId!);
              setHiddenColumns(newSet);
              hideColumn(registerId, columnMenuId!, true);
              setColumnMenuId(null);
            }}>
              <Ionicons name="eye-off-outline" size={16} color={Colors.navy} />
              <Text style={styles.contextItemText}>Hide Column</Text>
            </TouchableOpacity>

            <View style={styles.contextDivider} />

            {/* Section: Destructive */}
            <Text style={styles.contextSectionLabel}>DANGER</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              Alert.alert('Clear Data', 'Clear all data from this column?', [
                { text: 'Cancel', style: 'cancel', onPress: () => setColumnMenuId(null) },
                { text: 'Clear', style: 'destructive', onPress: () => clearColumnDataMutation.mutate(columnMenuId!) },
              ]);
            }}>
              <Ionicons name="backspace-outline" size={16} color={Colors.destructive} />
              <Text style={styles.contextItemDanger}>Clear Column Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => {
              Alert.alert('Delete Column', 'Are you sure? This cannot be undone.', [
                { text: 'Cancel', style: 'cancel', onPress: () => setColumnMenuId(null) },
                { text: 'Delete', style: 'destructive', onPress: () => deleteColumnMutation.mutate(columnMenuId!) },
              ]);
            }}>
              <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
              <Text style={styles.contextItemDanger}>Delete Column</Text>
            </TouchableOpacity>

          </ScrollView>
        </TouchableOpacity>
      </Modal>

      {/* ─── Change Column Type Modal ──────────────────────── */}
      <Modal visible={changeTypeModal} transparent animationType="slide" onRequestClose={() => setChangeTypeModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Column Type</Text>
            <Text style={styles.modalSub}>Select a new type for this column. Note: Converting types may cause some formatting to change.</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { val: 'text', icon: 'text', label: 'Text' },
                { val: 'number', icon: 'calculator', label: 'Number' },
                { val: 'currency', icon: 'cash', label: 'Currency' },
                { val: 'date', icon: 'calendar', label: 'Date' },
                { val: 'dropdown', icon: 'list', label: 'Dropdown' },
                { val: 'formula', icon: 'flask', label: 'Formula' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.val}
                  style={[styles.typeOption, changeTypeValue === t.val && styles.typeOptionSelected]}
                  onPress={() => setChangeTypeValue(t.val)}
                >
                  <Ionicons name={t.icon as any} size={24} color={changeTypeValue === t.val ? Colors.navy : Colors.muted} />
                  <Text style={[styles.typeOptionText, changeTypeValue === t.val && styles.typeOptionSelectedText]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setChangeTypeModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, changeColumnTypeMutation.isPending && { opacity: 0.7 }]}
                onPress={() => changeColumnTypeMutation.mutate()}
                disabled={changeColumnTypeMutation.isPending}
              >
                {changeColumnTypeMutation.isPending ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalConfirmText}>Save Type</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Insert Column Modal ─────────────────────────── */}
      <Modal visible={insertColModal !== null} transparent animationType="slide" onRequestClose={() => setInsertColModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInsertColModal(null)}>
          <KeyboardAvoidingView style={{ width: '100%', alignItems: 'center' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
              <Text style={styles.modalTitle}>Insert Column {insertColModal === 'left' ? 'Left' : 'Right'}</Text>
              
              <Text style={styles.modalLabel}>Column Name</Text>
              <TextInput style={styles.modalInput} value={newColumnName} onChangeText={setNewColumnName} placeholder="e.g. Price" placeholderTextColor={Colors.placeholder} />
              
              <Text style={styles.modalLabel}>Column Type</Text>
              <View style={styles.typeSelectorRow}>
              {[
                { val: 'text', icon: 'text', label: 'Text' },
                { val: 'number', icon: 'calculator', label: 'Number' },
                { val: 'currency', icon: 'cash', label: 'Currency' },
                { val: 'date', icon: 'calendar', label: 'Date' },
                { val: 'dropdown', icon: 'list', label: 'Dropdown' },
                { val: 'formula', icon: 'flask', label: 'Formula' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.val}
                  style={[styles.typeOption, newColumnType === t.val && styles.typeOptionSelected]}
                  onPress={() => setNewColumnType(t.val)}
                >
                  <Ionicons name={t.icon as any} size={24} color={newColumnType === t.val ? Colors.navy : Colors.muted} />
                  <Text style={[styles.typeOptionText, newColumnType === t.val && styles.typeOptionSelectedText]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
              </View>

              {newColumnType === 'dropdown' && (
                <>
                  <Text style={styles.modalLabel}>Dropdown Options (comma separated)</Text>
                  <TextInput style={styles.modalInput} value={newColumnDropdownOptions} onChangeText={setNewColumnDropdownOptions} placeholder="Option 1, Option 2" placeholderTextColor={Colors.placeholder} />
                </>
              )}
              {newColumnType === 'formula' && (
                <>
                  <Text style={styles.modalLabel}>Formula Expression</Text>
                  <TextInput style={styles.modalInput} value={newColumnFormula} onChangeText={setNewColumnFormula} placeholder="e.g., {Rate}*{Qty}" placeholderTextColor={Colors.placeholder} autoCapitalize="none" />
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setInsertColModal(null)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, insertColumnMutation.isPending && { opacity: 0.7 }]}
                  onPress={() => insertColumnMutation.mutate()}
                  disabled={insertColumnMutation.isPending || !newColumnName.trim()}
                >
                  {insertColumnMutation.isPending ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalConfirmText}>Insert</Text>}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>


      {/* ─── Row Context Menu ────────────────────────────── */}
      <Modal visible={rowMenuId !== null} transparent animationType="fade" onRequestClose={() => setRowMenuId(null)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setRowMenuId(null)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>Row Actions</Text>
            {/* Download as PDF */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => { if (rowMenuId) { handleRowDownloadPDF(rowMenuId); setRowMenuId(null); } }}
            >
              <Ionicons name="document-text-outline" size={18} color={Colors.navy} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contextItemText}>Download as PDF</Text>
                <Text style={styles.contextItemSubtext}>All columns included</Text>
              </View>
            </TouchableOpacity>
            {/* Download as Excel */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => { if (rowMenuId) { handleRowDownloadExcel(rowMenuId); setRowMenuId(null); } }}
            >
              <Ionicons name="document-outline" size={18} color={Colors.navy} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contextItemText}>Download as Excel</Text>
                <Text style={styles.contextItemSubtext}>All columns included</Text>
              </View>
            </TouchableOpacity>
            {/* Share as Text */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => { if (rowMenuId) { handleRowShareText(rowMenuId); setRowMenuId(null); } }}
            >
              <Ionicons name="share-outline" size={18} color={Colors.navy} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contextItemText}>Share as Text</Text>
                <Text style={styles.contextItemSubtext}>All columns included</Text>
              </View>
            </TouchableOpacity>
            {/* Duplicate */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (rowMenuId) duplicateEntryMutation.mutate(rowMenuId);
              }}
            >
              <Ionicons name="copy-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Duplicate Row</Text>
            </TouchableOpacity>
            {/* Delete */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (rowMenuId) {
                  Alert.alert('Delete Row', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel', onPress: () => setRowMenuId(null) },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteEntryMutation.mutate(rowMenuId) },
                  ]);
                }
              }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
              <Text style={styles.contextItemDanger}>Delete Row</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Rename Column Modal ─────────────────────────── */}
      <Modal visible={renameColumnModal} transparent animationType="slide" onRequestClose={() => setRenameColumnModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRenameColumnModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Column</Text>
            <TextInput
              style={styles.modalInput}
              value={renameColumnValue}
              onChangeText={setRenameColumnValue}
              placeholder="New column name"
              placeholderTextColor={Colors.placeholder}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRenameColumnModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => renameColumnMutation.mutate()}
                disabled={!renameColumnValue.trim()}
              >
                <Text style={styles.modalConfirmText}>Rename</Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ─── Dropdown Config Modal ───────────────────────── */}
      <Modal visible={dropdownConfigModal} transparent animationType="slide" onRequestClose={() => setDropdownConfigModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownConfigModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Dropdown Options</Text>
            <Text style={styles.modalLabel}>Options (comma-separated)</Text>
            <TextInput
              style={styles.modalInput}
              value={dropdownConfigOptions}
              onChangeText={setDropdownConfigOptions}
              placeholder="e.g., Active, Inactive, Pending"
              placeholderTextColor={Colors.placeholder}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDropdownConfigModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => updateDropdownOptionsMutation.mutate()}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ─── Register Action Menu ────────────────────────── */}
      <Modal visible={registerMenu} transparent animationType="fade" onRequestClose={() => setRegisterMenu(false)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setRegisterMenu(false)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>Register Actions</Text>
            
            <Text style={styles.contextSectionLabel}>Export & Share</Text>
            <TouchableOpacity style={styles.contextItem} onPress={handleExportCSV}>
              <Ionicons name="document-text-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Export to CSV</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contextItem} onPress={handleExportExcel}>
              <Ionicons name="grid-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Export to Excel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contextItem} onPress={handleExportPDF}>
              <Ionicons name="document-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Export to PDF</Text>
            </TouchableOpacity>

            <View style={styles.contextDivider} />
            
            <Text style={styles.contextSectionLabel}>Template</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => Alert.alert('Coming Soon', 'Save as Template will be available in the next update.')}>
              <Ionicons name="copy-outline" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Save as Template</Text>
            </TouchableOpacity>

            <View style={styles.contextDivider} />

            <Text style={styles.contextSectionLabel}>Danger Zone</Text>
            <TouchableOpacity 
              style={styles.contextItem} 
              onPress={() => {
                Alert.alert("Confirm Duplicate", "Do you want to create a copy of this register?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Duplicate", onPress: () => {
                    setRegisterMenu(false);
                    setIsSyncing(true);
                    duplicateRegister(registerId, `${register.name} (Copy)`)
                      .then(() => {
                        Alert.alert("Success", "Register duplicated successfully");
                        router.back();
                      })
                      .catch(() => Alert.alert("Error", "Failed to duplicate"))
                      .finally(() => setIsSyncing(false));
                  }}
                ]);
              }}
            >
              <Ionicons name="copy" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Duplicate Register</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.contextItem} 
              onPress={() => {
                Alert.alert("Delete Register", "Are you sure? This cannot be undone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => {
                    setRegisterMenu(false);
                    setIsSyncing(true);
                    deleteRegister(registerId)
                      .then(() => {
                        Alert.alert("Success", "Register deleted");
                        router.replace('/(tabs)/home');
                      })
                      .catch(() => Alert.alert("Error", "Failed to delete"))
                      .finally(() => setIsSyncing(false));
                  }}
                ]);
              }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
              <Text style={[styles.contextItemText, { color: Colors.destructive }]}>Delete Register</Text>
            </TouchableOpacity>

            <View style={styles.contextDivider} />

            <TouchableOpacity 
              style={[styles.contextItem, { marginTop: Spacing.sm }]} 
              onPress={() => setRegisterMenu(false)}
            >
              <Ionicons name="close" size={18} color={Colors.muted} />
              <Text style={[styles.contextItemText, { color: Colors.muted }]}>Close Menu</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Calc Type Modal ─────────────────────────────── */}
      <Modal visible={calcModal} transparent animationType="fade" onRequestClose={() => setCalcModal(false)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setCalcModal(false)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>Calculation Type</Text>
            {(['sum', 'average', 'count', 'min', 'max'] as CalcType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.contextItem, selectedCalcType[calcColumnId || ''] === type && styles.contextItemSelected]}
                onPress={() => {
                  if (calcColumnId) {
                    setSelectedCalcType({ ...selectedCalcType, [calcColumnId]: type });
                    setCalcModal(false);
                  }
                }}
              >
                <Ionicons
                  name={
                    type === 'sum' ? 'add-circle' :
                    type === 'average' ? 'analytics' :
                    type === 'count' ? 'list' :
                    type === 'min' ? 'arrow-down-circle' :
                    'arrow-up-circle'
                  }
                  size={18}
                  color={Colors.navy}
                />
                <Text style={styles.contextItemText}>{type.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Date Picker Modal ───────────────────────────── */}
      <Modal visible={dateModal} transparent animationType="slide" onRequestClose={() => setDateModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDateModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <View style={styles.datePickerRow}>
              <View style={styles.datePickerField}>
                <Text style={styles.modalLabel}>Day</Text>
                <TextInput
                  style={styles.datePickerInput}
                  value={dateDay}
                  onChangeText={setDateDay}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="DD"
                  placeholderTextColor={Colors.placeholder}
                />
              </View>
              <View style={styles.datePickerField}>
                <Text style={styles.modalLabel}>Month</Text>
                <TextInput
                  style={styles.datePickerInput}
                  value={dateMonth}
                  onChangeText={setDateMonth}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="MM"
                  placeholderTextColor={Colors.placeholder}
                />
              </View>
              <View style={styles.datePickerField}>
                <Text style={styles.modalLabel}>Year</Text>
                <TextInput
                  style={styles.datePickerInput}
                  value={dateYear}
                  onChangeText={setDateYear}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  placeholderTextColor={Colors.placeholder}
                />
              </View>
            </View>
            {/* Quick date buttons */}
            <View style={styles.quickDateRow}>
              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => {
                  const d = new Date();
                  setDateDay(d.getDate().toString());
                  setDateMonth((d.getMonth() + 1).toString());
                  setDateYear(d.getFullYear().toString());
                }}
              >
                <Text style={styles.quickDateBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setDateDay(d.getDate().toString());
                  setDateMonth((d.getMonth() + 1).toString());
                  setDateYear(d.getFullYear().toString());
                }}
              >
                <Text style={styles.quickDateBtnText}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDateDay(d.getDate().toString());
                  setDateMonth((d.getMonth() + 1).toString());
                  setDateYear(d.getFullYear().toString());
                }}
              >
                <Text style={styles.quickDateBtnText}>Tomorrow</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  // Clear date
                  if (dateEntryId && dateColumnId) {
                    handleCellChange(dateEntryId, dateColumnId, '', '');
                  }
                  setDateModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleDateSelect}>
                <Text style={styles.modalConfirmText}>Set Date</Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ─── Dropdown Cell Modal ─────────────────────────── */}
      <Modal visible={dropdownModal} transparent animationType="slide" onRequestClose={() => setDropdownModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Option</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {dropdownOptions.map((option, idx) => {
                const currentVal = dropdownEntryId
                  ? localEntries.find((e) => e.id === dropdownEntryId)?.cells?.[dropdownColumnId || '']
                  : '';
                const isSelected = currentVal === option;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                    onPress={() => {
                      if (dropdownEntryId && dropdownColumnId) {
                        handleCellChange(dropdownEntryId, dropdownColumnId, option, currentVal || '');
                        setDropdownModal(false);
                      }
                    }}
                  >
                    <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                      {option}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={Colors.navy} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { marginTop: Spacing.lg }]}
              onPress={() => {
                if (dropdownEntryId && dropdownColumnId) {
                  handleCellChange(dropdownEntryId, dropdownColumnId, '', '');
                }
                setDropdownModal(false);
              }}
            >
              <Text style={styles.modalCancelText}>Clear Selection</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── Share Modal ─────────────────────────────────── */}
      <Modal visible={shareModal} transparent animationType="slide" onRequestClose={() => setShareModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShareModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Share Register</Text>

            {/* Share link */}
            <View style={styles.shareLinkRow}>
              <View style={styles.shareLinkBox}>
                <Ionicons name="link" size={16} color={Colors.navy} />
                <Text style={styles.shareLinkText} numberOfLines={1}>{shareLink || 'Generating...'}</Text>
              </View>
              <TouchableOpacity style={styles.shareCopyBtn} onPress={handleNativeShare}>
                <Ionicons name="share-outline" size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {/* Add collaborator */}
            <Text style={[styles.modalLabel, { marginTop: Spacing.xl }]}>Add Collaborator</Text>
            <View style={styles.shareAddRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                value={sharePhone}
                onChangeText={setSharePhone}
                placeholder="Phone number"
                placeholderTextColor={Colors.placeholder}
                keyboardType="phone-pad"
              />
              <View style={styles.sharePermRow}>
                <TouchableOpacity
                  style={[styles.sharePermBtn, sharePermission === 'view' && styles.sharePermBtnActive]}
                  onPress={() => setSharePermission('view')}
                >
                  <Text style={[styles.sharePermText, sharePermission === 'view' && styles.sharePermTextActive]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sharePermBtn, sharePermission === 'edit' && styles.sharePermBtnActive]}
                  onPress={() => setSharePermission('edit')}
                >
                  <Text style={[styles.sharePermText, sharePermission === 'edit' && styles.sharePermTextActive]}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.filterAddBtn, { marginTop: Spacing.md }]}
              onPress={async () => {
                if (sharePhone.trim()) {
                  await addSharedUser(registerId, sharePhone, sharePermission);
                  setSharePhone('');
                  invalidate();
                }
              }}
            >
              <Ionicons name="person-add" size={16} color={Colors.white} />
              <Text style={styles.filterAddBtnText}>Add</Text>
            </TouchableOpacity>

            {/* Shared users */}
            {register.sharedWith && register.sharedWith.length > 0 && (
              <>
                <Text style={[styles.modalLabel, { marginTop: Spacing.xl }]}>Collaborators</Text>
                {register.sharedWith.map((user) => (
                  <View key={user.id} style={styles.sharedUserRow}>
                    <View style={styles.sharedUserAvatar}>
                      <Text style={styles.sharedUserAvatarText}>{user.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sharedUserName}>{user.name}</Text>
                      <Text style={styles.sharedUserPerm}>{user.permission}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeSharedUser(registerId, user.id).then(invalidate)}>
                      <Ionicons name="close-circle" size={20} color={Colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: Spacing.xxl }]} onPress={() => setShareModal(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ─── Rename Page Modal ───────────────────────────── */}
      <Modal visible={renamePageModal} transparent animationType="slide" onRequestClose={() => setRenamePageModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRenamePageModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Page</Text>
            <TextInput
              style={styles.modalInput}
              value={renamePageValue}
              onChangeText={setRenamePageValue}
              placeholder="Page name"
              placeholderTextColor={Colors.placeholder}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  if (pages.length > 1 && renamePageId) {
                    Alert.alert('Delete Page', 'Delete this page and its entries?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => {
                        deletePageMutation.mutate(renamePageId);
                        setRenamePageModal(false);
                      }},
                    ]);
                  } else {
                    setRenamePageModal(false);
                  }
                }}
              >
                <Text style={[styles.modalCancelText, pages.length > 1 && { color: Colors.destructive }]}>
                  {pages.length > 1 ? 'Delete' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  if (renamePageId === -1) {
                    renameRegisterMutation.mutate(renamePageValue);
                  } else {
                    renamePageMutation.mutate({ pageId: renamePageId!, newName: renamePageValue });
                  }
                  setRenamePageModal(false);
                }}
                disabled={!renamePageValue.trim()}
              >
                <Text style={styles.modalConfirmText}>{renamePageId === -1 ? 'Rename Register' : 'Rename Page'}</Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: Spacing.md },
  errorTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground },
  listContent: { paddingBottom: 100 },

  // ── Guidance & Empty State ──
  emptyColumns: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.huge },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground },
  emptySub: { fontSize: FontSize.md, color: Colors.muted, marginTop: 4, marginBottom: Spacing.xxl, textAlign: 'center' },
  addFirstColBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm,
    ...Shadows.button,
  },
  addFirstColText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // ── Modals ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26, 31, 58, 0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, paddingBottom: 40,
    ...Shadows.premium,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.lg },
  modalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.xs, marginTop: Spacing.md },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 12, fontSize: FontSize.md,
    color: Colors.foreground, backgroundColor: Colors.background,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.md, flexWrap: 'wrap' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: BorderRadius.sm, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.white,
  },
  typeChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typeChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.muted },
  typeChipTextActive: { color: Colors.white },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.muted },
  modalConfirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: Colors.navy, alignItems: 'center', ...Shadows.button,
  },
  modalConfirmText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },

  // ── Context Menus ──
  contextOverlay: { flex: 1, backgroundColor: 'rgba(26, 31, 58, 0.4)', justifyContent: 'center', alignItems: 'center' },
  contextMenu: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md,
    width: 300, ...Shadows.elevated,
  },
  contextTitleContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  contextTitleMain: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.foreground },
  contextTypeBadge: { backgroundColor: Colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  contextTypeBadgeText: { fontSize: 9, fontWeight: FontWeight.bold, color: Colors.navy, letterSpacing: 1 },
  contextSectionLabel: {
    fontSize: 9, fontWeight: FontWeight.bold, color: Colors.mutedLight,
    textTransform: 'uppercase', letterSpacing: 1.5,
    marginTop: Spacing.md, marginBottom: 4, paddingHorizontal: 4,
  },
  contextItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: BorderRadius.sm,
  },
  contextItemText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.foreground },
  contextDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.xs },

  // ── Specific Inputs ──
  formulaInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: FontSize.sm, backgroundColor: '#F8F9FF', borderColor: Colors.navy,
  },
  formulaHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  formulaHintText: { fontSize: 10, color: Colors.muted, fontStyle: 'italic' },
});
