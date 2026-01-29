import { KnowledgeService } from '../services/knowledge-service.js';
import { KnowledgeType } from '../types.js';

/**
 * MCP 工具接口
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * 所有知识类型
 */
const ALL_KNOWLEDGE_TYPES: KnowledgeType[] = [
  'Memories', 'Skills', 'Rules', 'MCPs',
  'Experiences', 'Commands', 'Contexts', 'Workflows'
];

/**
 * 创建知识库管理工具集
 */
export function createKnowledgeTools(
  knowledgeService: KnowledgeService,
  enableEmbedding: boolean = false
): McpTool[] {
  const tools: McpTool[] = [
    // ========== 通用 CRUD 工具 ==========

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

    // 添加经验
    {
      name: 'experience_add',
      description: '添加一条经验（成功案例/最佳实践）',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '经验名称',
          },
          scenario: {
            type: 'string',
            description: '应用场景',
          },
          solution: {
            type: 'string',
            description: '解决方案',
          },
          outcome: {
            type: 'string',
            description: '执行结果（可选）',
          },
          effectiveness: {
            type: 'number',
            description: '有效性评分（1-5）',
            enum: [1, 2, 3, 4, 5],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表',
          },
        },
        required: ['name', 'scenario', 'solution'],
      },
      handler: async (args) => {
        const { name, scenario, solution, outcome, effectiveness, tags } = args as {
          name: string;
          scenario: string;
          solution: string;
          outcome?: string;
          effectiveness?: 1 | 2 | 3 | 4 | 5;
          tags?: string[];
        };

        try {
          const content = { scenario, solution, outcome, effectiveness };
          const doc = await knowledgeService.upsert('Experiences', name, {
            content,
            description: scenario,
            tags,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `经验 "${name}" 已保存`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 添加命令
    {
      name: 'command_add',
      description: '添加一个快捷命令',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '命令名称',
          },
          template: {
            type: 'string',
            description: '命令模板',
          },
          description: {
            type: 'string',
            description: '命令描述',
          },
          shortcut: {
            type: 'string',
            description: '快捷别名',
          },
          category: {
            type: 'string',
            description: '命令分类',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表',
          },
        },
        required: ['name', 'template'],
      },
      handler: async (args) => {
        const { name, template, description, shortcut, category, tags } = args as {
          name: string;
          template: string;
          description?: string;
          shortcut?: string;
          category?: string;
          tags?: string[];
        };

        try {
          const content = { template, shortcut, category };
          const doc = await knowledgeService.upsert('Commands', name, {
            content,
            description,
            tags: tags || (category ? [category] : []),
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `命令 "${name}" 已保存`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 设置上下文
    {
      name: 'context_set',
      description: '设置上下文信息',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '上下文名称',
          },
          content: {
            type: 'string',
            description: '上下文内容',
          },
          scope: {
            type: 'string',
            description: '上下文范围',
            enum: ['project', 'domain', 'global'],
          },
          projectPath: {
            type: 'string',
            description: '关联项目路径（可选）',
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
        const { name, content, scope = 'global', projectPath, tags } = args as {
          name: string;
          content: string;
          scope?: 'project' | 'domain' | 'global';
          projectPath?: string;
          tags?: string[];
        };

        try {
          const doc = await knowledgeService.upsert('Contexts', name, {
            content: { text: content, scope, projectPath },
            description: `${scope} context`,
            tags: tags || [scope],
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `上下文 "${name}" 已保存`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 同步 MCP
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
        },
        required: ['name', 'command'],
      },
      handler: async (args) => {
        const { name, command, args: cmdArgs, env, description, tools } = args as {
          name: string;
          command: string;
          args?: string[];
          env?: Record<string, string>;
          description?: string;
          tools?: string[];
        };

        try {
          const content = { command, args: cmdArgs, env, tools };
          const doc = await knowledgeService.upsert('MCPs', name, {
            content,
            description,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `MCP "${name}" 已同步`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
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
          triggerMode: {
            type: 'string',
            description: '触发方式',
            enum: ['always_on', 'auto_attached', 'agent_requested', 'manual'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签',
          },
        },
        required: ['name', 'content'],
      },
      handler: async (args) => {
        const { name, content, description, priority, triggerMode, tags } = args as {
          name: string;
          content: string;
          description?: string;
          priority?: number;
          triggerMode?: string;
          tags?: string[];
        };

        try {
          const doc = await knowledgeService.upsert('Rules', name, {
            content: { text: content, priority, triggerMode },
            description,
            tags,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `规则 "${name}" 已同步`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
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
        },
        required: ['name', 'content'],
      },
      handler: async (args) => {
        const { name, content, description, trigger, tags } = args as {
          name: string;
          content: string;
          description?: string;
          trigger?: string;
          tags?: string[];
        };

        try {
          const doc = await knowledgeService.upsert('Skills', name, {
            content: { script: content, trigger },
            description,
            tags,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `技能 "${name}" 已同步`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 创建工作流
    {
      name: 'workflow_create',
      description: '创建工作流',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '工作流名称',
          },
          description: {
            type: 'string',
            description: '工作流描述',
          },
          steps: {
            type: 'array',
            description: '工作流步骤',
            items: {
              type: 'object',
              properties: {
                order: { type: 'number' },
                action: { type: 'string' },
                toolCall: { type: 'string' },
                condition: { type: 'string' },
              },
            },
          },
          trigger: {
            type: 'string',
            description: '触发条件',
          },
          autoRun: {
            type: 'boolean',
            description: '是否自动执行',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表',
          },
        },
        required: ['name', 'steps'],
      },
      handler: async (args) => {
        const { name, description, steps, trigger, autoRun, tags } = args as {
          name: string;
          description?: string;
          steps: Array<{ order: number; action: string; toolCall?: string; condition?: string }>;
          trigger?: string;
          autoRun?: boolean;
          tags?: string[];
        };

        try {
          const content = { steps, trigger, autoRun };
          const doc = await knowledgeService.upsert('Workflows', name, {
            content,
            description,
            tags,
          });

          return {
            success: true,
            data: { id: doc._id?.toString(), name },
            message: `工作流 "${name}" 已创建`,
          };
        } catch (error: unknown) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // 获取用户信息
    {
      name: 'get_user_info',
      description: '获取当前用户和设备信息',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const context = knowledgeService.getUserContext();
        return {
          success: true,
          data: context,
        };
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

  // 如果启用嵌入功能，添加语义搜索工具
  if (enableEmbedding) {
    tools.push(
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
      }
    );
  }

  return tools;
}
