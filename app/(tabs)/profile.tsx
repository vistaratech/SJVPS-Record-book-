import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { listBusinesses, importData } from '../../lib/api';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';
import { TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importDataString, setImportDataString] = useState('');

  const { data: businesses } = useQuery({
    queryKey: ['businesses'],
    queryFn: listBusinesses,
  });
  const businessId = businesses?.[0]?.id;

  const importMutation = useMutation({
    mutationFn: (jsonData: string) => importData(businessId!, jsonData),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setImportModalVisible(false);
      setImportDataString('');
      Alert.alert('Success', `Successfully imported ${res.importedCount} registers!`);
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to import data'),
  });

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <Text style={styles.userPhone}>{user?.phone}</Text>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIcon, { backgroundColor: '#EBF5FF' }]}>
            <Ionicons name="person-outline" size={20} color={Colors.navy} />
          </View>
          <Text style={styles.menuLabel}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.mutedLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIcon, { backgroundColor: '#F0FFF4' }]}>
            <Ionicons name="business-outline" size={20} color={Colors.green} />
          </View>
          <Text style={styles.menuLabel}>Manage Business</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.mutedLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="cloud-download-outline" size={20} color={Colors.warning} />
          </View>
          <Text style={styles.menuLabel}>Export Data</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.mutedLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setImportModalVisible(true)}>
          <View style={[styles.menuIcon, { backgroundColor: '#F0F9FF' }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.navy} />
          </View>
          <Text style={styles.menuLabel}>Import Data</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.mutedLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIcon, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="help-circle-outline" size={20} color="#8B5CF6" />
          </View>
          <Text style={styles.menuLabel}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.mutedLight} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.destructive} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>AG Trust v1.0.0</Text>

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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xxl,
    paddingBottom: Spacing.huge,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  userPhone: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: Spacing.xs,
  },
  menuSection: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.destructiveBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.destructive,
  },
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.mutedLight,
    marginTop: Spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '90%',
    maxWidth: 400,
    ...Shadows.card,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    marginBottom: Spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.foreground,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  modalCancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.muted,
  },
  modalConfirmBtn: {
    backgroundColor: Colors.navy,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
});
