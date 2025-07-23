import DatabaseService, { type InventoryItem, type StockTransaction } from '@/lib/database';

class InventoryService {
  private static isInitialized = false;

  // Initialize database through the unified service
  async initializeDatabase(): Promise<void> {
    await DatabaseService.initializeDatabase();
    InventoryService.isInitialized = true;
  }

  async addItem(item: Omit<InventoryItem, "id" | "created_at" | "updated_at" | "total_sold">): Promise<InventoryItem> {
    try {
      const result = await DatabaseService.addInventoryItem(item);
      
      // Check if the new item triggers low stock alert
      if (item.quantity <= item.min_stock_level) {
        this.triggerLowStockNotification();
      }

      return result;
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  }

  async getAllItems(): Promise<InventoryItem[]> {
    return DatabaseService.getAllInventoryItems();
  }

  async getItemById(id: number): Promise<InventoryItem | null> {
    return DatabaseService.getInventoryItemById(id);
  }

  async updateStock(itemId: number, newQuantity: number, notes?: string): Promise<void> {
    try {
      // Get current item to check for low stock after update
      const currentItem = await this.getItemById(itemId);
      if (!currentItem) throw new Error("Item not found");

      await DatabaseService.updateInventoryStock(itemId, newQuantity, notes);

      // Check if this update triggers low stock alert
      if (newQuantity <= currentItem.min_stock_level) {
        this.triggerLowStockNotification();
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  async recordSale(itemId: number, quantitySold: number, unitPrice?: number, notes?: string): Promise<void> {
    try {
      const currentItem = await this.getItemById(itemId);
      if (!currentItem) throw new Error("Item not found");

      if (currentItem.quantity < quantitySold) {
        throw new Error("Insufficient stock for sale");
      }

      const salePrice = unitPrice || currentItem.selling_price;
      const totalAmount = salePrice * quantitySold;
      const newQuantity = currentItem.quantity - quantitySold;

      await DatabaseService.recordSale(itemId, quantitySold, unitPrice, notes);

      // Send sales notification
      this.triggerSalesNotification(currentItem.name, quantitySold, totalAmount);

      // Check if this sale triggers low stock alert
      if (newQuantity <= currentItem.min_stock_level) {
        this.triggerLowStockNotification();
      }
    } catch (error) {
      console.error('Error recording sale:', error);
      throw error;
    }
  }

  async deleteItem(id: number): Promise<void> {
    return DatabaseService.deleteInventoryItem(id);
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return DatabaseService.getLowStockItems();
  }

  async getStockTransactions(itemId?: number): Promise<StockTransaction[]> {
    return DatabaseService.getStockTransactions(itemId);
  }

  async getTotalStockValue(): Promise<number> {
    return DatabaseService.getTotalStockValue();
  }

  async getTotalRevenue(): Promise<number> {
    return DatabaseService.getTotalRevenue();
  }

  async getTotalProfit(): Promise<number> {
    return DatabaseService.getTotalProfit();
  }

  async getSalesData(): Promise<{ totalSold: number; totalRevenue: number; totalProfit: number }> {
    return DatabaseService.getSalesData();
  }

  async getSalesDataByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalSold: number; totalRevenue: number; totalProfit: number }> {
    return DatabaseService.getSalesDataByDateRange(startDate, endDate);
  }

  async getItemsCreatedInPeriod(startDate: Date, endDate: Date): Promise<number> {
    const stats = await DatabaseService.getMainStatsForPeriod(startDate, endDate);
    return stats.totalItems;
  }

  async getStockMovementsInPeriod(startDate: Date, endDate: Date): Promise<{ stockIn: number; stockOut: number }> {
    // This is calculated within getMainStatsForPeriod, but we can extract it if needed
    const db = DatabaseService.getDatabase();
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    const stockIn = (await db.getFirstAsync(
      "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'in' AND created_at BETWEEN ? AND ?",
      [startDateStr, endDateStr],
    )) as { total: number };

    const stockOut = (await db.getFirstAsync(
      "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'out' AND created_at BETWEEN ? AND ?",
      [startDateStr, endDateStr],
    )) as { total: number };

    return {
      stockIn: stockIn.total || 0,
      stockOut: stockOut.total || 0,
    };
  }

  async getStockValueChangesInPeriod(startDate: Date, endDate: Date): Promise<number> {
    const stats = await DatabaseService.getMainStatsForPeriod(startDate, endDate);
    return stats.totalValue;
  }

  async getMainStatsForPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalItems: number; lowStockCount: number; totalValue: number }> {
    return DatabaseService.getMainStatsForPeriod(startDate, endDate);
  }

  async resetDatabase(): Promise<void> {
    try {
      await DatabaseService.resetDatabase();
      InventoryService.isInitialized = false;
      await this.initializeDatabase();
      console.log("Inventory database reset successfully");
    } catch (error) {
      console.error('Error resetting inventory database:', error);
      throw error;
    }
  }

  // Check if database is ready
  isReady(): boolean {
    return InventoryService.isInitialized && DatabaseService.isReady();
  }

  // Helper methods to trigger notifications
  private triggerLowStockNotification() {
    // Import notification service dynamically to avoid circular dependency
    setTimeout(async () => {
      try {
        const NotificationService = require('./notificationService').default;
        const notificationService = NotificationService.getInstance();
        await notificationService.checkLowStockAlerts(this);
      } catch (error) {
        console.warn('Failed to trigger low stock notification:', error);
      }
    }, 100);
  }

  private triggerSalesNotification(itemName: string, quantity: number, revenue: number) {
    // Import notification service dynamically to avoid circular dependency
    setTimeout(async () => {
      try {
        const NotificationService = require('./notificationService').default;
        const notificationService = NotificationService.getInstance();
        await notificationService.sendSalesNotification(itemName, quantity, revenue);
      } catch (error) {
        console.warn('Failed to trigger sales notification:', error);
      }
    }, 100);
  }
}

export default new InventoryService();
export type { InventoryItem, StockTransaction };