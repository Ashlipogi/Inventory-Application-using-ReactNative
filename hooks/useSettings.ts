import { useState, useEffect } from 'react';
import SettingsService, { type AppSettings } from '@/lib/settingsService';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(SettingsService.getInstance().getSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        await SettingsService.getInstance().initialize();
        const currentSettings = SettingsService.getInstance().getSettings();
        setSettings(currentSettings);
      } catch (error) {
        console.error('Error initializing settings:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeSettings();

    // Listen for settings changes
    const handleSettingsChange = (newSettings: AppSettings) => {
      setSettings(newSettings);
    };

    SettingsService.getInstance().addListener(handleSettingsChange);

    return () => {
      SettingsService.getInstance().removeListener(handleSettingsChange);
    };
  }, []);

  const updateSetting = async (section: keyof AppSettings, key: string, value: any) => {
    try {
      await SettingsService.getInstance().updateSetting(section, key, value);
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  };

  const formatCurrency = (amount: number): string => {
    return `${settings.display.currency}${amount.toFixed(2)}`;
  };

  const formatCurrencyInt = (amount: number): string => {
    return `${settings.display.currency}${amount.toFixed(0)}`;
  };

  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return SettingsService.getInstance().formatDate(dateObj);
  };

  const shouldShowCostPrices = (): boolean => {
    return settings.inventory.showCostPrices;
  };

  const shouldAutoCalculateProfit = (): boolean => {
    return settings.inventory.autoCalculateProfit;
  };

  const getDefaultLowStockThreshold = (): number => {
    return settings.inventory.defaultLowStockThreshold;
  };

  const calculateProfit = (costPrice: number, sellingPrice: number, quantity: number): number => {
    if (!settings.inventory.autoCalculateProfit) {
      return 0;
    }
    return (sellingPrice - costPrice) * quantity;
  };

  return {
    settings,
    loading,
    updateSetting,
    formatCurrency,
    formatCurrencyInt,
    formatDate,
    shouldShowCostPrices,
    shouldAutoCalculateProfit,
    getDefaultLowStockThreshold,
    calculateProfit,
  };
}