import { MongoClient, Db, Collection, ObjectId, Filter } from 'mongodb';
import type { KnowledgeDocument, KnowledgeType, SourceType } from '../types.js';
import type { SyncConflict } from '../types/sync.types.js';

/**
 * 冲突解决策略
 */
export type ResolutionStrategy = 'keep_local' | 'keep_remote' | 'merge' | 'manual';

/**
 * 合并结果
 */
export interface MergeResult {
  success: boolean;
  content: string | Record<string, unknown>;
  strategy: ResolutionStrategy;
  message?: string;
}

/**
 * 冲突解决器
 * 处理跨设备/IDE 同步时的内容冲突
 */
export class ConflictResolver {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<SyncConflict> | null = null;
  private mongoUri: string;
  private database: string;

  constructor(mongoUri: string, database: string = 'mongo_mcp') {
    this.mongoUri = mongoUri;
    this.database = database;
  }

  /**
   * 连接 MongoDB
   */
  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new MongoClient(this.mongoUri);
    await this.client.connect();
    this.db = this.client.db(this.database);
    this.collection = this.db.collection<SyncConflict>('sync_conflicts');

    await this.ensureIndexes();
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collection = null;
    }
  }

  /**
   * 确保索引存在
   */
  private async ensureIndexes(): Promise<void> {
    if (!this.collection) return;

    await this.collection.createIndex({ userId: 1, status: 1, detectedAt: -1 });
    await this.collection.createIndex({ documentId: 1 });
    await this.collection.createIndex({ userId: 1, documentType: 1 });
  }

  /**
   * 记录冲突
   */
  async recordConflict(
    userId: string,
    document: KnowledgeDocument,
    remoteContent: string | Record<string, unknown>,
    remoteSource: { deviceId: string; ideSource: SourceType; modifiedAt: Date }
  ): Promise<ObjectId> {
    if (!this.collection) throw new Error('Service not connected');

    const conflict: SyncConflict = {
      userId,
      documentId: document._id!,
      documentType: document.type,
      documentName: document.name,
      localSnapshot: {
        deviceId: document.deviceId,
        ideSource: document.ideSource,
        content: document.content,
        version: document.syncVersion,
        modifiedAt: document.updatedAt,
      },
      remoteSnapshot: {
        deviceId: remoteSource.deviceId,
        ideSource: remoteSource.ideSource,
        content: remoteContent,
        version: document.syncVersion + 1,
        modifiedAt: remoteSource.modifiedAt,
      },
      status: 'unresolved',
      detectedAt: new Date(),
    };

    const result = await this.collection.insertOne(conflict);
    return result.insertedId;
  }

  /**
   * 获取未解决的冲突
   */
  async getUnresolvedConflicts(
    userId: string,
    type?: KnowledgeType
  ): Promise<SyncConflict[]> {
    if (!this.collection) throw new Error('Service not connected');

    const filter: Filter<SyncConflict> = {
      userId,
      status: 'unresolved',
    };

    if (type) {
      filter.documentType = type;
    }

    return this.collection
      .find(filter)
      .sort({ detectedAt: -1 })
      .toArray();
  }

  /**
   * 获取冲突详情
   */
  async getConflict(conflictId: ObjectId): Promise<SyncConflict | null> {
    if (!this.collection) throw new Error('Service not connected');

    return this.collection.findOne({ _id: conflictId });
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflictId: ObjectId,
    resolution: ResolutionStrategy,
    resolvedBy: string,
    mergedContent?: string | Record<string, unknown>
  ): Promise<MergeResult> {
    if (!this.collection) throw new Error('Service not connected');

    const conflict = await this.collection.findOne({ _id: conflictId });
    if (!conflict) {
      return {
        success: false,
        content: '',
        strategy: resolution,
        message: 'Conflict not found',
      };
    }

    let resolvedContent: string | Record<string, unknown>;

    switch (resolution) {
      case 'keep_local':
        resolvedContent = conflict.localSnapshot.content;
        break;
      case 'keep_remote':
        resolvedContent = conflict.remoteSnapshot.content;
        break;
      case 'merge':
        if (!mergedContent) {
          // 自动合并尝试
          resolvedContent = this.autoMerge(
            conflict.localSnapshot.content,
            conflict.remoteSnapshot.content
          );
        } else {
          resolvedContent = mergedContent;
        }
        break;
      case 'manual':
        if (!mergedContent) {
          return {
            success: false,
            content: '',
            strategy: resolution,
            message: 'Manual resolution requires merged content',
          };
        }
        resolvedContent = mergedContent;
        break;
    }

    // 更新冲突记录
    await this.collection.updateOne(
      { _id: conflictId },
      {
        $set: {
          status: 'resolved',
          resolution,
          resolvedContent,
          resolvedBy,
          resolvedAt: new Date(),
        },
      }
    );

    return {
      success: true,
      content: resolvedContent,
      strategy: resolution,
    };
  }

  /**
   * 忽略冲突
   */
  async ignoreConflict(conflictId: ObjectId, resolvedBy: string): Promise<void> {
    if (!this.collection) throw new Error('Service not connected');

    await this.collection.updateOne(
      { _id: conflictId },
      {
        $set: {
          status: 'ignored',
          resolvedBy,
          resolvedAt: new Date(),
        },
      }
    );
  }

  /**
   * 自动合并（简单实现）
   * 对于字符串内容，尝试行级合并
   */
  private autoMerge(
    local: string | Record<string, unknown>,
    remote: string | Record<string, unknown>
  ): string | Record<string, unknown> {
    // 如果都是对象，尝试合并
    if (typeof local === 'object' && typeof remote === 'object') {
      return { ...local, ...remote };
    }

    // 如果都是字符串，尝试行级合并
    if (typeof local === 'string' && typeof remote === 'string') {
      const localLines = local.split('\n');
      const remoteLines = remote.split('\n');

      // 简单策略：取两边的并集（去重）
      const merged = new Set([...localLines, ...remoteLines]);
      return Array.from(merged).join('\n');
    }

    // 默认使用远程版本
    return remote;
  }

  /**
   * 获取冲突统计
   */
  async getStats(userId: string): Promise<{
    unresolved: number;
    resolved: number;
    ignored: number;
    byType: Record<KnowledgeType, number>;
  }> {
    if (!this.collection) throw new Error('Service not connected');

    const pipeline = [
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const statusResult = await this.collection.aggregate(pipeline).toArray();

    const stats = {
      unresolved: 0,
      resolved: 0,
      ignored: 0,
      byType: {} as Record<KnowledgeType, number>,
    };

    for (const item of statusResult) {
      if (item._id === 'unresolved') stats.unresolved = item.count;
      else if (item._id === 'resolved') stats.resolved = item.count;
      else if (item._id === 'ignored') stats.ignored = item.count;
    }

    // 按类型统计未解决的冲突
    const typePipeline = [
      { $match: { userId, status: 'unresolved' } },
      { $group: { _id: '$documentType', count: { $sum: 1 } } },
    ];

    const typeResult = await this.collection.aggregate(typePipeline).toArray();
    for (const item of typeResult) {
      stats.byType[item._id as KnowledgeType] = item.count;
    }

    return stats;
  }

  /**
   * 批量解决冲突
   */
  async batchResolve(
    conflictIds: ObjectId[],
    resolution: ResolutionStrategy,
    resolvedBy: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of conflictIds) {
      const result = await this.resolveConflict(id, resolution, resolvedBy);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 清理旧的已解决冲突
   */
  async cleanup(olderThan: Date): Promise<number> {
    if (!this.collection) throw new Error('Service not connected');

    const result = await this.collection.deleteMany({
      status: { $in: ['resolved', 'ignored'] },
      resolvedAt: { $lt: olderThan },
    });

    return result.deletedCount;
  }
}
