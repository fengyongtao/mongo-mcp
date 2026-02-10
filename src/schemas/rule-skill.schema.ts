import { z } from 'zod';
import {
  nameSchema,
  tagsSchema,
  descriptionSchema,
  contentSchema,
  sourceTypeSchema,
  triggerModeSchema,
} from './common.schema.js';

/**
 * Rule 文档验证模式
 */

// Rule 同步
export const syncRuleSchema = z.object({
  name: nameSchema,
  content: contentSchema,
  description: descriptionSchema,
  tags: tagsSchema,
  priority: z.number().int().min(0).max(1000).optional(),
  triggerMode: triggerModeSchema.optional(),
  source: sourceTypeSchema.optional(),
});

/**
 * Skill 文档验证模式
 */

// Skill 同步
export const syncSkillSchema = z.object({
  name: nameSchema,
  content: contentSchema,
  trigger: z.string().max(500).optional(),
  description: descriptionSchema,
  tags: tagsSchema,
  source: sourceTypeSchema.optional(),
});

// 导出类型
export type SyncRuleInput = z.infer<typeof syncRuleSchema>;
export type SyncSkillInput = z.infer<typeof syncSkillSchema>;
