import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { useDS } from '../hooks/useDS';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  value: string | null;
  onChange: (isoDate: string) => void;
  title?: string;
}

function parseISO(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function firstDayOfWeek(y: number, m: number): number {
  return new Date(y, m - 1, 1).getDay();
}

export default function DatePickerSheet({ visible, onClose, value, onChange, title = 'Select Date' }: Props) {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const parsed = parseISO(value);
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth() + 1);
  const [selected, setSelected] = useState<string | null>(value);

  useEffect(() => {
    if (visible) {
      const p = parseISO(value);
      const y = p?.y ?? today.getFullYear();
      const m = p?.m ?? today.getMonth() + 1;
      setViewYear(y);
      setViewMonth(m);
      setSelected(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const prevYear = () => setViewYear(y => y - 1);
  const nextYear = () => setViewYear(y => y + 1);

  const totalDays = daysInMonth(viewYear, viewMonth);
  const offset = firstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDay = (day: number) => {
    const iso = toISO(viewYear, viewMonth, day);
    setSelected(iso);
    onChange(iso);
    onClose();
  };

  const selectedParsed = parseISO(selected);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={s.container}>
        {/* Year navigation */}
        <View style={s.navRow}>
          <TouchableOpacity style={s.navBtn} onPress={prevYear} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={ds.text.secondary} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{viewYear}</Text>
          <TouchableOpacity style={s.navBtn} onPress={nextYear} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-right" size={26} color={ds.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Month navigation */}
        <View style={s.navRow}>
          <TouchableOpacity style={s.navBtn} onPress={prevMonth} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={ds.text.secondary} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTH_NAMES[viewMonth - 1]}</Text>
          <TouchableOpacity style={s.navBtn} onPress={nextMonth} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-right" size={26} color={ds.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={s.weekRow}>
          {WEEKDAYS.map(d => (
            <Text key={d} style={s.weekDay}>{d}</Text>
          ))}
        </View>

        {/* Day grid */}
        <View style={s.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`empty-${i}`} style={s.cell} />;
            const iso = toISO(viewYear, viewMonth, day);
            const isSelected = selectedParsed?.y === viewYear && selectedParsed?.m === viewMonth && selectedParsed?.d === day;
            const isToday = iso === todayISO;
            return (
              <TouchableOpacity
                key={iso}
                style={[s.cell, isSelected && s.cellSelected, isToday && !isSelected && s.cellToday]}
                onPress={() => handleDay(day)}
                activeOpacity={0.75}
              >
                <Text style={[s.cellText, isSelected && s.cellTextSelected, isToday && !isSelected && s.cellTextToday]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

function makeStyles(ds: ReturnType<typeof useDS>) {
  const cellSize = 40;
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    navBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      flex: 1,
      textAlign: 'center',
      fontFamily: 'Inter_700Bold',
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.3,
      color: ds.text.primary,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 18,
      color: ds.text.muted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: `${100 / 7}%`,
      height: cellSize,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    cellSelected: {
      backgroundColor: ds.primary,
      borderRadius: cellSize / 2,
    },
    cellToday: {
      backgroundColor: ds.surface.elevated,
      borderRadius: cellSize / 2,
      borderWidth: 1,
      borderColor: ds.primary,
    },
    cellText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.primary,
    },
    cellTextSelected: {
      fontFamily: 'Inter_700Bold',
      color: '#fff',
    },
    cellTextToday: {
      color: ds.primary,
      fontFamily: 'Inter_600SemiBold',
    },
  });
}
