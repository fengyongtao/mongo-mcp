import { KnowledgeService } from '../../services/knowledge-service.js';
import type { McpTool } from '../types.js';

/**
 * 创建 Memory 工具集
 */
export function createMemoryTools(knowledgeService: KnowledgeService): McpTool[] {
  return [
    // 添加记忆
    {
      name: 'memory_add',
      description: '快速添加一条记忆',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '记忆名称/标题',
          },
          content: {
            type: 'string',
            description: '记忆内容',
          },
          category: {
            type: 'string',
            description: '分类（如：preference, history, fact）',
          },
          importance: {
            type: 'string',
            description: '重要程度',
            enum: ['low', 'medium', 'high'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表',
          },
        },
        required: ['name', 'content'],
      },
      handler: async (args) => {
        const { name, content, category, importance, tags } = args as {
          name: string;
          content: string;
          category?: string;
          importance?: 'low' | 'medium' | 'high';
          tags?: string[];
        };

        try {
          const doc = await knowledgeService.upsert('Memories', name, {
            content,
            description: category,
            tags: tags || (category ? [category] : []),
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `记忆 "${name}" 已保存`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 搜索记忆
    {
      name: 'memory_search',
      description: '搜索记忆',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词',
          },
          category: {
            type: 'string',
            description: '分类过滤（可选）',
          },
          limit: {
            type: 'number',
            description: '返回数量限制（默认 10）',
          },
        },
        required: ['keyword'],
      },
      handler: async (args) => {
        const { keyword, category, limit = 10 } = args as {
          keyword: string;
          category?: string;
          limit?: number;
        };

        const tags = category ? [category] : undefined;
        const docs = await knowledgeService.list({ type: 'Memories', search: keyword, tags, limit });

        return {
          success: true,
          data: docs.map(doc => ({
            name: doc.name,
            content: doc.content,
            category: doc.description,
            tags: doc.tags,
            updatedAt: doc.updatedAt,
          })),
          count: docs.length,
        };
      },
    },
  ];
}
