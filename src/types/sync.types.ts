import { ObjectId } from 'mongodb';
import { SourceType, KnowledgeType } from '../types.js';

/**
 * 同步状态
 */
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'local_only';

/**
 * 同步操作类型
 */
export type SyncOperation = 'create' | 'update' | 'delete' | 'conflict_resolve';

/**
 * 同步方向
 */
export type SyncDirection = 'push' | 'pull' | 'bidirectional';

/**
 * 同步历史记录
 * 记录每次同步操作的详细信息
 */
export interface SyncHistory {
  _id?: ObjectId;
  /** 用户标识 */
  userId: string;
  /** 设备标识 */
  deviceId: string;
  /** IDE 来源 */
  ideSource: SourceType;
  /** 同步方向 */
  direction: SyncDirection;
  /** 同步操作类型 */
  operation: SyncOperation;
  /** 关联的知识文档 ID */
  documentId: ObjectId;
  /** 文档类型 */
  documentType: KnowledgeType;
  /** 文档名称 */
  documentName: string;
  /** 同步前版本号 */
  fromVersion: number;
  /** 同步后版本号 */
  toVersion: number;
  /** 变更摘要 */
  changeSummary?: string;
  /** 同步状态 */
  status: 'success' | 'failed' | 'partial';
  /** 错误信息 */
  errorMessage?: string;
  /** 同步开始时间 */
  startedAt: Date;
  /** 同步完成时间 */
  completedAt?: Date;
  /** 同步耗时(ms) */
  durationMs?: number;
}

/**
 * 同步冲突记录
 * 当同一文档在多端修改时产生冲突
 */
export interface SyncConflict {
  _id?: ObjectId;
  /** 用户标识 */
  userId: string;
  /** 关联的知识文档 ID */
  documentId: ObjectId;
  /** 文档类型 */
  documentType: KnowledgeType;
  /** 文档名称 */
  documentName: string;
  /** 本地版本快照 */
  localSnapshot: {
    deviceId: string;
    ideSource: SourceType;
    content: string | Record<string, unknown>;
    version: number;
    modifiedAt: Date;
  };
  /** 远程版本快照 */
  remoteSnapshot: {
    deviceId: string;
    ideSource: SourceType;
    content: string | Record<string, unknown>;
    version: number;
    modifiedAt: Date;
  };
  /** 冲突状态 */
  status: 'unresolved' | 'resolved' | 'ignored';
  /** 解决方式 */
  resolution?: 'keep_local' | 'keep_remote' | 'merge' | 'manual';
  /** 解决后的内容 */
  resolvedContent?: string | Record<string, unknown>;
  /** 解决者 */
  resolvedBy?: string;
  /** 解决时间 */
  resolvedAt?: Date;
  /** 冲突检测时间 */
  detectedAt: Date;
}

/**
 * 设备注册信息
 * 记录用户的所有设备和 IDE
 */
export interface DeviceRegistry {
  _id?: ObjectId;
  /** 用户标识 */
  userId: string;
  /** 设备唯一标识 */
  deviceId: string;
  /** 设备名称 */
  deviceName: string;
  /** 操作系统 */
  platform: 'windows' | 'macos' | 'linux';
  /** 主机名 */
  hostname?: string;
  /** IDE 来源列表（一台设备可能安装多个 IDE） */
  installedIDEs: Array<{
    ideSource: SourceType;
    version?: string;
    configPath?: string;
    lastActiveAt?: Date;
  }>;
  /** 当前活跃的 IDE */
  activeIDE?: SourceType;
  /** 设备状态 */
  status: 'active' | 'inactive' | 'removed';
  /** 最后心跳时间 */
  lastHeartbeat?: Date;
  /** 最后同步时间 */
  lastSyncAt?: Date;
  /** 同步优先级（数字越小优先级越高） */
  syncPriority: number;
  /** 首次注册时间 */
  registeredAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 同步配置
 */
export interface SyncConfig {
  /** 是否启用自动同步 */
  autoSync: boolean;
  /** 自动同步间隔(ms) */
  syncIntervalMs: number;
  /** 冲突解决策略 */
  conflictStrategy: 'last_write_wins' | 'ask_user' | 'keep_both';
  /** 需要同步的文档类型 */
  syncTypes: KnowledgeType[];
  /** 排除的标签 */
  excludeTags?: string[];
  /** 最大同步批次大小 */
  batchSize: number;
}

/**
 * 同步状态摘要
 */
export interface SyncStatusSummary {
  /** 用户标识 */
  userId: string;
  /** 设备标识 */
  deviceId: string;
  /** 待同步数量 */
  pendingCount: number;
  /** 冲突数量 */
  conflictCount: number;
  /** 已同步数量 */
  syncedCount: number;
  /** 仅本地数量 */
  localOnlyCount: number;
  /** 最后同步时间 */
  lastSyncAt?: Date;
  /** 按类型统计 */
  byType: Record<KnowledgeType, {
    pending: number;
    conflict: number;
    synced: number;
  }>;
}

/**
 * 同步增量数据
 */
export interface SyncDelta {
  /** 新增文档 */
  created: Array<{
    documentId: ObjectId;
    type: KnowledgeType;
    name: string;
  }>;
  /** 更新文档 */
  updated: Array<{
    documentId: ObjectId;
    type: KnowledgeType;
    name: string;
    fromVersion: number;
    toVersion: number;
  }>;
  /** 删除文档 */
  deleted: Array<{
    documentId: ObjectId;
    type: KnowledgeType;
    name: string;
  }>;
  /** 有冲突的文档 */
  conflicts: Array<{
    documentId: ObjectId;
    type: KnowledgeType;
    name: string;
    conflictId: ObjectId;
  }>;
}
