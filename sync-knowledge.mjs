// 知识库数据同步脚本
import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'knowledge';
const COLLECTION_NAME = 'context';

// 来源类型: qoder | trae | cursor | windsurf | vscode | manual | sync-script | other
const DEFAULT_SOURCE = 'qoder'; // 当前 IDE 来源
const SOURCE_PROJECT = 'ConcreteFrameCloud/clientapi';

// 待同步的规则
const rules = [
  {
    type: 'Rules',
    name: 'ai-standards',
    content: `# 智能辅助与自动化规则

1. 工具优先 - 先检查并调用匹配的 Skills/Agents
2. 记忆增强 - 执行前检索并应用核心记忆
3. 产出物验证 - 每次改动后执行构建/测试
4. 持续学习 - 将稳定经验记录为长期记忆
5. 语言与安全 - 默认中文；禁止记录密钥/隐私数据`,
    description: 'AI 协作基础规则',
    tags: ['ai', 'automation', 'standards'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceProject: SOURCE_PROJECT,
    sourcePath: '.trae/rules/ai-standards.md',
  },
  {
    type: 'Rules',
    name: 'coding-standards',
    content: `# 代码生成与质量规范

1. 遵循 .editorconfig 规范
2. 强制 XML 文档注释
3. 单一职责与模块化
4. 类长度不超过 200 行
5. 分层架构: Controller → Service → Repository
6. API 统一返回 TPResponse<T>
7. 多租户基于 TenantId 切换
8. 模型分类: Entity/DTO/VO`,
    description: '代码生成与质量规范',
    tags: ['coding', 'standards', 'quality'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceProject: SOURCE_PROJECT,
    sourcePath: '.trae/rules/coding-standards.md',
  },
  {
    type: 'Rules',
    name: 'project-rules',
    content: `# 项目开发与架构规范 (ConcreteFrameClientAPI)

技术栈: .NET 8, ASP.NET Core, SqlSugar, NLog, Quartz, Swagger, Casbin
架构: Controller → Service → Repository
返回体: TPResponse<T>
依赖注入: C# 12 主构造函数
多租户: TenantId 自动切换
模型: Entity(ModelDb)/DTO(ModelDto)/VO(ModelVo)`,
    description: 'ConcreteFrameClientAPI 项目架构规范',
    tags: ['project', 'architecture', '.net'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceProject: SOURCE_PROJECT,
    sourcePath: '.trae/rules/project-rules.md',
  },
];

// 待同步的技能
const skills = [
  {
    type: 'Skills',
    name: 'compile-error-fixer',
    content: `构建失败/编译错误修复技能
1. 收集错误日志
2. 定位问题文件和行号
3. 分析根因(语法/类型/依赖)
4. 应用修复
5. 重新构建验证`,
    description: '分析并修复编译错误',
    tags: ['build', 'error', 'fix'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceProject: SOURCE_PROJECT,
    sourcePath: '.trae/skills/compile-error-fixer/SKILL.md',
  },
  {
    type: 'Skills',
    name: 'mcp-builder',
    content: `MCP Server 构建指南
- 工具命名: 动词+领域前缀
- 输入输出: schema完整、字段描述清晰
- 错误处理: 可执行的下一步提示
- 四阶段: 调研→设计→实现→评测`,
    description: '构建高质量 MCP Server 与工具设计',
    tags: ['mcp', 'server', 'tools'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceProject: SOURCE_PROJECT,
    sourcePath: '.trae/skills/mcp-builder/SKILL.md',
  },
  {
    type: 'Skills',
    name: 'personal-ai-profile-sync',
    content: `个人 AI 技能与习惯同步
目标目录: .trae/my-ai-skills-and-habits
行为: 不存在则 clone，存在则 pull
仓库: github.com/fengyongtao/my-ai-skills-and-habits`,
    description: '同步个人 AI 技能与习惯仓库',
    tags: ['sync', 'profile', 'habits'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceProject: SOURCE_PROJECT,
    sourcePath: '.trae/skills/personal-ai-profile-sync/SKILL.md',
  },
  {
    type: 'Skills',
    name: 'memory-sync',
    content: `记忆同步技能
- 将 Quest 内置记忆同步到 MongoDB 知识库
- 支持双向查询：Quest ↔ MongoDB
- 使用 upsert 方式，不删除现有数据`,
    description: '同步记忆到 MongoDB 知识库',
    tags: ['sync', 'memory', 'mongodb'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceProject: SOURCE_PROJECT,
    sourcePath: '.trae/skills/memory-sync/SKILL.md',
  },
];

// 待同步的记忆 (合并 Quest 内置记忆 + 自定义记忆)
const memories = [
  // === 用户偏好 ===
  {
    type: 'Memories',
    name: 'user-communication-preferences',
    content: `沟通偏好:
- 默认中文交流
- 先结论后分析
- 复杂信息用表格/列表
- 简单问题快速回答，复杂问题深入分析`,
    description: '用户沟通偏好',
    tags: ['preference', 'communication'],
    enabled: true,
    source: 'manual',
    sourceProject: SOURCE_PROJECT,
  },
  {
    type: 'Memories',
    name: 'user-workflow-preferences',
    content: `工作方式偏好:
- 设计类: 先梳理模块边界和数据流
- 性能类: 先确认瓶颈再重构
- 风险改动: 先小范围试点
- Git提交: 精简中文注释
- 代码规范: 补齐XML文档注释`,
    description: '用户工作方式偏好',
    tags: ['preference', 'workflow'],
    enabled: true,
    source: 'manual',
    sourceProject: SOURCE_PROJECT,
  },
  {
    type: 'Memories',
    name: 'mongodb-typo-correction',
    content: `用户输入习惯:
- 用户常将 mongodb 误写为 mongodo
- AI 应自动纠正为 mongodb`,
    description: '用户输入习惯纠正',
    tags: ['typo', 'mongodb', 'preference'],
    enabled: true,
    source: 'manual',
    sourceProject: SOURCE_PROJECT,
  },
  // === 项目技术栈 ===
  {
    type: 'Memories',
    name: 'dotnet-tech-stack',
    content: `**开发框架**: .NET 6/7+ Web API

**核心库与服务**：
- SqlSugar 5.x+: 轻量级ORM，替代Entity Framework
- Casbin: 基于RBAC模型的权限控制（rbac_model.conf）
- RestSharp: 第三方HTTP客户端调用
- log4net: 日志框架
- NPOI: Excel处理

**架构风格**: 分层架构（Controller-Service-Model-Infrastructure），支持多租户、数据权限（DataScopeEnum）`,
    description: '.NET后端技术栈与核心依赖',
    tags: ['tech-stack', '.net', 'sqlsugar', 'casbin', 'backend'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: '5cff8e78-3d34-4953-a8b0-6b6d1bdd97da',
    sourceProject: SOURCE_PROJECT,
  },
  // === 项目配置 ===
  {
    type: 'Memories',
    name: 'mcp-json-config-lines-8-13',
    content: `mcp.json 文件第8至13行是项目关键配置段，需明确其字段含义、作用及取值约束，用于指导配置修改与功能对齐。`,
    description: 'mcp.json 第8-13行配置含义',
    tags: ['config', 'mcp.json', 'configuration'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: 'e211b975-980a-4e85-be63-f6034d59c409',
    sourceProject: SOURCE_PROJECT,
  },
  {
    type: 'Memories',
    name: 'knowledge-service-connection',
    content: `knowledge服务的连接配置需在mcp.json文件中设置（第8-13行），包括服务地址、端口、认证凭据等；同时必须设置环境变量MONGODB_COLLECTION，用于指定MongoDB中存储知识数据的集合名称，该变量不可省略。`,
    description: 'knowledge服务连接配置要求',
    tags: ['config', 'knowledge', 'mongodb', 'environment'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: '9c84f2bd-8fd3-4bfd-a75f-882b3401a236',
    sourceProject: SOURCE_PROJECT,
  },
  {
    type: 'Memories',
    name: 'mongodb-collection-required',
    content: `MONGODB_COLLECTION是连接knowledge必需的环境变量，不可省略，用于指定MongoDB中存储知识数据的集合名称。`,
    description: 'MONGODB_COLLECTION配置必要性',
    tags: ['config', 'mongodb', 'environment-variable'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: '649839d3-2268-4079-9a3a-00155db6d554',
    sourceProject: SOURCE_PROJECT,
  },
  {
    type: 'Memories',
    name: 'mcp-mongodb-connection',
    content: `MCP插件运行时需连接MongoDB，连接地址为 mongodb://localhost:27017`,
    description: 'MCP插件MongoDB连接配置',
    tags: ['config', 'mongodb', 'mcp', 'connection'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: '77855bcd-8498-4f88-ba54-a73fa48a80c9',
    sourceProject: SOURCE_PROJECT,
  },
  // === 项目介绍 ===
  {
    type: 'Memories',
    name: 'mcp-tool-independence',
    content: `MCP工具是一个独立于当前主项目的外部工具，不依赖主项目代码、构建流程和运行环境，需自主完成设计、开发、打包与部署。`,
    description: 'MCP工具的独立性定位',
    tags: ['mcp', 'architecture', 'independence'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: '0e0c0655-825b-4cab-98af-2302c9c5e7d4',
    sourceProject: SOURCE_PROJECT,
  },
  {
    type: 'Memories',
    name: 'mcp-tool-definition',
    content: `MCP工具是一个独立外部工具，核心功能是通过MongoDB持久化并同步AI对话过程中的关键状态数据，包括记忆（memory）、MCP定义、技能（skills）和规则（rules），以支持跨会话的数据复用与能力延续。`,
    description: 'MCP工具核心功能定位',
    tags: ['mcp', 'mongodb', 'sync', 'persistence'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: '98718f5c-3870-40cf-8de6-76b91ace6d06',
    sourceProject: SOURCE_PROJECT,
  },
  {
    type: 'Memories',
    name: 'clientapi-project-overview',
    content: `**项目定位**: 面向土木工程领域的结构计算与钢筋深化设计API平台

**核心业务模块**：
- Rebar: 钢筋操作（梁/柱/板/基础配筋、图谱导出）
- StructCal: 结构计算（梁柱设计、楼板分析、SAP2000接口SafeSapLink）
- Sys: 通用系统管理（用户/角色/菜单/字典/日志/租户）
- ProjectInfo/ProjectOBS: 项目信息与对象存储集成`,
    description: 'clientApi项目功能架构与业务领域',
    tags: ['project', 'architecture', 'rebar', 'structcal', 'engineering'],
    enabled: true,
    source: DEFAULT_SOURCE,
    sourceId: 'ec14c45a-9aef-41f0-ad5d-506a141603ac',
    sourceProject: SOURCE_PROJECT,
  },
];

// MCP 配置
const mcps = [
  {
    type: 'MCPs',
    name: 'mongo-mcp',
    content: {
      command: 'node',
      args: ['C:\\Users\\fengyongtao\\AppData\\Roaming\\mongo-mcp\\dist\\index.js'],
      env: {
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DATABASE: 'config_db',
        MONGODB_COLLECTION: 'ConfigModules',
        KNOWLEDGE_DATABASE: 'knowledge',
        KNOWLEDGE_COLLECTION: 'context',
        ENABLE_CHANGE_STREAM: 'false',
      },
      tools: [
        'knowledge_create', 'knowledge_read', 'knowledge_update', 'knowledge_delete',
        'knowledge_list', 'knowledge_stats', 'memory_add', 'memory_search',
        'mcp_sync', 'rule_sync', 'skill_sync',
      ],
    },
    description: 'MongoDB 知识库 MCP 工具',
    tags: ['mcp', 'mongodb', 'knowledge'],
    enabled: true,
    source: 'sync-script',
    sourceProject: SOURCE_PROJECT,
    sourcePath: 'C:\\Users\\fengyongtao\\AppData\\Roaming\\mongo-mcp',
  },
];

async function sync() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // 创建索引
    await collection.createIndex({ type: 1, name: 1 }, { unique: true });
    await collection.createIndex({ source: 1 });
    await collection.createIndex({ sourceProject: 1 });
    
    const allDocs = [...rules, ...skills, ...memories, ...mcps];
    let created = 0;
    let updated = 0;
    
    for (const doc of allDocs) {
      const now = new Date();
      const result = await collection.updateOne(
        { type: doc.type, name: doc.name },
        {
          $set: { ...doc, updatedAt: now, syncedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      
      if (result.upsertedCount > 0) {
        created++;
        console.log(`Created: [${doc.source}] ${doc.type}/${doc.name}`);
      } else if (result.modifiedCount > 0) {
        updated++;
        console.log(`Updated: [${doc.source}] ${doc.type}/${doc.name}`);
      }
    }
    
    console.log(`\nSync completed: ${created} created, ${updated} updated`);
    
    // 统计
    const stats = {};
    for (const type of ['MCPs', 'Memories', 'Rules', 'Skills']) {
      stats[type] = await collection.countDocuments({ type });
    }
    console.log('Stats:', stats);
    
    // 来源统计
    const sources = await collection.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log('Sources:', sources.map(s => `${s._id}: ${s.count}`).join(', '));
    
  } finally {
    await client.close();
  }
}

sync().catch(console.error);
