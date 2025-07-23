import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  notifications: {
    lowStockAlerts: boolean;
    dailyReports: boolean;
    salesNotifications: boolean;
  };
  inventory: {
    defaultLowStockThreshold: number;
    autoCalculateProfit: boolean;
    showCostPrices: boolean;
  };
  display: {
    currency: string;
    dateFormat: string;
    theme: "light" | "dark" | "system";
  };
  backup: {
    autoBackup: boolean;
    backupFrequency: "daily" | "weekly" | "monthly";
    lastBackupDate?: string;
  };
}

export const defaultSettings: AppSettings = {
  notifications: {
    lowStockAlerts: true,
    dailyReports: false,
    salesNotifications: true,
  },
  inventory: {
    defaultLowStockThreshold: 10,
    autoCalculateProfit: true,
    showCostPrices: true,
  },
  display: {
    currency: "₱",
    dateFormat: "MM/DD/YYYY",
    theme: "light",
  },
  backup: {
    autoBackup: false,
    backupFrequency: "weekly",
  },
};

class SettingsService {
  private static instance: SettingsService;
  private settings: AppSettings = defaultSettings;
  private listeners: ((settings: AppSettings) => void)[] = [];

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async initialize(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem('app_settings');
      if (savedSettings) {
        this.settings = { ...defaultSettings, ...JSON.parse(savedSettings) };
      }
      this.notifyListeners();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  addListener(callback: (settings: AppSettings) => void) {
    this.listeners.push(callback);
    callback(this.settings);
  }

  removeListener(callback: (settings: AppSettings) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.settings));
  }

  async updateSettings(newSettings: AppSettings): Promise<void> {
    try {
      this.settings = newSettings;
      await AsyncStorage.setItem('app_settings', JSON.stringify(newSettings));
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  async updateSetting(section: keyof AppSettings, key: string, value: any): Promise<void> {
    const newSettings = {
      ...this.settings,
      [section]: {
        ...this.settings[section],
        [key]: value,
      },
    };
    await this.updateSettings(newSettings);
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  // Utility methods for common operations
  formatCurrency(amount: number): string {
    return `${this.settings.display.currency}${amount.toFixed(2)}`;
  }

  formatDate(date: Date): string {
    const format = this.settings.display.dateFormat;
    
    switch (format) {
      case "MM/DD/YYYY":
        return date.toLocaleDateString('en-US');
      case "DD/MM/YYYY":
        return date.toLocaleDateString('en-GB');
      case "YYYY-MM-DD":
        return date.toISOString().split('T')[0];
      default:
        return date.toLocaleDateString();
    }
  }

  calculateProfit(costPrice: number, sellingPrice: number, quantity: number): number {
    if (!this.settings.inventory.autoCalculateProfit) {
      return 0;
    }
    return (sellingPrice - costPrice) * quantity;
  }

  shouldShowCostPrices(): boolean {
    return this.settings.inventory.showCostPrices;
  }

  getTheme(): "light" | "dark" | "system" {
    return this.settings.display.theme;
  }

  getDefaultLowStockThreshold(): number {
    return this.settings.inventory.defaultLowStockThreshold;
  }
}

export default SettingsService;