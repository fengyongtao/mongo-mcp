import { z } from 'zod';
import { searchSchema, paginationSchema, knowledgeTypeSchema } from './common.schema.js';

/**
 * 语义搜索验证模式
 */

// 语义搜索
export const semanticSearchSchema = z.object({
  query: z.string().min(1, '查询不能为空').max(1000, '查询最长1000字符'),
  type: knowledgeTypeSchema.optional(),
  limit: paginationSchema.shape.limit,
  threshold: z.number().min(0).max(1).optional().default(0.3),
});

// 生成嵌入
export const generateEmbeddingsSchema = z.object({
  type: knowledgeTypeSchema.optional(),
});

// 导出类型
export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;
export type GenerateEmbeddingsInput = z.infer<typeof generateEmbeddingsSchema>;
