import { z } from 'zod';

/**
 * 通用字段验证模式
 */

// 名称：支持字母、数字、下划线、中划线、中文
export const nameSchema = z
  .string()
  .min(1, '名称不能为空')
  .max(255, '名称最长255字符')
  .regex(/^[a-zA-Z0-9_\-\u4e00-\u9fa5\s.]+$/, '名称只能包含字母、数字、下划线、中划线、中文、空格和点');

// 标签数组
export const tagsSchema = z
  .array(z.string().max(50, '单个标签最长50字符'))
  .max(20, '最多20个标签')
  .optional();

// 描述
export const descriptionSchema = z
  .string()
  .max(2000, '描述最长2000字符')
  .optional();

// 内容：字符串或对象
export const contentSchema = z.union([
  z.string().max(500000, '内容最长500000字符'),
  z.record(z.unknown()),
]);

// 知识类型枚举
export const knowledgeTypeSchema = z.enum([
  'Memories',
  'Skills',
  'Rules',
  'MCPs',
  'Experiences',
  'Commands',
  'Contexts',
  'Workflows',
]);

// 数据来源枚举
export const sourceTypeSchema = z.enum([
  'qoder',
  'trae',
  'cursor',
  'windsurf',
  'vscode',
  'manual',
  'sync-script',
  'other',
]);

// 同步状态枚举
export const syncStatusSchema = z.enum([
  'synced',
  'pending',
  'conflict',
  'local_only',
]);

// 重要程度枚举
export const importanceSchema = z.enum(['low', 'medium', 'high']);

// 触发模式枚举
export const triggerModeSchema = z.enum([
  'always_on',
  'auto_attached',
  'agent_requested',
  'manual',
]);

// 分页参数
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

// 搜索参数
export const searchSchema = z
  .string()
  .max(200, '搜索关键词最长200字符')
  .optional();
