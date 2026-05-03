/**
 * ID 生成工具
 * 格式: {prefix}_{timestamp}_{random}
 * 示例: acc_1704067200_abc123
 */

/**
 * 生成带前缀的 UUID 风格的 ID
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 生成简短的 ID（无时间戳）
 */
export function shortId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${random}`;
}
