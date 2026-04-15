// Register Spreadsheet View — full-featured Excel-like mobile experience
// Implements: search filter, sort, filter modal, calculation bar, multi-page,
// CSV download, share, date picker, dropdown editor, column rename, row duplication,
// bulk select/delete, and frozen serial column
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Share,
  Animated,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRegister,
  addColumn,
  deleteColumn,
  renameColumn,
  updateColumnDropdownOptions,
  addEntry,
  updateEntry,
  deleteEntry,
  duplicateEntry,
  bulkDeleteEntries,
  addPage,
  renamePage,
  deletePage,
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
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COL_WIDTH = 150;
const SERIAL_COL_WIDTH = 52;
const CHECKBOX_COL_WIDTH = 40;

type SortDirection = 'asc' | 'desc' | null;
type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max';

interface FilterCondition {
  columnId: string;
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'empty' | 'not_empty';
  value: string;
}

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

  // Sort state
  const [sortColumnId, setSortColumnId] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Filter state
  const [filterModal, setFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [tempFilterCol, setTempFilterCol] = useState('');
  const [tempFilterOp, setTempFilterOp] = useState<FilterCondition['operator']>('contains');
  const [tempFilterValue, setTempFilterValue] = useState('');

  // Calculation bar
  const [calcModal, setCalcModal] = useState(false);
  const [calcColumnId, setCalcColumnId] = useState<string | null>(null);
  const [selectedCalcType, setSelectedCalcType] = useState<Record<string, CalcType>>({});

  // Bulk selection
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Share modal
  const [shareModal, setShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharePhone, setSharePhone] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');

  // Dropdown cell editor
  const [dropdownModal, setDropdownModal] = useState(false);
  const [dropdownEntryId, setDropdownEntryId] = useState<number | null>(null);
  const [dropdownColumnId, setDropdownColumnId] = useState<string | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);

  // Date picker state
  const [dateModal, setDateModal] = useState(false);
  const [dateEntryId, setDateEntryId] = useState<number | null>(null);
  const [dateColumnId, setDateColumnId] = useState<string | null>(null);
  const [dateYear, setDateYear] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');

  // Page management
  const [pageMenuVisible, setPageMenuVisible] = useState(false);
  const [renamePageModal, setRenamePageModal] = useState(false);
  const [renamePageId, setRenamePageId] = useState<number | null>(null);
  const [renamePageValue, setRenamePageValue] = useState('');

  // Dropdown config for column
  const [dropdownConfigModal, setDropdownConfigModal] = useState(false);
  const [dropdownConfigColumnId, setDropdownConfigColumnId] = useState<number | null>(null);
  const [dropdownConfigOptions, setDropdownConfigOptions] = useState('');

  // Horizontal scroll ref for frozen serial column effect
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Sync server → local entries
  useEffect(() => {
    if (register?.entries) {
      setLocalEntries(register.entries);
    }
  }, [register?.entries]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['register', registerId] });

  // ─── Mutations ────────────────────────────────────────────
  const addColumnMutation = useMutation({
    mutationFn: () =>
      addColumn(registerId, {
        name: newColumnName,
        type: newColumnType,
        dropdownOptions: newColumnType === 'dropdown' ? newColumnDropdownOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        formula: newColumnType === 'formula' ? newColumnFormula : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setNewColumnModal(false);
      setNewColumnName('');
      setNewColumnType('text');
      setNewColumnDropdownOptions('');
      setNewColumnFormula('');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (colId: number) => deleteColumn(registerId, colId),
    onSuccess: () => {
      invalidate();
      setColumnMenuId(null);
    },
  });

  const renameColumnMutation = useMutation({
    mutationFn: () => renameColumn(registerId, renameColumnId!, renameColumnValue),
    onSuccess: () => {
      invalidate();
      setRenameColumnModal(false);
      setRenameColumnId(null);
      setRenameColumnValue('');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const updateDropdownOptionsMutation = useMutation({
    mutationFn: () =>
      updateColumnDropdownOptions(
        registerId,
        dropdownConfigColumnId!,
        dropdownConfigOptions.split(',').map((s) => s.trim()).filter(Boolean)
      ),
    onSuccess: () => {
      invalidate();
      setDropdownConfigModal(false);
      setDropdownConfigColumnId(null);
      setDropdownConfigOptions('');
    },
  });

  const addEntryMutation = useMutation({
    mutationFn: () => addEntry(registerId, {}, activePageIndex),
    onSuccess: invalidate,
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, cells }: { entryId: number; cells: Record<string, string> }) =>
      updateEntry(registerId, entryId, cells),
    onError: () => {
      invalidate();
      Alert.alert('Error', 'Failed to save cell');
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => deleteEntry(registerId, entryId),
    onSuccess: () => {
      invalidate();
      setRowMenuId(null);
    },
  });

  const duplicateEntryMutation = useMutation({
    mutationFn: (entryId: number) => duplicateEntry(registerId, entryId),
    onSuccess: () => {
      invalidate();
      setRowMenuId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => bulkDeleteEntries(registerId, Array.from(selectedRows)),
    onSuccess: () => {
      invalidate();
      setSelectedRows(new Set());
      setBulkMode(false);
    },
  });

  const addPageMutation = useMutation({
    mutationFn: () => addPage(registerId),
    onSuccess: (newPage) => {
      invalidate();
      setActivePageIndex(newPage.index);
    },
  });

  const renamePageMutation = useMutation({
    mutationFn: () => renamePage(registerId, renamePageId!, renamePageValue),
    onSuccess: () => {
      invalidate();
      setRenamePageModal(false);
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => deletePage(registerId, pageId),
    onSuccess: () => {
      invalidate();
      setActivePageIndex(0);
    },
  });

  // ─── Cell Edit ────────────────────────────────────────────
  const handleCellChange = useCallback(
    (entryId: number, columnId: string, newValue: string, oldValue: string) => {
      if (newValue === oldValue) return;
      // Optimistic update
      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? { ...entry, cells: { ...entry.cells, [columnId]: newValue } }
            : entry
        )
      );
      updateEntryMutation.mutate({ entryId, cells: { [columnId]: newValue } });
    },
    [updateEntryMutation]
  );

  // ─── Sort handler ─────────────────────────────────────────
  const handleSort = (colId: number) => {
    if (sortColumnId === colId) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortColumnId(null);
        setSortDirection(null);
      }
    } else {
      setSortColumnId(colId);
      setSortDirection('asc');
    }
  };

  // ─── Share handlers ───────────────────────────────────────
  const handleGenerateShareLink = async () => {
    try {
      const link = await generateShareLink(registerId);
      setShareLink(link);
    } catch {
      Alert.alert('Error', 'Failed to generate share link');
    }
  };

  const handleNativeShare = async () => {
    if (!register) return;
    try {
      const csv = generateCSV(register, activePageIndex);
      await Share.share({
        title: register.name,
        message: `${register.name}\n\nShared from SJVPS Record Book\n\n${shareLink || 'Open SJVPS Record Book to view'}`,
      });
    } catch (err) {
      // User cancelled
    }
  };

  const handleDownloadCSV = () => {
    if (!register) return;
    const csv = generateCSV(register, activePageIndex);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${register.name.replace(/\s+/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      Share.share({
        title: `${register.name}.csv`,
        message: csv,
      });
    }
    Alert.alert('Export', 'Register exported as CSV!');
  };

  // ─── Date handler ─────────────────────────────────────────
  const handleDateSelect = () => {
    if (dateEntryId && dateColumnId) {
      const dateStr = `${dateYear}-${dateMonth.padStart(2, '0')}-${dateDay.padStart(2, '0')}`;
      handleCellChange(dateEntryId, dateColumnId, dateStr, '');
      setDateModal(false);
      setDateEntryId(null);
      setDateColumnId(null);
    }
  };

  // ─── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.navy} />
      </View>
    );
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

  // ─── Filter & Sort entries (page-scoped) ──────────────────
  let pageEntries = localEntries.filter((e) => (e.pageIndex || 0) === activePageIndex);

  // Apply search filter
  if (search.trim()) {
    const searchLower = search.toLowerCase();
    pageEntries = pageEntries.filter((entry) =>
      columns.some((col) => {
        const val = entry.cells?.[col.id.toString()] || '';
        return val.toLowerCase().includes(searchLower);
      })
    );
  }

  // Apply active filters
  if (activeFilters.length > 0) {
    pageEntries = pageEntries.filter((entry) =>
      activeFilters.every((filter) => {
        const val = entry.cells?.[filter.columnId] || '';
        const numVal = parseFloat(val);
        const filterNum = parseFloat(filter.value);
        switch (filter.operator) {
          case 'contains': return val.toLowerCase().includes(filter.value.toLowerCase());
          case 'equals': return val.toLowerCase() === filter.value.toLowerCase();
          case 'gt': return !isNaN(numVal) && !isNaN(filterNum) && numVal > filterNum;
          case 'lt': return !isNaN(numVal) && !isNaN(filterNum) && numVal < filterNum;
          case 'gte': return !isNaN(numVal) && !isNaN(filterNum) && numVal >= filterNum;
          case 'lte': return !isNaN(numVal) && !isNaN(filterNum) && numVal <= filterNum;
          case 'empty': return !val || val.trim() === '';
          case 'not_empty': return val && val.trim() !== '';
          default: return true;
        }
      })
    );
  }

  // Apply sort
  if (sortColumnId !== null && sortDirection) {
    const colIdStr = sortColumnId.toString();
    const col = columns.find((c) => c.id === sortColumnId);
    pageEntries = [...pageEntries].sort((a, b) => {
      const aVal = a.cells?.[colIdStr] || '';
      const bVal = b.cells?.[colIdStr] || '';
      if (col?.type === 'number') {
        const aNum = parseFloat(aVal) || 0;
        const bNum = parseFloat(bVal) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }

  // Fill minimum 7 rows (mock rows are tappable — they auto-create real entries)
  const displayEntries = [...pageEntries];
  while (displayEntries.length < Math.max(7, pageEntries.length)) {
    displayEntries.push({ _mock: true, id: `mock-${displayEntries.length}`, cells: {} } as any);
  }

  // Stats count
  const totalEntries = localEntries.filter((e) => (e.pageIndex || 0) === activePageIndex).length;

  // Track if we have no entries yet (for first-time guidance banner)
  const hasNoEntries = totalEntries === 0;

  // ════════════════════════════════════════════════════════════
  return (
    <>
      <Stack.Screen
        options={{
          title: register.name,
          headerShown: false,
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ─── Top Header (web: bg-primary h-14) ─────────── */}
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => require('expo-router').router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.topHeaderLeft}>
            <Ionicons name={(register.icon as any) || 'document'} size={22} color={Colors.white} style={{ marginRight: 4 }} />
            <Text style={styles.topHeaderTitle} numberOfLines={1}>{register.name}</Text>
          </View>
          <View style={styles.topHeaderRight}>
            <TouchableOpacity style={styles.topHeaderBtn} onPress={handleDownloadCSV}>
              <Ionicons name="download-outline" size={16} color={Colors.white} />
              <Text style={styles.topHeaderBtnText}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topHeaderBtn}
              onPress={() => {
                setShareModal(true);
                handleGenerateShareLink();
              }}
            >
              <Ionicons name="share-outline" size={16} color={Colors.white} />
              <Text style={styles.topHeaderBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Stats bar ─────────────────────────────────── */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Ionicons name="grid-outline" size={12} color={Colors.muted} />
            <Text style={styles.statText}>{columns.length} columns</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statItem}>
            <Ionicons name="list-outline" size={12} color={Colors.muted} />
            <Text style={styles.statText}>{totalEntries} entries</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statItem}>
            <Ionicons name="copy-outline" size={12} color={Colors.muted} />
            <Text style={styles.statText}>{pages.length} pages</Text>
          </View>
          {activeFilters.length > 0 && (
            <>
              <View style={styles.statSep} />
              <TouchableOpacity style={styles.statItemActive} onPress={() => setActiveFilters([])}>
                <Ionicons name="funnel" size={12} color={Colors.white} />
                <Text style={styles.statTextActive}>{activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''}</Text>
                <Ionicons name="close" size={12} color={Colors.white} />
              </TouchableOpacity>
            </>
          )}
          {sortColumnId !== null && (
            <>
              <View style={styles.statSep} />
              <TouchableOpacity style={styles.statItemActive} onPress={() => { setSortColumnId(null); setSortDirection(null); }}>
                <Ionicons name="swap-vertical" size={12} color={Colors.white} />
                <Text style={styles.statTextActive}>Sorted</Text>
                <Ionicons name="close" size={12} color={Colors.white} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ─── Tabs Row (multi-page support) ─────────────── */}
        <View style={styles.tabsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {pages.map((page, idx) => (
              <TouchableOpacity
                key={page.id}
                style={[styles.tabBtn, idx === activePageIndex && styles.activeTab]}
                onPress={() => setActivePageIndex(idx)}
                onLongPress={() => {
                  setRenamePageId(page.id);
                  setRenamePageValue(page.name);
                  setRenamePageModal(true);
                }}
              >
                <Text style={[styles.tabBtnText, idx === activePageIndex && styles.activeTabText]}>
                  📄 {page.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.addTabBtn}
              onPress={() => addPageMutation.mutate()}
              disabled={addPageMutation.isPending}
            >
              {addPageMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.muted} />
              ) : (
                <Ionicons name="add" size={16} color={Colors.muted} />
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ─── Toolbar ───────────────────────────────────── */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => addEntryMutation.mutate()}
              disabled={addEntryMutation.isPending}
            >
              <Ionicons name="add" size={16} color={Colors.navy} />
              <Text style={styles.toolbarBtnPrimary}>Add entry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarBtn, activeFilters.length > 0 && styles.toolbarBtnHighlight]}
              onPress={() => {
                setFilters([...activeFilters]);
                setFilterModal(true);
              }}
            >
              <Ionicons name="funnel" size={14} color={activeFilters.length > 0 ? Colors.white : Colors.muted} />
              <Text style={[styles.toolbarBtnMuted, activeFilters.length > 0 && styles.toolbarBtnHighlightText]}>Filter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarBtn, bulkMode && styles.toolbarBtnHighlight]}
              onPress={() => {
                setBulkMode(!bulkMode);
                setSelectedRows(new Set());
              }}
            >
              <Ionicons name="checkbox" size={14} color={bulkMode ? Colors.white : Colors.muted} />
              <Text style={[styles.toolbarBtnMuted, bulkMode && styles.toolbarBtnHighlightText]}>Select</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={14} color={Colors.muted} />
            <TextInput
              style={styles.searchBoxInput}
              placeholder="Search..."
              placeholderTextColor={Colors.placeholder}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.mutedLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Bulk Actions Bar ──────────────────────────── */}
        {bulkMode && selectedRows.size > 0 && (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkBarText}>{selectedRows.size} selected</Text>
            <TouchableOpacity
              style={styles.bulkBarBtn}
              onPress={() => {
                Alert.alert(
                  'Delete Selected',
                  `Delete ${selectedRows.size} rows? This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete All', style: 'destructive', onPress: () => bulkDeleteMutation.mutate() },
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.white} />
              <Text style={styles.bulkBarBtnText}>Delete All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bulkBarCancelBtn}
              onPress={() => { setBulkMode(false); setSelectedRows(new Set()); }}
            >
              <Text style={styles.bulkBarCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Spreadsheet ────────────────────────────────── */}
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
            {/* First-time guidance banner */}
            {hasNoEntries && (
              <TouchableOpacity
                style={styles.firstEntryBanner}
                onPress={() => addEntryMutation.mutate()}
                activeOpacity={0.85}
              >
                <View style={styles.firstEntryBannerIcon}>
                  <Ionicons name="arrow-down-circle" size={24} color={Colors.white} />
                </View>
                <View style={styles.firstEntryBannerText}>
                  <Text style={styles.firstEntryTitle}>Ready to enter data!</Text>
                  <Text style={styles.firstEntrySub}>Tap here or tap any row below to start adding entries</Text>
                </View>
                <View style={styles.firstEntryBannerBtn}>
                  {addEntryMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="add" size={22} color={Colors.white} />
                  )}
                </View>
              </TouchableOpacity>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={horizontalScrollRef}>
              <View>
                {/* Column Headers */}
                <View style={styles.headerRow}>
                  {bulkMode && (
                    <TouchableOpacity
                      style={styles.checkboxHeader}
                      onPress={() => {
                        const realEntries = pageEntries.filter((e) => !(e as any)._mock);
                        if (selectedRows.size === realEntries.length) {
                          setSelectedRows(new Set());
                        } else {
                          setSelectedRows(new Set(realEntries.map((e) => e.id)));
                        }
                      }}
                    >
                      <Ionicons
                        name={selectedRows.size > 0 ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={Colors.navy}
                      />
                    </TouchableOpacity>
                  )}
                  <View style={styles.serialHeader}>
                    <Text style={styles.serialHeaderText}>S No.</Text>
                  </View>
                  {columns.map((col) => (
                    <TouchableOpacity
                      key={col.id}
                      style={styles.colHeader}
                      onPress={() => handleSort(col.id)}
                      onLongPress={() => setColumnMenuId(col.id)}
                    >
                      <View style={styles.colHeaderInner}>
                        <View style={styles.colTypeChip}>
                          <Ionicons
                            name={
                              col.type === 'number' ? 'calculator' :
                              col.type === 'date' ? 'calendar' :
                              col.type === 'dropdown' ? 'chevron-down-circle' :
                              col.type === 'formula' ? 'flask' :
                              'text'
                            }
                            size={12}
                            color={col.type === 'formula' ? Colors.navy : Colors.muted}
                          />
                        </View>
                        <Text style={styles.colHeaderText} numberOfLines={1}>{col.name}</Text>
                        {sortColumnId === col.id && sortDirection && (
                          <Ionicons
                            name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                            size={12}
                            color={Colors.navy}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.addColBtn} onPress={() => setNewColumnModal(true)}>
                    <Ionicons name="add" size={20} color={Colors.muted} />
                  </TouchableOpacity>
                </View>

                {/* Data Rows */}
                <FlatList
                  data={displayEntries}
                  keyExtractor={(item: any, idx) => (item.id ? item.id.toString() : `mock-${idx}`)}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 140 }}
                  renderItem={({ item: entry, index }: { item: any; index: number }) => {
                    const isMock = !!(entry as any)._mock;
                    const isSelected = selectedRows.has(entry.id);
                    return (
                      <View style={[styles.dataRow, !isMock && styles.dataRowReal, isSelected && styles.dataRowSelected]}>
                        {bulkMode && (
                          <TouchableOpacity
                            style={styles.checkboxCell}
                            onPress={() => {
                              if (isMock) return;
                              const newSet = new Set(selectedRows);
                              if (isSelected) newSet.delete(entry.id);
                              else newSet.add(entry.id);
                              setSelectedRows(newSet);
                            }}
                          >
                            {!isMock && (
                              <Ionicons
                                name={isSelected ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={isSelected ? Colors.navy : Colors.mutedLight}
                              />
                            )}
                          </TouchableOpacity>
                        )}
                        <View style={styles.serialCell}>
                          <Text style={styles.serialText}>{index + 1}</Text>
                        </View>
                        {columns.map((col) => {
                          if (isMock) {
                            // Mock rows: tapping auto-creates a real entry
                            return (
                              <TouchableOpacity
                                key={col.id}
                                style={styles.dataCell}
                                onPress={() => addEntryMutation.mutate()}
                                activeOpacity={0.6}
                              >
                                <View style={styles.mockCellInner}>
                                  <Text style={styles.mockCellText}>
                                    {col.type === 'date' ? '📅' : col.type === 'dropdown' ? '▾' : col.type === 'formula' ? 'fx' : '—'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          }
                          const value = entry.cells?.[col.id.toString()] || '';

                          // Date column → tappable date display
                          if (col.type === 'date') {
                            return (
                              <TouchableOpacity
                                key={col.id}
                                style={styles.dataCell}
                                onPress={() => {
                                  setDateEntryId(entry.id);
                                  setDateColumnId(col.id.toString());
                                  const parts = (value || '').split('-');
                                  setDateYear(parts[0] || new Date().getFullYear().toString());
                                  setDateMonth(parts[1] || (new Date().getMonth() + 1).toString());
                                  setDateDay(parts[2] || new Date().getDate().toString());
                                  setDateModal(true);
                                }}
                              >
                                <View style={styles.dateCellInner}>
                                  <Ionicons name="calendar-outline" size={14} color={value ? Colors.navy : Colors.mutedLight} />
                                  <Text style={[styles.dateCellText, !value && styles.dateCellPlaceholder]}>
                                    {value || 'Select date'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          }

                          // Dropdown column → tappable dropdown
                          if (col.type === 'dropdown') {
                            return (
                              <TouchableOpacity
                                key={col.id}
                                style={styles.dataCell}
                                onPress={() => {
                                  setDropdownEntryId(entry.id);
                                  setDropdownColumnId(col.id.toString());
                                  setDropdownOptions(col.dropdownOptions || ['Active', 'Inactive', 'Pending']);
                                  setDropdownModal(true);
                                }}
                              >
                                <View style={styles.dropdownCellInner}>
                                  <Text
                                    style={[styles.dropdownCellText, !value && styles.dropdownCellPlaceholder]}
                                    numberOfLines={1}
                                  >
                                    {value || 'Select...'}
                                  </Text>
                                  <Ionicons name="chevron-down" size={14} color={Colors.mutedLight} />
                                </View>
                              </TouchableOpacity>
                            );
                          }

                          // Formula column → read-only calculated value
                          if (col.type === 'formula') {
                            const formulaResult = col.formula
                              ? evaluateFormula(col.formula, entry, columns)
                              : '';
                            return (
                              <View key={col.id} style={styles.dataCell}>
                                <View style={styles.formulaCellInner}>
                                  <Text
                                    style={[
                                      styles.formulaCellText,
                                      formulaResult === 'ERR' && styles.formulaCellError,
                                      !formulaResult && styles.formulaCellPlaceholder,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {formulaResult || 'fx'}
                                  </Text>
                                </View>
                              </View>
                            );
                          }

                          // Text/Number column → editable text input
                          return (
                            <View key={col.id} style={styles.dataCell}>
                              <TextInput
                                style={styles.cellInput}
                                defaultValue={value}
                                onEndEditing={(e) =>
                                  handleCellChange(entry.id, col.id.toString(), e.nativeEvent.text, value)
                                }
                                placeholder="—"
                                placeholderTextColor="rgba(0,0,0,0.15)"
                                keyboardType={col.type === 'number' ? 'numeric' : 'default'}
                              />
                            </View>
                          );
                        })}
                        {!isMock ? (
                          <TouchableOpacity style={styles.rowActionCell} onPress={() => setRowMenuId(entry.id)}>
                            <Ionicons name="ellipsis-vertical" size={14} color={Colors.mutedLight} />
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.rowActionCell} />
                        )}
                      </View>
                    );
                  }}
                />

                {/* Calculation Bar */}
                <View style={styles.calcBar}>
                  <View style={[styles.calcSerial, bulkMode && { marginLeft: CHECKBOX_COL_WIDTH }]}>
                    <Text style={styles.calcSerialText}>⊞ Calc</Text>
                  </View>
                  {columns.map((col) => {
                    const colIdStr = col.id.toString();
                    const calcType = selectedCalcType[colIdStr] || (col.type === 'number' ? 'sum' : 'count');
                    const realEntries = pageEntries.filter((e) => !(e as any)._mock);
                    const stats = calculateColumnStats(realEntries, colIdStr);
                    const displayVal =
                      calcType === 'sum' ? stats.sum :
                      calcType === 'average' ? stats.average :
                      calcType === 'count' ? stats.count :
                      calcType === 'min' ? stats.min :
                      calcType === 'max' ? stats.max : 0;

                    return (
                      <TouchableOpacity
                        key={col.id}
                        style={styles.calcCell}
                        onPress={() => {
                          setCalcColumnId(colIdStr);
                          setCalcModal(true);
                        }}
                      >
                        {realEntries.length > 0 ? (
                          <View>
                            <Text style={styles.calcLabel}>{calcType.toUpperCase()}</Text>
                            <Text style={styles.calcValue}>{typeof displayVal === 'number' ? (Number.isInteger(displayVal) ? displayVal : displayVal.toFixed(2)) : displayVal}</Text>
                          </View>
                        ) : (
                          <Text style={styles.calcPlaceholder}>Click to calc</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ width: 44 }} />
                </View>
              </View>
            </ScrollView>

            {/* Add Row Bar */}
            <View style={styles.addRowBar}>
              <TouchableOpacity
                style={styles.addRowFab}
                onPress={() => addEntryMutation.mutate()}
                disabled={addEntryMutation.isPending}
                activeOpacity={0.85}
              >
                {addEntryMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="add" size={26} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
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
              {(['text', 'number', 'date', 'dropdown', 'formula'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, newColumnType === type && styles.typeChipActive]}
                  onPress={() => setNewColumnType(type)}
                >
                  <Ionicons
                    name={
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

      {/* ─── Column Context Menu ─────────────────────────── */}
      <Modal visible={columnMenuId !== null} transparent animationType="fade" onRequestClose={() => setColumnMenuId(null)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setColumnMenuId(null)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>
              {columns.find((c) => c.id === columnMenuId)?.name}
            </Text>
            {/* Sort Ascending */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (columnMenuId) {
                  setSortColumnId(columnMenuId);
                  setSortDirection('asc');
                  setColumnMenuId(null);
                }
              }}
            >
              <Ionicons name="arrow-up" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Sort A → Z</Text>
            </TouchableOpacity>
            {/* Sort Descending */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (columnMenuId) {
                  setSortColumnId(columnMenuId);
                  setSortDirection('desc');
                  setColumnMenuId(null);
                }
              }}
            >
              <Ionicons name="arrow-down" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Sort Z → A</Text>
            </TouchableOpacity>
            {/* Rename */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (columnMenuId) {
                  setRenameColumnId(columnMenuId);
                  setRenameColumnValue(columns.find((c) => c.id === columnMenuId)?.name || '');
                  setRenameColumnModal(true);
                  setColumnMenuId(null);
                }
              }}
            >
              <Ionicons name="pencil" size={18} color={Colors.navy} />
              <Text style={styles.contextItemText}>Rename Column</Text>
            </TouchableOpacity>
            {/* Configure Dropdown (only for dropdown columns) */}
            {columns.find((c) => c.id === columnMenuId)?.type === 'dropdown' && (
              <TouchableOpacity
                style={styles.contextItem}
                onPress={() => {
                  if (columnMenuId) {
                    setDropdownConfigColumnId(columnMenuId);
                    const col = columns.find((c) => c.id === columnMenuId);
                    setDropdownConfigOptions(col?.dropdownOptions?.join(', ') || '');
                    setDropdownConfigModal(true);
                    setColumnMenuId(null);
                  }
                }}
              >
                <Ionicons name="list" size={18} color={Colors.navy} />
                <Text style={styles.contextItemText}>Edit Options</Text>
              </TouchableOpacity>
            )}
            {/* Delete */}
            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {
                if (columnMenuId) {
                  Alert.alert('Delete Column', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel', onPress: () => setColumnMenuId(null) },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteColumnMutation.mutate(columnMenuId) },
                  ]);
                }
              }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
              <Text style={styles.contextItemDanger}>Delete Column</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Row Context Menu ────────────────────────────── */}
      <Modal visible={rowMenuId !== null} transparent animationType="fade" onRequestClose={() => setRowMenuId(null)}>
        <TouchableOpacity style={styles.contextOverlay} onPress={() => setRowMenuId(null)} activeOpacity={1}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle}>Row Actions</Text>
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

      {/* ─── Filter Modal ────────────────────────────────── */}
      <Modal visible={filterModal} transparent animationType="slide" onRequestClose={() => setFilterModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.modalTitle}>Filter Data</Text>
              {filters.length > 0 && (
                <TouchableOpacity onPress={() => setFilters([])}>
                  <Text style={{ color: Colors.destructive, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {/* Existing filters */}
              {filters.map((filter, idx) => {
                const col = columns.find((c) => c.id.toString() === filter.columnId);
                return (
                  <View key={idx} style={styles.filterRow}>
                    <View style={styles.filterRowContent}>
                      <Text style={styles.filterRowLabel}>{col?.name || 'Unknown'}</Text>
                      <Text style={styles.filterRowOp}>{filter.operator}</Text>
                      <Text style={styles.filterRowVal}>"{filter.value}"</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFilters(filters.filter((_, i) => i !== idx))}>
                      <Ionicons name="close-circle" size={20} color={Colors.destructive} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Add new filter */}
              <View style={styles.filterAddSection}>
                <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>Add Filter</Text>

                <Text style={styles.filterLabel}>Column</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
                  {columns.map((col) => (
                    <TouchableOpacity
                      key={col.id}
                      style={[styles.filterChip, tempFilterCol === col.id.toString() && styles.filterChipActive]}
                      onPress={() => setTempFilterCol(col.id.toString())}
                    >
                      <Text style={[styles.filterChipText, tempFilterCol === col.id.toString() && styles.filterChipTextActive]}>
                        {col.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.filterLabel}>Condition</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
                  {(['contains', 'equals', 'gt', 'lt', 'empty', 'not_empty'] as const).map((op) => (
                    <TouchableOpacity
                      key={op}
                      style={[styles.filterChip, tempFilterOp === op && styles.filterChipActive]}
                      onPress={() => setTempFilterOp(op)}
                    >
                      <Text style={[styles.filterChipText, tempFilterOp === op && styles.filterChipTextActive]}>
                        {op === 'contains' ? 'Contains' : op === 'equals' ? 'Equals' : op === 'gt' ? '>' : op === 'lt' ? '<' : op === 'empty' ? 'Empty' : 'Not Empty'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {tempFilterOp !== 'empty' && tempFilterOp !== 'not_empty' && (
                  <>
                    <Text style={styles.filterLabel}>Value</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={tempFilterValue}
                      onChangeText={setTempFilterValue}
                      placeholder="Filter value..."
                      placeholderTextColor={Colors.placeholder}
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[styles.filterAddBtn, (!tempFilterCol) && { opacity: 0.5 }]}
                  onPress={() => {
                    if (!tempFilterCol) return;
                    setFilters([...filters, { columnId: tempFilterCol, operator: tempFilterOp, value: tempFilterValue }]);
                    setTempFilterCol('');
                    setTempFilterValue('');
                  }}
                  disabled={!tempFilterCol}
                >
                  <Ionicons name="add" size={16} color={Colors.white} />
                  <Text style={styles.filterAddBtnText}>Add Filter</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setFilterModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setActiveFilters(filters);
                  setFilterModal(false);
                }}
              >
                <Text style={styles.modalConfirmText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
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
                onPress={() => renamePageMutation.mutate()}
                disabled={!renamePageValue.trim()}
              >
                <Text style={styles.modalConfirmText}>Rename</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: Spacing.md },
  errorTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground },

  // ── Top Header ──────────────────────────────────────
  topHeader: {
    backgroundColor: Colors.navy,
    height: Platform.OS === 'ios' ? 100 : 56,
    paddingTop: Platform.OS === 'ios' ? 48 : 0,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { marginRight: Spacing.md },
  topHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  topHeaderTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white, flex: 1, letterSpacing: -0.3 },
  topHeaderRight: { flexDirection: 'row', gap: Spacing.sm },
  topHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm,
  },
  topHeaderBtnText: { color: Colors.white, fontSize: 11, fontWeight: '600' },

  // ── Stats Bar ─────────────────────────────────────────
  statsBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
    paddingVertical: 6, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm, flexWrap: 'wrap',
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 10, color: Colors.muted, fontWeight: FontWeight.medium },
  statSep: { width: 1, height: 12, backgroundColor: Colors.border },
  statItemActive: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.navy, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  statTextActive: { fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold },

  // ── Tabs Row ──────────────────────────────────────
  tabsRow: {
    height: 44, backgroundColor: Colors.white, borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsScroll: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xs },
  tabBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnText: { color: Colors.muted, fontWeight: FontWeight.medium, fontSize: FontSize.sm },
  activeTab: {
    borderBottomColor: Colors.navy,
    backgroundColor: 'rgba(0,75,143,0.04)',
  },
  activeTabText: { color: Colors.navy, fontWeight: FontWeight.bold },
  addTabBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },

  // ── Toolbar ───────────────────────────────────────
  toolbar: {
    height: 52, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md,
  },
  toolbarLeft: { flexDirection: 'row', gap: Spacing.xs },
  toolbarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  toolbarBtnHighlight: {
    backgroundColor: Colors.navy, borderColor: Colors.navy,
  },
  toolbarBtnHighlightText: { color: Colors.white },
  toolbarBtnPrimary: { fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.navy },
  toolbarBtnMuted: { fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.muted },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, height: 34, width: 120,
  },
  searchBoxInput: { flex: 1, fontSize: 11, color: Colors.foreground },

  // ── Bulk Actions Bar ──────────────────────────────
  bulkBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.md,
  },
  bulkBarText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.bold, flex: 1 },
  bulkBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.destructive, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  bulkBarBtnText: { color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold },
  bulkBarCancelBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  bulkBarCancelText: { color: Colors.white, fontSize: 11, fontWeight: FontWeight.semibold },

  // ── Spreadsheet ───────────────────────────────────
  headerRow: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 2, borderBottomColor: Colors.border,
  },
  checkboxHeader: {
    width: CHECKBOX_COL_WIDTH, justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border,
  },
  serialHeader: {
    width: SERIAL_COL_WIDTH, paddingVertical: Spacing.md, justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: '#F8FAFC',
  },
  serialHeaderText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.muted },
  colHeader: {
    width: COL_WIDTH, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
    borderRightWidth: 1, borderRightColor: Colors.border, justifyContent: 'center',
  },
  colHeaderInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  colTypeChip: {
    backgroundColor: Colors.borderLight, paddingHorizontal: 5, paddingVertical: 4,
    borderRadius: 4, justifyContent: 'center', alignItems: 'center',
  },
  colHeaderText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.foreground, flex: 1 },
  addColBtn: { width: 44, justifyContent: 'center', alignItems: 'center' },

  dataRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, minHeight: 44 },
  dataRowReal: { backgroundColor: Colors.white },
  dataRowSelected: { backgroundColor: '#EBF5FF' },
  checkboxCell: {
    width: CHECKBOX_COL_WIDTH, justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border,
  },
  serialCell: {
    width: SERIAL_COL_WIDTH, justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: '#F8FAFC',
  },
  serialText: { fontSize: FontSize.xs, color: Colors.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  dataCell: { width: COL_WIDTH, borderRightWidth: 1, borderRightColor: Colors.border },
  cellInput: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.sm, color: Colors.foreground, minHeight: 44,
  },
  rowActionCell: { width: 36, justifyContent: 'center', alignItems: 'center' },

  // ── Mock/placeholder cell (tappable to create entry) ──
  mockCellInner: {
    justifyContent: 'center', alignItems: 'center', minHeight: 44,
  },
  mockCellText: {
    fontSize: FontSize.xs, color: 'rgba(0,0,0,0.08)',
  },

  // ── First entry guidance banner ───────────────────
  firstEntryBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.navy, marginHorizontal: Spacing.md,
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
    borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md,
    ...Shadows.button,
  },
  firstEntryBannerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  firstEntryBannerText: { flex: 1 },
  firstEntryTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.white,
  },
  firstEntrySub: {
    fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 1,
  },
  firstEntryBannerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Date cell ─────────────────────────────────────
  dateCellInner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 44,
  },
  dateCellText: { fontSize: FontSize.sm, color: Colors.foreground },
  dateCellPlaceholder: { color: 'rgba(0,0,0,0.15)' },

  // ── Dropdown cell ─────────────────────────────────
  dropdownCellInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 44,
  },
  dropdownCellText: { fontSize: FontSize.sm, color: Colors.foreground, flex: 1 },
  dropdownCellPlaceholder: { color: 'rgba(0,0,0,0.15)' },

  // ── Calc Bar ──────────────────────────────────────
  calcBar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderTopWidth: 2, borderTopColor: Colors.border, minHeight: 52,
  },
  calcSerial: {
    width: SERIAL_COL_WIDTH, backgroundColor: '#F0F4F8', borderRightWidth: 1,
    borderRightColor: Colors.border, justifyContent: 'center', alignItems: 'center',
  },
  calcSerialText: { fontSize: 9, fontWeight: FontWeight.bold, color: Colors.navy },
  calcCell: {
    width: COL_WIDTH, borderRightWidth: 1, borderRightColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: Spacing.sm,
  },
  calcLabel: { fontSize: 8, fontWeight: FontWeight.bold, color: Colors.navy, letterSpacing: 0.5 },
  calcValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.foreground, marginTop: 1 },
  calcPlaceholder: { fontSize: FontSize.xs, color: 'rgba(0,0,0,0.2)' },

  // ── Add Row Bar ───────────────────────────────────
  addRowBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  addRowFab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center',
    ...Shadows.button,
  },

  // ── Empty columns ─────────────────────────────────
  emptyColumns: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.foreground },
  emptySub: { fontSize: FontSize.sm, color: Colors.muted, marginTop: Spacing.xs, marginBottom: Spacing.xl },
  addFirstColBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.xs,
  },
  addFirstColText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // ── Modals ────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl, padding: Spacing.xxl, paddingBottom: Spacing.huge,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.xl },
  modalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.foreground, marginBottom: Spacing.sm },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.md,
    color: Colors.foreground, marginBottom: Spacing.lg,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xxl, flexWrap: 'wrap' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typeChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.foreground, textTransform: 'capitalize' },
  typeChipTextActive: { color: Colors.white },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalCancelBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.foreground },
  modalConfirmBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.navy, alignItems: 'center', ...Shadows.button,
  },
  modalConfirmText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },

  // ── Context Menus ─────────────────────────────────
  contextOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  contextMenu: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    width: 280, ...Shadows.elevated,
  },
  contextTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.md },
  contextItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  contextItemSelected: { backgroundColor: Colors.surface, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm },
  contextItemText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.foreground },
  contextItemDanger: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.destructive },

  // ── Filter Modal ──────────────────────────────────
  filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  filterRowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  filterRowLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.navy },
  filterRowOp: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic' },
  filterRowVal: { fontSize: FontSize.sm, color: Colors.foreground },
  filterAddSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  filterLabel: { fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.muted, marginTop: Spacing.md, marginBottom: Spacing.xs },
  filterChipScroll: { marginBottom: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.xs,
  },
  filterChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterChipText: { fontSize: 11, color: Colors.foreground, fontWeight: FontWeight.medium },
  filterChipTextActive: { color: Colors.white },
  filterAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    backgroundColor: Colors.navy, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, ...Shadows.button,
  },
  filterAddBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // ── Date Picker ───────────────────────────────────
  datePickerRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  datePickerField: { flex: 1 },
  datePickerInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.xl,
    color: Colors.foreground, textAlign: 'center', fontWeight: FontWeight.bold,
  },
  quickDateRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  quickDateBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.navy, alignItems: 'center',
  },
  quickDateBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.navy },

  // ── Dropdown Options ──────────────────────────────
  dropdownOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  dropdownOptionSelected: { backgroundColor: '#EBF5FF' },
  dropdownOptionText: { fontSize: FontSize.md, color: Colors.foreground },
  dropdownOptionTextSelected: { fontWeight: FontWeight.bold, color: Colors.navy },

  // ── Share ─────────────────────────────────────────
  shareLinkRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  shareLinkBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  shareLinkText: { fontSize: FontSize.xs, color: Colors.muted, flex: 1 },
  shareCopyBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: Colors.navy,
    justifyContent: 'center', alignItems: 'center',
  },
  shareAddRow: { gap: Spacing.sm },
  sharePermRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  sharePermBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  sharePermBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  sharePermText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.foreground },
  sharePermTextActive: { color: Colors.white },
  sharedUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sharedUserAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.navy,
    justifyContent: 'center', alignItems: 'center',
  },
  sharedUserAvatarText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  sharedUserName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.foreground },
  sharedUserPerm: { fontSize: FontSize.xs, color: Colors.muted, textTransform: 'capitalize' },

  // ── Formula Cell ──────────────────────────────────
  formulaCellInner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 44,
    backgroundColor: 'rgba(20, 83, 45, 0.03)',
  },
  formulaCellText: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.navy,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formulaCellError: { color: Colors.destructive },
  formulaCellPlaceholder: { color: 'rgba(0,0,0,0.12)', fontWeight: FontWeight.regular },

  // ── Formula Input ─────────────────────────────────
  formulaInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: FontSize.sm,
    backgroundColor: '#F8F9F3',
    borderColor: Colors.navy,
  },
  formulaHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    marginBottom: Spacing.lg, paddingHorizontal: Spacing.xs,
  },
  formulaHintText: {
    fontSize: FontSize.xs, color: Colors.muted, flex: 1, lineHeight: 16,
  },
});
