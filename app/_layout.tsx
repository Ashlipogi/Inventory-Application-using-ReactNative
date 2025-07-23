import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import NotificationService from '@/lib/notificationService';
import InventoryService from '@/lib/inventory';
import SettingsService from '@/lib/settingsService';
import ThemeService from '@/lib/themeService';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    // Initialize services when app starts
    const initializeServices = async () => {
      try {
        console.log('🚀 Initializing app services...');
        
        // Initialize settings service first (required by other services)
        await SettingsService.getInstance().initialize();
        console.log('✅ Settings service initialized');
        
        // Initialize theme service (depends on settings)
        ThemeService.getInstance();
        console.log('✅ Theme service initialized');
        
        // Initialize inventory service
        await InventoryService.initializeDatabase();
        console.log('✅ Inventory service initialized');
        
        // Initialize notification service
        const notificationService = NotificationService.getInstance();
        await notificationService.initialize();
        console.log('✅ Notification service initialized');
        
        // Services are now ready and will communicate through method parameters
        console.log('✅ All services initialized successfully');
      } catch (error) {
        console.error('❌ Service initialization failed:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="inventory" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
