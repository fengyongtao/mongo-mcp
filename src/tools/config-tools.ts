import { z } from 'zod';
import { MongoService } from '../services/mongo-service.js';
import { ConfigDocument } from '../types.js';

/**
 * MCP 工具定义
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
 * 创建 MongoDB 配置管理工具集
 */
export function createMongoTools(mongoService: MongoService): McpTool[] {
  return [
    // 读取配置
    {
      name: 'mongo_config_read',
      description: '从 MongoDB 读取指定的配置文档',
      inputSchema: {
        type: 'object',
        properties: {
          configKey: {
            type: 'string',
            description: '配置键名（如 DatabaseConfig、CacheConfig）',
          },
          environment: {
            type: 'string',
            description: '环境名称（Development、Production、Test）',
          },
        },
        required: ['configKey', 'environment'],
      },
      handler: async (args) => {
        const { configKey, environment } = args as { configKey: string; environment: string };
        const config = await mongoService.getConfig(configKey, environment);
        
        if (!config) {
          return {
            success: false,
            error: `Config not found: ${configKey}@${environment}`,
          };
        }

        return {
          success: true,
          data: {
            configKey: config.configKey,
            environment: config.environment,
            version: config.version,
            content: config.content,
            metadata: config.metadata,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          },
        };
      },
    },

    // 写入配置
    {
      name: 'mongo_config_write',
      description: '将配置文档写入 MongoDB（如果存在则更新）',
      inputSchema: {
        type: 'object',
        properties: {
          configKey: {
            type: 'string',
            description: '配置键名',
          },
          environment: {
            type: 'string',
            description: '环境名称',
          },
          content: {
            type: 'object',
            description: '配置内容（JSON 对象）',
          },
          metadata: {
            type: 'object',
            description: '元数据信息（可选）',
            properties: {
              description: { type: 'string' },
              author: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        required: ['configKey', 'environment', 'content'],
      },
      handler: async (args) => {
        const { configKey, environment, content, metadata } = args as {
          configKey: string;
          environment: string;
          content: Record<string, unknown>;
          metadata?: ConfigDocument['metadata'];
        };

        const saved = await mongoService.saveConfig(
          configKey,
          environment,
          content,
          metadata
        );

        return {
          success: true,
          data: {
            configKey: saved.configKey,
            environment: saved.environment,
            version: saved.version,
            updatedAt: saved.updatedAt,
          },
          message: `Config saved: ${configKey}@${environment} (v${saved.version})`,
        };
      },
    },

    // 更新配置（带乐观锁）
    {
      name: 'mongo_config_update',
      description: '更新配置文档（支持乐观锁版本控制）',
      inputSchema: {
        type: 'object',
        properties: {
          configKey: {
            type: 'string',
            description: '配置键名',
          },
          environment: {
            type: 'string',
            description: '环境名称',
          },
          content: {
            type: 'object',
            description: '新的配置内容',
          },
          expectedVersion: {
            type: 'number',
            description: '期望的版本号（用于乐观锁，防止并发冲突）',
          },
        },
        required: ['configKey', 'environment', 'content'],
      },
      handler: async (args) => {
        const { configKey, environment, content, expectedVersion } = args as {
          configKey: string;
          environment: string;
          content: Record<string, unknown>;
          expectedVersion?: number;
        };

        try {
          const updated = await mongoService.saveConfig(
            configKey,
            environment,
            content,
            undefined,
            expectedVersion
          );

          return {
            success: true,
            data: {
              configKey: updated.configKey,
              environment: updated.environment,
              version: updated.version,
              updatedAt: updated.updatedAt,
            },
            message: `Config updated: ${configKey}@${environment} (v${updated.version})`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Update failed',
          };
        }
      },
    },

    // 删除配置
    {
      name: 'mongo_config_delete',
      description: '从 MongoDB 删除指定的配置文档',
      inputSchema: {
        type: 'object',
        properties: {
          configKey: {
            type: 'string',
            description: '配置键名',
          },
          environment: {
            type: 'string',
            description: '环境名称',
          },
        },
        required: ['configKey', 'environment'],
      },
      handler: async (args) => {
        const { configKey, environment } = args as { configKey: string; environment: string };
        const deleted = await mongoService.deleteConfig(configKey, environment);

        return {
          success: deleted,
          message: deleted
            ? `Config deleted: ${configKey}@${environment}`
            : `Config not found: ${configKey}@${environment}`,
        };
      },
    },

    // 列出配置
    {
      name: 'mongo_config_list',
      description: '列出 MongoDB 中的所有配置文档',
      inputSchema: {
        type: 'object',
        properties: {
          environment: {
            type: 'string',
            description: '环境名称过滤（可选）',
          },
          configKeyFilter: {
            type: 'string',
            description: '配置键名过滤（模糊匹配，可选）',
          },
        },
      },
      handler: async (args) => {
        const { environment, configKeyFilter } = args as {
          environment?: string;
          configKeyFilter?: string;
        };

        const configs = await mongoService.listConfigs(environment, configKeyFilter);

        return {
          success: true,
          data: configs.map((c) => ({
            configKey: c.configKey,
            environment: c.environment,
            version: c.version,
            description: c.metadata?.description,
            updatedAt: c.updatedAt,
          })),
          count: configs.length,
        };
      },
    },

    // 检查配置是否存在
    {
      name: 'mongo_config_exists',
      description: '检查指定的配置文档是否存在',
      inputSchema: {
        type: 'object',
        properties: {
          configKey: {
            type: 'string',
            description: '配置键名',
          },
          environment: {
            type: 'string',
            description: '环境名称',
          },
        },
        required: ['configKey', 'environment'],
      },
      handler: async (args) => {
        const { configKey, environment } = args as { configKey: string; environment: string };
        const exists = await mongoService.exists(configKey, environment);

        return {
          success: true,
          exists,
          message: exists
            ? `Config exists: ${configKey}@${environment}`
            : `Config not found: ${configKey}@${environment}`,
        };
      },
    },
  ];
}
