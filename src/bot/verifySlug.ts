import { getCurrentBtc15MinSlug } from './slugGenerator';

console.log('\n' + '='.repeat(60));
console.log('🎯 验证 BTC Slug 生成');
console.log('='.repeat(60) + '\n');

const slug = getCurrentBtc15MinSlug();

const expectedTimestamp = 1763827200;
const actualTimestamp = parseInt(slug.split('-').pop() || '0');

console.log('\n' + '='.repeat(60));
console.log('📊 与官网对比:');
console.log(`  官网时间戳: ${expectedTimestamp}`);
console.log(`  生成时间戳: ${actualTimestamp}`);
console.log(`  差异: ${actualTimestamp - expectedTimestamp} 秒`);
console.log(`  结果: ${expectedTimestamp === actualTimestamp ? '✅ 完全匹配！' : `❌ 不匹配`}`);
console.log('='.repeat(60) + '\n');
