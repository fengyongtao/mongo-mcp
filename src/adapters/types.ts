import type { SourceType, KnowledgeType, KnowledgeDocument } from '../types.js';

/**
 * IDE 配置文件格式
 */
export type ConfigFormat = 'json' | 'markdown' | 'plaintext' | 'yaml';

/**
 * IDE 规则/记忆条目
 */
export interface IDEEntry {
  /** 条目名称 */
  name: string;
  /** 条目内容 */
  content: string;
  /** 描述 */
  description?: string;
  /** 标签 */
  tags?: string[];
  /** 是否启用 */
  enabled?: boolean;
  /** 原始文件路径 */
  filePath?: string;
  /** IDE 特有的元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * IDE 配置解析结果
 */
export interface ParseResult {
  /** 解析的条目列表 */
  entries: IDEEntry[];
  /** 解析错误 */
  errors: Array<{
    file: string;
    message: string;
  }>;
  /** 原始配置 */
  rawConfig?: unknown;
}

/**
 * IDE 导出选项
 */
export interface ExportOptions {
  /** 导出格式 */
  format?: ConfigFormat;
  /** 是否包含禁用的条目 */
  includeDisabled?: boolean;
  /** 按类型过滤 */
  types?: KnowledgeType[];
  /** 按标签过滤 */
  tags?: string[];
}

/**
 * IDE 适配器接口
 * 定义各 IDE 配置文件的读写操作
 */
export interface IDEAdapter {
  /** IDE 来源标识 */
  readonly source: SourceType;
  /** IDE 显示名称 */
  readonly displayName: string;
  /** 支持的配置格式 */
  readonly supportedFormats: ConfigFormat[];
  /** 默认配置路径 */
  readonly defaultConfigPath: string;

  /**
   * 检测 IDE 配置是否存在
   */
  detect(): Promise<boolean>;

  /**
   * 获取配置文件路径
   */
  getConfigPaths(): Promise<string[]>;

  /**
   * 解析 IDE 配置文件
   * @param configPath 配置文件路径，不提供则使用默认路径
   */
  parse(configPath?: string): Promise<ParseResult>;

  /**
   * 将知识文档转换为 IDE 格式
   */
  toIDEFormat(documents: KnowledgeDocument[], options?: ExportOptions): string;

  /**
   * 将 IDE 条目转换为知识文档格式
   */
  toKnowledgeDocument(entry: IDEEntry, type: KnowledgeType): Partial<KnowledgeDocument>;

  /**
   * 写入配置到 IDE
   */
  write(content: string, configPath?: string): Promise<void>;

  /**
   * 备份现有配置
   */
  backup(configPath?: string): Promise<string>;
}

/**
 * 适配器注册表
 */
export const adapterRegistry = new Map<SourceType, IDEAdapter>();

/**
 * 注册适配器
 */
export function registerAdapter(adapter: IDEAdapter): void {
  adapterRegistry.set(adapter.source, adapter);
}

/**
 * 获取适配器
 */
export function getAdapter(source: SourceType): IDEAdapter | undefined {
  return adapterRegistry.get(source);
}

/**
 * 获取所有已注册的适配器
 */
export function getAllAdapters(): IDEAdapter[] {
  return Array.from(adapterRegistry.values());
}
