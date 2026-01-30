import { ObjectId } from 'mongodb';
import type { KnowledgeDocument, KnowledgeType, SourceType } from '../types.js';
import type { SyncConflict, SyncDelta, SyncDirection, SyncStatusSummary } from '../types/sync.types.js';
import { KnowledgeService } from './knowledge-service.js';
import { SyncHistoryService } from './sync-history-service.js';
import { getAdapter, type IDEAdapter } from '../adapters/types.js';

/**
 * 同步引擎配置
 */
export interface SyncEngineConfig {
  /** 冲突解决策略 */
  conflictStrategy: 'last_write_wins' | 'keep_local' | 'keep_remote' | 'manual';
  /** 需要同步的文档类型 */
  syncTypes: KnowledgeType[];
  /** 是否自动备份 */
  autoBackup: boolean;
  /** 批量大小 */
  batchSize: number;
}

const defaultConfig: SyncEngineConfig = {
  conflictStrategy: 'last_write_wins',
  syncTypes: ['Rules', 'Memories', 'Skills', 'MCPs'],
  autoBackup: true,
  batchSize: 50,
};

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  direction: SyncDirection;
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  errors: string[];
  duration: number;
}

/**
 * 同步引擎
 * 协调知识库与 IDE 配置之间的双向同步
 */
export class SyncEngine {
  private knowledgeService: KnowledgeService;
  private historyService: SyncHistoryService;
  private config: SyncEngineConfig;

  constructor(
    knowledgeService: KnowledgeService,
    historyService: SyncHistoryService,
    config: Partial<SyncEngineConfig> = {}
  ) {
    this.knowledgeService = knowledgeService;
    this.historyService = historyService;
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 从 IDE 同步到知识库（Pull）
   */
  async syncFromIDE(
    ideSource: SourceType,
    configPath?: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      direction: 'pull',
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
    };

    try {
      const adapter = getAdapter(ideSource);
      if (!adapter) {
        throw new Error(`No adapter found for IDE: ${ideSource}`);
      }

      // 解析 IDE 配置
      const parseResult = await adapter.parse(configPath);

      if (parseResult.errors.length > 0) {
        result.errors.push(...parseResult.errors.map(e => `${e.file}: ${e.message}`));
      }

      // 处理每个条目
      for (const entry of parseResult.entries) {
        try {
          // 确定文档类型（默认为 Rules）
          const type = this.inferType(entry.name, entry.metadata);

          // 检查是否已存在
          const existing = await this.knowledgeService.get(type, entry.name);

          if (existing) {
            // 检查冲突
            if (this.hasConflict(existing, entry.content)) {
              const resolved = await this.resolveConflict(
                existing,
                entry.content,
                ideSource
              );
              if (resolved) {
                await this.knowledgeService.update(type, entry.name, {
                  content: resolved,
                  description: entry.description,
                  tags: entry.tags,
                  sourcePath: entry.filePath,
                });
                result.updated++;
              } else {
                result.conflicts++;
              }
            } else {
              // 无冲突，直接更新
              await this.knowledgeService.update(type, entry.name, {
                content: entry.content,
                description: entry.description,
                tags: entry.tags,
                sourcePath: entry.filePath,
              });
              result.updated++;
            }
          } else {
            // 创建新文档
            const docData = adapter.toKnowledgeDocument(entry, type);
            await this.knowledgeService.create({
              ...docData,
              type,
              name: entry.name,
              content: entry.content,
            } as Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'deviceId' | 'ideSource' | 'syncVersion' | 'syncStatus'>);
            result.created++;
          }

          // 记录同步历史
          await this.historyService.record({
            userId: 'current', // 从上下文获取
            deviceId: 'current',
            ideSource,
            direction: 'pull',
            operation: existing ? 'update' : 'create',
            documentId: new ObjectId(),
            documentType: type,
            documentName: entry.name,
            fromVersion: existing?.syncVersion || 0,
            toVersion: (existing?.syncVersion || 0) + 1,
            status: 'success',
            startedAt: new Date(),
            completedAt: new Date(),
          });
        } catch (err) {
          result.errors.push(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * 从知识库同步到 IDE（Push）
   */
  async syncToIDE(
    ideSource: SourceType,
    configPath?: string,
    types?: KnowledgeType[]
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      direction: 'push',
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
    };

    try {
      const adapter = getAdapter(ideSource);
      if (!adapter) {
        throw new Error(`No adapter found for IDE: ${ideSource}`);
      }

      // 备份现有配置
      if (this.config.autoBackup) {
        try {
          await adapter.backup(configPath);
        } catch {
          // 忽略备份错误（可能文件不存在）
        }
      }

      // 获取要同步的文档
      const syncTypes = types || this.config.syncTypes;
      const documents: KnowledgeDocument[] = [];

      for (const type of syncTypes) {
        const docs = await this.knowledgeService.list({ type, enabled: true });
        documents.push(...docs);
      }

      // 转换为 IDE 格式
      const content = adapter.toIDEFormat(documents, {
        includeDisabled: false,
        types: syncTypes,
      });

      // 写入 IDE 配置
      await adapter.write(content, configPath);

      result.updated = documents.length;
      result.success = true;

      // 更新同步状态
      for (const doc of documents) {
        if (doc._id) {
          await this.knowledgeService.update(doc.type, doc.name, {
            syncStatus: 'synced',
            lastSyncAt: new Date(),
          });
        }
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * 双向同步
   */
  async syncBidirectional(
    ideSource: SourceType,
    configPath?: string
  ): Promise<SyncResult> {
    const startTime = Date.now();

    // 先拉取再推送
    const pullResult = await this.syncFromIDE(ideSource, configPath);
    const pushResult = await this.syncToIDE(ideSource, configPath);

    return {
      success: pullResult.success && pushResult.success,
      direction: 'bidirectional',
      created: pullResult.created + pushResult.created,
      updated: pullResult.updated + pushResult.updated,
      deleted: pullResult.deleted + pushResult.deleted,
      conflicts: pullResult.conflicts + pushResult.conflicts,
      errors: [...pullResult.errors, ...pushResult.errors],
      duration: Date.now() - startTime,
    };
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(userId: string): Promise<SyncStatusSummary> {
    const documents = await this.knowledgeService.list({});

    const summary: SyncStatusSummary = {
      userId,
      deviceId: 'current',
      pendingCount: 0,
      conflictCount: 0,
      syncedCount: 0,
      localOnlyCount: 0,
      byType: {} as Record<KnowledgeType, { pending: number; conflict: number; synced: number }>,
    };

    for (const doc of documents) {
      if (!summary.byType[doc.type]) {
        summary.byType[doc.type] = { pending: 0, conflict: 0, synced: 0 };
      }

      switch (doc.syncStatus) {
        case 'pending':
          summary.pendingCount++;
          summary.byType[doc.type].pending++;
          break;
        case 'conflict':
          summary.conflictCount++;
          summary.byType[doc.type].conflict++;
          break;
        case 'synced':
          summary.syncedCount++;
          summary.byType[doc.type].synced++;
          break;
        case 'local_only':
          summary.localOnlyCount++;
          break;
      }
    }

    // 获取最后同步时间
    const lastSync = await this.historyService.getLatestSync(userId, 'current');
    if (lastSync) {
      summary.lastSyncAt = lastSync.completedAt || lastSync.startedAt;
    }

    return summary;
  }

  /**
   * 计算同步增量
   */
  async calculateDelta(
    ideSource: SourceType,
    since?: Date
  ): Promise<SyncDelta> {
    const delta: SyncDelta = {
      created: [],
      updated: [],
      deleted: [],
      conflicts: [],
    };

    const adapter = getAdapter(ideSource);
    if (!adapter) return delta;

    // 获取 IDE 当前状态
    const ideResult = await adapter.parse();
    const ideEntries = new Map(ideResult.entries.map(e => [e.name, e]));

    // 获取数据库文档
    const dbDocs = await this.knowledgeService.list({});
    const dbMap = new Map(dbDocs.map(d => [d.name, d]));

    // 比较差异
    for (const [name, entry] of ideEntries) {
      const dbDoc = dbMap.get(name);
      if (!dbDoc) {
        delta.created.push({
          documentId: new ObjectId(),
          type: this.inferType(name, entry.metadata),
          name,
        });
      } else if (this.hasConflict(dbDoc, entry.content)) {
        if (since && dbDoc.updatedAt > since) {
          delta.conflicts.push({
            documentId: dbDoc._id!,
            type: dbDoc.type,
            name,
            conflictId: new ObjectId(),
          });
        } else {
          delta.updated.push({
            documentId: dbDoc._id!,
            type: dbDoc.type,
            name,
            fromVersion: dbDoc.syncVersion,
            toVersion: dbDoc.syncVersion + 1,
          });
        }
      }
    }

    // 检查已删除
    for (const [name, doc] of dbMap) {
      if (!ideEntries.has(name) && doc.ideSource === ideSource) {
        delta.deleted.push({
          documentId: doc._id!,
          type: doc.type,
          name,
        });
      }
    }

    return delta;
  }

  /**
   * 推断文档类型
   */
  private inferType(name: string, metadata?: Record<string, unknown>): KnowledgeType {
    if (metadata?.type) {
      return metadata.type as KnowledgeType;
    }

    const lowerName = name.toLowerCase();
    if (lowerName.includes('rule')) return 'Rules';
    if (lowerName.includes('memory') || lowerName.includes('memo')) return 'Memories';
    if (lowerName.includes('skill')) return 'Skills';
    if (lowerName.includes('mcp')) return 'MCPs';
    if (lowerName.includes('experience')) return 'Experiences';
    if (lowerName.includes('command') || lowerName.includes('cmd')) return 'Commands';
    if (lowerName.includes('context')) return 'Contexts';
    if (lowerName.includes('workflow') || lowerName.includes('flow')) return 'Workflows';

    return 'Rules'; // 默认类型
  }

  /**
   * 检测冲突
   */
  private hasConflict(
    existing: KnowledgeDocument,
    newContent: string | Record<string, unknown>
  ): boolean {
    const existingContent = typeof existing.content === 'string'
      ? existing.content
      : JSON.stringify(existing.content);

    const newContentStr = typeof newContent === 'string'
      ? newContent
      : JSON.stringify(newContent);

    return existingContent !== newContentStr;
  }

  /**
   * 解决冲突
   */
  private async resolveConflict(
    existing: KnowledgeDocument,
    newContent: string | Record<string, unknown>,
    _source: SourceType
  ): Promise<string | Record<string, unknown> | null> {
    switch (this.config.conflictStrategy) {
      case 'last_write_wins':
        return newContent;
      case 'keep_local':
        return existing.content;
      case 'keep_remote':
        return newContent;
      case 'manual':
        // 返回 null 表示需要手动解决
        return null;
      default:
        return newContent;
    }
  }
}
