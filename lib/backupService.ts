import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Alert } from 'react-native';
import InventoryService from './inventory';
import SettingsService from './settingsService';

export interface BackupData {
  timestamp: string;
  version: string;
  settings: any;
  items: any[];
  transactions: any[];
  metadata: {
    totalItems: number;
    totalTransactions: number;
    totalValue: number;
    exportedBy: string;
    appVersion: string;
  };
}

class BackupService {
  private static instance: BackupService;
  private settingsService = SettingsService.getInstance();
  private isAutoBackupInProgress = false;

  private constructor() {}

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  async createBackup(): Promise<BackupData> {
    try {
      console.log('📦 Creating backup...');
      await InventoryService.initializeDatabase();

      const items = await InventoryService.getAllItems();
      const transactions = await InventoryService.getStockTransactions();
      const salesData = await InventoryService.getSalesData();
      const settings = this.settingsService.getSettings();

      const backupData: BackupData = {
        timestamp: new Date().toISOString(),
        version: "1.1.0",
        settings,
        items,
        transactions,
        metadata: {
          totalItems: items.length,
          totalTransactions: transactions.length,
          totalValue: await InventoryService.getTotalStockValue(),
          exportedBy: "StockBox Inventory App",
          appVersion: "1.1.0",
        },
      };

      console.log('✅ Backup created successfully');
      return backupData;
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw new Error('Failed to create backup');
    }
  }

  async exportBackup(): Promise<void> {
    try {
      console.log('📤 Exporting backup...');
      const backupData = await this.createBackup();
      const backupJson = JSON.stringify(backupData, null, 2);

      const fileName = `StockBox_Backup_${new Date().toISOString().split('T')[0]}.json`;
      
      await Share.share({
        message: backupJson,
        title: fileName,
      });

      // Update last backup date
      await this.settingsService.updateSetting('backup', 'lastBackupDate', new Date().toISOString());
      
      Alert.alert(
        "Backup Created! 📦", 
        `Your complete inventory backup has been created.\n\nSize: ${(backupJson.length / 1024).toFixed(1)} KB\nItems: ${backupData.metadata.totalItems}\nTransactions: ${backupData.metadata.totalTransactions}`,
        [{ text: "OK" }]
      );
      
      console.log('✅ Backup exported successfully');
    } catch (error) {
      console.error('❌ Error exporting backup:', error);
      Alert.alert("Export Failed", "Failed to create backup file. Please try again.");
      throw error;
    }
  }

  async exportCSV(): Promise<void> {
    try {
      console.log('📊 Exporting CSV...');
      await InventoryService.initializeDatabase();
      const items = await InventoryService.getAllItems();
      const transactions = await InventoryService.getStockTransactions();
      const salesData = await InventoryService.getSalesData();
      const settings = this.settingsService.getSettings();

      console.log(`📊 Found ${items.length} items to export`);
      
      if (items.length === 0) {
        Alert.alert("No Data", "No inventory items to export.");
        return;
      }

      // Create comprehensive CSV with multiple sheets equivalent
      const timestamp = new Date().toLocaleDateString();
      
      // Inventory Items CSV
      const csvHeader = "Name,Cost Price,Selling Price,Quantity,Min Stock Level,Total Sold,Stock Value,Created At\n";
      const csvData = items
        .map((item) => {
          const stockValue = (item.cost_price * item.quantity).toFixed(2);
          // Clean the item name and ensure it's properly escaped
          const cleanName = (item.name || '').toString().trim().replace(/"/g, '""');
          return `"${cleanName}",${item.cost_price || 0},${item.selling_price || 0},${item.quantity || 0},${item.min_stock_level || 0},${item.total_sold || 0},${stockValue},"${item.created_at || ''}"`;
        })
        .join("\n");

      console.log(`📊 Generated CSV data for ${items.length} items`);
      console.log('📊 Sample CSV line:', csvData.split('\n')[0]);

      // Transactions CSV
      const transactionHeader = "\n\n=== TRANSACTIONS ===\nItem Name,Type,Quantity,Unit Price,Total Amount,Notes,Date\n";
      const transactionData = transactions
        .map((t) => {
          const itemName = (t as any).item_name || 'Unknown Item';
          return `"${itemName.replace(/"/g, '""')}","${t.type}",${t.quantity},"${t.unit_price || ''}","${t.total_amount || ''}","${(t.notes || '').replace(/"/g, '""')}","${t.created_at}"`;
        })
        .join("\n");

      // Summary section
      const totalValue = await InventoryService.getTotalStockValue();
      const summaryHeader = "\n\n=== SUMMARY ===\nMetric,Value\n";
      const summaryData = [
        `"Total Items",${items.length}`,
        `"Total Stock Value","${settings.display.currency}${totalValue.toFixed(2)}"`,
        `"Total Revenue","${settings.display.currency}${salesData.totalRevenue.toFixed(2)}"`,
        `"Total Profit","${settings.display.currency}${salesData.totalProfit.toFixed(2)}"`,
        `"Total Units Sold",${salesData.totalSold}`,
        `"Export Date","${timestamp}"`,
        `"Export Time","${new Date().toLocaleTimeString()}"`,
      ].join("\n");

      // Low Stock Items
      const lowStockItems = await InventoryService.getLowStockItems();
      const lowStockHeader = "\n\n=== LOW STOCK ALERT ===\nItem Name,Current Stock,Min Level,Status\n";
      const lowStockData = lowStockItems.length > 0 
        ? lowStockItems.map(item => 
            `"${item.name.replace(/"/g, '""')}",${item.quantity},${item.min_stock_level},"${item.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}"`
          ).join("\n")
        : "No low stock items";

      const exportData = csvHeader + csvData + transactionHeader + transactionData + summaryHeader + summaryData + lowStockHeader + lowStockData;

      const fileName = `StockBox_Export_${new Date().toISOString().split('T')[0]}.csv`;

      await Share.share({
        message: exportData,
        title: fileName,
      });

      Alert.alert(
        "Export Complete! 📊", 
        `Your inventory data has been exported successfully.\n\nIncludes:\n• ${items.length} inventory items\n• ${transactions.length} transactions\n• Summary statistics\n• Low stock alerts\n\nReady to share or save!`,
        [{ text: "OK" }]
      );
      
      console.log('✅ CSV export completed successfully');
    } catch (error) {
      console.error('❌ Error exporting CSV:', error);
      Alert.alert("Export Failed", "Failed to export data. Please try again.");
      throw error;
    }
  }

  async shouldAutoBackup(): Promise<boolean> {
    try {
      const settings = this.settingsService.getSettings();
      
      if (!settings.backup.autoBackup) {
        return false;
      }

      const lastBackup = settings.backup.lastBackupDate;
      if (!lastBackup) {
        console.log('🔄 First auto backup needed');
        return true;
      }

      const lastBackupDate = new Date(lastBackup);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24));

      let shouldBackup = false;
      switch (settings.backup.backupFrequency) {
        case "daily":
          shouldBackup = daysDiff >= 1;
          break;
        case "weekly":
          shouldBackup = daysDiff >= 7;
          break;
        case "monthly":
          shouldBackup = daysDiff >= 30;
          break;
        default:
          shouldBackup = false;
      }

      if (shouldBackup) {
        console.log(`🔄 Auto backup needed (${daysDiff} days since last backup)`);
      }

      return shouldBackup;
    } catch (error) {
      console.error('❌ Error checking auto backup:', error);
      return false;
    }
  }

  async performAutoBackup(): Promise<void> {
    if (this.isAutoBackupInProgress) {
      console.log('🔄 Auto backup already in progress, skipping...');
      return;
    }

    try {
      this.isAutoBackupInProgress = true;
      
      const shouldBackup = await this.shouldAutoBackup();
      
      if (shouldBackup) {
        console.log('🔄 Performing auto backup...');
        const backupData = await this.createBackup();
        
        // Store backup locally with timestamp
        const backupKey = `auto_backup_${Date.now()}`;
        await AsyncStorage.setItem(backupKey, JSON.stringify(backupData));
        
        // Keep only last 5 auto backups to save storage
        await this.cleanupOldAutoBackups();
        
        // Update last backup date
        await this.settingsService.updateSetting('backup', 'lastBackupDate', new Date().toISOString());
        
        console.log('✅ Auto backup completed successfully');
        
        // Show subtle notification
        const settings = this.settingsService.getSettings();
        if (settings.notifications.dailyReports) {
          Alert.alert(
            "Auto Backup Complete 📦", 
            `Your inventory data has been automatically backed up.\n\nItems: ${backupData.metadata.totalItems}\nValue: ${settings.display.currency}${backupData.metadata.totalValue.toFixed(0)}`,
            [{ text: "OK" }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Auto backup failed:', error);
    } finally {
      this.isAutoBackupInProgress = false;
    }
  }

  private async cleanupOldAutoBackups(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const autoBackupKeys = allKeys
        .filter(key => key.startsWith('auto_backup_'))
        .sort()
        .reverse(); // Most recent first

      // Keep only the last 5 auto backups
      if (autoBackupKeys.length > 5) {
        const keysToDelete = autoBackupKeys.slice(5);
        await AsyncStorage.multiRemove(keysToDelete);
        console.log(`🧹 Cleaned up ${keysToDelete.length} old auto backups`);
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  async getAutoBackupHistory(): Promise<{ date: string; size: number; items: number }[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const autoBackupKeys = allKeys
        .filter(key => key.startsWith('auto_backup_'))
        .sort()
        .reverse();

      const history = [];
      for (const key of autoBackupKeys.slice(0, 10)) { // Get last 10 backups
        try {
          const backupData = await AsyncStorage.getItem(key);
          if (backupData) {
            const backup = JSON.parse(backupData);
            history.push({
              date: backup.timestamp,
              size: backupData.length,
              items: backup.metadata.totalItems,
            });
          }
        } catch (error) {
          console.warn(`Failed to load backup ${key}:`, error);
        }
      }

      return history;
    } catch (error) {
      console.error('Error getting backup history:', error);
      return [];
    }
  }

  parseCSVImport(csvData: string): any[] {
    try {
      console.log('📥 Parsing CSV import data...');
      console.log('📥 Raw CSV data length:', csvData.length);
      
      const lines = csvData.trim().split('\n').filter(line => line.trim());
      console.log('📥 Total lines found:', lines.length);
      
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
      }

      // Find where the inventory section ends - look for section markers
      let inventoryEndIndex = lines.length;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        // Check if this line is a section marker or starts a new section
        if (line.includes('=== TRANSACTIONS ===') || 
            line.includes('=== SUMMARY ===') || 
            line.includes('=== LOW STOCK ALERT ===') ||
            line === '' ||
            (i > 1 && line.startsWith('Item Name,Type,'))) { // Specific check for transaction header
          inventoryEndIndex = i;
          console.log(`📥 Found section marker at line ${i + 1}, inventory section ends here`);
          break;
        }
      }

      // Only process the inventory section (header + data until first section marker)
      const inventoryLines = lines.slice(0, inventoryEndIndex);
      console.log(`📥 Processing ${inventoryLines.length} inventory lines (header + data)`);

      if (inventoryLines.length < 2) {
        throw new Error('No inventory data found - CSV contains only headers or section markers');
      }

      // Parse header
      const headerLine = inventoryLines[0];
      console.log('📥 Header line:', headerLine);
      const headers = this.parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
      console.log('📥 Parsed headers:', headers);
      
      // Validate required columns
      const requiredColumns = ['name'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Map column indices
      const columnMap = {
        name: headers.indexOf('name'),
        costPrice: Math.max(
          headers.indexOf('cost price'),
          headers.indexOf('cost_price'),
          headers.indexOf('costprice')
        ),
        sellingPrice: Math.max(
          headers.indexOf('selling price'),
          headers.indexOf('selling_price'),
          headers.indexOf('sellingprice'),
          headers.indexOf('price')
        ),
        quantity: headers.indexOf('quantity'),
        minStockLevel: Math.max(
          headers.indexOf('min stock level'),
          headers.indexOf('min_stock_level'),
          headers.indexOf('minstocklevel'),
          headers.indexOf('min level'),
          headers.indexOf('minimum')
        ),
      };

      console.log('📥 Column mapping:', columnMap);
      const items = [];
      const errors = [];
      const seenNames = new Set<string>();

      // Parse data rows (skip header, only process inventory section)
      for (let i = 1; i < inventoryLines.length; i++) {
        const line = inventoryLines[i];
        
        // Skip empty lines
        if (!line.trim()) {
          console.log(`📥 Skipping empty line ${i + 1}`);
          continue;
        }

        try {
          const values = this.parseCSVLine(line);
          console.log(`📥 Parsing line ${i + 1}:`, values);
          
          if (values.length === 0 || !values[0]?.trim()) {
            console.log(`📥 Skipping empty data line ${i + 1}`);
            continue;
          }

          const name = values[columnMap.name]?.trim();
          if (!name) {
            errors.push(`Row ${i + 1}: Missing product name`);
            continue;
          }

          // Additional validation to ensure this is a valid product name
          // Skip headers, section markers, and invalid data
          if (name.includes('===') || 
              name.toLowerCase().includes('total') ||
              name.toLowerCase().includes('metric') ||
              name.toLowerCase().includes('export') ||
              name.toLowerCase() === 'item name' ||
              name.toLowerCase() === 'name' ||
              /^[0-9]+$/.test(name)) {
            console.log(`📥 Skipping non-product line ${i + 1}: ${name}`);
            continue;
          }

          // Check for duplicate names in the CSV itself
          const nameLower = name.toLowerCase();
          if (seenNames.has(nameLower)) {
            errors.push(`Row ${i + 1}: Duplicate product name "${name}" found in CSV`);
            continue;
          }
          seenNames.add(nameLower);

          const item = {
            name,
            cost_price: this.parsePrice(values[columnMap.costPrice]) || 0,
            selling_price: this.parsePrice(values[columnMap.sellingPrice]) || 0,
            quantity: this.parseInteger(values[columnMap.quantity]) || 0,
            min_stock_level: this.parseInteger(values[columnMap.minStockLevel]) || 10,
          };

          // Validate item data
          if (item.selling_price <= 0) {
            item.selling_price = item.cost_price * 1.2; // Default 20% markup
          }

          console.log(`📥 Valid item found: ${item.name}`);
          items.push(item);
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
        }
      }

      if (errors.length > 0 && items.length === 0) {
        throw new Error(`Import failed:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n... and more errors' : ''}`);
      }

      console.log(`✅ CSV parsing completed: ${items.length} items, ${errors.length} errors`);
      console.log('📥 Parsed items:', items.map(item => item.name));
      
      if (errors.length > 0) {
        Alert.alert(
          "Import Warnings",
          `${items.length} items will be imported.\n\nWarnings:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n... and more' : ''}`,
          [{ text: "Continue" }]
        );
      }

      return items;
    } catch (error) {
      console.error('❌ Error parsing CSV:', error);
      throw error instanceof Error ? error : new Error('Invalid CSV format');
    }
  }

  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private parsePrice(value: string | undefined): number {
    if (!value) return 0;
    const cleaned = value.replace(/[₱$€£¥₹₦R¢,]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, num);
  }

  private parseInteger(value: string | undefined): number {
    if (!value) return 0;
    const num = parseInt(value.trim());
    return isNaN(num) ? 0 : Math.max(0, num);
  }

  async importFromBackup(backupData: BackupData): Promise<void> {
    try {
      console.log('📥 Importing from backup...');
      
      // Validate backup data
      if (!backupData.items || !Array.isArray(backupData.items)) {
        throw new Error('Invalid backup data: missing or invalid items array');
      }

      if (!backupData.metadata) {
        throw new Error('Invalid backup data: missing metadata');
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Import items
      for (const item of backupData.items) {
        try {
          // Validate item structure
          if (!item.name || typeof item.cost_price !== 'number' || typeof item.selling_price !== 'number') {
            throw new Error(`Invalid item data: ${item.name || 'Unknown'}`);
          }

          await InventoryService.addItem({
            name: item.name,
            cost_price: item.cost_price,
            selling_price: item.selling_price,
            quantity: item.quantity || 0,
            min_stock_level: item.min_stock_level || 10,
          });
          
          successCount++;
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('UNIQUE constraint failed')) {
            errors.push(`${item.name || 'Unknown item'}: Item already exists (duplicate name)`);
          } else {
            errors.push(`${item.name || 'Unknown item'}: ${errorMessage}`);
          }
          console.warn(`Failed to import item: ${item.name}`, error);
        }
      }

      // Import settings if available
      if (backupData.settings) {
        try {
          await this.settingsService.updateSettings(backupData.settings);
          console.log('✅ Settings imported successfully');
        } catch (error) {
          console.warn('Failed to import settings:', error);
        }
      }

      // Show result
      if (successCount > 0) {
        const message = errorCount > 0 
          ? `Successfully imported ${successCount} items.\n\n${errorCount} items failed:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n... and more' : ''}`
          : `Successfully imported ${successCount} items!`;
          
        Alert.alert(
          "Import Complete! 📦", 
          message,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Import Failed", 
          `No items were imported.\n\nErrors:\n${errors.slice(0, 5).join('\n')}`,
          [{ text: "OK" }]
        );
      }

      console.log(`✅ Backup import completed: ${successCount} success, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Error importing backup:', error);
      Alert.alert("Import Failed", `Failed to import backup data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async generateSampleCSV(): Promise<string> {
    const sampleData = `Name,Cost Price,Selling Price,Quantity,Min Stock Level
"iPhone 14",45000,55000,20,5
"Samsung Galaxy S23",40000,50000,15,3
"MacBook Pro",85000,105000,8,2
"AirPods Pro",8000,12000,50,10
"iPad Air",35000,45000,12,3`;

    return sampleData;
  }

  // Get backup service status
  getServiceStatus() {
    return {
      autoBackupInProgress: this.isAutoBackupInProgress,
      lastBackupDate: this.settingsService.getSettings().backup.lastBackupDate,
      autoBackupEnabled: this.settingsService.getSettings().backup.autoBackup,
      backupFrequency: this.settingsService.getSettings().backup.backupFrequency,
    };
  }
}

export default BackupService;