import { z } from 'zod';
import {
  nameSchema,
  tagsSchema,
  descriptionSchema,
  contentSchema,
  sourceTypeSchema,
  importanceSchema,
  searchSchema,
  paginationSchema,
} from './common.schema.js';

/**
 * Memory 文档验证模式
 */

// Memory 分类
export const memoryCategorySchema = z
  .string()
  .max(100, '分类最长100字符')
  .optional();

// 添加 Memory
export const addMemorySchema = z.object({
  name: nameSchema,
  content: contentSchema,
  description: descriptionSchema,
  tags: tagsSchema,
  category: memoryCategorySchema,
  importance: importanceSchema.optional().default('medium'),
  source: sourceTypeSchema.optional(),
});

// 搜索 Memory
export const searchMemorySchema = z.object({
  keyword: z.string().min(1, '关键词不能为空').max(200, '关键词最长200字符'),
  category: memoryCategorySchema,
  limit: paginationSchema.shape.limit,
});

// 导出类型
export type AddMemoryInput = z.infer<typeof addMemorySchema>;
export type SearchMemoryInput = z.infer<typeof searchMemorySchema>;
