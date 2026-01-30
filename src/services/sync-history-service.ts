import { MongoClient, Db, Collection, ObjectId, Filter } from 'mongodb';
import { SyncHistory, SyncOperation, SyncDirection } from '../types/sync.types.js';
import type { SourceType, KnowledgeType } from '../types.js';

/**
 * 同步历史服务
 * 记录和查询同步操作历史
 */
export class SyncHistoryService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<SyncHistory> | null = null;
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
    this.collection = this.db.collection<SyncHistory>('sync_history');

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

    // 用户+设备+时间 查询
    await this.collection.createIndex(
      { userId: 1, deviceId: 1, startedAt: -1 }
    );
    // 文档 ID 查询
    await this.collection.createIndex(
      { documentId: 1, startedAt: -1 }
    );
    // 用户+状态 查询
    await this.collection.createIndex(
      { userId: 1, status: 1, startedAt: -1 }
    );
    // 用户+操作类型 查询
    await this.collection.createIndex(
      { userId: 1, operation: 1, startedAt: -1 }
    );
    // TTL 索引 - 90天后自动删除历史记录
    await this.collection.createIndex(
      { startedAt: 1 },
      { expireAfterSeconds: 90 * 24 * 60 * 60 }
    );
  }

  /**
   * 记录同步历史
   */
  async record(history: Omit<SyncHistory, '_id'>): Promise<ObjectId> {
    if (!this.collection) throw new Error('Service not connected');

    const result = await this.collection.insertOne(history as SyncHistory);
    return result.insertedId;
  }

  /**
   * 批量记录同步历史
   */
  async recordBatch(histories: Array<Omit<SyncHistory, '_id'>>): Promise<ObjectId[]> {
    if (!this.collection) throw new Error('Service not connected');
    if (histories.length === 0) return [];

    const result = await this.collection.insertMany(histories as SyncHistory[]);
    return Object.values(result.insertedIds);
  }

  /**
   * 更新同步状态
   */
  async updateStatus(
    historyId: ObjectId,
    status: 'success' | 'failed' | 'partial',
    errorMessage?: string
  ): Promise<void> {
    if (!this.collection) throw new Error('Service not connected');

    const completedAt = new Date();
    const history = await this.collection.findOne({ _id: historyId });
    const durationMs = history ? completedAt.getTime() - history.startedAt.getTime() : undefined;

    await this.collection.updateOne(
      { _id: historyId },
      {
        $set: {
          status,
          completedAt,
          durationMs,
          ...(errorMessage && { errorMessage }),
        },
      }
    );
  }

  /**
   * 查询用户同步历史
   */
  async findByUser(
    userId: string,
    options: {
      deviceId?: string;
      status?: 'success' | 'failed' | 'partial';
      operation?: SyncOperation;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SyncHistory[]> {
    if (!this.collection) throw new Error('Service not connected');

    const filter: Filter<SyncHistory> = { userId };
    if (options.deviceId) filter.deviceId = options.deviceId;
    if (options.status) filter.status = options.status;
    if (options.operation) filter.operation = options.operation;

    return this.collection
      .find(filter)
      .sort({ startedAt: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 50)
      .toArray();
  }

  /**
   * 查询文档同步历史
   */
  async findByDocument(
    documentId: ObjectId,
    limit: number = 20
  ): Promise<SyncHistory[]> {
    if (!this.collection) throw new Error('Service not connected');

    return this.collection
      .find({ documentId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * 获取最近的同步记录
   */
  async getLatestSync(userId: string, deviceId: string): Promise<SyncHistory | null> {
    if (!this.collection) throw new Error('Service not connected');

    return this.collection.findOne(
      { userId, deviceId, status: 'success' },
      { sort: { startedAt: -1 } }
    );
  }

  /**
   * 统计同步情况
   */
  async getStats(
    userId: string,
    since?: Date
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    partial: number;
    byOperation: Record<SyncOperation, number>;
    avgDurationMs: number;
  }> {
    if (!this.collection) throw new Error('Service not connected');

    const filter: Filter<SyncHistory> = { userId };
    if (since) filter.startedAt = { $gte: since };

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          partial: { $sum: { $cond: [{ $eq: ['$status', 'partial'] }, 1, 0] } },
          avgDurationMs: { $avg: '$durationMs' },
        },
      },
    ];

    const result = await this.collection.aggregate(pipeline).toArray();
    const stats = result[0] || { total: 0, success: 0, failed: 0, partial: 0, avgDurationMs: 0 };

    // 按操作类型统计
    const opPipeline = [
      { $match: filter },
      { $group: { _id: '$operation', count: { $sum: 1 } } },
    ];
    const opResult = await this.collection.aggregate(opPipeline).toArray();
    const byOperation: Record<SyncOperation, number> = {
      create: 0,
      update: 0,
      delete: 0,
      conflict_resolve: 0,
    };
    for (const op of opResult) {
      byOperation[op._id as SyncOperation] = op.count;
    }

    return {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      partial: stats.partial,
      byOperation,
      avgDurationMs: Math.round(stats.avgDurationMs || 0),
    };
  }

  /**
   * 清理旧历史记录
   */
  async cleanup(olderThan: Date): Promise<number> {
    if (!this.collection) throw new Error('Service not connected');

    const result = await this.collection.deleteMany({
      startedAt: { $lt: olderThan },
    });
    return result.deletedCount;
  }
}
