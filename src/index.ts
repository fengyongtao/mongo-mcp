#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { KnowledgeService } from './services/knowledge-service.js';
import { createKnowledgeTools, McpTool } from './tools/knowledge-tools.js';
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

  try {
    // 连接 MongoDB
    await knowledgeService.connect();
    logger.info('Connected to MongoDB');

    // 创建工具
    const tools = createKnowledgeTools(knowledgeService, config.enableEmbedding);
    logger.info(`Loaded ${tools.length} tools`);

    // 创建并启动服务器
    const server = await createStdioServer(tools);
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Server started in stdio mode');

    // 优雅关闭
    const shutdown = async () => {
      logger.info('Shutting down...');
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
