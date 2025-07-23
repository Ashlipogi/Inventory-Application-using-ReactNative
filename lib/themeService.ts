import { Appearance, ColorSchemeName } from 'react-native';
import SettingsService from './settingsService';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  shadow: string;
  card: string;
  notification: string;
}

const lightTheme: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F2F2F7',
  surfaceSecondary: '#F8F9FA',
  text: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  primary: '#007AFF',
  secondary: '#5856D6',
  accent: '#FF9500',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  border: '#E5E5EA',
  shadow: '#000000',
  card: '#FFFFFF',
  notification: '#FF3B30',
};

const darkTheme: ThemeColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#98989D',
  textTertiary: '#636366',
  primary: '#0A84FF',
  secondary: '#5E5CE6',
  accent: '#FF9F0A',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  border: '#38383A',
  shadow: '#000000',
  card: '#1C1C1E',
  notification: '#FF453A',
};

class ThemeService {
  private static instance: ThemeService;
  private currentTheme: ThemeColors = lightTheme;
  private listeners: ((theme: ThemeColors) => void)[] = [];
  private settingsService = SettingsService.getInstance();

  private constructor() {
    this.updateTheme();
    
    // Listen to system appearance changes
    Appearance.addChangeListener(this.handleAppearanceChange);
    
    // Listen to settings changes
    this.settingsService.addListener(this.handleSettingsChange);
  }

  static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  private handleAppearanceChange = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
    this.updateTheme();
  };

  private handleSettingsChange = () => {
    this.updateTheme();
  };

  private updateTheme() {
    const settings = this.settingsService.getSettings();
    const themePreference = settings.display.theme;
    
    let effectiveTheme: 'light' | 'dark';
    
    if (themePreference === 'system') {
      effectiveTheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
    } else {
      effectiveTheme = themePreference;
    }
    
    this.currentTheme = effectiveTheme === 'dark' ? darkTheme : lightTheme;
    this.notifyListeners();
  }

  addListener(callback: (theme: ThemeColors) => void) {
    this.listeners.push(callback);
    callback(this.currentTheme);
  }

  removeListener(callback: (theme: ThemeColors) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentTheme));
  }

  getTheme(): ThemeColors {
    return this.currentTheme;
  }

  isDark(): boolean {
    return this.currentTheme === darkTheme;
  }
}

export default ThemeService;