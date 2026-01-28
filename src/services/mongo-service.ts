import {
  MongoClient,
  Db,
  Collection,
  ChangeStream,
  ChangeStreamDocument,
  Filter,
  UpdateFilter,
} from 'mongodb';
import { ConfigDocument, ConfigChangeEvent, ServerConfig } from '../types.js';

/**
 * MongoDB 服务类
 * 封装 MongoDB 操作和 Change Stream 监听
 */
export class MongoService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<ConfigDocument> | null = null;
  private changeStream: ChangeStream | null = null;
  private config: ServerConfig;
  private changeListeners: ((event: ConfigChangeEvent) => void)[] = [];

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * 连接 MongoDB
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = new MongoClient(this.config.mongoUri);
    await this.client.connect();
    this.db = this.client.db(this.config.database);
    this.collection = this.db.collection<ConfigDocument>(this.config.collection);

    // 创建索引
    await this.ensureIndexes();

    console.log(`[MongoDB] Connected to ${this.config.database}`);
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
    }
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collection = null;
    }
    console.log('[MongoDB] Disconnected');
  }

  /**
   * 确保索引存在
   */
  private async ensureIndexes(): Promise<void> {
    if (!this.collection) return;

    await this.collection.createIndex(
      { configKey: 1, environment: 1 },
      { unique: true }
    );
    await this.collection.createIndex({ environment: 1 });
    await this.collection.createIndex({ updatedAt: -1 });
  }

  /**
   * 获取配置
   */
  async getConfig(configKey: string, environment: string): Promise<ConfigDocument | null> {
    if (!this.collection) {
      throw new Error('MongoDB not connected');
    }

    return this.collection.findOne({ configKey, environment });
  }

  /**
   * 保存配置（插入或更新）
   */
  async saveConfig(
    configKey: string,
    environment: string,
    content: Record<string, unknown>,
    metadata?: ConfigDocument['metadata'],
    expectedVersion?: number
  ): Promise<ConfigDocument> {
    if (!this.collection) {
      throw new Error('MongoDB not connected');
    }

    const now = new Date();
    const filter: Filter<ConfigDocument> = { configKey, environment };

    // 如果指定了期望版本号，添加到过滤条件（乐观锁）
    if (expectedVersion !== undefined) {
      (filter as Record<string, unknown>).version = expectedVersion;
    }

    const existing = await this.collection.findOne({ configKey, environment });
    const newVersion = existing ? existing.version + 1 : 1;

    const update: UpdateFilter<ConfigDocument> = {
      $set: {
        content,
        metadata,
        updatedAt: now,
        version: newVersion,
      },
      $setOnInsert: {
        configKey,
        environment,
        createdAt: now,
      },
    };

    const result = await this.collection.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
    });

    if (!result) {
      throw new Error('Version conflict: config was modified by another process');
    }

    return result;
  }

  /**
   * 删除配置
   */
  async deleteConfig(configKey: string, environment: string): Promise<boolean> {
    if (!this.collection) {
      throw new Error('MongoDB not connected');
    }

    const result = await this.collection.deleteOne({ configKey, environment });
    return result.deletedCount > 0;
  }

  /**
   * 列出配置
   */
  async listConfigs(
    environment?: string,
    configKeyFilter?: string
  ): Promise<ConfigDocument[]> {
    if (!this.collection) {
      throw new Error('MongoDB not connected');
    }

    const filter: Filter<ConfigDocument> = {};

    if (environment) {
      filter.environment = environment;
    }

    if (configKeyFilter) {
      filter.configKey = { $regex: configKeyFilter, $options: 'i' };
    }

    return this.collection
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * 检查配置是否存在
   */
  async exists(configKey: string, environment: string): Promise<boolean> {
    if (!this.collection) {
      throw new Error('MongoDB not connected');
    }

    const count = await this.collection.countDocuments({ configKey, environment });
    return count > 0;
  }

  /**
   * 启动 Change Stream 监听
   */
  async startChangeStream(): Promise<void> {
    if (!this.config.enableChangeStream) {
      console.log('[MongoDB] Change Stream disabled');
      return;
    }

    if (!this.collection) {
      throw new Error('MongoDB not connected');
    }

    if (this.changeStream) {
      return;
    }

    const pipeline = [
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace', 'delete'] },
        },
      },
    ];

    this.changeStream = this.collection.watch(pipeline, {
      fullDocument: 'updateLookup',
    });

    this.changeStream.on('change', (change: ChangeStreamDocument<ConfigDocument>) => {
      this.handleChange(change);
    });

    this.changeStream.on('error', (error) => {
      console.error('[MongoDB] Change Stream error:', error);
      // 尝试重新连接
      setTimeout(() => this.reconnectChangeStream(), 5000);
    });

    console.log('[MongoDB] Change Stream started');
  }

  /**
   * 停止 Change Stream 监听
   */
  async stopChangeStream(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
      console.log('[MongoDB] Change Stream stopped');
    }
  }

  /**
   * 重新连接 Change Stream
   */
  private async reconnectChangeStream(): Promise<void> {
    console.log('[MongoDB] Reconnecting Change Stream...');
    this.changeStream = null;
    await this.startChangeStream();
  }

  /**
   * 处理变更事件
   */
  private handleChange(change: ChangeStreamDocument<ConfigDocument>): void {
    let event: ConfigChangeEvent | null = null;

    if (change.operationType === 'delete') {
      const docKey = change.documentKey as { _id: unknown; configKey?: string; environment?: string };
      event = {
        operationType: 'delete',
        configKey: docKey.configKey || 'unknown',
        environment: docKey.environment || 'unknown',
        timestamp: new Date(),
      };
    } else if (
      change.operationType === 'insert' ||
      change.operationType === 'update' ||
      change.operationType === 'replace'
    ) {
      const fullDoc = (change as { fullDocument?: ConfigDocument }).fullDocument;
      if (fullDoc) {
        event = {
          operationType: change.operationType,
          configKey: fullDoc.configKey,
          environment: fullDoc.environment,
          document: fullDoc,
          timestamp: new Date(),
        };
      }
    }

    if (event) {
      console.log(`[MongoDB] Config changed: ${event.operationType} ${event.configKey}@${event.environment}`);
      this.changeListeners.forEach((listener) => listener(event!));
    }
  }

  /**
   * 注册变更监听器
   */
  onConfigChange(listener: (event: ConfigChangeEvent) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * 移除变更监听器
   */
  offConfigChange(listener: (event: ConfigChangeEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }
}
