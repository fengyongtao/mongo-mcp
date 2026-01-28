import { MongoClient, Db, Collection, ObjectId, Filter } from 'mongodb';
import { KnowledgeDocument, KnowledgeType, MemoryDocument, McpDocument, SkillDocument, RuleDocument } from '../types.js';
import { getEmbeddingService, EmbeddingService } from './embedding-service.js';

/**
 * 知识库服务类
 * 管理 MCPs、Memories、Rules、Skills
 */
export class KnowledgeService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<KnowledgeDocument> | null = null;
  private mongoUri: string;
  private database: string;
  private collectionName: string;

  constructor(mongoUri: string, database: string = 'knowledge', collectionName: string = 'context') {
    this.mongoUri = mongoUri;
    this.database = database;
    this.collectionName = collectionName;
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
    console.log(`[Knowledge] Connected to ${this.database}/${this.collectionName}`);
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

    await this.collection.createIndex({ type: 1, name: 1 }, { unique: true });
    await this.collection.createIndex({ type: 1 });
    await this.collection.createIndex({ tags: 1 });
    await this.collection.createIndex({ updatedAt: -1 });
  }

  /**
   * 创建知识文档
   */
  async create(doc: Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeDocument> {
    if (!this.collection) throw new Error('Not connected');

    const now = new Date();
    const newDoc: KnowledgeDocument = {
      ...doc,
      enabled: doc.enabled ?? true,
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
    return this.collection.findOne({ type, name });
  }

  /**
   * 通过 ID 获取文档
   */
  async getById(id: string): Promise<KnowledgeDocument | null> {
    if (!this.collection) throw new Error('Not connected');
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * 更新文档
   */
  async update(
    type: KnowledgeType,
    name: string,
    updates: Partial<Omit<KnowledgeDocument, '_id' | 'type' | 'createdAt'>>
  ): Promise<KnowledgeDocument | null> {
    if (!this.collection) throw new Error('Not connected');

    const result = await this.collection.findOneAndUpdate(
      { type, name },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * 删除文档
   */
  async delete(type: KnowledgeType, name: string): Promise<boolean> {
    if (!this.collection) throw new Error('Not connected');
    const result = await this.collection.deleteOne({ type, name });
    return result.deletedCount > 0;
  }

  /**
   * 列出指定类型的所有文档
   */
  async list(type?: KnowledgeType, options?: {
    tags?: string[];
    enabled?: boolean;
    search?: string;
    source?: string;
    limit?: number;
    skip?: number;
  }): Promise<KnowledgeDocument[]> {
    if (!this.collection) throw new Error('Not connected');

    const filter: Filter<KnowledgeDocument> = {};

    if (type) filter.type = type;
    if (options?.enabled !== undefined) filter.enabled = options.enabled;
    if (options?.tags?.length) filter.tags = { $in: options.tags };
    if (options?.source) filter.source = options.source as any;
    if (options?.search) {
      filter.$or = [
        { name: { $regex: options.search, $options: 'i' } },
        { description: { $regex: options.search, $options: 'i' } },
      ];
    }

    let cursor = this.collection.find(filter).sort({ updatedAt: -1 });

    if (options?.skip) cursor = cursor.skip(options.skip);
    if (options?.limit) cursor = cursor.limit(options.limit);

    return cursor.toArray();
  }

  /**
   * 统计文档数量
   */
  async count(type?: KnowledgeType): Promise<Record<KnowledgeType, number> | number> {
    if (!this.collection) throw new Error('Not connected');

    if (type) {
      return this.collection.countDocuments({ type });
    }

    const types: KnowledgeType[] = ['MCPs', 'Memories', 'Rules', 'Skills'];
    const counts: Record<string, number> = {};

    for (const t of types) {
      counts[t] = await this.collection.countDocuments({ type: t });
    }

    return counts as Record<KnowledgeType, number>;
  }

  /**
   * 批量导入
   */
  async bulkImport(docs: Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt'>[]): Promise<number> {
    if (!this.collection) throw new Error('Not connected');

    const now = new Date();
    const docsToInsert = docs.map(doc => ({
      ...doc,
      enabled: doc.enabled ?? true,
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
    return this.list(type);
  }

  /**
   * 语义搜索
   */
  async semanticSearch(query: string, options?: {
    type?: KnowledgeType;
    limit?: number;
    threshold?: number;
  }): Promise<Array<KnowledgeDocument & { score: number }>> {
    if (!this.collection) throw new Error('Not connected');

    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.embed(query);

    const filter: Filter<KnowledgeDocument> = { embedding: { $exists: true } };
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
    const filter: Filter<KnowledgeDocument> = {};
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
      console.log(`[Embedding] Generated for ${doc.type}/${doc.name} (${count}/${docs.length})`);
    }

    return count;
  }

  /**
   * 创建文档并生成嵌入
   */
  async createWithEmbedding(doc: Omit<KnowledgeDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeDocument> {
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
}
