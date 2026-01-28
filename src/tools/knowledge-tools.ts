import { KnowledgeService } from '../services/knowledge-service.js';
import { KnowledgeType, KnowledgeDocument, SourceType } from '../types.js';
import { McpTool } from './config-tools.js';

/**
 * 创建知识库管理工具集
 */
export function createKnowledgeTools(knowledgeService: KnowledgeService): McpTool[] {
  return [
    // ========== 通用 CRUD 工具 ==========

    // 创建知识文档
    {
      name: 'knowledge_create',
      description: '创建知识文档（Memory/MCP/Skill/Rule）',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文档类型：MCPs | Memories | Rules | Skills',
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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
          source: {
            type: 'string',
            description: '数据来源：qoder | trae | cursor | windsurf | vscode | manual | sync-script | other',
            enum: ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'sync-script', 'other'],
          },
          sourceId: {
            type: 'string',
            description: '来源系统中的原始 ID（可选）',
          },
          sourcePath: {
            type: 'string',
            description: '来源文件路径（可选）',
          },
          sourceProject: {
            type: 'string',
            description: '来源项目名称（可选）',
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
            description: '文档类型：MCPs | Memories | Rules | Skills',
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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
            source: doc.source,
            sourceId: doc.sourceId,
            sourcePath: doc.sourcePath,
            sourceProject: doc.sourceProject,
            syncedAt: doc.syncedAt,
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
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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
          source: {
            type: 'string',
            description: '数据来源：qoder | trae | cursor | windsurf | vscode | manual | sync-script | other',
            enum: ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'sync-script', 'other'],
          },
          sourceId: {
            type: 'string',
            description: '来源系统中的原始 ID（可选）',
          },
          sourcePath: {
            type: 'string',
            description: '来源文件路径（可选）',
          },
          sourceProject: {
            type: 'string',
            description: '来源项目名称（可选）',
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
          source?: SourceType;
          sourceId?: string;
          sourcePath?: string;
          sourceProject?: string;
        };

        const doc = await knowledgeService.update(type, name, updates);

        if (!doc) {
          return { success: false, error: `${type} "${name}" 不存在` };
        }

        return {
          success: true,
          data: { id: doc._id?.toString(), type, name },
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
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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
          source: {
            type: 'string',
            description: '数据来源过滤（可选）',
            enum: ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'sync-script', 'other'],
          },
          limit: {
            type: 'number',
            description: '返回数量限制（可选）',
          },
        },
      },
      handler: async (args) => {
        const { type, search, tags, enabled, source, limit } = args as {
          type?: KnowledgeType;
          search?: string;
          tags?: string[];
          enabled?: boolean;
          source?: string;
          limit?: number;
        };

        const docs = await knowledgeService.list(type, { search, tags, enabled, source, limit });

        return {
          success: true,
          data: docs.map(doc => ({
            id: doc._id?.toString(),
            type: doc.type,
            name: doc.name,
            description: doc.description,
            tags: doc.tags,
            enabled: doc.enabled,
            source: doc.source,
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
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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

    // ========== 快捷工具 ==========

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
            description: '分类（如：coding_habit, preference, experience）',
          },
          importance: {
            type: 'string',
            description: '重要程度：low | medium | high',
            enum: ['low', 'medium', 'high'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表',
          },
          source: {
            type: 'string',
            description: '数据来源：qoder | trae | cursor | windsurf | vscode | manual | sync-script | other',
            enum: ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'sync-script', 'other'],
          },
        },
        required: ['name', 'content'],
      },
      handler: async (args) => {
        const { name, content, category, importance, tags, source } = args as {
          name: string;
          content: string;
          category?: string;
          importance?: 'low' | 'medium' | 'high';
          tags?: string[];
          source?: string;
        };

        try {
          const doc = await knowledgeService.create({
            type: 'Memories',
            name,
            content,
            description: category,
            tags: tags || (category ? [category] : []),
            enabled: true,
            source: source as any,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `记忆 "${name}" 已保存`,
          };
        } catch (error: unknown) {
          const err = error as Error & { code?: number };
          if (err.code === 11000) {
            // 更新已存在的记忆
            const updated = await knowledgeService.update('Memories', name, {
              content,
              description: category,
              tags: tags || (category ? [category] : undefined),
              source: source as any,
            });
            return {
              success: true,
              data: { id: updated?._id?.toString(), name },
              message: `记忆 "${name}" 已更新`,
            };
          }
          return { success: false, error: err.message };
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
        const docs = await knowledgeService.list('Memories', { search: keyword, tags, limit });

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

    // 同步 MCP 配置
    {
      name: 'mcp_sync',
      description: '同步 MCP 配置到数据库',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'MCP 名称',
          },
          command: {
            type: 'string',
            description: '执行命令',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: '命令参数',
          },
          env: {
            type: 'object',
            description: '环境变量',
          },
          description: {
            type: 'string',
            description: 'MCP 描述',
          },
          tools: {
            type: 'array',
            items: { type: 'string' },
            description: '提供的工具列表',
          },
          source: {
            type: 'string',
            description: '数据来源：qoder | trae | cursor | windsurf | vscode | manual | sync-script | other',
            enum: ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'sync-script', 'other'],
          },
        },
        required: ['name', 'command'],
      },
      handler: async (args) => {
        const { name, command, args: cmdArgs, env, description, tools, source } = args as {
          name: string;
          command: string;
          args?: string[];
          env?: Record<string, string>;
          description?: string;
          tools?: string[];
          source?: string;
        };

        try {
          const content = { command, args: cmdArgs, env, tools };
          const doc = await knowledgeService.create({
            type: 'MCPs',
            name,
            content,
            description,
            enabled: true,
            source: source as any,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `MCP "${name}" 已同步`,
          };
        } catch (error: unknown) {
          const err = error as Error & { code?: number };
          if (err.code === 11000) {
            const content = { command, args: cmdArgs, env, tools };
            const updated = await knowledgeService.update('MCPs', name, { content, description, source: source as any });
            return {
              success: true,
              data: { id: updated?._id?.toString(), name },
              message: `MCP "${name}" 已更新`,
            };
          }
          return { success: false, error: err.message };
        }
      },
    },

    // 同步规则
    {
      name: 'rule_sync',
      description: '同步规则到数据库',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '规则名称',
          },
          content: {
            type: 'string',
            description: '规则内容',
          },
          description: {
            type: 'string',
            description: '规则描述',
          },
          priority: {
            type: 'number',
            description: '优先级（数字越小优先级越高）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签',
          },
          source: {
            type: 'string',
            description: '数据来源：qoder | trae | cursor | windsurf | vscode | manual | sync-script | other',
            enum: ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'sync-script', 'other'],
          },
        },
        required: ['name', 'content'],
      },
      handler: async (args) => {
        const { name, content, description, priority, tags, source } = args as {
          name: string;
          content: string;
          description?: string;
          priority?: number;
          tags?: string[];
          source?: string;
        };

        try {
          const doc = await knowledgeService.create({
            type: 'Rules',
            name,
            content,
            description,
            tags,
            enabled: true,
            source: source as any,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `规则 "${name}" 已同步`,
          };
        } catch (error: unknown) {
          const err = error as Error & { code?: number };
          if (err.code === 11000) {
            const updated = await knowledgeService.update('Rules', name, { content, description, tags, source: source as any });
            return {
              success: true,
              data: { id: updated?._id?.toString(), name },
              message: `规则 "${name}" 已更新`,
            };
          }
          return { success: false, error: err.message };
        }
      },
    },

    // 同步技能
    {
      name: 'skill_sync',
      description: '同步技能到数据库',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '技能名称',
          },
          content: {
            type: 'string',
            description: '技能内容/脚本',
          },
          description: {
            type: 'string',
            description: '技能描述',
          },
          trigger: {
            type: 'string',
            description: '触发条件',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签',
          },
          source: {
            type: 'string',
            description: '数据来源：qoder | trae | cursor | windsurf | vscode | manual | sync-script | other',
            enum: ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'sync-script', 'other'],
          },
        },
        required: ['name', 'content'],
      },
      handler: async (args) => {
        const { name, content, description, trigger, tags, source } = args as {
          name: string;
          content: string;
          description?: string;
          trigger?: string;
          tags?: string[];
          source?: string;
        };

        try {
          const doc = await knowledgeService.create({
            type: 'Skills',
            name,
            content,
            description,
            tags,
            enabled: true,
            source: source as any,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `技能 "${name}" 已同步`,
          };
        } catch (error: unknown) {
          const err = error as Error & { code?: number };
          if (err.code === 11000) {
            const updated = await knowledgeService.update('Skills', name, { content, description, tags, source: source as any });
            return {
              success: true,
              data: { id: updated?._id?.toString(), name },
              message: `技能 "${name}" 已更新`,
            };
          }
          return { success: false, error: err.message };
        }
      },
    },

    // ========== 语义搜索工具 ==========

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
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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
            enum: ['MCPs', 'Memories', 'Rules', 'Skills'],
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
