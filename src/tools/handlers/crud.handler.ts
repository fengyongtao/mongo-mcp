import { KnowledgeService } from '../../services/knowledge-service.js';
import { KnowledgeType } from '../../types.js';
import type { McpTool } from '../types.js';
import { ALL_KNOWLEDGE_TYPES } from '../types.js';

/**
 * 创建 CRUD 工具集
 */
export function createCrudTools(knowledgeService: KnowledgeService): McpTool[] {
  return [
    // 创建知识文档
    {
      name: 'knowledge_create',
      description: '创建知识文档（Memories/Skills/Rules/MCPs/Experiences/Commands/Contexts/Workflows）',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型',
            enum: ALL_KNOWLEDGE_TYPES,
          },
          name: {
            type: 'string',
            description: '文档名称（同类型下唯一）',
          },
          content: {
            type: ['string', 'object'],
            description: '文档内容（字符串或 JSON 对象）',
          },
          description: {
            type: 'string',
            description: '文档描述（可选）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（可选）',
          },
          enabled: {
            type: 'boolean',
            description: '是否启用（默认 true）',
          },
        },
        required: ['type', 'name', 'content'],
      },
      handler: async (args) => {
        const { type, name, content, description, tags, enabled, ...extra } = args as {
          type: KnowledgeType;
          name: string;
          content: string | Record<string, unknown>;
          description?: string;
          tags?: string[];
          enabled?: boolean;
          [key: string]: unknown;
        };

        try {
          const doc = await knowledgeService.create({
            type,
            name,
            content,
            description,
            tags,
            enabled,
            ...extra,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), type, name },
            message: `${type} "${name}" 创建成功`,
          };
        } catch (error: unknown) {
          const err = error as Error & { code?: number };
          if (err.code === 11000) {
            return { success: false, error: `${type} "${name}" 已存在` };
          }
          return { success: false, error: err.message };
        }
      },
    },

    // 读取知识文档
    {
      name: 'knowledge_read',
      description: '读取知识文档',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型',
            enum: ALL_KNOWLEDGE_TYPES,
          },
          name: {
            type: 'string',
            description: '文档名称',
          },
        },
        required: ['type', 'name'],
      },
      handler: async (args) => {
        const { type, name } = args as { type: KnowledgeType; name: string };
        const doc = await knowledgeService.get(type, name);

        if (!doc) {
          return { success: false, error: `${type} "${name}" 不存在` };
        }

        return {
          success: true,
          data: {
            id: doc._id?.toString(),
            type: doc.type,
            name: doc.name,
            content: doc.content,
            description: doc.description,
            tags: doc.tags,
            enabled: doc.enabled,
            userId: doc.userId,
            deviceId: doc.deviceId,
            ideSource: doc.ideSource,
            syncVersion: doc.syncVersion,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          },
        };
      },
    },

    // 更新知识文档
    {
      name: 'knowledge_update',
      description: '更新知识文档',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型',
            enum: ALL_KNOWLEDGE_TYPES,
          },
          name: {
            type: 'string',
            description: '文档名称',
          },
          content: {
            type: ['string', 'object'],
            description: '新内容（可选）',
          },
          description: {
            type: 'string',
            description: '新描述（可选）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '新标签（可选）',
          },
          enabled: {
            type: 'boolean',
            description: '是否启用（可选）',
          },
        },
        required: ['type', 'name'],
      },
      handler: async (args) => {
        const { type, name, ...updates } = args as {
          type: KnowledgeType;
          name: string;
          content?: string | Record<string, unknown>;
          description?: string;
          tags?: string[];
          enabled?: boolean;
        };

        const doc = await knowledgeService.update(type, name, updates);

        if (!doc) {
          return { success: false, error: `${type} "${name}" 不存在` };
        }

        return {
          success: true,
          data: { id: doc._id?.toString(), type, name, syncVersion: doc.syncVersion },
          message: `${type} "${name}" 更新成功`,
        };
      },
    },

    // 删除知识文档
    {
      name: 'knowledge_delete',
      description: '删除知识文档',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型',
            enum: ALL_KNOWLEDGE_TYPES,
          },
          name: {
            type: 'string',
            description: '文档名称',
          },
        },
        required: ['type', 'name'],
      },
      handler: async (args) => {
        const { type, name } = args as { type: KnowledgeType; name: string };
        const deleted = await knowledgeService.delete(type, name);

        return {
          success: deleted,
          message: deleted ? `${type} "${name}" 删除成功` : `${type} "${name}" 不存在`,
        };
      },
    },

    // 列出知识文档
    {
      name: 'knowledge_list',
      description: '列出知识文档',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型（可选，不指定则列出所有类型）',
            enum: ALL_KNOWLEDGE_TYPES,
          },
          search: {
            type: 'string',
            description: '搜索关键词（可选）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签过滤（可选）',
          },
          enabled: {
            type: 'boolean',
            description: '启用状态过滤（可选）',
          },
          limit: {
            type: 'number',
            description: '返回数量限制（可选）',
          },
          offset: {
            type: 'number',
            description: '偏移量（可选）',
          },
        },
      },
      handler: async (args) => {
        const { type, search, tags, enabled, limit, offset } = args as {
          type?: KnowledgeType;
          search?: string;
          tags?: string[];
          enabled?: boolean;
          limit?: number;
          offset?: number;
        };

        const docs = await knowledgeService.list({ type, search, tags, enabled, limit, offset });

        return {
          success: true,
          data: docs.map(doc => ({
            id: doc._id?.toString(),
            type: doc.type,
            name: doc.name,
            description: doc.description,
            tags: doc.tags,
            enabled: doc.enabled,
            syncVersion: doc.syncVersion,
            updatedAt: doc.updatedAt,
          })),
          count: docs.length,
        };
      },
    },

    // 统计知识文档
    {
      name: 'knowledge_stats',
      description: '统计知识文档数量',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型（可选，不指定则统计所有类型）',
            enum: ALL_KNOWLEDGE_TYPES,
          },
        },
      },
      handler: async (args) => {
        const { type } = args as { type?: KnowledgeType };
        const counts = await knowledgeService.count(type);

        return {
          success: true,
          data: counts,
        };
      },
    },

    // 创建或更新文档
    {
      name: 'knowledge_upsert',
      description: '创建或更新知识文档（存在则更新，不存在则创建）',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型',
            enum: ALL_KNOWLEDGE_TYPES,
          },
          name: {
            type: 'string',
            description: '文档名称',
          },
          content: {
            type: ['string', 'object'],
            description: '文档内容',
          },
          description: {
            type: 'string',
            description: '文档描述（可选）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（可选）',
          },
          enabled: {
            type: 'boolean',
            description: '是否启用（默认 true）',
          },
        },
        required: ['type', 'name', 'content'],
      },
      handler: async (args) => {
        const { type, name, content, description, tags, enabled } = args as {
          type: KnowledgeType;
          name: string;
          content: string | Record<string, unknown>;
          description?: string;
          tags?: string[];
          enabled?: boolean;
        };

        try {
          const doc = await knowledgeService.upsert(type, name, {
            content,
            description,
            tags,
            enabled,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), type, name, syncVersion: doc.syncVersion },
            message: `${type} "${name}" 已保存`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 批量导出
    {
      name: 'knowledge_export',
      description: '导出知识库数据',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型（可选，不指定则导出全部）',
            enum: ALL_KNOWLEDGE_TYPES,
          },
        },
      },
      handler: async (args) => {
        const { type } = args as { type?: KnowledgeType };
        const docs = await knowledgeService.bulkExport(type);

        return {
          success: true,
          data: docs,
          count: docs.length,
        };
      },
    },
  ];
}
