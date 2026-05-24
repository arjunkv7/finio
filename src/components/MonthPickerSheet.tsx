import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { DSType } from '../constants/colors';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface Props {
  visible: boolean;
  onClose: () => void;
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  ds: DSType;
}

export default function MonthPickerSheet({ visible, onClose, year, month, onChange, ds }: Props) {
  const [ly, setLy] = useState(year);
  const [lm, setLm] = useState(month);
  const [gridMode, setGridMode] = useState(false);
  const now = new Date();
  const isAtNow = ly === now.getFullYear() && lm === now.getMonth() + 1;

  useEffect(() => {
    if (visible) { setLy(year); setLm(month); setGridMode(false); }
  }, [visible, year, month]);

  const step = (delta: number) => {
    let nm = lm + delta;
    let ny = ly;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth() + 1)) return;
    setLy(ny); setLm(nm);
  };

  const stepYear = (delta: number) => {
    const ny = ly + delta;
    if (ny > now.getFullYear()) return;
    setLy(ny);
    if (ny === now.getFullYear() && lm > now.getMonth() + 1) setLm(now.getMonth() + 1);
  };

  const confirm = () => { onChange(ly, lm); onClose(); };

  const selectFromGrid = (m: number) => {
    if (ly === now.getFullYear() && m > now.getMonth() + 1) return;
    setLm(m);
    setGridMode(false);
  };

  const s = makeStyles(ds);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Month">
      <View style={s.body}>
        {gridMode ? (
          <>
            <View style={s.row}>
              <TouchableOpacity style={s.arrow} onPress={() => stepYear(-1)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="chevron-left" size={26} color={ds.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setGridMode(false)} activeOpacity={0.7}>
                <Text style={s.label}>{ly}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.arrow} onPress={() => stepYear(1)} disabled={ly >= now.getFullYear()} activeOpacity={0.7}>
                <MaterialCommunityIcons name="chevron-right" size={26}
                  color={ly >= now.getFullYear() ? ds.text.muted : ds.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={s.grid}>
              {MONTH_NAMES.map((name, i) => {
                const m = i + 1;
                const isFuture = ly === now.getFullYear() && m > now.getMonth() + 1;
                const isSelected = lm === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[s.cell, isSelected && { backgroundColor: ds.primary, borderColor: ds.primary }, isFuture && { opacity: 0.3 }]}
                    onPress={() => selectFromGrid(m)}
                    disabled={isFuture}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.cellText, isSelected && { color: '#fff' }]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <View style={s.row}>
              <TouchableOpacity style={s.arrow} onPress={() => step(-1)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="chevron-left" size={26} color={ds.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setGridMode(true)} activeOpacity={0.7}>
                <Text style={s.label}>{MONTH_NAMES[lm - 1]} {ly}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.arrow} onPress={() => step(1)} disabled={isAtNow} activeOpacity={0.7}>
                <MaterialCommunityIcons name="chevron-right" size={26}
                  color={isAtNow ? ds.text.muted : ds.text.secondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.confirmBtn} onPress={confirm} activeOpacity={0.85}>
              <Text style={s.confirmText}>Show {MONTH_NAMES[lm - 1]} {ly}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
    row:  { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    label: {
      flex: 1, textAlign: 'center',
      fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28,
      letterSpacing: -0.44, color: ds.text.primary,
    },
    confirmBtn: {
      height: 52, borderRadius: ds.radius.md, backgroundColor: ds.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    confirmText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: '#fff',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    cell: {
      width: '22%', flexGrow: 1, paddingVertical: 10,
      borderRadius: ds.radius.md,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1, borderColor: ds.border.subtle,
      alignItems: 'center',
    },
    cellText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: ds.text.primary },
  });
}
