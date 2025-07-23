import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

export interface NotificationData {
  id: string;
  type: 'low_stock' | 'daily_report' | 'sales';
  title: string;
  body: string;
  data?: any;
  timestamp: string;
  read: boolean;
}

export interface NotificationSettings {
  lowStockAlerts: boolean;
  dailyReports: boolean;
  salesNotifications: boolean;
}

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private static instance: NotificationService;
  private notifications: NotificationData[] = [];
  private listeners: ((notifications: NotificationData[]) => void)[] = [];
  private isInitialized = false;
  private hasNotificationPermissions = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔔 Initializing notification service...');
      
      // Request permissions for local notifications
      await this.requestPermissions();
      
      // Load stored notifications
      await this.loadStoredNotifications();
      
      // Set up notification listeners
      this.setupNotificationListeners();
      
      // Set as initialized
      this.isInitialized = true;
      
      console.log('✅ Notification service initialized successfully');
    } catch (error) {
      console.warn('⚠️ Notification initialization failed:', error);
    }
  }

  // Request notification permissions for local notifications
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Notification permissions not granted');
        this.hasNotificationPermissions = false;
        return false;
      }
      
      this.hasNotificationPermissions = true;
      console.log('✅ Local notification permissions granted');
      return true;
    } catch (error) {
      console.warn('Failed to request notification permissions:', error);
      this.hasNotificationPermissions = false;
      return false;
    }
  }

  // Set up notification event listeners
  private setupNotificationListeners() {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received in foreground:', notification);
    });

    // Handle notification tapped/clicked
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 Notification tapped:', response);
      
      // Handle different notification types
      const notificationData = response.notification.request.content.data;
      if (notificationData?.type) {
        this.handleNotificationTap(notificationData);
      }
    });
  }

  // Handle notification tap actions
  private handleNotificationTap(data: any) {
    // This could be used to navigate to specific screens
    // For now, just log the action
    console.log('📱 Handling notification tap:', data.type);
  }

  // Add notification listener
  addListener(callback: (notifications: NotificationData[]) => void) {
    this.listeners.push(callback);
    // Immediately call with current notifications
    callback(this.notifications);
  }

  // Remove notification listener
  removeListener(callback: (notifications: NotificationData[]) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.notifications));
  }

  // Get current notifications
  getNotifications(): NotificationData[] {
    return [...this.notifications];
  }

  // Get unread notifications
  getUnreadNotifications(): NotificationData[] {
    return this.notifications.filter(notification => !notification.read);
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      await this.saveNotifications();
      this.notifyListeners();
    }
  }

  // Mark all notifications as read
  async markAllAsRead() {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    await this.saveNotifications();
    this.notifyListeners();
  }

  // Clear all notifications
  async clearAllNotifications() {
    this.notifications = [];
    await this.saveNotifications();
    this.notifyListeners();
    
    // Clear system notifications
    await Notifications.dismissAllNotificationsAsync();
  }

  // Remove specific notification
  async removeNotification(notificationId: string) {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    await this.saveNotifications();
    this.notifyListeners();
  }

  // Add internal notification
  private async addNotification(notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) {
    const newNotification: NotificationData = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      read: false,
    };

    this.notifications.unshift(newNotification);
    
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }

    await this.saveNotifications();
    this.notifyListeners();

    console.log(`🔔 Added notification: ${notification.title}`);
    return newNotification;
  }

  // Send local mobile notification
  private async sendLocalNotification(title: string, body: string, data?: any) {
    if (!this.hasNotificationPermissions) {
      console.warn('No notification permissions, skipping local notification');
      return;
    }

    try {
      // Schedule local notification that appears in notification tray
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
        },
        trigger: null, // Show immediately
      });

      console.log(`📱 Local notification sent: ${title}`);
    } catch (error) {
      console.warn('Failed to send local notification:', error);
    }
  }

  // Check for low stock alerts using passed inventory service
  async checkLowStockAlerts(inventoryService?: any): Promise<void> {
    if (!inventoryService) {
      console.warn('No inventory service provided for low stock check');
      return;
    }

    const settings = await this.getNotificationSettings();
    if (!settings.lowStockAlerts) return;

    try {
      await inventoryService.initializeDatabase();
      const lowStockItems = await inventoryService.getLowStockItems();

      if (lowStockItems.length > 0) {
        // Check if we've already sent a low stock alert recently
        const lastAlert = await AsyncStorage.getItem('last_low_stock_alert');
        const now = new Date();
        const hoursSinceLastAlert = lastAlert 
          ? (now.getTime() - new Date(lastAlert).getTime()) / (1000 * 60 * 60)
          : 24;

        // Only send alert if it's been more than 1 hour since last alert (reduced for testing)
        if (hoursSinceLastAlert >= 1) {
          const title = 'Low Stock Alert! ⚠️';
          const body = lowStockItems.length === 1 
            ? `${lowStockItems[0].name} is running low (${lowStockItems[0].quantity} left)`
            : `${lowStockItems.length} items are running low in stock`;

          // Add to internal notifications
          await this.addNotification({
            type: 'low_stock',
            title,
            body,
            data: { items: lowStockItems },
          });

          // Send mobile notification
          await this.sendLocalNotification(title, body, { 
            type: 'low_stock', 
            items: lowStockItems 
          });

          await AsyncStorage.setItem('last_low_stock_alert', now.toISOString());
          
          console.log(`🔔 Low stock alert sent for ${lowStockItems.length} items`);
        }
      }
    } catch (error) {
      console.error('Error checking low stock alerts:', error);
    }
  }

  // Generate and send daily report
  async sendDailyReport(inventoryService?: any): Promise<void> {
    if (!inventoryService) {
      console.warn('No inventory service provided for daily report');
      return;
    }

    const settings = await this.getNotificationSettings();
    if (!settings.dailyReports) return;

    try {
      await inventoryService.initializeDatabase();
      
      // Get today's data
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const salesData = await inventoryService.getSalesDataByDateRange(startOfDay, endOfDay);
      const allItems = await inventoryService.getAllItems();
      const lowStockItems = await inventoryService.getLowStockItems();

      const title = '📊 Daily Inventory Report';
      const body = `Revenue: ₱${salesData.totalRevenue.toFixed(0)} | Units Sold: ${salesData.totalSold} | Low Stock: ${lowStockItems.length}`;

      // Add to internal notifications
      await this.addNotification({
        type: 'daily_report',
        title,
        body,
        data: { 
          salesData, 
          totalItems: allItems.length, 
          lowStockCount: lowStockItems.length 
        },
      });

      // Send mobile notification
      await this.sendLocalNotification(title, body, { 
        type: 'daily_report', 
        salesData 
      });

      console.log('📊 Daily report generated and sent');

    } catch (error) {
      console.error('Error generating daily report:', error);
    }
  }

  // Send sales notification
  async sendSalesNotification(itemName: string, quantity: number, revenue: number): Promise<void> {
    const settings = await this.getNotificationSettings();
    if (!settings.salesNotifications) return;

    const title = '💰 Sale Recorded!';
    const body = `Sold ${quantity}x ${itemName} for ₱${revenue.toFixed(2)}`;

    // Add to internal notifications
    await this.addNotification({
      type: 'sales',
      title,
      body,
      data: { itemName, quantity, revenue },
    });

    // Send mobile notification
    await this.sendLocalNotification(title, body, { 
      type: 'sales', 
      itemName, 
      quantity, 
      revenue 
    });

    console.log(`💰 Sales notification sent: ${quantity}x ${itemName}`);
  }

  // Get notification settings
  private async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem('app_settings');
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        return settings.notifications || {
          lowStockAlerts: true,
          dailyReports: false,
          salesNotifications: true,
        };
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }

    return {
      lowStockAlerts: true,
      dailyReports: false,
      salesNotifications: true,
    };
  }

  // Method to manually trigger low stock check
  async triggerLowStockCheck(inventoryService?: any): Promise<NotificationData[]> {
    await this.checkLowStockAlerts(inventoryService);
    return this.getUnreadNotifications().filter(n => n.type === 'low_stock');
  }

  // Method to manually trigger daily report
  async triggerDailyReport(inventoryService?: any): Promise<NotificationData | null> {
    await this.sendDailyReport(inventoryService);
    const dailyReports = this.getUnreadNotifications().filter(n => n.type === 'daily_report');
    return dailyReports.length > 0 ? dailyReports[0] : null;
  }

  // Test notification method
  async sendTestNotification(): Promise<void> {
    const title = '🧪 Test Notification';
    const body = 'This is a test notification from your inventory app!';

    // Add to internal notifications
    await this.addNotification({
      type: 'sales', // Use sales type for test
      title,
      body,
      data: { test: true },
    });

    // Send mobile notification
    await this.sendLocalNotification(title, body, { 
      type: 'test',
      timestamp: new Date().toISOString()
    });

    console.log('🧪 Test notification sent');
  }

  // Save notifications to storage
  private async saveNotifications() {
    try {
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  // Load notifications from storage
  private async loadStoredNotifications() {
    try {
      const stored = await AsyncStorage.getItem('stored_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error loading stored notifications:', error);
    }
  }

  // Get service status for debugging
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      hasNotificationPermissions: this.hasNotificationPermissions,
      notificationCount: this.notifications.length,
      unreadCount: this.getUnreadNotifications().length,
    };
  }

  // Clear notification badge
  async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.warn('Failed to clear badge:', error);
    }
  }

  // Set notification badge count
  async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.warn('Failed to set badge count:', error);
    }
  }
}

export default NotificationService;