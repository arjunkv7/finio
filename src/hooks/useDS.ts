import { useColorScheme } from 'react-native';
import { DS_DARK, DS_LIGHT, DSType } from '../constants/colors';
import { useSettingsStore } from '../store/settingsStore';

export function useDS(): DSType {
  const theme = useSettingsStore(s => s.theme);
  const colorScheme = useColorScheme();
  const isDark = theme === 'dark' || (theme === 'system' && colorScheme !== 'light');
  return isDark ? DS_DARK : DS_LIGHT;
}
