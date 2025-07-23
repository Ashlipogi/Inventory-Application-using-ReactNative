import { useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { useSettings } from './useSettings';

const lightTheme = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceSecondary: '#F1F3F4',
  primary: '#007AFF',
  secondary: '#5856D6',
  accent: '#FF9500',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  text: '#000000',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  shadow: '#000000',
};

const darkTheme = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  primary: '#007AFF',
  secondary: '#5856D6',
  accent: '#FF9500',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  border: '#38383A',
  shadow: '#000000',
};

export function useTheme() {
  const { settings } = useSettings();
  const [systemTheme, setSystemTheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  const getActiveTheme = () => {
    if (settings.display.theme === 'system') {
      return systemTheme === 'dark' ? 'dark' : 'light';
    }
    return settings.display.theme;
  };

  const activeTheme = getActiveTheme();
  const theme = activeTheme === 'dark' ? darkTheme : lightTheme;
  const isDark = activeTheme === 'dark';

  return {
    theme,
    isDark,
    activeTheme,
  };
}