/**
 * Generate BTC 15-minute market slug based on current time
 * Format: btc-updown-15m-{timestamp}
 * Uses floor (向下取整) to the current 15-minute interval start time
 */

/**
 * Get the current BTC 15-minute market slug
 * @returns slug string like 'btc-updown-15m-1700000000'
 */
export function getCurrentBtc15MinSlug(): string {
  // Get current time
  const now = new Date();
  
  // Use UTC time
  const minutes = now.getUTCMinutes();
  
  // Floor to nearest 15-minute interval (向下取整)
  let roundedMinutes: number;
  if (minutes >= 0 && minutes < 15) {
    roundedMinutes = 0;
  } else if (minutes >= 15 && minutes < 30) {
    roundedMinutes = 15;
  } else if (minutes >= 30 && minutes < 45) {
    roundedMinutes = 30;
  } else {
    roundedMinutes = 45;
  }
  
  // Create a new date with rounded minutes and 0 seconds
  const roundedDate = new Date(now);
  roundedDate.setUTCMinutes(roundedMinutes);
  roundedDate.setUTCSeconds(0);
  roundedDate.setUTCMilliseconds(0);
  
  // Get Unix timestamp (in seconds)
  const timestamp = Math.floor(roundedDate.getTime() / 1000);
  
  // Generate slug
  const slug = `btc-updown-15m-${timestamp}`;
  
  console.log(`🕐 当前时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  console.log(`🌍 UTC+8 时间: ${beijingTime}`);
  const intervalStartBeijing = new Date(roundedDate.getTime() + 8 * 60 * 60 * 1000);
  console.log(`⏰ 15分钟区间起点: ${intervalStartBeijing.toISOString().substring(11, 19)} (UTC+8)`);
  console.log(`📝 生成的 Slug: ${slug}`);
  console.log(`🔢 时间戳: ${timestamp}`);
  
  return slug;
}

/**
 * Format time for display
 */
export function formatUtcTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}
