/**
 * 数据同步脚本 - 将记忆、规则、MCP 配置同步到 MongoDB
 */
import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb://47.104.213.226:27017';
const DATABASE = 'knowledge';
const COLLECTION = 'context';
const USER_ID = 'default';
const DEVICE_ID = 'qoder-sync';
const IDE_SOURCE = 'qoder';

// 记忆数据
const memories = [
  {
    name: '用户图表表达、指令响应与输出格式偏好规范',
    content: `用户沟通偏好设定：

**图表表达规范**：
- 偏好结构化图表辅助说明（如流程图、表格、树状图等），确保逻辑清晰、层次分明
- 具体实现时优先选用 Mermaid 或 Canvas 等绘图工具生成可视化内容

**/compact 指令响应规范**：
- 用户使用 '/compact' 指令时，AI需跳过分析过程，仅输出核心结论与必要结构化图表（如Mermaid流程图/表格）
- 禁用解释性文字、过渡句和冗余说明

**功能不可用提示规范**：
- 当检测到某功能在当前项目中不可用时，必须主动、明确提示'当前项目不支持'
- 不省略、不模糊表述

**代码修改点输出规范（commit风格）**：
- 代码修改点总结需极度精简，严格适配 git commit 规范：
  - 单行输出
  - 动词开头（如 add/remove/update/fix）
  - 优先控制在 50 字符内
  - 避免标点符号（句号、逗号等）
  - 内容可直接复制粘贴用于 commit message`,
    description: 'user_preference',
    tags: ['用户偏好', '输出格式', '图表', 'commit']
  },
  {
    name: '记忆写入更新策略',
    content: "记忆写入Mongo时采用'存在即更新'策略：若已存在相同规则（基于唯一标识或语义相似性判定），则执行更新操作，禁止重复新增，确保知识库中规则唯一且最新。",
    description: 'project_configuration',
    tags: ['记忆', '更新策略', 'upsert']
  },
  {
    name: 'Mongo-Knowledge核心功能与定位',
    content: `**核心功能定位**：MongoDB MCP Server —— 配置管理工具

**关键能力**：
- 配置项的CRUD操作
- 基于MongoDB Change Stream的实时数据变更监听与响应
- 支持知识库服务（knowledge-service）与MongoDB底层交互（mongo-service）`,
    description: 'project_introduction',
    tags: ['mongo-knowledge', '功能定位', 'MCP']
  },
  {
    name: '项目源码目录结构与模块职责',
    content: `**源码结构**：
- \`src/services/\`: 核心服务层
  - \`knowledge-service.ts\`: 知识库业务逻辑
  - \`mongo-service.ts\`: MongoDB数据访问
- \`src/tools/\`: 工具函数
  - \`config-tools.ts\`: 配置操作工具
  - \`knowledge-tools.ts\`: 知识库操作工具
- \`src/index.ts\`: 应用入口
- \`qoder-mcp-config.json\`: MCP配置文件`,
    description: 'project_structure',
    tags: ['源码结构', '目录', '模块']
  },
  {
    name: 'Mongo-MCP后端技术栈',
    content: `**核心依赖**：
- \`@modelcontextprotocol/sdk 1.0.0+\`: MCP协议实现
- \`mongodb 6.3.0+\`: 数据库驱动，支持Change Stream
- \`express 4.18.2+\`: HTTP服务框架
- \`dotenv 16.3.1+\`: 环境变量加载
- \`zod 3.22.4+\`: 数据验证

**开发依赖**：TypeScript 5.3.0、ESLint、tsx（热重载）`,
    description: 'tech_stack',
    tags: ['技术栈', '依赖', 'MongoDB', 'MCP']
  },
  {
    name: '知识库自动同步机制',
    content: '项目需实现自动知识同步机制：当记忆、技能或规则任一类型发生更新时，系统应自动将变更内容同步至用户知识库，确保知识库实时性与一致性。',
    description: 'project_introduction',
    tags: ['知识库', '自动同步', '实时']
  }
];

// 规则数据
const rules = [
  {
    name: 'auto-merge',
    content: {
      text: '当我的记忆、规则、指令、mcp等更新时,自动触发mongo mcp',
      triggerMode: 'always_on',
      priority: 1
    },
    description: '自动同步触发规则',
    tags: ['自动同步', 'mongo-knowledge', '触发器']
  }
];

// MCP 配置数据
const mcps = [
  {
    name: 'mongo-knowledge',
    content: {
      command: 'node',
      args: ['C:\\Users\\fengyongtao\\AppData\\Roaming\\mongo-knowledge\\dist\\index.js'],
      env: {
        ENABLE_CHANGE_STREAM: 'false',
        KNOWLEDGE_COLLECTION: 'context',
        KNOWLEDGE_DATABASE: 'knowledge',
        MONGODB_COLLECTION: 'ConfigModules',
        MONGODB_DATABASE: 'config_db',
        MONGODB_URI: 'mongodb://47.104.213.226:27017'
      }
    },
    description: 'MongoDB MCP Server - 知识库管理',
    tags: ['mcp', 'mongodb', '知识库']
  },
  {
    name: 'sequential-thinking',
    content: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
    },
    description: '顺序思考 MCP Server',
    tags: ['mcp', 'thinking']
  },
  {
    name: 'win-cli',
    content: {
      command: 'node',
      args: ['D:\\tools\\win-cli-mcp-server\\dist\\index.js'],
      env: {
        CONFIG_PATH: 'D:\\tools\\win-cli-mcp-server\\config.json'
      }
    },
    description: 'Windows CLI MCP Server',
    tags: ['mcp', 'cli', 'windows']
  },
  {
    name: 'github',
    content: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github']
    },
    description: 'GitHub MCP Server',
    tags: ['mcp', 'github']
  }
];

async function syncData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE);
    const collection = db.collection(COLLECTION);
    
    // 确保索引存在
    await collection.createIndex({ userId: 1, type: 1, name: 1 }, { unique: true });
    
    const now = new Date();
    let syncedCount = { memories: 0, rules: 0, mcps: 0 };
    
    // 同步记忆
    console.log('\n--- Syncing Memories ---');
    for (const memory of memories) {
      const doc = {
        type: 'Memories',
        name: memory.name,
        content: memory.content,
        description: memory.description,
        tags: memory.tags,
        enabled: true,
        userId: USER_ID,
        deviceId: DEVICE_ID,
        ideSource: IDE_SOURCE,
      };
      
      const existing = await collection.findOne({ userId: USER_ID, type: 'Memories', name: memory.name });
      let result;
      if (existing) {
        result = await collection.updateOne(
          { userId: USER_ID, type: 'Memories', name: memory.name },
          { 
            $set: { ...doc, updatedAt: now },
            $inc: { syncVersion: 1 }
          }
        );
      } else {
        result = await collection.insertOne({
          ...doc,
          createdAt: now,
          updatedAt: now,
          syncVersion: 1
        });
      }
      
      const action = existing ? 'Updated' : 'Created';
      console.log(`${action}: ${memory.name}`);
      syncedCount.memories++;
    }
    
    // 同步规则
    console.log('\n--- Syncing Rules ---');
    for (const rule of rules) {
      const doc = {
        type: 'Rules',
        name: rule.name,
        content: rule.content,
        description: rule.description,
        tags: rule.tags,
        enabled: true,
        userId: USER_ID,
        deviceId: DEVICE_ID,
        ideSource: IDE_SOURCE,
      };
      
      const existingRule = await collection.findOne({ userId: USER_ID, type: 'Rules', name: rule.name });
      if (existingRule) {
        await collection.updateOne(
          { userId: USER_ID, type: 'Rules', name: rule.name },
          { 
            $set: { ...doc, updatedAt: now },
            $inc: { syncVersion: 1 }
          }
        );
      } else {
        await collection.insertOne({
          ...doc,
          createdAt: now,
          updatedAt: now,
          syncVersion: 1
        });
      }
      
      const action = existingRule ? 'Updated' : 'Created';
      console.log(`${action}: ${rule.name}`);
      syncedCount.rules++;
    }
    
    // 同步 MCP 配置
    console.log('\n--- Syncing MCPs ---');
    for (const mcp of mcps) {
      const doc = {
        type: 'MCPs',
        name: mcp.name,
        content: mcp.content,
        description: mcp.description,
        tags: mcp.tags,
        enabled: true,
        userId: USER_ID,
        deviceId: DEVICE_ID,
        ideSource: IDE_SOURCE,
      };
      
      // 查找时先按 type+name 查找（兼容旧索引）
      const existingMcp = await collection.findOne({ type: 'MCPs', name: mcp.name });
      if (existingMcp) {
        await collection.updateOne(
          { type: 'MCPs', name: mcp.name },
          { 
            $set: { ...doc, updatedAt: now },
            $inc: { syncVersion: 1 }
          }
        );
      } else {
        await collection.insertOne({
          ...doc,
          createdAt: now,
          updatedAt: now,
          syncVersion: 1
        });
      }
      
      const action = existingMcp ? 'Updated' : 'Created';
      console.log(`${action}: ${mcp.name}`);
      syncedCount.mcps++;
    }
    
    console.log('\n=== Sync Complete ===');
    console.log(`Memories: ${syncedCount.memories}`);
    console.log(`Rules: ${syncedCount.rules}`);
    console.log(`MCPs: ${syncedCount.mcps}`);
    console.log(`Total: ${syncedCount.memories + syncedCount.rules + syncedCount.mcps}`);
    
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

syncData();
