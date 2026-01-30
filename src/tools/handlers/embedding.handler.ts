import { KnowledgeService } from '../../services/knowledge-service.js';
import { KnowledgeType } from '../../types.js';
import type { McpTool } from '../types.js';
import { ALL_KNOWLEDGE_TYPES } from '../types.js';

/**
 * 创建嵌入工具集（语义搜索/生成嵌入）
 */
export function createEmbeddingTools(knowledgeService: KnowledgeService): McpTool[] {
  return [
    // 语义搜索
    {
      name: 'semantic_search',
      description: '基于语义相似度搜索知识库（需要先生成嵌入）',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索查询文本',
          },
          type: {
            type: 'string',
            description: '文档类型过滤（可选）',
            enum: ALL_KNOWLEDGE_TYPES,
          },
          limit: {
            type: 'number',
            description: '返回结果数量（默认 10）',
          },
          threshold: {
            type: 'number',
            description: '相似度阈值（0-1，默认 0.3）',
          },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { query, type, limit, threshold } = args as {
          query: string;
          type?: KnowledgeType;
          limit?: number;
          threshold?: number;
        };

        try {
          const results = await knowledgeService.semanticSearch(query, { type, limit, threshold });

          return {
            success: true,
            data: results.map(doc => ({
              id: doc._id?.toString(),
              type: doc.type,
              name: doc.name,
              description: doc.description,
              score: Math.round(doc.score * 100) / 100,
              tags: doc.tags,
            })),
            count: results.length,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 生成嵌入
    {
      name: 'generate_embeddings',
      description: '为知识库文档生成向量嵌入（用于语义搜索）',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型（可选，不指定则为所有文档生成）',
            enum: ALL_KNOWLEDGE_TYPES,
          },
        },
      },
      handler: async (args) => {
        const { type } = args as { type?: KnowledgeType };

        try {
          const count = await knowledgeService.generateEmbeddings(type);

          return {
            success: true,
            message: `已为 ${count} 个文档生成嵌入`,
            data: { count },
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },
  ];
}
