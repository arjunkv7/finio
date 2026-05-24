import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BrandHeader from '../components/BrandHeader';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { RootTabParamList, RootStackParamList } from '../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'More'>,
  StackNavigationProp<RootStackParamList>
>;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  iconBg: string;
  target: keyof RootStackParamList;
}

interface SupportItem {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
}

const GRID_SERVICES: ServiceItem[] = [
  {
    id: 'savings',
    title: 'Savings Goals',
    description: 'Automated pots for your future.',
    icon: 'piggy-bank-outline',
    iconBg: '#F59E0B',
    target: 'Savings',
  },
  {
    id: 'investments',
    title: 'Investments',
    description: 'Stocks, crypto, and market analysis.',
    icon: 'trending-up',
    iconBg: '#9C7EF0',
    target: 'Investments',
  },
  {
    id: 'trips',
    title: 'Trip Expenses',
    description: 'Split costs and track travel budgets.',
    icon: 'airplane',
    iconBg: '#F43F5E',
    target: 'Trips',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Preferences, theme, and currency.',
    icon: 'cog-outline',
    iconBg: '#6B7482',
    target: 'Settings',
  },
];

const SUPPORT_ITEMS: SupportItem[] = [
  {
    id: 'security',
    title: 'Security Center',
    subtitle: 'Biometrics, PIN, and device limits',
    icon: 'shield-check-outline',
  },
  {
    id: 'help',
    title: 'Help Center',
    subtitle: '24/7 support and FAQ',
    icon: 'help-circle-outline',
  },
];

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: ds.surface.screen,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    heroText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 26,
      color: ds.text.primary,
      letterSpacing: -0.4,
      marginBottom: 6,
    },
    heroSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: ds.text.muted,
      lineHeight: 20,
      marginBottom: 24,
    },
    // Wallet featured card
    featuredCard: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      ...ds.shadow.card,
    },
    featuredIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: hexToRgba(ds.primary, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    featuredContent: {
      flex: 1,
    },
    featuredTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      color: ds.text.primary,
      marginBottom: 2,
    },
    featuredDesc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: ds.text.muted,
    },
    // 2×2 grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    gridCard: {
      width: '47.5%',
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      padding: 16,
      ...ds.shadow.card,
    },
    gridIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    gridTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: ds.text.primary,
      marginBottom: 4,
    },
    gridDesc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: ds.text.muted,
      lineHeight: 16,
    },
    // Upgrade banner
    upgradeBanner: {
      borderRadius: ds.radius.xl,
      overflow: 'hidden',
      marginBottom: 28,
    },
    upgradeBg: {
      backgroundColor: '#0C2A1F',
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: hexToRgba(ds.primary, 0.3),
      padding: 20,
    },
    upgradeTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: ds.text.primary,
      marginBottom: 4,
    },
    upgradeDesc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: ds.primaryLight,
      marginBottom: 14,
    },
    upgradeBtn: {
      alignSelf: 'flex-start',
      backgroundColor: ds.primary,
      borderRadius: ds.radius.full,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    upgradeBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#fff',
    },
    // Support section
    sectionLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: ds.text.muted,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    supportCard: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      overflow: 'hidden',
    },
    supportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    supportDivider: {
      height: 1,
      backgroundColor: ds.border.subtle,
      marginHorizontal: 16,
    },
    supportIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    supportContent: {
      flex: 1,
    },
    supportTitle: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: ds.text.primary,
    },
    supportSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: ds.text.muted,
      marginTop: 1,
    },
  });
}

export default function MoreScreen() {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.screen}>
      <BrandHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroText}>Services</Text>
        <Text style={styles.heroSub}>
          Everything you need to manage your{'\n'}financial life in one place.
        </Text>

        {/* Wallet & Accounts — featured full-width card */}
        <TouchableOpacity
          style={styles.featuredCard}
          onPress={() => navigation.navigate('Accounts')}
          activeOpacity={0.75}
        >
          <View style={styles.featuredIconWrap}>
            <MaterialCommunityIcons name="wallet-outline" size={24} color={ds.primary} />
          </View>
          <View style={styles.featuredContent}>
            <Text style={styles.featuredTitle}>Wallet & Accounts</Text>
            <Text style={styles.featuredDesc}>Manage your cards, balances, and cash flow across all linked banks.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={ds.text.muted} />
        </TouchableOpacity>

        {/* 2×2 grid */}
        <View style={styles.grid}>
          {GRID_SERVICES.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridCard}
              onPress={() => navigation.navigate(item.target)}
              activeOpacity={0.75}
            >
              <View style={[styles.gridIconWrap, { backgroundColor: hexToRgba(item.iconBg, 0.15) }]}>
                <MaterialCommunityIcons name={item.icon} size={22} color={item.iconBg} />
              </View>
              <Text style={styles.gridTitle}>{item.title}</Text>
              <Text style={styles.gridDesc}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upgrade to Gold banner */}
        <View style={styles.upgradeBanner}>
          <View style={styles.upgradeBg}>
            <Text style={styles.upgradeTitle}>Upgrade to Gold</Text>
            <Text style={styles.upgradeDesc}>Get 4.5% APY on all savings.</Text>
            <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8}>
              <Text style={styles.upgradeBtnText}>Learn More</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security & Support */}
        <Text style={styles.sectionLabel}>Security &amp; Support</Text>
        <View style={styles.supportCard}>
          {SUPPORT_ITEMS.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <View style={styles.supportDivider} />}
              <TouchableOpacity style={styles.supportRow} activeOpacity={0.7}>
                <View style={styles.supportIconWrap}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={ds.primary} />
                </View>
                <View style={styles.supportContent}>
                  <Text style={styles.supportTitle}>{item.title}</Text>
                  <Text style={styles.supportSub}>{item.subtitle}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={ds.text.muted} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
