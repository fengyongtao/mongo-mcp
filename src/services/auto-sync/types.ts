import type { ObjectId } from 'mongodb';
import type { KnowledgeType, SourceType } from '../../types.js';

/**
 * 自动同步配置
 */
export interface AutoSyncConfig {
  /** 同步模式 */
  mode: 'bidirectional' | 'pull_only' | 'push_only';
  /** 启用的 IDE 列表 */
  enabledIDEs: SourceType[];
  /** 本地文件防抖延迟（ms） */
  localDebounce: number;
  /** 远程变更节流延迟（ms） */
  remoteThrottle: number;
  /** 批量处理大小 */
  batchSize: number;
  /** 批量处理延迟（ms） */
  batchDelay: number;
  /** 冲突解决策略 */
  conflictStrategy: 'last_write_wins' | 'keep_local' | 'keep_remote' | 'manual';
  /** MCP 服务启动时是否自动开始 */
  autoStart: boolean;
  /** 健康检查间隔（ms） */
  healthCheckInterval: number;
  /** 监听的基础路径列表 */
  watchPaths?: string[];
}

/**
 * 默认配置
 */
export const defaultAutoSyncConfig: AutoSyncConfig = {
  mode: 'bidirectional',
  enabledIDEs: ['qoder', 'cursor', 'vscode', 'windsurf', 'trae'],
  localDebounce: 300,
  remoteThrottle: 5000,
  batchSize: 50,
  batchDelay: 1000,
  conflictStrategy: 'last_write_wins',
  autoStart: true,
  healthCheckInterval: 60000,
};

/**
 * 文件变更事件类型
 */
export type FileChangeType = 'add' | 'change' | 'delete';

/**
 * 本地文件变更事件
 */
export interface FileChangeEvent {
  source: 'local';
  /** IDE 来源 */
  ideSource: SourceType;
  /** 变更类型 */
  type: FileChangeType;
  /** 文件路径 */
  filePath: string;
  /** 事件时间戳 */
  timestamp: Date;
}

/**
 * 远程变更事件类型
 */
export type RemoteChangeType = 'insert' | 'update' | 'delete' | 'replace';

/**
 * 远程变更事件
 */
export interface RemoteChangeEvent {
  source: 'remote';
  /** 操作类型 */
  operationType: RemoteChangeType;
  /** 文档 ID */
  documentId: ObjectId;
  /** 文档类型 */
  documentType: KnowledgeType;
  /** 文档名称 */
  documentName: string;
  /** 用户 ID */
  userId: string;
  /** 设备 ID */
  deviceId: string;
  /** 事件时间戳 */
  timestamp: Date;
}

/**
 * 同步事件（本地或远程）
 */
export interface SyncEvent {
  /** 事件唯一标识 */
  id: string;
  /** 事件来源 */
  source: 'local' | 'remote';
  /** 优先级（数字越大优先级越高） */
  priority: number;
  /** 事件数据 */
  data: FileChangeEvent | RemoteChangeEvent;
  /** 事件创建时间 */
  createdAt: Date;
}

/**
 * 监听目标配置
 */
export interface WatchTarget {
  /** IDE 来源 */
  ideSource: SourceType;
  /** 监听路径列表 */
  paths: string[];
  /** glob 模式列表 */
  patterns: string[];
}

/**
 * 同步状态
 */
export interface AutoSyncStatus {
  /** 是否正在运行 */
  isRunning: boolean;
  /** 启动时间 */
  startedAt?: Date;
  /** 统计信息 */
  stats: {
    /** 处理的本地事件数 */
    localEventsProcessed: number;
    /** 处理的远程事件数 */
    remoteEventsProcessed: number;
    /** 当前队列大小 */
    queueSize: number;
    /** 最后同步时间 */
    lastSyncTime?: Date;
    /** 同步成功次数 */
    successCount: number;
    /** 同步失败次数 */
    errorCount: number;
  };
  /** 当前配置 */
  config: AutoSyncConfig;
}

/**
 * 事件处理器类型
 */
export type EventHandler = (event: FileChangeEvent | RemoteChangeEvent) => void;

/**
 * 本地事件处理器类型
 */
export type LocalEventHandler = (event: FileChangeEvent) => void;

/**
 * 批量事件处理器类型
 */
export type BatchEventHandler = (events: SyncEvent[]) => Promise<void>;
