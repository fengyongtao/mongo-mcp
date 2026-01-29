import { ObjectId } from 'mongodb';

/**
 * 知识库文档类型（8种）
 */
export type KnowledgeType = 
  | 'Memories'      // 记忆（对话历史/用户偏好）
  | 'Skills'        // 技能（可执行脚本/工作流）
  | 'Rules'         // 规则（行为约束/触发条件）
  | 'MCPs'          // MCP 配置
  | 'Experiences'   // 经验（成功案例/最佳实践）
  | 'Commands'      // 命令（快捷命令/模板）
  | 'Contexts'      // 上下文（项目背景/领域知识）
  | 'Workflows';    // 工作流（多步骤流程）

/**
 * 数据来源类型
 */
export type SourceType = 'qoder' | 'trae' | 'cursor' | 'windsurf' | 'vscode' | 'manual' | 'other';

/**
 * 基础知识库文档接口
 */
export interface KnowledgeDocument {
  _id?: ObjectId;
  /** 文档类型 */
  type: KnowledgeType;
  /** 唯一标识名 */
  name: string;
  /** 主要内容 */
  content: string | Record<string, unknown>;
  /** 简短描述 */
  description?: string;
  /** 分类标签 */
  tags?: string[];
  /** 是否启用 */
  enabled?: boolean;
  
  // === 用户与设备标识（支持跨终端/跨 IDE）===
  /** 用户标识 */
  userId: string;
  /** 设备标识 */
  deviceId: string;
  /** IDE 来源 */
  ideSource: SourceType;
  
  // === 同步相关 ===
  /** 同步版本号 */
  syncVersion: number;
  /** 最后同步时间 */
  lastSyncAt?: Date;
  
  // === 来源信息 ===
  /** 来源系统中的原始 ID */
  sourceId?: string;
  /** 来源文件路径 */
  sourcePath?: string;
  /** 来源项目名称 */
  sourceProject?: string;
  
  // === 时间戳 ===
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  
  // === 向量嵌入 ===
  /** 向量嵌入 */
  embedding?: number[];
  /** 使用的嵌入模型 */
  embeddingModel?: string;
  /** 嵌入生成时间 */
  embeddedAt?: Date;
}

/**
 * Memory 文档（记忆）
 * 用于存储对话历史、用户偏好等
 */
export interface MemoryDocument extends KnowledgeDocument {
  type: 'Memories';
  /** 分类：preference/history/fact/context */
  category?: string;
  /** 重要程度 */
  importance?: 'low' | 'medium' | 'high';
  /** 过期时间 */
  expiresAt?: Date;
}

/**
 * MCP 文档
 * 用于存储 MCP 工具配置
 */
export interface McpDocument extends KnowledgeDocument {
  type: 'MCPs';
  /** 执行命令 */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 提供的工具列表 */
  tools?: string[];
}

/**
 * Skill 文档（技能）
 * 用于存储可执行脚本和工作流
 */
export interface SkillDocument extends KnowledgeDocument {
  type: 'Skills';
  /** 触发条件 */
  trigger?: string;
  /** 脚本内容 */
  script?: string;
  /** 依赖项 */
  dependencies?: string[];
}

/**
 * Rule 文档（规则）
 * 用于存储行为约束和触发条件
 */
export interface RuleDocument extends KnowledgeDocument {
  type: 'Rules';
  /** 优先级 */
  priority?: number;
  /** 条件列表 */
  conditions?: string[];
  /** 动作列表 */
  actions?: string[];
  /** 触发方式：always_on/auto_attached/agent_requested/manual */
  triggerMode?: 'always_on' | 'auto_attached' | 'agent_requested' | 'manual';
}

/**
 * Experience 文档（经验）
 * 用于存储成功案例和最佳实践
 */
export interface ExperienceDocument extends KnowledgeDocument {
  type: 'Experiences';
  /** 应用场景 */
  scenario: string;
  /** 解决方案 */
  solution: string;
  /** 执行结果 */
  outcome?: string;
  /** 有效性评分（1-5） */
  effectiveness?: 1 | 2 | 3 | 4 | 5;
  /** 关联技能 */
  relatedSkills?: string[];
}

/**
 * Command 文档（命令）
 * 用于存储快捷命令和模板
 */
export interface CommandDocument extends KnowledgeDocument {
  type: 'Commands';
  /** 命令模板 */
  template: string;
  /** 参数定义 */
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: string;
    description?: string;
  }>;
  /** 命令分类 */
  category?: string;
  /** 快捷别名 */
  shortcut?: string;
}

/**
 * Context 文档（上下文）
 * 用于存储项目背景和领域知识
 */
export interface ContextDocument extends KnowledgeDocument {
  type: 'Contexts';
  /** 上下文范围 */
  scope: 'project' | 'domain' | 'global';
  /** 关联项目路径 */
  projectPath?: string;
  /** 有效期 */
  validUntil?: Date;
  /** 参考资料链接 */
  references?: string[];
}

/**
 * Workflow 文档（工作流）
 * 用于存储多步骤流程定义
 */
export interface WorkflowDocument extends KnowledgeDocument {
  type: 'Workflows';
  /** 工作流步骤 */
  steps: Array<{
    order: number;
    action: string;
    toolCall?: string;
    condition?: string;
    onError?: 'stop' | 'continue' | 'retry';
  }>;
  /** 触发条件 */
  trigger?: string;
  /** 是否自动执行 */
  autoRun?: boolean;
}

/**
 * 所有知识文档类型联合
 */
export type AnyKnowledgeDocument = 
  | MemoryDocument 
  | McpDocument 
  | SkillDocument 
  | RuleDocument
  | ExperienceDocument
  | CommandDocument
  | ContextDocument
  | WorkflowDocument;

/**
 * 创建知识文档请求
 */
export interface CreateKnowledgeRequest {
  type: KnowledgeType;
  name: string;
  content: string | Record<string, unknown>;
  description?: string;
  tags?: string[];
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * 更新知识文档请求
 */
export interface UpdateKnowledgeRequest {
  content?: string | Record<string, unknown>;
  description?: string;
  tags?: string[];
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * 列表查询选项
 */
export interface ListOptions {
  type?: KnowledgeType;
  tags?: string[];
  enabled?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * 语义搜索选项
 */
export interface SemanticSearchOptions {
  type?: KnowledgeType;
  limit?: number;
  threshold?: number;
}
