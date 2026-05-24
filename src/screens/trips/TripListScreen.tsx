import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { DSType } from '../../constants/colors';
import { hexToRgba } from '../../utils/color';
import { useDS } from '../../hooks/useDS';
import { useTripsStore } from '../../store/tripsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getTripParticipants, getTripTotal } from '../../db/queries/tripQueries';
import BottomSheet from '../../components/BottomSheet';
import DatePickerSheet from '../../components/DatePickerSheet';
import { Trip } from '../../types/db';
import { TripsStackParamList } from '../../types';

type Nav = StackNavigationProp<TripsStackParamList, 'TripList'>;

interface TripCard extends Trip {
  participantCount: number;
  total: number;
}

const AVATAR_PALETTE = [
  '#10B981', '#F43F5E', '#F59E0B', '#9C7EF0',
  '#3B82F6', '#EC4899', '#14B8A6', '#F97316',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Dates not set';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) {
    const s = new Date(start);
    const e = new Date(end);
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${fmt(end)}`;
    }
    return `${fmt(start)} – ${fmt(end)}`;
  }
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Create Trip Sheet ─────────────────────────────────────────────────────────

interface CreateTripSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, start: string | null, end: string | null, desc: string | null, participants: string[]) => Promise<void>;
}

function formatDisplayDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function makeCsStyles(ds: DSType) {
  return StyleSheet.create({
    body: { padding: 20, gap: 16 },
    row: { flexDirection: 'row', gap: 12 },
    field: { gap: 6 },
    label: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
    },
    optional: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      textTransform: 'none',
      letterSpacing: 0,
    },
    input: {
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      height: 48,
      justifyContent: 'center',
    },
    inputError: { borderColor: ds.secondary },
    inputMulti: { height: 88, paddingVertical: 12, justifyContent: 'flex-start' },
    inputText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      color: ds.text.primary,
      padding: 0,
    },
    inputPlaceholder: { color: ds.text.muted },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dateIcon: {},
    errorText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.secondaryLight,
    },
    participantInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    participantInput: {
      flex: 1,
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 12,
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    participantInputText: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.primary,
      padding: 0,
    },
    addChipBtn: {
      height: 44,
      paddingHorizontal: 14,
      borderRadius: ds.radius.md,
      backgroundColor: hexToRgba(ds.primary, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    addChipBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: ds.primaryLight,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: ds.radius.full,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderWidth: 1,
      borderColor: hexToRgba(ds.primary, 0.25),
    },
    chipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.primaryLight,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: ds.radius.md,
      backgroundColor: ds.primary,
      marginTop: 4,
    },
    createBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      lineHeight: 22,
      color: '#fff',
    },
  });
}

function CreateTripSheet({ visible, onClose, onCreate }: CreateTripSheetProps) {
  const ds = useDS();
  const cs = useMemo(() => makeCsStyles(ds), [ds]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName(''); setStartDate(null); setEndDate(null); setDescription('');
      setParticipants([]); setParticipantInput(''); setNameError('');
    }
  }, [visible]);

  const addParticipantChip = () => {
    const trimmed = participantInput.trim();
    if (!trimmed) return;
    const names = trimmed.split(',').map(n => n.trim()).filter(Boolean);
    setParticipants(prev => {
      const existing = new Set(prev.map(p => p.toLowerCase()));
      const toAdd = names.filter(n => !existing.has(n.toLowerCase()));
      return [...prev, ...toAdd];
    });
    setParticipantInput('');
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) { setNameError('Trip name is required.'); return; }
    setSaving(true);
    try {
      await onCreate(
        name.trim(),
        startDate,
        endDate,
        description.trim() || null,
        participants,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title="New Trip">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ maxHeight: 520 }}
            contentContainerStyle={cs.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={cs.field}>
              <Text style={cs.label}>TRIP NAME</Text>
              <View style={[cs.input, nameError ? cs.inputError : null]}>
                <TextInput
                  style={cs.inputText}
                  value={name}
                  onChangeText={(v) => { setName(v); if (v.trim()) setNameError(''); }}
                  placeholder="e.g. Goa Weekend, Bali Summer…"
                  placeholderTextColor={ds.text.muted}
                  selectionColor={ds.primary}
                  autoFocus
                />
              </View>
              {nameError ? <Text style={cs.errorText}>{nameError}</Text> : null}
            </View>

            <View style={cs.row}>
              <View style={[cs.field, { flex: 1 }]}>
                <Text style={cs.label}>START DATE</Text>
                <TouchableOpacity
                  style={[cs.input, cs.dateRow]}
                  onPress={() => setStartPickerOpen(true)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="calendar-outline" size={16} color={startDate ? ds.text.secondary : ds.text.muted} style={cs.dateIcon} />
                  <Text style={[cs.inputText, !startDate && cs.inputPlaceholder]} numberOfLines={1}>
                    {startDate ? formatDisplayDate(startDate) : 'Pick date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[cs.field, { flex: 1 }]}>
                <Text style={cs.label}>END DATE</Text>
                <TouchableOpacity
                  style={[cs.input, cs.dateRow]}
                  onPress={() => setEndPickerOpen(true)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="calendar-outline" size={16} color={endDate ? ds.text.secondary : ds.text.muted} style={cs.dateIcon} />
                  <Text style={[cs.inputText, !endDate && cs.inputPlaceholder]} numberOfLines={1}>
                    {endDate ? formatDisplayDate(endDate) : 'Pick date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={cs.field}>
              <Text style={cs.label}>DESCRIPTION <Text style={cs.optional}>(optional)</Text></Text>
              <View style={[cs.input, cs.inputMulti]}>
                <TextInput
                  style={[cs.inputText, { textAlignVertical: 'top' }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What's this trip about?"
                  placeholderTextColor={ds.text.muted}
                  selectionColor={ds.primary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={cs.field}>
              <Text style={cs.label}>PARTICIPANTS <Text style={cs.optional}>(optional)</Text></Text>
              <View style={cs.participantInputRow}>
                <View style={cs.participantInput}>
                  <MaterialCommunityIcons name="account-plus-outline" size={16} color={ds.text.muted} />
                  <TextInput
                    style={cs.participantInputText}
                    value={participantInput}
                    onChangeText={setParticipantInput}
                    placeholder="Name or comma-separated names"
                    placeholderTextColor={ds.text.muted}
                    selectionColor={ds.primary}
                    returnKeyType="done"
                    onSubmitEditing={addParticipantChip}
                  />
                </View>
                <TouchableOpacity style={cs.addChipBtn} onPress={addParticipantChip} activeOpacity={0.75}>
                  <Text style={cs.addChipBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              {participants.length > 0 && (
                <View style={cs.chipsWrap}>
                  {participants.map((p, i) => (
                    <TouchableOpacity key={`${p}-${i}`} style={cs.chip} onPress={() => removeParticipant(i)} activeOpacity={0.75}>
                      <Text style={cs.chipText}>{p}</Text>
                      <MaterialCommunityIcons name="close-circle" size={14} color={ds.primaryLight} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[cs.createBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialCommunityIcons name="airplane-takeoff" size={20} color="#fff" />
              )}
              <Text style={cs.createBtnText}>{saving ? 'Creating…' : 'Create Trip'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>

      <DatePickerSheet
        visible={startPickerOpen}
        onClose={() => setStartPickerOpen(false)}
        value={startDate}
        onChange={setStartDate}
        title="Start Date"
      />
      <DatePickerSheet
        visible={endPickerOpen}
        onClose={() => setEndPickerOpen(false)}
        value={endDate}
        onChange={setEndDate}
        title="End Date"
      />
    </>
  );
}

// ── Trip Card ─────────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: TripCard;
  currencySymbol: string;
  onPress: () => void;
}

function makeCardStyles(ds: DSType) {
  return StyleSheet.create({
    card: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      padding: 16,
      ...ds.shadow.card,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    tripIconWrap: {
      width: 42,
      height: 42,
      borderRadius: ds.radius.md,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripName: {
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: ds.text.primary,
      marginBottom: 2,
    },
    tripDates: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: ds.radius.full,
      borderWidth: 1,
    },
    badgeSettled: {
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderColor: hexToRgba(ds.primary, 0.3),
    },
    badgePending: {
      backgroundColor: hexToRgba(ds.tertiary, 0.12),
      borderColor: hexToRgba(ds.tertiary, 0.3),
    },
    badgeText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0.3,
    },
    badgeTextSettled: { color: ds.primaryLight },
    badgeTextPending: { color: ds.tertiaryLight },
    cardStats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statDivider: {
      width: 1,
      height: 16,
      backgroundColor: ds.border.subtle,
      marginHorizontal: 12,
    },
    statLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },
    statText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.secondary,
    },
    statAmount: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
      lineHeight: 20,
      color: ds.primaryLight,
    },
  });
}

function TripCardView({ trip, currencySymbol, onPress }: TripCardProps) {
  const ds = useDS();
  const s = useMemo(() => makeCardStyles(ds), [ds]);
  const settled = trip.is_settled === 1;
  const total = (trip.total / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      {/* Card header row */}
      <View style={s.cardTop}>
        <View style={s.tripIconWrap}>
          <MaterialCommunityIcons name="airplane" size={22} color={ds.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.tripName} numberOfLines={1}>{trip.name}</Text>
          <Text style={s.tripDates}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
        </View>
        <View style={[s.badge, settled ? s.badgeSettled : s.badgePending]}>
          <Text style={[s.badgeText, settled ? s.badgeTextSettled : s.badgeTextPending]}>
            {settled ? 'Settled' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.cardStats}>
        <View style={s.stat}>
          <MaterialCommunityIcons name="account-group-outline" size={14} color={ds.text.muted} />
          <Text style={s.statText}>{trip.participantCount} participants</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statLabel}>Total spent</Text>
          <Text style={s.statAmount}>{currencySymbol}{total}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    screenTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: -0.48,
      color: ds.text.primary,
    },
    screenSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      marginTop: 2,
    },

    summaryCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...ds.shadow.card,
    },
    summaryLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
      marginBottom: 6,
    },
    summaryAmount: {
      fontFamily: 'Inter_700Bold',
      fontSize: 28,
      lineHeight: 36,
      letterSpacing: -0.56,
      color: ds.text.primary,
    },
    summaryMeta: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, gap: 12 },

    centerFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      lineHeight: 28,
      color: ds.text.primary,
      textAlign: 'center',
    },
    emptyBody: {
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      color: ds.text.muted,
      textAlign: 'center',
    },

    newTripBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: ds.radius.full,
      backgroundColor: ds.primary,
    },
    newTripBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: '#fff',
    },
  });
}

export default function TripListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const { trips, loadFromDB, selectTrip, addTrip, addParticipant } = useTripsStore();
  const { currencySymbol } = useSettingsStore();

  const [enriched, setEnriched] = useState<TripCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    await loadFromDB();
  }, [loadFromDB]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  // Enrich each trip with participant count + total
  useEffect(() => {
    let cancelled = false;
    async function enrich() {
      const cards = await Promise.all(
        trips.map(async (t) => {
          const [participants, total] = await Promise.all([
            getTripParticipants(t.id),
            getTripTotal(t.id),
          ]);
          return { ...t, participantCount: participants.length, total };
        })
      );
      if (!cancelled) { setEnriched(cards); setLoading(false); }
    }
    enrich();
    return () => { cancelled = true; };
  }, [trips]);

  const handleSelectTrip = useCallback(async (tripId: string) => {
    await selectTrip(tripId);
    navigation.navigate('TripDetail', { tripId });
  }, [selectTrip, navigation]);

  const handleCreateTrip = useCallback(async (
    name: string,
    start: string | null,
    end: string | null,
    desc: string | null,
    participants: string[],
  ) => {
    const trip = await addTrip({ name, start_date: start, end_date: end, description: desc });
    for (const participantName of participants) {
      await addParticipant({ trip_id: trip.id, name: participantName });
    }
  }, [addTrip, addParticipant]);

  const totalBudget = enriched.reduce((acc, t) => acc + t.total, 0);
  const activeCount = enriched.filter((t) => !t.is_settled).length;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.screenTitle}>My Trips</Text>
          <Text style={s.screenSub}>{enriched.length} trips · {activeCount} active</Text>
        </View>
        <TouchableOpacity style={s.newTripBtn} onPress={() => setCreateOpen(true)} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={16} color="#fff" />
          <Text style={s.newTripBtnText}>New Trip</Text>
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      <View style={s.summaryCard}>
        <View>
          <Text style={s.summaryLabel}>TOTAL SPEND ACROSS TRIPS</Text>
          <Text style={s.summaryAmount}>
            {currencySymbol}{(totalBudget / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={s.summaryMeta}>
          <MaterialCommunityIcons name="airplane-check" size={28} color={ds.primary} />
        </View>
      </View>

      {/* Trip list */}
      {loading ? (
        <View style={s.centerFill}>
          <ActivityIndicator size="large" color={ds.primary} />
        </View>
      ) : enriched.length === 0 ? (
        <View style={s.centerFill}>
          <MaterialCommunityIcons name="airplane-off" size={56} color={ds.text.muted} />
          <Text style={s.emptyTitle}>No trips yet</Text>
          <Text style={s.emptyBody}>Tap + to plan your first trip and track shared expenses.</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {enriched.map((trip) => (
            <TripCardView
              key={trip.id}
              trip={trip}
              currencySymbol={currencySymbol}
              onPress={() => handleSelectTrip(trip.id)}
            />
          ))}
        </ScrollView>
      )}

      <CreateTripSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateTrip}
      />
    </View>
  );
}
