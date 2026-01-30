/**
 * 知识库工具集入口
 * 组合所有 handler 模块
 */

import { KnowledgeService } from '../services/knowledge-service.js';
import type { McpTool } from './types.js';

// 导入所有 handler
import { createCrudTools } from './handlers/crud.handler.js';
import { createMemoryTools } from './handlers/memory.handler.js';
import { createSyncTools } from './handlers/sync.handler.js';
import { createShortcutTools } from './handlers/shortcut.handler.js';
import { createEmbeddingTools } from './handlers/embedding.handler.js';

// 导出类型和常量
export type { McpTool } from './types.js';
export { ALL_KNOWLEDGE_TYPES } from './types.js';

/**
 * 创建知识库管理工具集
 */
export function createKnowledgeTools(
  knowledgeService: KnowledgeService,
  enableEmbedding: boolean = false
): McpTool[] {
  const tools: McpTool[] = [
    // CRUD 工具
    ...createCrudTools(knowledgeService),
    
    // Memory 工具
    ...createMemoryTools(knowledgeService),
    
    // 同步工具（MCP/Rule/Skill）
    ...createSyncTools(knowledgeService),
    
    // 快捷工具（Experience/Command/Context/Workflow/UserInfo）
    ...createShortcutTools(knowledgeService),
  ];

  // 如果启用嵌入功能，添加语义搜索工具
  if (enableEmbedding) {
    tools.push(...createEmbeddingTools(knowledgeService));
  }

  return tools;
}

// 导出各 handler 创建函数，便于单独使用
export {
  createCrudTools,
  createMemoryTools,
  createSyncTools,
  createShortcutTools,
  createEmbeddingTools,
};
