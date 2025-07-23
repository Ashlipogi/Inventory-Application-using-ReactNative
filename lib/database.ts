// lib/database.ts
import * as SQLite from 'expo-sqlite';

// Open database connection using the new API - single instance
const db = SQLite.openDatabaseSync('inventory.db');

export interface User {
  id?: number;
  username: string;
  email: string;
  password: string;
  created_at?: string;
}

export interface Product {
  id?: number;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id?: number;
  name: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  min_stock_level: number;
  total_sold?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StockTransaction {
  id?: number;
  item_id: number;
  type: "in" | "out" | "sold";
  quantity: number;
  unit_price?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

class DatabaseService {
  private static isInitialized = false;
  private static initializationPromise: Promise<void> | null = null;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 100;

  // Wait for database to be ready with retry logic
  private static async waitForDatabase(): Promise<void> {
    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        // Test database connection with a simple query
        await db.getFirstAsync('SELECT 1 as test');
        return;
      } catch (error) {
        retries++;
        if (retries >= this.MAX_RETRIES) {
          console.error('Database connection failed after retries:', error);
          throw new Error(`Database connection failed: ${error}`);
        }
        console.warn(`Database connection attempt ${retries} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retries));
      }
    }
  }

  // Execute database operation with retry logic
  private static async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    await this.ensureInitialized();
    
    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        return await operation();
      } catch (error: any) {
        retries++;
        const isNullPointerError = error?.message?.includes('NullPointerException') || 
                                  error?.message?.includes('has been rejected');
        
        if (isNullPointerError && retries < this.MAX_RETRIES) {
          console.warn(`${operationName} failed (attempt ${retries}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retries));
          continue;
        }
        
        console.error(`${operationName} failed:`, error);
        throw error;
      }
    }
    
    throw new Error(`${operationName} failed after ${this.MAX_RETRIES} attempts`);
  }

  // Ensure database is initialized (singleton pattern)
  private static async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private static async performInitialization(): Promise<void> {
    try {
      console.log('Initializing unified database...');
      
      // Wait for database to be ready
      await this.waitForDatabase();

      // Create all tables with proper error handling
      await this.createAllTables();

      this.isInitialized = true;
      console.log('Unified database initialized successfully');
    } catch (error) {
      this.initializationPromise = null; // Reset so initialization can be retried
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private static async createAllTables(): Promise<void> {
    // Create users table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create legacy products table (for compatibility)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        quantity INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL DEFAULT 0,
        category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create inventory items table (main inventory system)
    await db.execAsync(`
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
    `);

    // Check if stock_transactions table exists and has the correct constraint
    const tableInfo = (await db.getAllAsync(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='stock_transactions'
    `)) as Array<{ sql: string }>;

    let needsTableRecreation = false;

    if (tableInfo.length > 0) {
      const tableSql = tableInfo[0].sql;
      // Check if the constraint includes 'sold'
      if (!tableSql.includes("'sold'")) {
        needsTableRecreation = true;
      }
    }

    if (needsTableRecreation) {
      // Backup existing data
      const existingTransactions = await db.getAllAsync(`
        SELECT * FROM stock_transactions
      `);

      // Drop and recreate the table with correct constraint
      await db.execAsync(`DROP TABLE IF EXISTS stock_transactions`);

      await db.execAsync(`
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
      `);

      // Restore existing data
      for (const transaction of existingTransactions as any[]) {
        await db.runAsync(
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
        );
      }
    } else {
      // Create stock transactions table if it doesn't exist
      await db.execAsync(`
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
      `);
    }

    // Create categories table (for future use)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create trigger to update updated_at timestamp
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS update_inventory_timestamp 
      AFTER UPDATE ON inventory_items
      BEGIN
        UPDATE inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    // Add total_sold column if it doesn't exist (for existing databases)
    try {
      await db.execAsync(`ALTER TABLE inventory_items ADD COLUMN total_sold INTEGER NOT NULL DEFAULT 0;`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Insert default user if not exists
    await db.execAsync(`
      INSERT OR IGNORE INTO users (username, email, password)
      VALUES ('Owner', 'owner@stockbox.local', 'stockbox123')
    `);
  }

  // Initialize all database tables (public method)
  static async initializeDatabase(): Promise<void> {
    return this.ensureInitialized();
  }

  // Get shared database instance
  static getDatabaseInstance(): SQLite.SQLiteDatabase {
    return db;
  }

  // USER OPERATIONS
  static async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    return this.executeWithRetry(async () => {
      const result = await db.runAsync(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [user.username.toLowerCase(), user.email, user.password]
      );

      return {
        id: result.lastInsertRowId,
        ...user,
        created_at: new Date().toISOString()
      };
    }, 'createUser');
  }

  static async getUserByUsernameAndPassword(username: string, password: string): Promise<User | null> {
    return this.executeWithRetry(async () => {
      const result = await db.getFirstAsync<User>(
        'SELECT * FROM users WHERE LOWER(username) = ? AND password = ?',
        [username.toLowerCase(), password]
      );
      
      return result || null;
    }, 'getUserByUsernameAndPassword');
  }

  static async getAllUsers(): Promise<User[]> {
    return this.executeWithRetry(async () => {
      const result = await db.getAllAsync<User>(
        'SELECT * FROM users ORDER BY created_at DESC'
      );
      
      return result;
    }, 'getAllUsers');
  }

  static async getUserById(id: number): Promise<User | null> {
    return this.executeWithRetry(async () => {
      const result = await db.getFirstAsync<User>(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      return result || null;
    }, 'getUserById');
  }

  // INVENTORY OPERATIONS (Unified approach)
  static async addInventoryItem(item: Omit<InventoryItem, "id" | "created_at" | "updated_at" | "total_sold">): Promise<InventoryItem> {
    return this.executeWithRetry(async () => {
      const result = await db.runAsync(
        `INSERT INTO inventory_items (name, cost_price, selling_price, quantity, min_stock_level, total_sold)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [item.name, item.cost_price, item.selling_price, item.quantity, item.min_stock_level],
      );

      // Log initial stock as a transaction
      if (item.quantity > 0) {
        await db.runAsync(
          `INSERT INTO stock_transactions (item_id, type, quantity, notes)
           VALUES (?, 'in', ?, 'Initial stock')`,
          [result.lastInsertRowId, item.quantity],
        );
      }

      return { ...item, id: result.lastInsertRowId, total_sold: 0 };
    }, 'addInventoryItem');
  }

  static async getAllInventoryItems(): Promise<InventoryItem[]> {
    return this.executeWithRetry(async () => {
      const result = await db.getAllAsync("SELECT * FROM inventory_items ORDER BY name ASC");
      return result as InventoryItem[];
    }, 'getAllInventoryItems');
  }

  static async getInventoryItemById(id: number): Promise<InventoryItem | null> {
    return this.executeWithRetry(async () => {
      const result = await db.getFirstAsync("SELECT * FROM inventory_items WHERE id = ?", [id]);
      return result as InventoryItem | null;
    }, 'getInventoryItemById');
  }

  static async updateInventoryStock(itemId: number, newQuantity: number, notes?: string): Promise<void> {
    return this.executeWithRetry(async () => {
      // Get current quantity to determine transaction type and amount
      const currentItem = await this.getInventoryItemById(itemId);
      if (!currentItem) throw new Error("Item not found");

      const difference = newQuantity - currentItem.quantity;
      const transactionType: "in" | "out" = difference > 0 ? "in" : "out";
      const transactionQuantity = Math.abs(difference);

      // Update the item quantity
      await db.runAsync("UPDATE inventory_items SET quantity = ? WHERE id = ?", [newQuantity, itemId]);

      // Log the transaction
      if (difference !== 0) {
        await db.runAsync(
          `INSERT INTO stock_transactions (item_id, type, quantity, notes)
           VALUES (?, ?, ?, ?)`,
          [itemId, transactionType, transactionQuantity, notes || ""],
        );
      }
    }, 'updateInventoryStock');
  }

  static async recordSale(itemId: number, quantitySold: number, unitPrice?: number, notes?: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const currentItem = await this.getInventoryItemById(itemId);
      if (!currentItem) throw new Error("Item not found");

      if (currentItem.quantity < quantitySold) {
        throw new Error("Insufficient stock for sale");
      }

      const salePrice = unitPrice || currentItem.selling_price;
      const totalAmount = salePrice * quantitySold;
      const newQuantity = currentItem.quantity - quantitySold;
      const newTotalSold = (currentItem.total_sold || 0) + quantitySold;

      // Update item quantity and total sold
      await db.runAsync("UPDATE inventory_items SET quantity = ?, total_sold = ? WHERE id = ?", [
        newQuantity,
        newTotalSold,
        itemId,
      ]);

      // Log the sale transaction
      await db.runAsync(
        `INSERT INTO stock_transactions (item_id, type, quantity, unit_price, total_amount, notes)
         VALUES (?, 'sold', ?, ?, ?, ?)`,
        [itemId, quantitySold, salePrice, totalAmount, notes || "Sale transaction"],
      );
    }, 'recordSale');
  }

  static async deleteInventoryItem(id: number): Promise<void> {
    return this.executeWithRetry(async () => {
      await db.runAsync("DELETE FROM inventory_items WHERE id = ?", [id]);
    }, 'deleteInventoryItem');
  }

  static async getLowStockItems(): Promise<InventoryItem[]> {
    return this.executeWithRetry(async () => {
      const result = await db.getAllAsync(
        "SELECT * FROM inventory_items WHERE quantity <= min_stock_level ORDER BY name ASC",
      );
      return result as InventoryItem[];
    }, 'getLowStockItems');
  }

  static async getStockTransactions(itemId?: number): Promise<StockTransaction[]> {
    return this.executeWithRetry(async () => {
      let query = `
        SELECT st.*, ii.name as item_name 
        FROM stock_transactions st 
        JOIN inventory_items ii ON st.item_id = ii.id
      `;
      const params: any[] = [];

      if (itemId) {
        query += " WHERE st.item_id = ?";
        params.push(itemId);
      }

      query += " ORDER BY st.created_at DESC";

      const result = await db.getAllAsync(query, params);
      return result as StockTransaction[];
    }, 'getStockTransactions');
  }

  static async getTotalStockValue(): Promise<number> {
    return this.executeWithRetry(async () => {
      const result = (await db.getFirstAsync(
        "SELECT SUM(cost_price * quantity) as total_value FROM inventory_items",
      )) as { total_value: number };
      return result.total_value || 0;
    }, 'getTotalStockValue');
  }

  static async getTotalRevenue(): Promise<number> {
    return this.executeWithRetry(async () => {
      const result = (await db.getFirstAsync(
        "SELECT SUM(total_amount) as total_revenue FROM stock_transactions WHERE type = 'sold'",
      )) as { total_revenue: number };
      return result.total_revenue || 0;
    }, 'getTotalRevenue');
  }

  static async getTotalProfit(): Promise<number> {
    return this.executeWithRetry(async () => {
      const result = (await db.getFirstAsync(`
        SELECT SUM((st.unit_price - ii.cost_price) * st.quantity) as total_profit
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'sold'
      `)) as { total_profit: number };
      return result.total_profit || 0;
    }, 'getTotalProfit');
  }

  static async getSalesData(): Promise<{ totalSold: number; totalRevenue: number; totalProfit: number }> {
    return this.executeWithRetry(async () => {
      const totalSold = (await db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'sold'",
      )) as { total: number };

      const totalRevenue = await this.getTotalRevenue();
      const totalProfit = await this.getTotalProfit();

      return {
        totalSold: totalSold.total || 0,
        totalRevenue,
        totalProfit,
      };
    }, 'getSalesData');
  }

  static async getSalesDataByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalSold: number; totalRevenue: number; totalProfit: number }> {
    return this.executeWithRetry(async () => {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      const totalSold = (await db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'sold' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total: number };

      const totalRevenue = (await db.getFirstAsync(
        "SELECT SUM(total_amount) as total_revenue FROM stock_transactions WHERE type = 'sold' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total_revenue: number };

      const totalProfit = (await db.getFirstAsync(
        `
        SELECT SUM((st.unit_price - ii.cost_price) * st.quantity) as total_profit
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'sold' AND st.created_at BETWEEN ? AND ?
      `,
        [startDateStr, endDateStr],
      )) as { total_profit: number };

      return {
        totalSold: totalSold.total || 0,
        totalRevenue: totalRevenue.total_revenue || 0,
        totalProfit: totalProfit.total_profit || 0,
      };
    }, 'getSalesDataByDateRange');
  }

  static async getMainStatsForPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalItems: number; lowStockCount: number; totalValue: number }> {
    return this.executeWithRetry(async () => {
      // For "all" filter, return current state
      const isAllTime = startDate.getTime() <= new Date("1970-01-01").getTime();

      if (isAllTime) {
        const allItems = await this.getAllInventoryItems();
        const lowStockItems = await this.getLowStockItems();
        const stockValue = await this.getTotalStockValue();

        return {
          totalItems: allItems.length,
          lowStockCount: lowStockItems.length,
          totalValue: stockValue,
        };
      }

      // For specific periods, show relevant filtered data
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      const itemsCreated = (await db.getFirstAsync(
        "SELECT COUNT(*) as count FROM inventory_items WHERE created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { count: number };

      const stockIn = (await db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'in' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total: number };

      const stockOut = (await db.getFirstAsync(
        "SELECT SUM(quantity) as total FROM stock_transactions WHERE type = 'out' AND created_at BETWEEN ? AND ?",
        [startDateStr, endDateStr],
      )) as { total: number };

      const stockInValue = (await db.getFirstAsync(
        `
        SELECT SUM(st.quantity * ii.cost_price) as total_value
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'in' AND st.created_at BETWEEN ? AND ?
      `,
        [startDateStr, endDateStr],
      )) as { total_value: number };

      const stockOutValue = (await db.getFirstAsync(
        `
        SELECT SUM(st.quantity * ii.cost_price) as total_value
        FROM stock_transactions st
        JOIN inventory_items ii ON st.item_id = ii.id
        WHERE st.type = 'out' AND st.created_at BETWEEN ? AND ?
      `,
        [startDateStr, endDateStr],
      )) as { total_value: number };

      const netStockMovement = (stockIn.total || 0) - (stockOut.total || 0);
      const valueChanges = (stockInValue.total_value || 0) - (stockOutValue.total_value || 0);

      return {
        totalItems: itemsCreated.count || 0,
        lowStockCount: netStockMovement,
        totalValue: valueChanges,
      };
    }, 'getMainStatsForPeriod');
  }

  // LEGACY PRODUCT OPERATIONS (for compatibility)
  static async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    return this.executeWithRetry(async () => {
      const result = await db.runAsync(
        'INSERT INTO products (name, description, quantity, price, category) VALUES (?, ?, ?, ?, ?)',
        [product.name, product.description || '', product.quantity, product.price, product.category || '']
      );

      return {
        id: result.lastInsertRowId,
        ...product,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }, 'createProduct');
  }

  static async getAllProducts(): Promise<Product[]> {
    return this.executeWithRetry(async () => {
      const result = await db.getAllAsync<Product>(
        'SELECT * FROM products ORDER BY name ASC'
      );
      
      return result;
    }, 'getAllProducts');
  }

  // INVENTORY STATS
  static async getInventoryStats(): Promise<{
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    categories: string[];
  }> {
    return this.executeWithRetry(async () => {
      // Get total products
      const totalResult = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM inventory_items'
      );
      
      // Get total value
      const valueResult = await db.getFirstAsync<{ total: number }>(
        'SELECT SUM(quantity * cost_price) as total FROM inventory_items'
      );
      
      // Get low stock count
      const lowStockResult = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM inventory_items WHERE quantity <= min_stock_level'
      );
      
      // Get unique categories (from legacy products table)
      const categoriesResult = await db.getAllAsync<{ category: string }>(
        'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != "" ORDER BY category'
      );

      return {
        totalProducts: totalResult?.count || 0,
        totalValue: valueResult?.total || 0,
        lowStockCount: lowStockResult?.count || 0,
        categories: categoriesResult.map(item => item.category)
      };
    }, 'getInventoryStats');
  }

  // UTILITY OPERATIONS
  static async dropAllTables(): Promise<void> {
    return this.executeWithRetry(async () => {
      await db.execAsync('DROP TABLE IF EXISTS stock_transactions');
      await db.execAsync('DROP TABLE IF EXISTS inventory_items');
      await db.execAsync('DROP TABLE IF EXISTS users');
      await db.execAsync('DROP TABLE IF EXISTS products');
      await db.execAsync('DROP TABLE IF EXISTS categories');
      await db.execAsync('DROP TRIGGER IF EXISTS update_inventory_timestamp');
    }, 'dropAllTables');
  }

  static async resetDatabase(): Promise<void> {
    try {
      await this.dropAllTables();
      this.isInitialized = false;
      this.initializationPromise = null;
      await this.initializeDatabase();
      console.log('Database reset successfully');
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }

  // Get database instance for advanced operations
  static getDatabase() {
    return db;
  }

  // Check if database is ready
  static isReady(): boolean {
    return this.isInitialized;
  }
}

export default DatabaseService;