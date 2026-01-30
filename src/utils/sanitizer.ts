/**
 * 输入净化工具
 * 防止 NoSQL 注入和其他安全问题
 */

/**
 * 转义正则表达式特殊字符
 * 防止正则表达式注入
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 净化搜索查询
 * - 转义正则特殊字符
 * - 限制长度
 * - 去除首尾空格
 */
export function sanitizeSearchQuery(query: string, maxLength: number = 200): string {
  return escapeRegex(query.trim().slice(0, maxLength));
}

/**
 * 净化 MongoDB 查询对象
 * 移除可能导致 NoSQL 注入的操作符
 */
export function sanitizeMongoQuery(obj: Record<string, unknown>): Record<string, unknown> {
  const dangerous = ['$where', '$function', '$accumulator', '$expr'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // 跳过危险的操作符
    if (dangerous.includes(key)) {
      continue;
    }

    // 递归处理嵌套对象
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeMongoQuery(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 验证 ObjectId 格式
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * 净化字符串，移除控制字符
 */
export function sanitizeString(str: string): string {
  // 移除控制字符，保留换行和制表符
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
