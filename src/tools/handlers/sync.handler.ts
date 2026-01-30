import { KnowledgeService } from '../../services/knowledge-service.js';
import type { McpTool } from '../types.js';

/**
 * 创建同步工具集（MCP/Rule/Skill）
 */
export function createSyncTools(knowledgeService: KnowledgeService): McpTool[] {
  return [
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
  ];
}
