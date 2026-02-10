# 其他 IDE 支持

<cite>
**本文档引用的文件**
- [package.json](file://package.json)
- [examples/mcp-config.json](file://examples/mcp-config.json)
- [src/utils/config.ts](file://src/utils/config.ts)
- [src/index.ts](file://src/index.ts)
- [src/services/knowledge-service.ts](file://src/services/knowledge-service.ts)
- [src/tools/knowledge-tools.ts](file://src/tools/knowledge-tools.ts)
- [src/types.ts](file://src/types.ts)
- [src/services/embedding-service.ts](file://src/services/embedding-service.ts)
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts)
- [src/services/sync-history-service.ts](file://src/services/sync-history-service.ts)
- [src/services/conflict-resolver.ts](file://src/services/conflict-resolver.ts)
- [src/tools/handlers/sync.tools.ts](file://src/tools/handlers/sync.tools.ts)
- [src/adapters/types.ts](file://src/adapters/types.ts)
- [src/adapters/base.adapter.ts](file://src/adapters/base.adapter.ts)
- [src/adapters/qoder.adapter.ts](file://src/adapters/qoder.adapter.ts)
- [src/adapters/cursor.adapter.ts](file://src/adapters/cursor.adapter.ts)
- [src/adapters/ide.adapters.ts](file://src/adapters/ide.adapters.ts)
- [src/tools/handlers/sync.handler.ts](file://src/tools/handlers/sync.handler.ts)
- [src/tools/index.ts](file://src/tools/index.ts)
- [src/tools/types.ts](file://src/tools/types.ts)
- [src/types/sync.types.ts](file://src/types/sync.types.ts)
</cite>

## 更新摘要
**所做更改**
- 新增了完整的同步架构支持说明
- 增加了跨 IDE 迁移指南和最佳实践
- 更新了 IDE 兼容性矩阵和功能对比
- 新增了同步工具和冲突解决机制说明
- 完善了配置模板和参数说明

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [IDE 集成指南](#ide-集成指南)
7. [同步架构支持](#同步架构支持)
8. [配置模板与参数说明](#配置模板与参数说明)
9. [IDE 兼容性矩阵](#ide-兼容性矩阵)
10. [跨 IDE 迁移指南](#跨-ide-迁移指南)
11. [最佳实践](#最佳实践)
12. [故障排除指南](#故障排除指南)
13. [结论](#结论)

## 简介

MongoDB MCP Server 是一个跨 IDE 的知识库管理工具，支持记忆、技能、规则、MCP、经验、命令、上下文、工作流等多种知识类型。该项目特别关注支持多种 IDE 平台，包括 Qoder、Trae、Cursor、Windsurf、VS Code 等，为开发者提供统一的知识管理体验。

该工具基于 MCP (Model Context Protocol) 协议，通过标准的命令行接口与各种 IDE 集成，实现知识库的跨平台同步和管理。项目采用 TypeScript 构建，使用 MongoDB 作为持久化存储，支持向量嵌入和语义搜索功能。

**新增** 项目现已支持完整的同步架构，包括双向同步、冲突解决、同步历史记录等功能，为用户提供更加稳定和可靠的知识管理体验。

## 项目结构

项目采用模块化的架构设计，主要包含以下核心目录和文件：

```mermaid
graph TB
subgraph "项目根目录"
PJSON[package.json]
README[README.md]
TSConfig[tsconfig.json]
end
subgraph "源代码 (src)"
INDEX[src/index.ts]
subgraph "服务层 (services)"
KSERVICE[src/services/knowledge-service.ts]
EMBED[src/services/embedding-service.ts]
SYNC_ENGINE[src/services/sync-engine.ts]
SYNC_HISTORY[src/services/sync-history-service.ts]
CONFLICT_RESOLVER[src/services/conflict-resolver.ts]
end
subgraph "适配器层 (adapters)"
BASE_ADAPTER[src/adapters/base.adapter.ts]
QODER_ADAPTER[src/adapters/qoder.adapter.ts]
CURSOR_ADAPTER[src/adapters/cursor.adapter.ts]
IDE_ADAPTERS[src/adapters/ide.adapters.ts]
ADAPTER_TYPES[src/adapters/types.ts]
end
subgraph "工具层 (tools)"
KTOOLS[src/tools/knowledge-tools.ts]
SYNC_TOOLS[src/tools/handlers/sync.tools.ts]
SYNC_HANDLER[src/tools/handlers/sync.handler.ts]
TOOLS_INDEX[src/tools/index.ts]
TOOLS_TYPES[src/tools/types.ts]
end
subgraph "工具函数 (utils)"
CONFIG[src/utils/config.ts]
end
TYPES[src/types.ts]
SUB_TYPES[src/types/sync.types.ts]
end
subgraph "示例配置 (examples)"
MCONFIG[examples/mcp-config.json]
end
subgraph "临时技能 (temp-skills)"
TREADME[temp-skills/README.md]
end
PJSON --> INDEX
INDEX --> KSERVICE
INDEX --> SYNC_ENGINE
INDEX --> SYNC_HISTORY
INDEX --> CONFLICT_RESOLVER
INDEX --> KTOOLS
INDEX --> CONFIG
KSERVICE --> EMBED
KTOOLS --> SYNC_TOOLS
SYNC_TOOLS --> SYNC_ENGINE
SYNC_ENGINE --> SYNC_HISTORY
SYNC_ENGINE --> CONFLICT_RESOLVER
SYNC_ENGINE --> ADAPTER_TYPES
ADAPTER_TYPES --> BASE_ADAPTER
BASE_ADAPTER --> QODER_ADAPTER
BASE_ADAPTER --> CURSOR_ADAPTER
BASE_ADAPTER --> IDE_ADAPTERS
KTOOLS --> TOOLS_INDEX
TOOLS_INDEX --> SYNC_HANDLER
TOOLS_INDEX --> TOOLS_TYPES
CONFIG --> TYPES
```

**图表来源**
- [package.json](file://package.json#L1-L48)
- [src/index.ts](file://src/index.ts#L1-L148)
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L1-L451)
- [src/adapters/types.ts](file://src/adapters/types.ts#L1-L133)

**章节来源**
- [package.json](file://package.json#L1-L48)
- [src/index.ts](file://src/index.ts#L1-L148)

## 核心组件

### MCP 服务器核心

项目的核心是一个基于 MCP 协议的服务器实现，支持标准的工具调用和列表功能：

```mermaid
classDiagram
class Server {
+name : string
+version : string
+capabilities : object
+setRequestHandler(schema, handler)
+connect(transport)
}
class KnowledgeService {
-client : MongoClient
-db : Db
-collection : Collection
+connect()
+disconnect()
+create(doc)
+get(type, name)
+update(type, name, updates)
+delete(type, name)
+list(options)
+semanticSearch(query, options)
}
class SyncEngine {
-knowledgeService : KnowledgeService
-historyService : SyncHistoryService
-config : SyncEngineConfig
+syncFromIDE(ideSource, configPath)
+syncToIDE(ideSource, configPath, types)
+syncBidirectional(ideSource, configPath)
+getSyncStatus(userId)
+calculateDelta(ideSource, since)
}
class ConflictResolver {
-client : MongoClient
-db : Db
-collection : Collection
+recordConflict(userId, document, remoteContent, remoteSource)
+resolveConflict(conflictId, resolution, resolvedBy, mergedContent)
+getUnresolvedConflicts(userId, type)
+batchResolve(conflictIds, resolution, resolvedBy)
}
class Config {
+mongoUri : string
+database : string
+collection : string
+userId : string
+deviceId : string
+ideSource : string
+enableEmbedding : boolean
+logLevel : string
+loadConfig()
+validateConfig()
+createLogger()
}
Server --> KnowledgeService : "使用"
Server --> SyncEngine : "协调同步"
SyncEngine --> KnowledgeService : "操作知识库"
SyncEngine --> ConflictResolver : "处理冲突"
KnowledgeService --> Config : "依赖"
```

**图表来源**
- [src/index.ts](file://src/index.ts#L16-L82)
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L47-L60)
- [src/services/conflict-resolver.ts](file://src/services/conflict-resolver.ts#L24-L34)
- [src/utils/config.ts](file://src/utils/config.ts#L11-L91)

### 知识库文档模型

系统支持八种不同的知识类型，每种类型都有特定的数据结构和用途：

| 知识类型 | 描述 | 主要字段 | 用途 |
|---------|------|----------|------|
| Memories | 记忆/偏好 | category, importance, expiresAt | 存储对话历史、用户偏好、事实信息 |
| Skills | 技能/脚本 | trigger, script, dependencies | 可执行的自动化脚本和工作流 |
| Rules | 规则/约束 | priority, conditions, actions | 行为约束和触发条件 |
| MCPs | MCP 配置 | command, args, env, tools | 外部 MCP 服务器配置 |
| Experiences | 经验/案例 | scenario, solution, effectiveness | 成功案例和最佳实践 |
| Commands | 命令/模板 | template, parameters, category | 快捷命令和模板 |
| Contexts | 上下文/背景 | scope, projectPath, validUntil | 项目背景和领域知识 |
| Workflows | 工作流/流程 | steps, trigger, autoRun | 多步骤自动化流程 |

**章节来源**
- [src/types.ts](file://src/types.ts#L6-L14)
- [src/types.ts](file://src/types.ts#L24-L74)

## 架构概览

项目采用分层架构设计，确保各组件职责清晰且易于维护：

```mermaid
graph TB
subgraph "客户端层"
IDE[IDE 应用程序]
MCP_CLIENT[MCP 客户端]
end
subgraph "应用层"
MCP_SERVER[MCP 服务器]
TOOL_REGISTRY[工具注册表]
SYNC_ENGINE[同步引擎]
end
subgraph "业务逻辑层"
KNOWLEDGE_SERVICE[知识库服务]
TOOL_IMPLEMENTATIONS[工具实现]
CONFLICT_RESOLVER[冲突解决器]
end
subgraph "数据访问层"
MONGO_DB[MongoDB 数据库]
COLLECTIONS[集合: knowledge, sync_history, sync_conflicts]
end
subgraph "基础设施层"
CONFIG[配置管理]
LOGGER[日志系统]
EMBEDDING[嵌入服务]
ADAPTERS[IDE 适配器]
end
IDE --> MCP_CLIENT
MCP_CLIENT --> MCP_SERVER
MCP_SERVER --> TOOL_REGISTRY
TOOL_REGISTRY --> KNOWLEDGE_SERVICE
KNOWLEDGE_SERVICE --> TOOL_IMPLEMENTATIONS
KNOWLEDGE_SERVICE --> SYNC_ENGINE
SYNC_ENGINE --> CONFLICT_RESOLVER
KNOWLEDGE_SERVICE --> MONGO_DB
SYNC_ENGINE --> MONGO_DB
CONFLICT_RESOLVER --> MONGO_DB
MCP_SERVER --> CONFIG
MCP_SERVER --> LOGGER
KNOWLEDGE_SERVICE --> EMBEDDING
EMBEDDING --> MONGO_DB
SYNC_ENGINE --> ADAPTERS
```

**图表来源**
- [src/index.ts](file://src/index.ts#L87-L145)
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L47-L60)
- [src/adapters/types.ts](file://src/adapters/types.ts#L61-L106)

## 详细组件分析

### 配置管理系统

配置管理系统是整个系统的核心，负责从多种来源加载和验证配置：

```mermaid
flowchart TD
START([开始配置加载]) --> LOAD_ENV[加载环境变量]
LOAD_ENV --> PARSE_IDE[解析 IDE 来源]
PARSE_IDE --> PARSE_BOOL[解析布尔值]
PARSE_BOOL --> PARSE_LEVEL[解析日志级别]
PARSE_LEVEL --> VALIDATE[验证配置]
VALIDATE --> VALID_CHECK{配置有效?}
VALID_CHECK --> |是| CREATE_LOGGER[创建日志器]
VALID_CHECK --> |否| ERROR_EXIT[错误退出]
CREATE_LOGGER --> SUCCESS[配置加载成功]
ERROR_EXIT --> END([结束])
SUCCESS --> END
```

**图表来源**
- [src/utils/config.ts](file://src/utils/config.ts#L76-L91)
- [src/utils/config.ts](file://src/utils/config.ts#L96-L115)

配置系统支持以下环境变量：

| 环境变量 | 类型 | 默认值 | 描述 |
|---------|------|--------|------|
| MONGO_URI | 字符串 | mongodb://localhost:27017 | MongoDB 连接字符串 |
| MONGO_DATABASE | 字符串 | mongo_mcp | 数据库名称 |
| MONGO_COLLECTION | 字符串 | knowledge | 集合名称 |
| USER_ID | 字符串 | default | 用户标识 |
| DEVICE_ID | 字符串 | 自动生成 | 设备标识 |
| IDE_SOURCE | 字符串 | other | IDE 来源类型 |
| ENABLE_EMBEDDING | 布尔值 | false | 是否启用向量嵌入 |
| LOG_LEVEL | 字符串 | info | 日志级别 |

**章节来源**
- [src/utils/config.ts](file://src/utils/config.ts#L76-L91)
- [src/utils/config.ts](file://src/utils/config.ts#L96-L115)

### 知识库服务

知识库服务提供了完整的 CRUD 操作和高级功能：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Service as 知识库服务
participant Mongo as MongoDB
participant Embedding as 嵌入服务
Client->>Service : 创建文档
Service->>Service : 注入用户上下文
Service->>Mongo : 插入文档
Mongo-->>Service : 返回插入结果
Service-->>Client : 返回创建的文档
Client->>Service : 语义搜索
Service->>Embedding : 生成查询向量
Embedding-->>Service : 返回向量
Service->>Mongo : 查询相似文档
Mongo-->>Service : 返回匹配结果
Service-->>Client : 返回搜索结果
```

**图表来源**
- [src/services/knowledge-service.ts](file://src/services/knowledge-service.ts#L111-L127)
- [src/services/knowledge-service.ts](file://src/services/knowledge-service.ts#L272-L299)

**章节来源**
- [src/services/knowledge-service.ts](file://src/services/knowledge-service.ts#L20-L404)

### 工具系统

工具系统提供了丰富的知识管理功能，支持通用 CRUD 操作和专用工具：

```mermaid
classDiagram
class ToolSystem {
+tools : McpTool[]
+createKnowledgeTools(service, enableEmbedding)
+registerTool(tool)
+executeTool(name, args)
}
class McpTool {
+name : string
+description : string
+inputSchema : object
+handler(args)
}
class KnowledgeTools {
+CRUD工具 : knowledge_create, knowledge_read, knowledge_update, knowledge_delete
+批量操作 : knowledge_list, knowledge_stats, knowledge_upsert
+快捷工具 : memory_add, memory_search, experience_add, command_add
+高级功能 : mcp_sync, rule_sync, skill_sync, workflow_create
+嵌入功能 : semantic_search, generate_embeddings
+同步工具 : sync_from_ide, sync_to_ide, sync_bidirectional, sync_status, detect_ides
}
ToolSystem --> McpTool : "管理"
KnowledgeTools --> McpTool : "实现"
```

**图表来源**
- [src/tools/knowledge-tools.ts](file://src/tools/knowledge-tools.ts#L29-L32)
- [src/tools/knowledge-tools.ts](file://src/tools/knowledge-tools.ts#L1093-L1092)
- [src/tools/handlers/sync.tools.ts](file://src/tools/handlers/sync.tools.ts#L12-L17)

**章节来源**
- [src/tools/knowledge-tools.ts](file://src/tools/knowledge-tools.ts#L1-L1093)
- [src/tools/handlers/sync.tools.ts](file://src/tools/handlers/sync.tools.ts#L1-L196)

## IDE 集成指南

### Trae IDE 集成

Trae 是一个新兴的 AI 增强 IDE，支持 MCP 协议。以下是 Trae 的配置方法：

#### Trae 配置文件位置
- **Windows**: `%APPDATA%\Trae\settings.json`
- **macOS**: `~/Library/Application Support/Trae/settings.json`
- **Linux**: `~/.config/Trae/settings.json`

#### Trae 配置示例

```json
{
  "mcp.servers": {
    "mongo-mcp": {
      "command": "npx",
      "args": ["-y", "mongo-mcp"],
      "env": {
        "MONGO_URI": "mongodb://localhost:27017",
        "MONGO_DATABASE": "trae_knowledge",
        "USER_ID": "your@email.com",
        "DEVICE_ID": "trae-laptop",
        "IDE_SOURCE": "trae",
        "ENABLE_EMBEDDING": "true"
      }
    }
  }
}
```

### Windsurf IDE 集成

Windsurf 是另一个支持 MCP 协议的 IDE，配置相对简单：

#### Windsurf 配置文件位置
- **Windows**: `%APPDATA%\Windsurf\settings.json`
- **macOS**: `~/Library/Application Support/Windsurf/settings.json`
- **Linux**: `~/.config/Windsurf/settings.json`

#### Windsurf 配置示例

```json
{
  "mcp.servers": {
    "mongo-mcp": {
      "command": "npx",
      "args": ["-y", "mongo-mcp"],
      "env": {
        "MONGO_URI": "mongodb://localhost:27017",
        "MONGO_DATABASE": "windsurf_knowledge",
        "USER_ID": "your@email.com",
        "DEVICE_ID": "windsurf-desktop",
        "IDE_SOURCE": "windsurf"
      }
    }
  }
}
```

### 其他 IDE 配置

#### Cursor IDE 配置
Cursor 使用独立的配置文件：
- **配置文件**: `~/.cursor/mcp.json`

#### VS Code 配置
VS Code 使用工作区设置：
- **配置文件**: `.vscode/settings.json`

#### Qoder IDE 配置
Qoder 使用内置的 MCP 配置：
- **配置位置**: Qoder IDE 内置设置界面

**章节来源**
- [examples/mcp-config.json](file://examples/mcp-config.json#L5-L22)
- [examples/mcp-config.json](file://examples/mcp-config.json#L24-L39)

## 同步架构支持

### 同步引擎架构

项目实现了完整的同步架构，支持多种同步模式和冲突解决机制：

```mermaid
sequenceDiagram
participant IDE as IDE 客户端
participant SyncEngine as 同步引擎
participant Adapter as IDE 适配器
participant KnowledgeService as 知识库服务
participant HistoryService as 历史服务
participant ConflictResolver as 冲突解决器
IDE->>SyncEngine : 请求同步
SyncEngine->>Adapter : 解析 IDE 配置
Adapter-->>SyncEngine : 返回配置条目
SyncEngine->>KnowledgeService : 检查现有文档
KnowledgeService-->>SyncEngine : 返回文档状态
SyncEngine->>SyncEngine : 检测冲突
alt 发现冲突
SyncEngine->>ConflictResolver : 记录冲突
ConflictResolver-->>SyncEngine : 返回解决策略
end
SyncEngine->>KnowledgeService : 更新/创建文档
KnowledgeService-->>SyncEngine : 返回操作结果
SyncEngine->>HistoryService : 记录同步历史
HistoryService-->>SyncEngine : 确认记录
SyncEngine-->>IDE : 返回同步结果
```

**图表来源**
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L65-L172)
- [src/services/conflict-resolver.ts](file://src/services/conflict-resolver.ts#L76-L109)
- [src/services/sync-history-service.ts](file://src/services/sync-history-service.ts#L79-L84)

### 同步工具集

系统提供了完整的同步工具集，支持多种同步操作：

| 工具名称 | 功能描述 | 输入参数 | 输出结果 |
|---------|----------|----------|----------|
| sync_from_ide | 从 IDE 同步到知识库 | ideSource, configPath | 同步统计信息 |
| sync_to_ide | 从知识库同步到 IDE | ideSource, configPath, types | 同步统计信息 |
| sync_bidirectional | 双向同步 | ideSource, configPath | 同步统计信息 |
| sync_status | 获取同步状态 | - | 状态摘要 |
| detect_ides | 检测可用 IDE | - | IDE 检测结果 |

### 冲突解决机制

系统实现了智能的冲突解决机制，支持多种解决策略：

```mermaid
flowchart TD
CONFLICT[检测到冲突] --> STRATEGY{选择解决策略}
STRATEGY --> |last_write_wins| LAST_WRITE[保留最新版本]
STRATEGY --> |keep_local| KEEP_LOCAL[保留本地版本]
STRATEGY --> |keep_remote| KEEP_REMOTE[保留远程版本]
STRATEGY --> |manual| MANUAL[手动解决]
LAST_WRITE --> RESOLVE[自动解决]
KEEP_LOCAL --> RESOLVE
KEEP_REMOTE --> RESOLVE
MANUAL --> WAIT[等待用户干预]
RESOLVE --> RECORD[记录解决结果]
RECORD --> UPDATE[更新文档状态]
UPDATE --> COMPLETE[同步完成]
WAIT --> COMPLETE
```

**图表来源**
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L431-L449)
- [src/services/conflict-resolver.ts](file://src/services/conflict-resolver.ts#L147-L217)

**章节来源**
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L1-L451)
- [src/services/conflict-resolver.ts](file://src/services/conflict-resolver.ts#L1-L351)
- [src/tools/handlers/sync.tools.ts](file://src/tools/handlers/sync.tools.ts#L1-L196)

## 配置模板与参数说明

### 通用 MCP 配置模板

以下是一个通用的 MCP 配置模板，适用于大多数 IDE：

```json
{
  "mcpServers": {
    "mongo-mcp": {
      "command": "npx",
      "args": ["-y", "mongo-mcp"],
      "env": {
        "MONGO_URI": "mongodb://localhost:27017",
        "MONGO_DATABASE": "mongo_mcp",
        "MONGO_COLLECTION": "knowledge",
        "USER_ID": "default",
        "DEVICE_ID": "auto-generated",
        "IDE_SOURCE": "other",
        "ENABLE_EMBEDDING": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### 环境变量详细说明

| 环境变量 | 必需 | 默认值 | 说明 |
|---------|------|--------|------|
| MONGO_URI | 是 | mongodb://localhost:27017 | MongoDB 连接字符串，支持本地和远程数据库 |
| MONGO_DATABASE | 否 | mongo_mcp | MongoDB 数据库名称 |
| MONGO_COLLECTION | 否 | knowledge | MongoDB 集合名称 |
| USER_ID | 否 | default | 用户标识符，用于区分不同用户 |
| DEVICE_ID | 否 | 自动生成 | 设备标识符，用于区分不同设备 |
| IDE_SOURCE | 否 | other | IDE 来源类型，支持 qoder, trae, cursor, windsurf, vscode, manual, other |
| ENABLE_EMBEDDING | 否 | false | 是否启用向量嵌入功能 |
| LOG_LEVEL | 否 | info | 日志级别，支持 debug, info, warn, error |

### IDE 特定配置模板

#### 开发环境配置
```json
{
  "mcpServers": {
    "mongo-mcp-dev": {
      "command": "node",
      "args": ["/path/to/mongo-mcp/dist/index.js"],
      "env": {
        "MONGO_URI": "mongodb://localhost:27017",
        "MONGO_DATABASE": "dev_knowledge",
        "USER_ID": "developer",
        "DEVICE_ID": "dev-machine",
        "IDE_SOURCE": "manual",
        "ENABLE_EMBEDDING": "true",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

#### 云端共享配置
```json
{
  "mcpServers": {
    "mongo-mcp-cloud": {
      "command": "npx",
      "args": ["-y", "mongo-mcp"],
      "env": {
        "MONGO_URI": "mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority",
        "MONGO_DATABASE": "shared_knowledge",
        "USER_ID": "team@company.com",
        "DEVICE_ID": "office-mac",
        "IDE_SOURCE": "qoder",
        "ENABLE_EMBEDDING": "true"
      }
    }
  }
}
```

**章节来源**
- [examples/mcp-config.json](file://examples/mcp-config.json#L57-L92)

## IDE 兼容性矩阵

### 当前支持的 IDE

| IDE 名称 | MCP 支持 | 同步支持 | 配置格式 | 文件位置 | 状态 |
|---------|----------|----------|----------|----------|------|
| Qoder | ✅ 完全支持 | ✅ 完全支持 | settings.json | IDE 内置 | ✅ 稳定 |
| Trae | ✅ 完全支持 | ✅ 完全支持 | settings.json | ~/.config/Trae/ | ✅ 测试中 |
| Cursor | ✅ 完全支持 | ✅ 完全支持 | mcp.json | ~/.cursor/mcp.json | ✅ 稳定 |
| Windsurf | ✅ 完全支持 | ✅ 完全支持 | settings.json | ~/.config/Windsurf/ | ✅ 测试中 |
| VS Code | ✅ 完全支持 | ❌ 不适用 | settings.json | .vscode/settings.json | ✅ 稳定 |
| Manual | ❌ 不适用 | ❌ 不适用 | CLI | 命令行 | ✅ 支持 |

### 功能支持对比

| 功能 | Qoder | Trae | Cursor | Windsurf | VS Code | Manual |
|-----|-------|------|--------|----------|---------|--------|
| 基本 MCP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 向量嵌入 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 语义搜索 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 跨设备同步 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 用户隔离 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 工作流支持 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 技能管理 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 规则引擎 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 冲突解决 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 同步历史 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

### 配置文件格式差异

| IDE | 配置文件 | 键名 | 命令键 | 参数键 | 环境变量键 |
|-----|----------|------|--------|--------|------------|
| Qoder | settings.json | mcpServers | command | args | env |
| Trae | settings.json | mcp.servers | command | args | env |
| Cursor | mcp.json | mcpServers | command | args | env |
| Windsurf | settings.json | mcp.servers | command | args | env |
| VS Code | settings.json | mcp.servers | command | args | env |
| Manual | CLI | - | - | - | 环境变量 |

**章节来源**
- [examples/mcp-config.json](file://examples/mcp-config.json#L5-L92)

## 跨 IDE 迁移指南

### 迁移前准备

在进行跨 IDE 迁移之前，请完成以下准备工作：

1. **备份当前配置**
   ```bash
   # 备份当前 IDE 配置
   cp ~/.cursor/mcp.json ~/.cursor/mcp.json.backup
   cp ~/.qoder/rules ~/.qoder/rules.backup -r
   ```

2. **验证数据完整性**
   ```bash
   # 检查知识库中的文档数量
   npx mongo-mcp knowledge_list --limit 10
   ```

3. **检查同步状态**
   ```bash
   # 获取当前同步状态
   npx mongo-mcp sync_status
   ```

### 迁移流程图

```mermaid
flowchart TD
START([开始迁移]) --> PREPARE[准备阶段]
PREPARE --> BACKUP[备份配置]
BACKUP --> VERIFY[验证数据]
VERIFY --> STOP_SERVER[停止 MCP 服务器]
STOP_SERVER --> INSTALL_IDE[安装目标 IDE]
INSTALL_IDE --> CONFIG_IDE[配置目标 IDE]
CONFIG_IDE --> TEST_CONNECTION[测试连接]
TEST_CONNECTION --> SYNC_PULL[执行 Pull 同步]
SYNC_PULL --> VERIFY_MIGRATION[验证迁移结果]
VERIFY_MIGRATION --> CLEANUP[清理旧配置]
CLEANUP --> DONE([迁移完成])
```

**图表来源**
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L65-L172)

### 具体迁移步骤

#### 从 Cursor 迁移到 Qoder

1. **导出 Cursor 配置**
   ```bash
   # 导出 Cursor 规则
   npx mongo-mcp knowledge_list --type Rules --output cursor_rules.json
   ```

2. **配置 Qoder IDE**
   ```json
   {
     "mcpServers": {
       "mongo-mcp": {
         "command": "npx",
         "args": ["-y", "mongo-mcp"],
         "env": {
           "MONGO_URI": "mongodb://localhost:27017",
           "MONGO_DATABASE": "qoder_knowledge",
           "USER_ID": "your@email.com",
           "DEVICE_ID": "qoder-desktop",
           "IDE_SOURCE": "qoder"
         }
       }
     }
   }
   ```

3. **执行双向同步**
   ```bash
   # 从 Cursor 同步到知识库
   npx mongo-mcp sync_from_ide --ide-source cursor
   
   # 从知识库同步到 Qoder
   npx mongo-mcp sync_to_ide --ide-source qoder
   
   # 验证同步状态
   npx mongo-mcp sync_status
   ```

#### 从 VS Code 迁移到 Windsurf

1. **检查 VS Code 配置**
   ```bash
   # 查看 VS Code 中的 AI 规则
   cat .vscode/ai-rules.json
   ```

2. **配置 Windsurf**
   ```json
   {
     "mcp.servers": {
       "mongo-mcp": {
         "command": "npx",
         "args": ["-y", "mongo-mcp"],
         "env": {
           "MONGO_URI": "mongodb://localhost:27017",
           "MONGO_DATABASE": "windsurf_knowledge",
           "USER_ID": "your@email.com",
           "DEVICE_ID": "windsurf-laptop",
           "IDE_SOURCE": "windsurf"
         }
       }
     }
   }
   ```

3. **执行迁移**
   ```bash
   # 同步 VS Code 配置
   npx mongo-mcp sync_from_ide --ide-source vscode
   
   # 检查冲突
   npx mongo-mcp sync_status
   
   # 解决任何冲突
   # 手动解决冲突或使用冲突解决工具
   ```

### 数据迁移策略

1. **导出现有数据**
   ```bash
   # 导出所有知识类型
   npx mongo-mcp knowledge_export --output backup.json
   
   # 导出特定类型
   npx mongo-mcp knowledge_export --type Rules --output rules_backup.json
   ```

2. **导入到新 IDE**
   ```bash
   # 导入规则
   npx mongo-mcp knowledge_import --input rules_backup.json --type Rules
   
   # 验证导入结果
   npx mongo-mcp knowledge_list --type Rules --limit 5
   ```

3. **清理和优化**
   ```bash
   # 清理过期数据
   npx mongo-mcp knowledge_cleanup --days 30
   
   # 重建索引
   npx mongo-mcp knowledge_rebuild_index
   ```

**章节来源**
- [src/tools/handlers/sync.tools.ts](file://src/tools/handlers/sync.tools.ts#L12-L17)
- [src/services/sync-engine.ts](file://src/services/sync-engine.ts#L250-L270)

## 最佳实践

### 配置最佳实践

1. **使用环境变量**
   - 在生产环境中使用环境变量而不是硬编码
   - 为不同环境使用不同的配置文件

2. **安全配置**
   - 使用加密的数据库连接字符串
   - 限制环境变量的访问权限
   - 定期轮换凭据

3. **性能优化**
   - 启用向量嵌入时合理设置阈值
   - 使用适当的日志级别
   - 优化数据库索引

### 同步最佳实践

1. **定期同步**
   - 建立定期同步计划
   - 监控同步状态和性能
   - 处理冲突和错误

2. **备份策略**
   - 自动备份 IDE 配置
   - 定期备份知识库数据
   - 测试恢复流程

3. **冲突预防**
   - 使用合适的冲突解决策略
   - 建立团队同步规范
   - 定期审查同步历史

### 开发最佳实践

1. **工具开发**
   - 遵循统一的输入输出格式
   - 实现适当的错误处理
   - 提供详细的文档和示例

2. **配置管理**
   - 使用配置模板
   - 实现配置验证
   - 支持配置热重载

3. **监控和调试**
   - 实施结构化日志记录
   - 提供健康检查端点
   - 实现性能指标收集

### 部署最佳实践

1. **容器化部署**
   - 使用 Docker 容器
   - 实现配置卷挂载
   - 设置适当的资源限制

2. **高可用性**
   - 使用 MongoDB 副本集
   - 实现负载均衡
   - 设置健康检查

3. **安全性**
   - 实施网络隔离
   - 使用防火墙规则
   - 定期安全审计

## 故障排除指南

### 常见问题诊断

#### 连接问题

**症状**: 无法连接到 MongoDB
**诊断步骤**:
1. 验证 `MONGO_URI` 格式
2. 检查网络连接
3. 验证认证凭据
4. 检查防火墙设置

**解决方案**:
```bash
# 测试数据库连接
mongosh mongodb://localhost:27017

# 检查环境变量
echo $MONGO_URI
```

#### 配置验证失败

**症状**: 配置验证失败并退出
**诊断步骤**:
1. 检查必需的环境变量
2. 验证配置格式
3. 查看错误日志

**解决方案**:
```bash
# 启用详细日志
export LOG_LEVEL=debug
npx mongo-mcp
```

#### 工具执行错误

**症状**: 工具执行失败
**诊断步骤**:
1. 检查工具输入参数
2. 验证数据库权限
3. 查看工具日志

**解决方案**:
```bash
# 测试单个工具
npx mongo-mcp knowledge_list
```

### 同步问题

#### 同步失败

**症状**: 同步过程中出现错误
**诊断步骤**:
1. 检查 IDE 配置文件
2. 验证知识库连接
3. 查看同步历史

**解决方案**:
```bash
# 查看同步历史
npx mongo-mcp sync_history --limit 10

# 检查冲突
npx mongo-mcp sync_conflicts --limit 5

# 重新同步
npx mongo-mcp sync_from_ide --ide-source trae
```

#### 冲突解决

**症状**: 同步时出现冲突
**诊断步骤**:
1. 查看冲突详情
2. 分析冲突原因
3. 选择解决策略

**解决方案**:
```bash
# 获取未解决冲突
npx mongo-mcp sync_conflicts --status unresolved

# 解决冲突
npx mongo-mcp resolve_conflict --strategy keep_local --conflict-id <conflict-id>

# 批量解决
npx mongo-mcp batch_resolve --strategy merge --conflict-ids <id1,id2,id3>
```

### 性能问题

#### 嵌入生成缓慢

**症状**: 语义搜索响应慢
**解决方案**:
1. 优化嵌入模型
2. 减少批量大小
3. 实现缓存机制

#### 查询性能问题

**症状**: 数据库查询响应慢
**解决方案**:
1. 添加适当的索引
2. 优化查询条件
3. 实现分页查询

### 日志分析

系统支持四种日志级别，从详细到简洁：

```mermaid
flowchart TD
DEBUG[DEBUG] --> INFO[INFO] --> WARN[WARN] --> ERROR[ERROR]
DEBUG_DESC[详细调试信息<br/>包含完整堆栈跟踪] --> INFO_DESC[一般运行信息<br/>启动/停止事件]
INFO_DESC --> WARN_DESC[警告信息<br/>潜在问题但不影响运行]
WARN_DESC --> ERROR_DESC[错误信息<br/>严重问题需要修复]
```

**图表来源**
- [src/utils/config.ts](file://src/utils/config.ts#L120-L146)

**章节来源**
- [src/utils/config.ts](file://src/utils/config.ts#L96-L115)
- [src/utils/config.ts](file://src/utils/config.ts#L120-L146)

## 结论

MongoDB MCP Server 为多个 IDE 平台提供了统一的知识管理解决方案。通过标准化的 MCP 协议和灵活的配置系统，用户可以在不同的开发环境中享受一致的知识库体验。

### 主要优势

1. **跨平台兼容性**: 支持主流 IDE 和新兴开发工具
2. **统一数据模型**: 八种知识类型的标准化管理
3. **智能搜索**: 基于向量嵌入的语义搜索功能
4. **完整同步架构**: 支持双向同步、冲突解决和历史记录
5. **灵活配置**: 支持多种配置方式和环境变量
6. **开源生态**: 基于 MCP 协议的开放生态系统

### 新增功能亮点

1. **完整的同步架构**: 支持从 IDE 到知识库的 Pull 同步
2. **智能冲突解决**: 多种策略支持和手动解决选项
3. **同步历史追踪**: 详细的同步操作记录和统计
4. **跨 IDE 迁移支持**: 完整的迁移工具和最佳实践
5. **实时状态监控**: 同步状态的实时跟踪和报告

### 未来发展方向

1. **更多 IDE 支持**: 扩展到更多开发工具和编辑器
2. **增强搜索能力**: 改进语义搜索算法和性能
3. **协作功能**: 实现团队协作和知识共享
4. **插件系统**: 支持第三方扩展和插件
5. **云原生**: 优化云部署和微服务架构
6. **AI 辅助迁移**: 使用 AI 技术简化跨 IDE 迁移过程

通过持续的社区贡献和生态建设，MongoDB MCP Server 将成为开发者知识管理的重要基础设施，为现代软件开发提供强大的知识支撑能力。