import { MongoClient, Db, Collection, ObjectId, Filter } from 'mongodb';
import { DeviceRegistry } from '../types/sync.types.js';
import type { SourceType } from '../types.js';

/**
 * 设备服务
 * 管理用户设备注册和心跳
 */
export class DeviceService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<DeviceRegistry> | null = null;
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
    this.collection = this.db.collection<DeviceRegistry>('devices');

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

    // 用户+设备 唯一索引
    await this.collection.createIndex(
      { userId: 1, deviceId: 1 },
      { unique: true }
    );
    // 用户查询
    await this.collection.createIndex({ userId: 1, status: 1 });
    // 心跳查询
    await this.collection.createIndex({ lastHeartbeat: 1 });
  }

  /**
   * 注册或更新设备
   */
  async registerDevice(
    userId: string,
    deviceId: string,
    deviceInfo: {
      deviceName: string;
      platform: 'windows' | 'macos' | 'linux';
      hostname?: string;
      ideSource: SourceType;
      ideVersion?: string;
      configPath?: string;
    }
  ): Promise<DeviceRegistry> {
    if (!this.collection) throw new Error('Service not connected');

    const now = new Date();
    const existing = await this.collection.findOne({ userId, deviceId });

    if (existing) {
      // 更新现有设备
      const ideIndex = existing.installedIDEs.findIndex(
        ide => ide.ideSource === deviceInfo.ideSource
      );

      const updateOps: Record<string, unknown> = {
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        hostname: deviceInfo.hostname,
        activeIDE: deviceInfo.ideSource,
        status: 'active',
        lastHeartbeat: now,
        updatedAt: now,
      };

      if (ideIndex >= 0) {
        // 更新已有 IDE
        updateOps[`installedIDEs.${ideIndex}.version`] = deviceInfo.ideVersion;
        updateOps[`installedIDEs.${ideIndex}.configPath`] = deviceInfo.configPath;
        updateOps[`installedIDEs.${ideIndex}.lastActiveAt`] = now;
      } else {
        // 添加新 IDE
        await this.collection.updateOne(
          { userId, deviceId },
          {
            $push: {
              installedIDEs: {
                ideSource: deviceInfo.ideSource,
                version: deviceInfo.ideVersion,
                configPath: deviceInfo.configPath,
                lastActiveAt: now,
              },
            },
          }
        );
      }

      await this.collection.updateOne(
        { userId, deviceId },
        { $set: updateOps }
      );

      return (await this.collection.findOne({ userId, deviceId }))!;
    }

    // 注册新设备
    const device: DeviceRegistry = {
      userId,
      deviceId,
      deviceName: deviceInfo.deviceName,
      platform: deviceInfo.platform,
      hostname: deviceInfo.hostname,
      installedIDEs: [
        {
          ideSource: deviceInfo.ideSource,
          version: deviceInfo.ideVersion,
          configPath: deviceInfo.configPath,
          lastActiveAt: now,
        },
      ],
      activeIDE: deviceInfo.ideSource,
      status: 'active',
      lastHeartbeat: now,
      syncPriority: 10,
      registeredAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(device);
    return device;
  }

  /**
   * 更新心跳
   */
  async heartbeat(userId: string, deviceId: string): Promise<void> {
    if (!this.collection) throw new Error('Service not connected');

    await this.collection.updateOne(
      { userId, deviceId },
      {
        $set: {
          lastHeartbeat: new Date(),
          status: 'active',
        },
      }
    );
  }

  /**
   * 获取设备信息
   */
  async getDevice(userId: string, deviceId: string): Promise<DeviceRegistry | null> {
    if (!this.collection) throw new Error('Service not connected');

    return this.collection.findOne({ userId, deviceId });
  }

  /**
   * 获取用户所有设备
   */
  async getUserDevices(
    userId: string,
    status?: 'active' | 'inactive' | 'removed'
  ): Promise<DeviceRegistry[]> {
    if (!this.collection) throw new Error('Service not connected');

    const filter: Filter<DeviceRegistry> = { userId };
    if (status) filter.status = status;

    return this.collection
      .find(filter)
      .sort({ syncPriority: 1, lastHeartbeat: -1 })
      .toArray();
  }

  /**
   * 设置设备状态
   */
  async setStatus(
    userId: string,
    deviceId: string,
    status: 'active' | 'inactive' | 'removed'
  ): Promise<void> {
    if (!this.collection) throw new Error('Service not connected');

    await this.collection.updateOne(
      { userId, deviceId },
      { $set: { status, updatedAt: new Date() } }
    );
  }

  /**
   * 更新最后同步时间
   */
  async updateLastSync(userId: string, deviceId: string): Promise<void> {
    if (!this.collection) throw new Error('Service not connected');

    await this.collection.updateOne(
      { userId, deviceId },
      { $set: { lastSyncAt: new Date(), updatedAt: new Date() } }
    );
  }

  /**
   * 设置同步优先级
   */
  async setSyncPriority(
    userId: string,
    deviceId: string,
    priority: number
  ): Promise<void> {
    if (!this.collection) throw new Error('Service not connected');

    await this.collection.updateOne(
      { userId, deviceId },
      { $set: { syncPriority: priority, updatedAt: new Date() } }
    );
  }

  /**
   * 标记不活跃设备
   * 超过指定时间未心跳的设备将被标记为不活跃
   */
  async markInactiveDevices(inactiveDuration: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.collection) throw new Error('Service not connected');

    const threshold = new Date(Date.now() - inactiveDuration);

    const result = await this.collection.updateMany(
      {
        status: 'active',
        lastHeartbeat: { $lt: threshold },
      },
      {
        $set: { status: 'inactive', updatedAt: new Date() },
      }
    );

    return result.modifiedCount;
  }

  /**
   * 删除设备
   */
  async removeDevice(userId: string, deviceId: string): Promise<boolean> {
    if (!this.collection) throw new Error('Service not connected');

    const result = await this.collection.deleteOne({ userId, deviceId });
    return result.deletedCount > 0;
  }

  /**
   * 检查设备是否活跃
   */
  async isDeviceActive(userId: string, deviceId: string): Promise<boolean> {
    if (!this.collection) throw new Error('Service not connected');

    const device = await this.collection.findOne({
      userId,
      deviceId,
      status: 'active',
    });

    return device !== null;
  }
}
