// D:\Projects\Kalwanga\packages\desktop\main\database.ts
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { logger } from './logger.js';

const DB_PATH = path.join(app.getPath('userData'), 'pos.db');

// sql.js runtime + raw database handle
let SQL: any = null;
let rawDb: any = null;

/**
 * Adapter that presents a better-sqlite3-like API on top of sql.js.
 *
 *   db.prepare(sql).run(...params)
 *   db.prepare(sql).all(...params)   → array of row objects
 *   db.prepare(sql).get(...params)   → first row object or undefined
 *   db.exec(sql)                     → run one or more statements (raw)
 *   db.run(sql, params)              → parameterized run (raw convenience)
 */
class Statement {
  constructor(private stmt: any) {}

  /**
   * Bind all params. sql.js's stmt.bind() accepts a single array OR an
   * object; we always pass an array so positional `?` placeholders work.
   */
  private bind(params: any[]): void {
    if (params.length === 0) return;
    this.stmt.bind(params);
  }

  run(...params: any[]): void {
    try {
      this.bind(params);
      this.stmt.step();
    } finally {
      this.stmt.free();
    }
  }

  all(...params: any[]): any[] {
    const rows: any[] = [];
    try {
      this.bind(params);
      while (this.stmt.step()) {
        rows.push(this.stmt.getAsObject());
      }
    } finally {
      this.stmt.free();
    }
    return rows;
  }

  get(...params: any[]): any | undefined {
    try {
      this.bind(params);
      if (this.stmt.step()) {
        return this.stmt.getAsObject();
      }
      return undefined;
    } finally {
      this.stmt.free();
    }
  }
}

class DatabaseAdapter {
  constructor(private db: any) {}

  prepare(sql: string): Statement {
    return new Statement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Convenience that mirrors `db.run(sql, params)` used in migrations.
   * Accepts either spread params or a single array.
   */
  run(sql: string, params?: any[] | any): void {
    const stmt = this.db.prepare(sql);
    try {
      if (Array.isArray(params)) {
        if (params.length > 0) stmt.bind(params);
      } else if (params !== undefined && params !== null) {
        stmt.bind([params]);
      }
      stmt.step();
    } finally {
      stmt.free();
    }
  }

  export(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}

let db: DatabaseAdapter | null = null;

// ============================================
// PUBLIC API
// ============================================

export function getDatabase(): DatabaseAdapter {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    logger.error('Failed to save database:', error);
  }
}

export async function initializeDatabase(): Promise<void> {
  try {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

    SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    if (fs.existsSync(DB_PATH)) {
      logger.info('Loading existing database from:', DB_PATH);
      const buffer = fs.readFileSync(DB_PATH);
      const localDb = new SQL.Database(buffer);
      rawDb = localDb;
      db = new DatabaseAdapter(localDb);
      await runMigrations(localDb);
    } else {
      logger.info('Creating new database at:', DB_PATH);
      const localDb = new SQL.Database();
      rawDb = localDb;
      db = new DatabaseAdapter(localDb);
      await initializeSchema(localDb);
      saveDatabase();
    }

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

export function getDatabasePath(): string {
  return DB_PATH;
}

export function closeDatabase(): void {
  if (db) {
    try {
      saveDatabase();
    } catch (error) {
      logger.error('Error saving database on close:', error);
    }
    db.close();
    db = null;
    rawDb = null;
  }
}

// ============================================
// PRIVATE — SCHEMA AND MIGRATIONS
// ============================================

async function initializeSchema(database: any): Promise<void> {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      last_sync_at DATETIME,
      sync_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type)
    );

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

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_sku
      ON local_products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_sync_status
      ON local_products(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sales_receipt
      ON local_sales(receipt_number);
    CREATE INDEX IF NOT EXISTS idx_sales_sync_status
      ON local_sales(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sales_customer
      ON local_sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale
      ON local_sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_customers_email
      ON local_customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_sync_status
      ON local_customers(sync_status);
    CREATE INDEX IF NOT EXISTS idx_offline_queue_status
      ON offline_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_created
      ON sync_logs(created_at);
  `);

  database.run(
    `INSERT OR IGNORE INTO settings (key, value) VALUES
      ('last_sync', '1970-01-01T00:00:00.000Z'),
      ('auto_sync', 'true'),
      ('sync_interval', '300'),
      ('offline_mode', 'false')`
  );

  logger.info('Database schema initialized');
}

async function runMigrations(database: any): Promise<void> {
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const appliedNames = new Set<string>();
    const result = database.exec('SELECT name FROM migrations ORDER BY id');
    if (result.length > 0) {
      for (const row of result[0].values) {
        appliedNames.add(String(row[0]));
      }
    }

    const migrationsPath = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsPath)) {
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsPath)
      .filter((file: string) => file.endsWith('.sql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      if (appliedNames.has(migrationFile)) continue;

      logger.info(`Applying migration: ${migrationFile}`);
      const sql = fs.readFileSync(
        path.join(migrationsPath, migrationFile),
        'utf-8'
      );

      database.exec('BEGIN TRANSACTION');
      try {
        database.exec(sql);
        database.run('INSERT INTO migrations (name) VALUES (?)', [migrationFile]);
        database.exec('COMMIT');
        logger.info(`Migration applied: ${migrationFile}`);
      } catch (error) {
        database.exec('ROLLBACK');
        logger.error(`Failed to apply migration ${migrationFile}:`, error);
        throw error;
      }
    }
  } catch (error) {
    logger.error('Failed to run migrations:', error);
    throw error;
  }
}
