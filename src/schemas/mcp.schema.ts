import { z } from 'zod';
import {
  nameSchema,
  tagsSchema,
  descriptionSchema,
  sourceTypeSchema,
} from './common.schema.js';

/**
 * MCP 配置验证模式
 */

// MCP 同步
export const syncMcpSchema = z.object({
  name: nameSchema,
  command: z.string().min(1, '命令不能为空').max(1000, '命令最长1000字符'),
  args: z.array(z.string().max(500)).max(50).optional(),
  env: z.record(z.string().max(10000)).optional(),
  tools: z.array(z.string().max(100)).max(100).optional(),
  description: descriptionSchema,
  source: sourceTypeSchema.optional(),
});

// 导出类型
export type SyncMcpInput = z.infer<typeof syncMcpSchema>;
