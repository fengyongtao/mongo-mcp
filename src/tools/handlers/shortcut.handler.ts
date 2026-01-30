import { KnowledgeService } from '../../services/knowledge-service.js';
import type { McpTool } from '../types.js';

/**
 * 创建快捷工具集（Experience/Command/Context/Workflow/UserInfo）
 */
export function createShortcutTools(knowledgeService: KnowledgeService): McpTool[] {
  return [
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
  ];
}
