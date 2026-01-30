#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { KnowledgeService } from './services/knowledge-service.js';
import { SyncEngine } from './services/sync-engine.js';
import { SyncHistoryService } from './services/sync-history-service.js';
import { AutoSyncScheduler } from './services/auto-sync/index.js';
import { createKnowledgeTools, createAutoSyncTools, McpTool } from './tools/index.js';
import { loadConfig, validateConfig, createLogger } from './utils/config.js';

/**
 * 创建 MCP Server（stdio 模式）
 */
async function createStdioServer(tools: McpTool[]): Promise<Server> {
  const server = new Server(
    {
      name: 'mongo-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 列出可用工具
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // 调用工具
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }),
          },
        ],
      };
    }

    try {
      const result = await tool.handler(args || {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
      };
    }
  });

  return server;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 加载配置
  const config = loadConfig();
  const logger = createLogger(config);

  // 验证配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    logger.error('Configuration validation failed:');
    validation.errors.forEach((err) => logger.error(`  - ${err}`));
    process.exit(1);
  }

  logger.info('MongoDB MCP Server starting...');
  logger.info(`Database: ${config.database}/${config.collection}`);
  logger.info(`User: ${config.userId}, Device: ${config.deviceId}, IDE: ${config.ideSource}`);

  // 创建知识库服务
  const knowledgeService = new KnowledgeService(
    config.mongoUri,
    config.database,
    config.collection,
    {
      userId: config.userId,
      deviceId: config.deviceId,
      ideSource: config.ideSource,
    }
  );

  // 创建同步历史服务
  const syncHistoryService = new SyncHistoryService(config.mongoUri, config.database);

  // 自动同步调度器（延迟初始化）
  let autoSyncScheduler: AutoSyncScheduler | null = null;

  try {
    // 连接 MongoDB
    await knowledgeService.connect();
    logger.info('Connected to MongoDB');

    // 连接同步历史服务
    await syncHistoryService.connect();

    // 创建同步引擎
    const syncEngine = new SyncEngine(knowledgeService, syncHistoryService);

    // 创建自动同步调度器（仅本地 → 远程单向同步）
    autoSyncScheduler = new AutoSyncScheduler(syncEngine, {
      autoStart: true, // MCP 服务启动时自动开始
    });

    // 创建基础工具
    const tools = createKnowledgeTools(knowledgeService, config.enableEmbedding);

    // 添加自动同步工具
    const autoSyncTools = createAutoSyncTools(() => autoSyncScheduler);
    tools.push(...autoSyncTools);

    logger.info(`Loaded ${tools.length} tools (including auto-sync tools)`);

    // 创建并启动服务器
    const server = await createStdioServer(tools);
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Server started in stdio mode');

    // 自动启动同步调度器
    try {
      await autoSyncScheduler.start();
      logger.info('Auto-sync scheduler started');
    } catch (syncError) {
      logger.warn('Failed to start auto-sync scheduler:', syncError);
      // 不阻止服务启动，同步功能可以稍后手动启动
    }

    // 优雅关闭
    const shutdown = async () => {
      logger.info('Shutting down...');

      // 停止自动同步调度器
      if (autoSyncScheduler) {
        try {
          await autoSyncScheduler.stop();
          logger.info('Auto-sync scheduler stopped');
        } catch {
          // 忽略停止错误
        }
      }

      // 断开同步历史服务
      await syncHistoryService.disconnect();

      // 断开知识库服务
      await knowledgeService.disconnect();

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

main();
