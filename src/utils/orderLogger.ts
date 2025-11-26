import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface OrderLogEntry {
  id?: number;
  timestamp: string;
  eventType: 'ORDER_CREATED' | 'ORDER_SUBMITTED' | 'ORDER_UPDATED' | 'ORDER_FILLED' | 'ORDER_CANCELLED' | 'ORDER_FAILED';
  orderId?: string;
  marketId: string;
  outcome: string;
  price: number;
  size: number;
  status?: string;
  details?: string;
}

class OrderLogger {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create database file
    this.dbPath = path.join(dataDir, 'orders.db');
    this.db = new Database(this.dbPath);
    
    console.log(`📊 订单数据库: ${this.dbPath}`);
    
    // Initialize database schema
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Create orders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        order_id TEXT,
        market_id TEXT NOT NULL,
        outcome TEXT,
        price REAL,
        size REAL,
        status TEXT,
        details TEXT,
        market_result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_id ON orders(order_id);
      CREATE INDEX IF NOT EXISTS idx_market_id ON orders(market_id);
      CREATE INDEX IF NOT EXISTS idx_event_type ON orders(event_type);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON orders(timestamp);
    `);

    console.log('✅ 订单数据库表已初始化');
  }

  private insertOrder(entry: OrderLogEntry) {
    const stmt = this.db.prepare(`
      INSERT INTO orders (timestamp, event_type, order_id, market_id, outcome, price, size, status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.timestamp,
      entry.eventType,
      entry.orderId || null,
      entry.marketId,
      entry.outcome,
      entry.price,
      entry.size,
      entry.status || null,
      entry.details || null
    );
  }

  /**
   * Get Beijing timestamp (UTC+8)
   */
  private getBeijingTimestamp(): string {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return beijingTime.toISOString().replace('Z', '+08:00');
  }

  /**
   * Log order creation
   */
  logOrderCreated(data: {
    marketId: string;
    outcome: string;
    price: number;
    size: number;
    details?: string;
  }) {
    const entry: OrderLogEntry = {
      timestamp: this.getBeijingTimestamp(),
      eventType: 'ORDER_CREATED',
      marketId: data.marketId,
      outcome: data.outcome,
      price: data.price,
      size: data.size,
      details: data.details,
    };
    
    this.insertOrder(entry);
    console.log(`📝 [DB] 订单创建记录已保存`);
  }

  /**
   * Log order submission
   */
  logOrderSubmitted(data: {
    orderId: string;
    marketId: string;
    outcome: string;
    price: number;
    size: number;
    status: string;
  }) {
    const entry: OrderLogEntry = {
      timestamp: this.getBeijingTimestamp(),
      eventType: 'ORDER_SUBMITTED',
      orderId: data.orderId,
      marketId: data.marketId,
      outcome: data.outcome,
      price: data.price,
      size: data.size,
      status: data.status,
    };
    
    this.insertOrder(entry);
    console.log(`✅ [DB] 订单提交记录已保存 (${data.orderId.substring(0, 16)}...)`);
  }

  /**
   * Log order status update
   */
  logOrderUpdated(data: {
    orderId: string;
    marketId: string;
    status: string;
    sizeFilled?: number;
    sizeRemaining?: number;
    details?: string;
  }) {
    const entry: OrderLogEntry = {
      timestamp: this.getBeijingTimestamp(),
      eventType: 'ORDER_UPDATED',
      orderId: data.orderId,
      marketId: data.marketId,
      outcome: '',
      price: 0,
      size: data.sizeFilled || 0,
      status: data.status,
      details: data.details || `Filled: ${data.sizeFilled}, Remaining: ${data.sizeRemaining}`,
    };
    
    this.insertOrder(entry);
    console.log(`🔄 [DB] 订单状态更新已保存 (${data.orderId.substring(0, 16)}...)`);
  }

  /**
   * Log order filled
   */
  logOrderFilled(data: {
    orderId: string;
    marketId: string;
    outcome: string;
    sizeFilled: number;
  }) {
    const entry: OrderLogEntry = {
      timestamp: this.getBeijingTimestamp(),
      eventType: 'ORDER_FILLED',
      orderId: data.orderId,
      marketId: data.marketId,
      outcome: data.outcome,
      price: 0,
      size: data.sizeFilled,
      status: 'FILLED',
    };
    
    this.insertOrder(entry);
    console.log(`✅ [DB] 订单成交记录已保存 (${data.orderId.substring(0, 16)}...)`);
  }

  /**
   * Log order cancellation
   */
  logOrderCancelled(data: {
    orderId: string;
    marketId: string;
    reason?: string;
  }) {
    const entry: OrderLogEntry = {
      timestamp: this.getBeijingTimestamp(),
      eventType: 'ORDER_CANCELLED',
      orderId: data.orderId,
      marketId: data.marketId,
      outcome: '',
      price: 0,
      size: 0,
      status: 'CANCELLED',
      details: data.reason || '手动取消',
    };
    
    this.insertOrder(entry);
    console.log(`🛑 [DB] 订单取消记录已保存 (${data.orderId.substring(0, 16)}...)`);
  }

  /**
   * Log order failure
   */
  logOrderFailed(data: {
    marketId: string;
    outcome: string;
    price: number;
    size: number;
    error: string;
  }) {
    const entry: OrderLogEntry = {
      timestamp: this.getBeijingTimestamp(),
      eventType: 'ORDER_FAILED',
      marketId: data.marketId,
      outcome: data.outcome,
      price: data.price,
      size: data.size,
      status: 'FAILED',
      details: data.error,
    };
    
    this.insertOrder(entry);
    console.log(`❌ [DB] 订单失败记录已保存`);
  }

  /**
   * Query orders by order ID
   */
  getOrderHistory(orderId: string): OrderLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM orders WHERE order_id = ? ORDER BY timestamp ASC
    `);
    return stmt.all(orderId) as OrderLogEntry[];
  }

  /**
   * Query recent orders
   */
  getRecentOrders(limit: number = 50): OrderLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM orders ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(limit) as OrderLogEntry[];
  }

  /**
   * Query orders by market
   */
  getOrdersByMarket(marketId: string): OrderLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM orders WHERE market_id = ? ORDER BY timestamp DESC
    `);
    return stmt.all(marketId) as OrderLogEntry[];
  }

  /**
   * Update market result for all orders of a specific market
   */
  updateMarketResult(marketId: string, winningOutcome: string) {
    const stmt = this.db.prepare(`
      UPDATE orders SET market_result = ? WHERE market_id = ?
    `);
    
    const result = stmt.run(winningOutcome, marketId);
    console.log(`🏆 [DB] 市场结果已更新: ${marketId.substring(0, 20)}... → ${winningOutcome} (${result.changes} 条记录)`);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
    const byType = this.db.prepare(`
      SELECT event_type, COUNT(*) as count FROM orders GROUP BY event_type
    `).all() as { event_type: string; count: number }[];

    return {
      totalOrders: total.count,
      byEventType: byType,
    };
  }

  /**
   * Query orders with filters
   */
  queryOrders(filters: {
    startDate?: string;
    endDate?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];

    if (filters.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.eventType) {
      sql += ' AND event_type = ?';
      params.push(filters.eventType);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Get statistics by time range
   */
  getStatisticsByTimeRange(startDate?: string, endDate?: string) {
    let whereClause = '';
    const params: any[] = [];

    if (startDate || endDate) {
      whereClause = 'WHERE';
      if (startDate) {
        whereClause += ' created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        if (startDate) whereClause += ' AND';
        whereClause += ' created_at <= ?';
        params.push(endDate);
      }
    }

    // Total count
    const total = this.db.prepare(`SELECT COUNT(*) as count FROM orders ${whereClause}`).get(...params) as { count: number };

    // By event type
    const byType = this.db.prepare(`
      SELECT event_type, COUNT(*) as count FROM orders ${whereClause} GROUP BY event_type
    `).all(...params) as { event_type: string; count: number }[];

    // By outcome
    const byOutcome = this.db.prepare(`
      SELECT outcome, COUNT(*) as count FROM orders ${whereClause} AND outcome != '' GROUP BY outcome
    `).all(...params) as { outcome: string; count: number }[];

    // Daily count
    const dailyStats = this.db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count FROM orders ${whereClause} GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30
    `).all(...params) as { date: string; count: number }[];

    return {
      totalOrders: total.count,
      byEventType: byType,
      byOutcome: byOutcome,
      dailyStats: dailyStats,
    };
  }

  close() {
    this.db.close();
  }

  getDatabasePath(): string {
    return this.dbPath;
  }
}

// Create singleton instance
export const orderLogger = new OrderLogger();

// Handle process exit
process.on('exit', () => {
  orderLogger.close();
});

process.on('SIGINT', () => {
  orderLogger.close();
});

export default orderLogger;
