// lib/database.ts
import * as SQLite from 'expo-sqlite';

// Open database connection using the new API
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
      console.log('Initializing database...');
      
      // Wait for database to be ready
      await this.waitForDatabase();

      // Create tables with proper error handling
      await this.createTables();

      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      this.initializationPromise = null; // Reset so initialization can be retried
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private static async createTables(): Promise<void> {
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

    // Create products/inventory table
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

    // Create categories table (for future use)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execAsync(`
  INSERT OR IGNORE INTO users (username, email, password)
  VALUES ('Owner', 'owner@stockbox.local', 'stockbox123')
`);
  }

  // Initialize all database tables (public method)
  static async initializeDatabase(): Promise<void> {
    return this.ensureInitialized();
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

  // PRODUCT/INVENTORY OPERATIONS
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

  static async getProductById(id: number): Promise<Product | null> {
    return this.executeWithRetry(async () => {
      const result = await db.getFirstAsync<Product>(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      
      return result || null;
    }, 'getProductById');
  }

  static async updateProduct(id: number, updates: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<void> {
    return this.executeWithRetry(async () => {
      const fields: string[] = [];
      const values: any[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at' && value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return;
      }

      // Add updated_at timestamp
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      await db.runAsync(
        `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }, 'updateProduct');
  }

  static async deleteProduct(id: number): Promise<void> {
    return this.executeWithRetry(async () => {
      await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    }, 'deleteProduct');
  }

  static async searchProducts(searchTerm: string): Promise<Product[]> {
    return this.executeWithRetry(async () => {
      const result = await db.getAllAsync<Product>(
        'SELECT * FROM products WHERE name LIKE ? OR description LIKE ? OR category LIKE ? ORDER BY name ASC',
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
      );
      
      return result;
    }, 'searchProducts');
  }

  static async getProductsByCategory(category: string): Promise<Product[]> {
    return this.executeWithRetry(async () => {
      const result = await db.getAllAsync<Product>(
        'SELECT * FROM products WHERE category = ? ORDER BY name ASC',
        [category]
      );
      
      return result;
    }, 'getProductsByCategory');
  }

  static async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
    return this.executeWithRetry(async () => {
      const result = await db.getAllAsync<Product>(
        'SELECT * FROM products WHERE quantity <= ? ORDER BY quantity ASC',
        [threshold]
      );
      
      return result;
    }, 'getLowStockProducts');
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
        'SELECT COUNT(*) as count FROM products'
      );
      
      // Get total value
      const valueResult = await db.getFirstAsync<{ total: number }>(
        'SELECT SUM(quantity * price) as total FROM products'
      );
      
      // Get low stock count (threshold: 10)
      const lowStockResult = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM products WHERE quantity <= 10'
      );
      
      // Get unique categories
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
      await db.execAsync('DROP TABLE IF EXISTS users');
      await db.execAsync('DROP TABLE IF EXISTS products');
      await db.execAsync('DROP TABLE IF EXISTS categories');
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