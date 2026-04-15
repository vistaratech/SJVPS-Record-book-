import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES } from '../../lib/templates';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');
// Responsive grid: Cap width on web for a cleaner desktop layout
const numColumns = width > 768 ? 5 : width > 400 ? 4 : 3;
const containerWidth = Platform.OS === 'web' ? Math.min(width, 1000) : width;
const totalSpacing = Spacing.xxl * 2 + Spacing.md * (numColumns - 1);
const CARD_WIDTH = (containerWidth - totalSpacing) / numColumns;

export default function TemplateCategoriesScreen() {
  const handleCategoryPress = (categoryId: string) => {
    router.push(`/templates/${categoryId}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Select Template', headerTitle: 'Create New Register' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS === 'web' && { alignSelf: 'center', width: containerWidth }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Templates</Text>
          <Text style={styles.subtitle}>
            Select a template below to create your register instantly.
          </Text>
        </View>

        {/* Category Grid */}
        <View style={styles.grid}>
          {CATEGORIES.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              index={index}
              onPress={() => handleCategoryPress(category.id)}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function CategoryCard({
  category,
  index,
  onPress,
}: {
  category: (typeof CATEGORIES)[number];
  index: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 30, // faster cascade
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        delay: index * 30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, !!(category as any).color && { backgroundColor: `${(category as any).color}15` }]}>
          <Ionicons name={category.icon as any} size={32} color={(category as any).color || Colors.navy} />
        </View>
        <Text style={styles.cardLabel} numberOfLines={2}>
          {category.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: Spacing.xxl,
    paddingBottom: Spacing.huge,
  },
  headerSection: {
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.foreground,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.muted,
    marginTop: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: CARD_WIDTH * 1.05,
    ...Shadows.card,
  },
  iconContainer: {
    marginBottom: Spacing.sm,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    textAlign: 'center',
  },
});
