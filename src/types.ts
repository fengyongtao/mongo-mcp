import { ObjectId } from 'mongodb';

/**
 * 知识库文档类型
 */
export type KnowledgeType = 'MCPs' | 'Memories' | 'Rules' | 'Skills';

/**
 * 数据来源类型
 */
export type SourceType = 'qoder' | 'trae' | 'cursor' | 'windsurf' | 'vscode' | 'manual' | 'sync-script' | 'other';

/**
 * 来源信息
 */
export interface SourceInfo {
  /** 来源 IDE/工具 */
  source: SourceType;
  /** 来源系统中的原始 ID */
  sourceId?: string;
  /** 来源文件路径 */
  sourcePath?: string;
  /** 来源项目名称 */
  sourceProject?: string;
  /** 同步时间 */
  syncedAt?: Date;
}

/**
 * 基础知识库文档接口
 */
export interface KnowledgeDocument extends Partial<SourceInfo> {
  _id?: ObjectId;
  type: KnowledgeType;
  name: string;
  content: string | Record<string, unknown>;
  description?: string;
  tags?: string[];
  enabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  /** 向量嵌入 */
  embedding?: number[];
  /** 使用的嵌入模型 */
  embeddingModel?: string;
  /** 嵌入生成时间 */
  embeddedAt?: Date;
}

/**
 * Memory 文档（记忆）
 */
export interface MemoryDocument extends KnowledgeDocument {
  type: 'Memories';
  category?: string;
  importance?: 'low' | 'medium' | 'high';
  expiresAt?: Date;
}

/**
 * MCP 文档
 */
export interface McpDocument extends KnowledgeDocument {
  type: 'MCPs';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: string[];
}

/**
 * Skill 文档（技能）
 */
export interface SkillDocument extends KnowledgeDocument {
  type: 'Skills';
  trigger?: string;
  script?: string;
  dependencies?: string[];
}

/**
 * Rule 文档（规则）
 */
export interface RuleDocument extends KnowledgeDocument {
  type: 'Rules';
  priority?: number;
  conditions?: string[];
  actions?: string[];
}

/**
 * 配置文档接口
 */
export interface ConfigDocument {
  _id?: ObjectId;
  configKey: string;
  environment: string;
  version: number;
  content: Record<string, unknown>;
  metadata?: ConfigMetadata;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * 配置元数据
 */
export interface ConfigMetadata {
  description?: string;
  author?: string;
  tags?: string[];
}

/**
 * 保存配置请求
 */
export interface SaveConfigRequest {
  configKey: string;
  environment: string;
  content: Record<string, unknown>;
  metadata?: ConfigMetadata;
  expectedVersion?: number;
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
  operationType: 'insert' | 'update' | 'replace' | 'delete';
  configKey: string;
  environment: string;
  document?: ConfigDocument;
  timestamp: Date;
}

/**
 * MCP 服务器配置
 */
export interface ServerConfig {
  mongoUri: string;
  database: string;
  collection: string;
  httpPort: number;
  enableChangeStream: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
