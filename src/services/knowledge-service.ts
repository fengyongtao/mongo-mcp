import { MongoClient, Db, Collection, ObjectId, Filter } from 'mongodb';
import { KnowledgeDocument, KnowledgeType, ListOptions, SemanticSearchOptions } from '../types.js';
import { getEmbeddingService } from './embedding-service.js';
import type { SourceType } from '../types.js';

/**
 * 用户上下文配置
 */
export interface UserContext {
  userId: string;
  deviceId: string;
  ideSource: SourceType;
}

/**
 * 知识库服务类
 * 管理 8 种知识类型：Memories, Skills, Rules, MCPs, Experiences, Commands, Contexts, Workflows
 * 支持用户隔离和跨终端同步
 */
export class KnowledgeService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<KnowledgeDocument> | null = null;
  private mongoUri: string;
  private database: string;
  private collectionName: string;
  private userContext: UserContext;

  constructor(
    mongoUri: string,
    database: string = 'mongo_mcp',
    collectionName: string = 'knowledge',
    userContext: UserContext = { userId: 'default', deviceId: 'unknown', ideSource: 'other' }
  ) {
    this.mongoUri = mongoUri;
    this.database = database;
    this.collectionName = collectionName;
    this.userContext = userContext;
  }

  /**
   * 连接 MongoDB
   */
  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new MongoClient(this.mongoUri);
    await this.client.connect();
    this.db = this.client.db(this.database);
    this.collection = this.db.collection<KnowledgeDocument>(this.collectionName);

    // 创建索引
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

    // 用户级唯一索引（同一用户下，type + name 唯一）
    await this.collection.createIndex(
      { userId: 1, type: 1, name: 1 },
      { unique: true }
    );
    // 用户 + 类型查询
    await this.collection.createIndex({ userId: 1, type: 1 });
    // 用户 + 设备查询（跨设备同步）
    await this.collection.createIndex({ userId: 1, deviceId: 1 });
    // 标签查询
    await this.collection.createIndex({ userId: 1, tags: 1 });
    // 时间排序
    await this.collection.createIndex({ userId: 1, updatedAt: -1 });
  }

  /**
   * 获取用户过滤器
   */
  private getUserFilter(): Filter<KnowledgeDocument> {
    return { userId: this.userContext.userId };
  }

  /**
   * 注入用户上下文到文档
   */
  private injectUserContext<T extends Partial<KnowledgeDocument>>(doc: T): T & UserContext {
    return {
      ...doc,
      userId: this.userContext.userId,
      deviceId: this.userContext.deviceId,
      ideSource: this.userContext.ideSource,
    };
  }

  /**
   * 创建知识文档
   */
  async create(
    doc: Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'deviceId' | 'ideSource' | 'syncVersion'>
  ): Promise<KnowledgeDocument> {
    if (!this.collection) throw new Error('Not connected');

    const now = new Date();
    const newDoc: KnowledgeDocument = {
      ...this.injectUserContext(doc),
      enabled: doc.enabled ?? true,
      syncVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(newDoc as KnowledgeDocument);
    return { ...newDoc, _id: result.insertedId };
  }

  /**
   * 获取单个文档
   */
  async get(type: KnowledgeType, name: string): Promise<KnowledgeDocument | null> {
    if (!this.collection) throw new Error('Not connected');
    return this.collection.findOne({
      ...this.getUserFilter(),
      type,
      name,
    });
  }

  /**
   * 通过 ID 获取文档
   */
  async getById(id: string): Promise<KnowledgeDocument | null> {
    if (!this.collection) throw new Error('Not connected');
    return this.collection.findOne({
      ...this.getUserFilter(),
      _id: new ObjectId(id),
    });
  }

  /**
   * 更新文档
   */
  async update(
    type: KnowledgeType,
    name: string,
    updates: Partial<Omit<KnowledgeDocument, '_id' | 'type' | 'createdAt' | 'userId'>>
  ): Promise<KnowledgeDocument | null> {
    if (!this.collection) throw new Error('Not connected');

    const result = await this.collection.findOneAndUpdate(
      { ...this.getUserFilter(), type, name },
      {
        $set: {
          ...updates,
          deviceId: this.userContext.deviceId,
          ideSource: this.userContext.ideSource,
          updatedAt: new Date(),
        },
        $inc: { syncVersion: 1 },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * 删除文档
   */
  async delete(type: KnowledgeType, name: string): Promise<boolean> {
    if (!this.collection) throw new Error('Not connected');
    const result = await this.collection.deleteOne({
      ...this.getUserFilter(),
      type,
      name,
    });
    return result.deletedCount > 0;
  }

  /**
   * 列出指定类型的所有文档
   */
  async list(options?: ListOptions): Promise<KnowledgeDocument[]> {
    if (!this.collection) throw new Error('Not connected');

    const filter: Filter<KnowledgeDocument> = this.getUserFilter();

    if (options?.type) filter.type = options.type;
    if (options?.enabled !== undefined) filter.enabled = options.enabled;
    if (options?.tags?.length) filter.tags = { $in: options.tags };
    if (options?.search) {
      filter.$or = [
        { name: { $regex: options.search, $options: 'i' } },
        { description: { $regex: options.search, $options: 'i' } },
      ];
    }

    let cursor = this.collection.find(filter).sort({ updatedAt: -1 });

    if (options?.offset) cursor = cursor.skip(options.offset);
    if (options?.limit) cursor = cursor.limit(options.limit);

    return cursor.toArray();
  }

  /**
   * 统计文档数量
   */
  async count(type?: KnowledgeType): Promise<Record<KnowledgeType, number> | number> {
    if (!this.collection) throw new Error('Not connected');

    if (type) {
      return this.collection.countDocuments({ ...this.getUserFilter(), type });
    }

    const types: KnowledgeType[] = [
      'MCPs', 'Memories', 'Rules', 'Skills',
      'Experiences', 'Commands', 'Contexts', 'Workflows'
    ];
    const counts: Record<string, number> = {};

    for (const t of types) {
      counts[t] = await this.collection.countDocuments({ ...this.getUserFilter(), type: t });
    }

    return counts as Record<KnowledgeType, number>;
  }

  /**
   * 批量导入
   */
  async bulkImport(
    docs: Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'deviceId' | 'ideSource' | 'syncVersion'>[]
  ): Promise<number> {
    if (!this.collection) throw new Error('Not connected');

    const now = new Date();
    const docsToInsert = docs.map(doc => ({
      ...this.injectUserContext(doc),
      enabled: doc.enabled ?? true,
      syncVersion: 1,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await this.collection.insertMany(docsToInsert as KnowledgeDocument[]);
    return result.insertedCount;
  }

  /**
   * 批量导出
   */
  async bulkExport(type?: KnowledgeType): Promise<KnowledgeDocument[]> {
    return this.list({ type });
  }

  /**
   * 语义搜索
   */
  async semanticSearch(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<Array<KnowledgeDocument & { score: number }>> {
    if (!this.collection) throw new Error('Not connected');

    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.embed(query);

    const filter: Filter<KnowledgeDocument> = {
      ...this.getUserFilter(),
      embedding: { $exists: true },
    };
    if (options?.type) filter.type = options.type;

    const docs = await this.collection.find(filter).toArray();

    const results = docs
      .map(doc => ({
        ...doc,
        score: embeddingService.cosineSimilarity(queryEmbedding, doc.embedding!)
      }))
      .filter(doc => doc.score >= (options?.threshold ?? 0.3))
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.limit ?? 10);

    return results;
  }

  /**
   * 为文档生成嵌入
   */
  async generateEmbedding(doc: KnowledgeDocument): Promise<number[]> {
    const embeddingService = getEmbeddingService();
    const text = embeddingService.extractTextForEmbedding(doc);
    return embeddingService.embed(text);
  }

  /**
   * 批量生成嵌入
   */
  async generateEmbeddings(type?: KnowledgeType): Promise<number> {
    if (!this.collection) throw new Error('Not connected');

    const embeddingService = getEmbeddingService();
    const filter: Filter<KnowledgeDocument> = this.getUserFilter();
    if (type) filter.type = type;

    const docs = await this.collection.find(filter).toArray();
    let count = 0;

    for (const doc of docs) {
      const text = embeddingService.extractTextForEmbedding(doc);
      const embedding = await embeddingService.embed(text);

      await this.collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            embedding,
            embeddingModel: embeddingService.getModelName(),
            embeddedAt: new Date()
          }
        }
      );
      count++;
    }

    return count;
  }

  /**
   * 创建文档并生成嵌入
   */
  async createWithEmbedding(
    doc: Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'deviceId' | 'ideSource' | 'syncVersion'>
  ): Promise<KnowledgeDocument> {
    const embeddingService = getEmbeddingService();
    const text = embeddingService.extractTextForEmbedding(doc as KnowledgeDocument);
    const embedding = await embeddingService.embed(text);

    return this.create({
      ...doc,
      embedding,
      embeddingModel: embeddingService.getModelName(),
      embeddedAt: new Date()
    });
  }

  /**
   * 获取用户上下文
   */
  getUserContext(): UserContext {
    return { ...this.userContext };
  }

  /**
   * 检查文档是否存在
   */
  async exists(type: KnowledgeType, name: string): Promise<boolean> {
    if (!this.collection) throw new Error('Not connected');
    const count = await this.collection.countDocuments({
      ...this.getUserFilter(),
      type,
      name,
    });
    return count > 0;
  }

  /**
   * 创建或更新文档（upsert）
   */
  async upsert(
    type: KnowledgeType,
    name: string,
    doc: Partial<Omit<KnowledgeDocument, '_id' | 'type' | 'name' | 'createdAt' | 'userId'>>
  ): Promise<KnowledgeDocument> {
    const existing = await this.get(type, name);

    if (existing) {
      const updated = await this.update(type, name, doc);
      return updated!;
    } else {
      return this.create({
        type,
        name,
        content: doc.content || '',
        ...doc,
      } as Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'deviceId' | 'ideSource' | 'syncVersion'>);
    }
  }
}
