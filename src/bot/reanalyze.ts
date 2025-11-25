// 重新分析正确的时间戳
const timestamp1 = 1763827200;
const timestamp2 = 1763826300;

const date1 = new Date(timestamp1 * 1000);
const date2 = new Date(timestamp2 * 1000);
const now = new Date();

console.log('\n' + '='.repeat(70));
console.log('🔍 重新分析时间戳');
console.log('='.repeat(70));

// console.log('\n📅 当前时间:');
// console.log(`  北京时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
// console.log(`  UTC 时间: ${now.toISOString()}`);
// console.log(`  UTC 小时:分钟: ${now.getUTCHours()}:${String(now.getUTCMinutes()).padStart(2, '0')}`);

// console.log('\n📅 时间戳 1763827200:');
// console.log(`  UTC 时间: ${date1.toISOString()}`);
console.log(`  北京时间: ${date1.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
// console.log(`  UTC 小时:分钟: ${date1.getUTCHours()}:${String(date1.getUTCMinutes()).padStart(2, '0')}`);

// console.log('\n📅 时间戳 1763826300:');
// console.log(`  UTC 时间: ${date2.toISOString()}`);
// console.log(`  北京时间: ${date2.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
// console.log(`  UTC 小时:分钟: ${date2.getUTCHours()}:${String(date2.getUTCMinutes()).padStart(2, '0')}`);

// console.log('\n💡 逻辑分析:');
const currentUtcMinutes = now.getUTCMinutes();
const currentUtcHours = now.getUTCHours();

console.log(`  当前 UTC 时间: ${currentUtcHours}:${String(currentUtcMinutes).padStart(2, '0')}`);

// 向下取整到15分钟
let floorMinutes: number;
if (currentUtcMinutes >= 0 && currentUtcMinutes < 15) {
  floorMinutes = 0;
} else if (currentUtcMinutes >= 15 && currentUtcMinutes < 30) {
  floorMinutes = 15;
} else if (currentUtcMinutes >= 30 && currentUtcMinutes < 45) {
  floorMinutes = 30;
} else {
  floorMinutes = 45;
}

console.log(`  向下取整到15分钟: ${currentUtcHours}:${String(floorMinutes).padStart(2, '0')}`);
console.log(`  1763827200 对应: ${date1.getUTCHours()}:${String(date1.getUTCMinutes()).padStart(2, '0')}`);
console.log(`  是否匹配: ${currentUtcHours === date1.getUTCHours() && floorMinutes === date1.getUTCMinutes() ? '✅ 匹配' : '❌ 不匹配'}`);

console.log('\n' + '='.repeat(70) + '\n');
