import { z } from 'zod';
import {
  nameSchema,
  tagsSchema,
  descriptionSchema,
  contentSchema,
  knowledgeTypeSchema,
  sourceTypeSchema,
  paginationSchema,
  searchSchema,
} from './common.schema.js';

/**
 * 知识文档验证模式
 */

// 创建知识文档
export const createKnowledgeSchema = z.object({
  type: knowledgeTypeSchema,
  name: nameSchema,
  content: contentSchema,
  description: descriptionSchema,
  tags: tagsSchema,
  enabled: z.boolean().optional().default(true),
  // 来源信息（可选）
  source: sourceTypeSchema.optional(),
  sourceId: z.string().max(255).optional(),
  sourcePath: z.string().max(1000).optional(),
  sourceProject: z.string().max(255).optional(),
});

// 更新知识文档
export const updateKnowledgeSchema = z.object({
  content: contentSchema.optional(),
  description: descriptionSchema,
  tags: tagsSchema,
  enabled: z.boolean().optional(),
  source: sourceTypeSchema.optional(),
  sourceId: z.string().max(255).optional(),
  sourcePath: z.string().max(1000).optional(),
  sourceProject: z.string().max(255).optional(),
});

// 读取知识文档
export const readKnowledgeSchema = z.object({
  type: knowledgeTypeSchema,
  name: nameSchema,
});

// 删除知识文档
export const deleteKnowledgeSchema = z.object({
  type: knowledgeTypeSchema,
  name: nameSchema,
});

// 列表查询
export const listKnowledgeSchema = z.object({
  type: knowledgeTypeSchema.optional(),
  tags: tagsSchema,
  enabled: z.boolean().optional(),
  search: searchSchema,
  source: sourceTypeSchema.optional(),
  limit: paginationSchema.shape.limit,
  offset: paginationSchema.shape.offset,
});

// Upsert 操作
export const upsertKnowledgeSchema = createKnowledgeSchema;

// 统计查询
export const statsKnowledgeSchema = z.object({
  type: knowledgeTypeSchema.optional(),
});

// 导出类型
export type CreateKnowledgeInput = z.infer<typeof createKnowledgeSchema>;
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeSchema>;
export type ReadKnowledgeInput = z.infer<typeof readKnowledgeSchema>;
export type DeleteKnowledgeInput = z.infer<typeof deleteKnowledgeSchema>;
export type ListKnowledgeInput = z.infer<typeof listKnowledgeSchema>;
export type UpsertKnowledgeInput = z.infer<typeof upsertKnowledgeSchema>;
export type StatsKnowledgeInput = z.infer<typeof statsKnowledgeSchema>;
