import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { logger } from './logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DB_PATH = path.join(app.getPath('userData'), 'pos.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  try {
    const database = getDatabase();
    
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      logger.info('Creating new database...');
      await initializeSchema(database);
      logger.info(`Database created at: ${DB_PATH}`);
    } else {
      logger.info('Database already exists at:', DB_PATH);
      await runMigrations(database);
    }

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

async function initializeSchema(db: Database.Database): Promise<void> {
  // Create tables
  db.exec(`
    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sync metadata
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      last_sync_at DATETIME,
      sync_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type)
    );

    -- Local products (mirrors backend Product)
    CREATE TABLE IF NOT EXISTS local_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT,
      unit_price REAL NOT NULL,
      cost_price REAL,
      tax_rate REAL,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      category_id TEXT,
      business_unit_id TEXT NOT NULL,
      images TEXT,
      attributes TEXT,
      sync_status TEXT DEFAULT 'synced',
      sync_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Local sales (mirrors backend Sale)
    CREATE TABLE IF NOT EXISTS local_sales (
      id TEXT PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      change_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'completed',
      customer_id TEXT,
      business_unit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      sync_attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Local sale items
    CREATE TABLE IF NOT EXISTS local_sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (sale_id) REFERENCES local_sales(id) ON DELETE CASCADE
    );

    -- Local customers (mirrors backend Customer)
    CREATE TABLE IF NOT EXISTS local_customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone_number TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      country TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      loyalty_points INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      last_purchase_at DATETIME,
      company_id TEXT NOT NULL,
      sync_status TEXT DEFAULT 'synced',
      sync_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Offline queue
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sync logs
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX idx_products_sku ON local_products(sku);
    CREATE INDEX idx_products_sync_status ON local_products(sync_status);
    CREATE INDEX idx_sales_receipt ON local_sales(receipt_number);
    CREATE INDEX idx_sales_sync_status ON local_sales(sync_status);
    CREATE INDEX idx_sales_customer ON local_sales(customer_id);
    CREATE INDEX idx_sale_items_sale ON local_sale_items(sale_id);
    CREATE INDEX idx_customers_email ON local_customers(email);
    CREATE INDEX idx_customers_sync_status ON local_customers(sync_status);
    CREATE INDEX idx_offline_queue_status ON offline_queue(status);
    CREATE INDEX idx_sync_logs_created ON sync_logs(created_at);
  `);

  // Insert default settings
  const settings = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES 
      ('last_sync', '1970-01-01T00:00:00.000Z'),
      ('auto_sync', 'true'),
      ('sync_interval', '300'),
      ('offline_mode', 'false')
  `);
  settings.run();

  logger.info('Database schema initialized');
}

async function runMigrations(db: Database.Database): Promise<void> {
  try {
    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get applied migrations
    const appliedMigrations = db.prepare('SELECT name FROM migrations ORDER BY id').all() as { name: string }[];
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    // Check for migrations directory
    const migrationsPath = path.join(__dirname, '../migrations');
    if (fs.existsSync(migrationsPath)) {
      const migrationFiles = fs.readdirSync(migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const migrationFile of migrationFiles) {
        if (!appliedNames.has(migrationFile)) {
          logger.info(`Applying migration: ${migrationFile}`);
          const sql = fs.readFileSync(path.join(migrationsPath, migrationFile), 'utf-8');
          
          // Run migration in transaction
          db.exec('BEGIN TRANSACTION');
          try {
            db.exec(sql);
            db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationFile);
            db.exec('COMMIT');
            logger.info(`Migration applied: ${migrationFile}`);
          } catch (error) {
            db.exec('ROLLBACK');
            logger.error(`Failed to apply migration ${migrationFile}:`, error);
            throw error;
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to run migrations:', error);
    throw error;
  }
}

export function getDatabasePath(): string {
  return DB_PATH;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
