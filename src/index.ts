#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MongoService } from './services/mongo-service.js';
import { KnowledgeService } from './services/knowledge-service.js';
import { createMongoTools, McpTool } from './tools/config-tools.js';
import { createKnowledgeTools } from './tools/knowledge-tools.js';
import { createDashboardRoutes } from './dashboard/routes.js';
import { getSSEManager } from './dashboard/sse.js';
import { ServerConfig } from './types.js';

// 加载环境变量
dotenv.config();

/**
 * 知识库配置
 */
interface KnowledgeConfig {
  database: string;
  collection: string;
}

/**
 * 获取服务器配置
 */
function getConfig(): ServerConfig & { knowledge: KnowledgeConfig } {
  return {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'config_db',
    collection: process.env.MONGODB_COLLECTION || 'ConfigModules',
    httpPort: parseInt(process.env.HTTP_PORT || '3100', 10),
    enableChangeStream: process.env.ENABLE_CHANGE_STREAM !== 'false',
    logLevel: (process.env.LOG_LEVEL as ServerConfig['logLevel']) || 'info',
    knowledge: {
      database: process.env.KNOWLEDGE_DATABASE || 'knowledge',
      collection: process.env.KNOWLEDGE_COLLECTION || 'context',
    },
  };
}

/**
 * 创建 MCP Server（stdio 模式）
 */
async function createStdioServer(mongoService: MongoService, tools: McpTool[]): Promise<void> {
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

  // 启动 stdio 传输
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Server started in stdio mode');
}

/**
 * 创建 HTTP Server
 */
async function createHttpServer(
  mongoService: MongoService,
  knowledgeService: KnowledgeService,
  tools: McpTool[],
  port: number
): Promise<void> {
  const app = express();
  app.use(express.json());

  // 获取项目根目录
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const publicPath = path.join(__dirname, '..', 'public');

  // 静态文件服务（Dashboard 前端）
  app.use(express.static(publicPath));

  // Dashboard API 路由
  const dashboardRoutes = createDashboardRoutes(knowledgeService);
  app.use('/api', dashboardRoutes);

  // SSE 事件流
  app.get('/api/events', (req, res) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    getSSEManager().addClient(clientId, res);
  });

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 列出可用工具
  app.get('/tools', (_req, res) => {
    res.json({
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  });

  // 调用工具
  app.post('/invoke', async (req, res) => {
    const { tool: toolName, parameters } = req.body;

    if (!toolName) {
      res.status(400).json({ success: false, error: 'Missing tool name' });
      return;
    }

    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      res.status(404).json({ success: false, error: `Unknown tool: ${toolName}` });
      return;
    }

    try {
      const result = await tool.handler(parameters || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // MCP 兼容端点（JSON-RPC 风格）
  app.post('/mcp', async (req, res) => {
    const { method, params, id } = req.body;

    try {
      let result: unknown;

      switch (method) {
        case 'tools/list':
          result = {
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          };
          break;

        case 'tools/call': {
          const { name, arguments: args } = params || {};
          const tool = tools.find((t) => t.name === name);

          if (!tool) {
            res.json({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Unknown tool: ${name}` },
            });
            return;
          }

          result = await tool.handler(args || {});
          break;
        }

        default:
          res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Unknown method: ${method}` },
          });
          return;
      }

      res.json({ jsonrpc: '2.0', id, result });
    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      });
    }
  });

  app.listen(port, () => {
    console.log(`[MCP] HTTP Server started on port ${port}`);
    console.log(`[MCP] Dashboard: http://localhost:${port}/`);
    console.log(`[MCP] Endpoints:`);
    console.log(`  - GET  /           - Dashboard UI`);
    console.log(`  - GET  /api/knowledge  - List documents`);
    console.log(`  - GET  /api/search     - Semantic search`);
    console.log(`  - GET  /api/stats      - Statistics`);
    console.log(`  - GET  /health     - Health check`);
    console.log(`  - GET  /tools      - List available tools`);
    console.log(`  - POST /invoke     - Invoke a tool`);
    console.log(`  - POST /mcp        - MCP JSON-RPC endpoint`);
  });
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const config = getConfig();
  const isHttpMode = process.argv.includes('--http');

  console.error('[MCP] MongoDB MCP Server starting...');
  console.error(`[MCP] Mode: ${isHttpMode ? 'HTTP' : 'stdio'}`);
  console.error(`[MCP] Config DB: ${config.database}/${config.collection}`);
  console.error(`[MCP] Knowledge DB: ${config.knowledge.database}/${config.knowledge.collection}`);

  // 创建服务
  const mongoService = new MongoService(config);
  const knowledgeService = new KnowledgeService(
    config.mongoUri,
    config.knowledge.database,
    config.knowledge.collection
  );

  try {
    // 连接 MongoDB
    await mongoService.connect();
    await knowledgeService.connect();

    // 启动 Change Stream（仅配置服务）
    if (config.enableChangeStream) {
      await mongoService.startChangeStream();

      // 监听配置变更
      mongoService.onConfigChange((event) => {
        console.error(
          `[MCP] Config change detected: ${event.operationType} ${event.configKey}@${event.environment}`
        );
      });
    }

    // 创建工具（合并配置工具和知识库工具）
    const configTools = createMongoTools(mongoService);
    const knowledgeTools = createKnowledgeTools(knowledgeService);
    const tools = [...configTools, ...knowledgeTools];

    console.error(`[MCP] Loaded ${tools.length} tools (${configTools.length} config + ${knowledgeTools.length} knowledge)`);

    // 根据模式启动服务器
    if (isHttpMode) {
      await createHttpServer(mongoService, knowledgeService, tools, config.httpPort);
    } else {
      await createStdioServer(mongoService, tools);
    }

    // 优雅关闭
    const shutdown = async () => {
      console.error('[MCP] Shutting down...');
      await mongoService.stopChangeStream();
      await mongoService.disconnect();
      await knowledgeService.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[MCP] Failed to start:', error);
    process.exit(1);
  }
}

main();
