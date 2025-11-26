import Database from 'better-sqlite3';
import path from 'path';

/**
 * Migrate existing database timestamps from UTC to Beijing time (UTC+8)
 */
function migrateTimestamps() {
  const dbPath = path.join(process.cwd(), 'data', 'orders.db');
  const db = new Database(dbPath);

  console.log('📊 开始迁移数据库时间字段...');
  console.log(`数据库路径: ${dbPath}`);

  try {
    // Get all records
    const records = db.prepare('SELECT id, timestamp, created_at FROM orders').all() as Array<{
      id: number;
      timestamp: string;
      created_at: string;
    }>;

    console.log(`\n找到 ${records.length} 条记录需要更新`);

    // Update each record
    const updateStmt = db.prepare('UPDATE orders SET timestamp = ?, created_at = ? WHERE id = ?');

    let updated = 0;
    for (const record of records) {
      // Convert UTC to Beijing time (UTC+8)
      const timestampDate = new Date(record.timestamp);
      const beijingTimestamp = new Date(timestampDate.getTime() + 8 * 60 * 60 * 1000);
      const newTimestamp = beijingTimestamp.toISOString().replace('Z', '+08:00');

      const createdDate = new Date(record.created_at);
      const beijingCreated = new Date(createdDate.getTime() + 8 * 60 * 60 * 1000);
      const newCreated = beijingCreated.toISOString().replace('Z', '+08:00');

      updateStmt.run(newTimestamp, newCreated, record.id);
      updated++;

      if (updated % 10 === 0) {
        console.log(`已更新 ${updated}/${records.length} 条记录...`);
      }
    }

    console.log(`\n✅ 成功更新 ${updated} 条记录`);
    console.log('\n示例更新：');
    
    // Show some examples
    const samples = db.prepare('SELECT id, timestamp, created_at FROM orders LIMIT 3').all();
    console.table(samples);

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
console.log('='.repeat(60));
console.log('时间字段迁移工具 (UTC → UTC+8)');
console.log('='.repeat(60));
console.log('');

migrateTimestamps();

console.log('\n='.repeat(60));
console.log('✅ 迁移完成！');
console.log('='.repeat(60));
