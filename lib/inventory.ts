import * as SQLite from "expo-sqlite"

export interface InventoryItem {
  id?: number
  name: string
  cost_price: number
  selling_price: number
  quantity: number
  min_stock_level: number
  total_sold?: number
  created_at?: string
  updated_at?: string
}

export interface StockTransaction {
  id?: number
  item_id: number
  type: "in" | "out" | "sold"
  quantity: number
  unit_price?: number // For sales transactions
  total_amount?: number // For sales transactions
  notes?: string
  created_at?: string
}

class InventoryService {
  private db: SQLite.SQLiteDatabase | null = null

  async initializeDatabase() {
    try {
      this.db = await SQLite.openDatabaseAsync("inventory.db")

      // Create inventory items table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS inventory_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          cost_price REAL NOT NULL,
          selling_price REAL NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          min_stock_level INTEGER NOT NULL DEFAULT 0,
          total_sold INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)

      // Check if stock_transactions table exists and has the correct constraint
      const tableInfo = (await this.db.getAllAsync(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='stock_transactions'
      `)) as Array<{ sql: string }>

      let needsTableRecreation = false

      if (tableInfo.length > 0) {
        const tableSql = tableInfo[0].sql
        // Check if the constraint includes 'sold'
        if (!tableSql.includes("'sold'")) {
          needsTableRecreation = true
        }
      }

      if (needsTableRecreation) {
        // Backup existing data
        const existingTransactions = await this.db.getAllAsync(`
          SELECT * FROM stock_transactions
        `)

        // Drop and recreate the table with correct constraint
        await this.db.execAsync(`DROP TABLE IF EXISTS stock_transactions`)

        await this.db.execAsync(`
          CREATE TABLE stock_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('in', 'out', 'sold')),
            quantity INTEGER NOT NULL,
            unit_price REAL,
            total_amount REAL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE CASCADE
          );
        `)

        // Restore existing data
        for (const transaction of existingTransactions as any[]) {
          await this.db.runAsync(
            `
            INSERT INTO stock_transactions 
            (id, item_id, type, quantity, unit_price, total_amount, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              (transaction as any).id,
              (transaction as any).item_id,
              (transaction as any).type,
              (transaction as any).quantity,
              (transaction as any).unit_price,
              (transaction as any).total_amount,
              (transaction as any).notes,
              (transaction as any).created_at,
            ],
          )
        }
      } else {
        // Create stock transactions table if it doesn't exist
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS stock_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('in', 'out', 'sold')),
            quantity INTEGER NOT NULL,
            unit_price REAL,
            total_amount REAL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE CASCADE
          );
        `)
      }

      // Create trigger to update updated_at timestamp
      await this.db.execAsync(`
        CREATE TRIGGER IF NOT EXISTS update_inventory_timestamp 
        AFTER UPDATE ON inventory_items
        BEGIN
          UPDATE inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `)

      // Add total_sold column if it doesn't exist (for existing databases)
      try {
        await this.db.execAsync(`ALTER TABLE inventory_items ADD COLUMN total_sold INTEGER NOT NULL DEFAULT 0;`)
      } catch (error) {
        // Column already exists, ignore error
      }

      console.log("Inventory database initialized successfully")
    } catch (error) {
      console.error("Error initializing inventory database:", error)
      throw error
    }
  }

  async addItem(item: Omit<InventoryItem, "id" | "created_at" | "updated_at" | "total_sold">): Promise<InventoryItem> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const result = await this.db.runAsync(
        `INSERT INTO inventory_items (name, cost_price, selling_price, quantity, min_stock_level, total_sold)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [item.name, item.cost_price, item.selling_price, item.quantity, item.min_stock_level],
      )

      // Log initial stock as a transaction
      if (item.quantity > 0) {
        await this.db.runAsync(
          `INSERT INTO stock_transactions (item_id, type, quantity, notes)
           VALUES (?, 'in', ?, 'Initial stock')`,
          [result.lastInsertRowId, item.quantity],
        )
      }

      return { ...item, id: result.lastInsertRowId, total_sold: 0 }
    } catch (error) {
      console.error("Error adding inventory item:", error)
      throw error
    }
  }

  async getAllItems(): Promise<InventoryItem[]> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const result = await this.db.getAllAsync("SELECT * FROM inventory_items ORDER BY name ASC")
      return result as InventoryItem[]
    } catch (error) {
      console.error("Error getting inventory items:", error)
      throw error
    }
  }

  async getItemById(id: number): Promise<InventoryItem | null> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const result = await this.db.getFirstAsync("SELECT * FROM inventory_items WHERE id = ?", [id])
      return result as InventoryItem | null
    } catch (error) {
      console.error("Error getting inventory item:", error)
      throw error
    }
  }

  async updateStock(itemId: number, newQuantity: number, notes?: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      // Get current quantity to determine transaction type and amount
      const currentItem = await this.getItemById(itemId)
      if (!currentItem) throw new Error("Item not found")

      const difference = newQuantity - currentItem.quantity
      const transactionType: "in" | "out" = difference > 0 ? "in" : "out"
      const transactionQuantity = Math.abs(difference)

      // Update the item quantity
      await this.db.runAsync("UPDATE inventory_items SET quantity = ? WHERE id = ?", [newQuantity, itemId])

      // Log the transaction
      if (difference !== 0) {
        await this.db.runAsync(
          `INSERT INTO stock_transactions (item_id, type, quantity, notes)
           VALUES (?, ?, ?, ?)`,
          [itemId, transactionType, transactionQuantity, notes || ""],
        )
      }
    } catch (error) {
      console.error("Error updating stock:", error)
      throw error
    }
  }

  async recordSale(itemId: number, quantitySold: number, unitPrice?: number, notes?: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const currentItem = await this.getItemById(itemId)
      if (!currentItem) throw new Error("Item not found")

      if (currentItem.quantity < quantitySold) {
        throw new Error("Insufficient stock for sale")
      }

      const salePrice = unitPrice || currentItem.selling_price
      const totalAmount = salePrice * quantitySold
      const newQuantity = currentItem.quantity - quantitySold
      const newTotalSold = (currentItem.total_sold || 0) + quantitySold

      // Update item quantity and total sold
      await this.db.runAsync("UPDATE inventory_items SET quantity = ?, total_sold = ? WHERE id = ?", [
        newQuantity,
        newTotalSold,
        itemId,
      ])

      // Log the sale transaction
      await this.db.runAsync(
        `INSERT INTO stock_transactions (item_id, type, quantity, unit_price, total_amount, notes)
         VALUES (?, 'sold', ?, ?, ?, ?)`,
        [itemId, quantitySold, salePrice, totalAmount, notes || "Sale transaction"],
      )
    } catch (error) {
      console.error("Error recording sale:", error)
      throw error
    }
  }

  async deleteItem(id: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      await this.db.runAsync("DELETE FROM inventory_items WHERE id = ?", [id])
    } catch (error) {
      console.error("Error deleting inventory item:", error)
      throw error
    }
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const result = await this.db.getAllAsync(
        "SELECT * FROM inventory_items WHERE quantity <= min_stock_level ORDER BY name ASC",
      )
      return result as InventoryItem[]
    } catch (error) {
      console.error("Error getting low stock items:", error)
      throw error
    }
  }

  async getStockTransactions(itemId?: number): Promise<StockTransaction[]> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      let query = `
        SELECT st.*, ii.name as item_name 
        FROM stock_transactions st 
        JOIN inventory_items ii ON st.item_id = ii.id
      `
      const params: any[] = []

      if (itemId) {
        query += " WHERE st.item_id = ?"
        params.push(itemId)
      }

      query += " ORDER BY st.created_at DESC"

      const result = await this.db.getAllAsync(query, params)
      return result as StockTransaction[]
    } catch (error) {
      console.error("Error getting stock transactions:", error)
      throw error
    }
  }

  async getTotalStockValue(): Promise<number> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const result = (await this.db.getFirstAsync(
        "SELECT SUM(cost_price * quantity) as total_value FROM inventory_items",
      )) as { total_value: number }
      return result.total_value || 0
    } catch (error) {
      console.error("Error calculating total stock value:", error)
      throw error
    }
  }

  async getTotalRevenue(): Promise<number> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const result = (await this.db.getFirstAsync(
        "SELECT SUM(total_amount) as total_revenue FROM stock_transactions WHERE type = 'sold'",
      )) as { total_revenue: number }
      return result.total_revenue || 0
    } catch (error) {
      console.error("Error calculating total revenue:", error)
      throw error
    }
  }

  async getTotalProfit(): Promise<number> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const result = (await this.db.getFirstAsync(`
        SELECT SUM((st.unit_price - ii.cost_price) * st.quantity) as total_profit
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'sold'
      `)) as { total_profit: number }
      return result.total_profit || 0
    } catch (error) {
      console.error("Error calculating total profit:", error)
      throw error
    }
  }

  async getSalesData(): Promise<{ totalSold: number; totalRevenue: number; totalProfit: number }> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const totalSold = (await this.db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'sold'",
      )) as { total: number }

      const totalRevenue = await this.getTotalRevenue()
      const totalProfit = await this.getTotalProfit()

      return {
        totalSold: totalSold.total || 0,
        totalRevenue,
        totalProfit,
      }
    } catch (error) {
      console.error("Error getting sales data:", error)
      throw error
    }
  }

  // New method for filtered sales data by date range
  async getSalesDataByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalSold: number; totalRevenue: number; totalProfit: number }> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const startDateStr = startDate.toISOString()
      const endDateStr = endDate.toISOString()

      const totalSold = (await this.db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'sold' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total: number }

      const totalRevenue = (await this.db.getFirstAsync(
        "SELECT SUM(total_amount) as total_revenue FROM stock_transactions WHERE type = 'sold' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total_revenue: number }

      const totalProfit = (await this.db.getFirstAsync(
        `
        SELECT SUM((st.unit_price - ii.cost_price) * st.quantity) as total_profit
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'sold' AND st.created_at BETWEEN ? AND ?
      `,
        [startDateStr, endDateStr],
      )) as { total_profit: number }

      return {
        totalSold: totalSold.total || 0,
        totalRevenue: totalRevenue.total_revenue || 0,
        totalProfit: totalProfit.total_profit || 0,
      }
    } catch (error) {
      console.error("Error getting filtered sales data:", error)
      throw error
    }
  }

  // New methods for filtered main stats
  async getItemsCreatedInPeriod(startDate: Date, endDate: Date): Promise<number> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const startDateStr = startDate.toISOString()
      const endDateStr = endDate.toISOString()

      const result = (await this.db.getFirstAsync(
        "SELECT COUNT(*) as count FROM inventory_items WHERE created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { count: number }

      return result.count || 0
    } catch (error) {
      console.error("Error getting items created in period:", error)
      throw error
    }
  }

  async getStockMovementsInPeriod(startDate: Date, endDate: Date): Promise<{ stockIn: number; stockOut: number }> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const startDateStr = startDate.toISOString()
      const endDateStr = endDate.toISOString()

      const stockIn = (await this.db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'in' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total: number }

      const stockOut = (await this.db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'out' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total: number }

      return {
        stockIn: stockIn.total || 0,
        stockOut: stockOut.total || 0,
      }
    } catch (error) {
      console.error("Error getting stock movements in period:", error)
      throw error
    }
  }

  async getStockValueChangesInPeriod(startDate: Date, endDate: Date): Promise<number> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const startDateStr = startDate.toISOString()
      const endDateStr = endDate.toISOString()

      // Calculate value of stock movements (in - out) in the period
      const stockInValue = (await this.db.getFirstAsync(
        `
        SELECT SUM(st.quantity * ii.cost_price) as total_value
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'in' AND st.created_at BETWEEN ? AND ?
      `,
        [startDateStr, endDateStr],
      )) as { total_value: number }

      const stockOutValue = (await this.db.getFirstAsync(
        `
        SELECT SUM(st.quantity * ii.cost_price) as total_value
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'out' AND st.created_at BETWEEN ? AND ?
      `,
        [startDateStr, endDateStr],
      )) as { total_value: number }

      return (stockInValue.total_value || 0) - (stockOutValue.total_value || 0)
    } catch (error) {
      console.error("Error getting stock value changes in period:", error)
      throw error
    }
  }

  async getMainStatsForPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalItems: number; lowStockCount: number; totalValue: number }> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      // For "all" filter, return current state
      const isAllTime = startDate.getTime() <= new Date("1970-01-01").getTime()

      if (isAllTime) {
        const allItems = await this.getAllItems()
        const lowStockItems = await this.getLowStockItems()
        const stockValue = await this.getTotalStockValue()

        return {
          totalItems: allItems.length,
          lowStockCount: lowStockItems.length,
          totalValue: stockValue,
        }
      }

      // For specific periods, show relevant filtered data
      const itemsCreated = await this.getItemsCreatedInPeriod(startDate, endDate)
      const stockMovements = await this.getStockMovementsInPeriod(startDate, endDate)
      const valueChanges = await this.getStockValueChangesInPeriod(startDate, endDate)

      // For filtered periods, show net stock movement and value changes
      const netStockMovement = stockMovements.stockIn - stockMovements.stockOut

      return {
        totalItems: itemsCreated, // Items created in period
        lowStockCount: netStockMovement, // Net stock movement (can be negative)
        totalValue: valueChanges, // Value changes in period
      }
    } catch (error) {
      console.error("Error getting main stats for period:", error)
      throw error
    }
  }

  // Add method to reset database if needed
  async resetDatabase(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      await this.db.execAsync(`DROP TABLE IF EXISTS stock_transactions`)
      await this.db.execAsync(`DROP TABLE IF EXISTS inventory_items`)
      await this.initializeDatabase()
      console.log("Database reset successfully")
    } catch (error) {
      console.error("Error resetting database:", error)
      throw error
    }
  }
}

export default new InventoryService()