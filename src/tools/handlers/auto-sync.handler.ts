/**
 * 自动同步 MCP 工具
 */

import type { McpTool, ToolResponse } from '../types.js';
import type { AutoSyncScheduler, AutoSyncConfig, AutoSyncStatus } from '../../services/auto-sync/index.js';

/**
 * 创建自动同步工具集
 * @param getScheduler 获取调度器的函数（延迟获取，因为调度器可能在工具创建后才初始化）
 */
export function createAutoSyncTools(
  getScheduler: () => AutoSyncScheduler | null
): McpTool[] {
  return [
    // 启动自动同步
    {
      name: 'auto_sync_start',
      description: '启动自动同步服务，监听本地文件和远程知识库变化，自动进行双向同步',
      inputSchema: {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            description: '同步配置（可选）',
            properties: {
              mode: {
                type: 'string',
                enum: ['bidirectional', 'pull_only', 'push_only'],
                description: '同步模式：bidirectional=双向，pull_only=仅本地到远程，push_only=仅远程到本地',
              },
              enabledIDEs: {
                type: 'array',
                items: { type: 'string' },
                description: '启用的 IDE 列表',
              },
              watchPaths: {
                type: 'array',
                items: { type: 'string' },
                description: '额外的监听路径列表',
              },
            },
          },
        },
        required: [],
      },
      handler: async (args): Promise<ToolResponse> => {
        const scheduler = getScheduler();
        if (!scheduler) {
          return {
            success: false,
            error: '自动同步调度器未初始化',
          };
        }

        try {
          // 如果提供了配置，先更新配置
          const config = args.config as Partial<AutoSyncConfig> | undefined;
          if (config) {
            await scheduler.updateConfig(config);
          }

          // 启动调度器
          await scheduler.start();

          return {
            success: true,
            message: '自动同步服务已启动',
            data: scheduler.getStatus(),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '启动失败',
          };
        }
      },
    },

    // 停止自动同步
    {
      name: 'auto_sync_stop',
      description: '停止自动同步服务',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (): Promise<ToolResponse> => {
        const scheduler = getScheduler();
        if (!scheduler) {
          return {
            success: false,
            error: '自动同步调度器未初始化',
          };
        }

        try {
          await scheduler.stop();

          return {
            success: true,
            message: '自动同步服务已停止',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '停止失败',
          };
        }
      },
    },

    // 获取自动同步状态
    {
      name: 'auto_sync_status',
      description: '获取自动同步服务的运行状态和统计信息',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (): Promise<ToolResponse<AutoSyncStatus>> => {
        const scheduler = getScheduler();
        if (!scheduler) {
          return {
            success: false,
            error: '自动同步调度器未初始化',
          };
        }

        try {
          const status = scheduler.getStatus();

          return {
            success: true,
            data: status,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '获取状态失败',
          };
        }
      },
    },

    // 更新自动同步配置
    {
      name: 'auto_sync_config',
      description: '更新自动同步配置',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['bidirectional', 'pull_only', 'push_only'],
            description: '同步模式',
          },
          enabledIDEs: {
            type: 'array',
            items: { type: 'string' },
            description: '启用的 IDE 列表',
          },
          localDebounce: {
            type: 'number',
            description: '本地文件变更防抖延迟（毫秒）',
          },
          remoteThrottle: {
            type: 'number',
            description: '远程变更节流延迟（毫秒）',
          },
          batchSize: {
            type: 'number',
            description: '批量处理大小',
          },
          batchDelay: {
            type: 'number',
            description: '批量处理延迟（毫秒）',
          },
          conflictStrategy: {
            type: 'string',
            enum: ['last_write_wins', 'keep_local', 'keep_remote', 'manual'],
            description: '冲突解决策略',
          },
          watchPaths: {
            type: 'array',
            items: { type: 'string' },
            description: '监听路径列表',
          },
        },
        required: [],
      },
      handler: async (args): Promise<ToolResponse> => {
        const scheduler = getScheduler();
        if (!scheduler) {
          return {
            success: false,
            error: '自动同步调度器未初始化',
          };
        }

        try {
          const config: Partial<AutoSyncConfig> = {};

          if (args.mode) config.mode = args.mode as AutoSyncConfig['mode'];
          if (args.enabledIDEs) config.enabledIDEs = args.enabledIDEs as AutoSyncConfig['enabledIDEs'];
          if (args.localDebounce) config.localDebounce = args.localDebounce as number;
          if (args.remoteThrottle) config.remoteThrottle = args.remoteThrottle as number;
          if (args.batchSize) config.batchSize = args.batchSize as number;
          if (args.batchDelay) config.batchDelay = args.batchDelay as number;
          if (args.conflictStrategy) config.conflictStrategy = args.conflictStrategy as AutoSyncConfig['conflictStrategy'];
          if (args.watchPaths) config.watchPaths = args.watchPaths as string[];

          await scheduler.updateConfig(config);

          return {
            success: true,
            message: '配置已更新',
            data: scheduler.getConfig(),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '更新配置失败',
          };
        }
      },
    },

    // 手动触发刷新
    {
      name: 'auto_sync_flush',
      description: '手动触发处理所有待处理的同步事件',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (): Promise<ToolResponse> => {
        const scheduler = getScheduler();
        if (!scheduler) {
          return {
            success: false,
            error: '自动同步调度器未初始化',
          };
        }

        try {
          await scheduler.flush();

          return {
            success: true,
            message: '已处理所有待处理事件',
            data: scheduler.getStatus(),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '刷新失败',
          };
        }
      },
    },
  ];
}
