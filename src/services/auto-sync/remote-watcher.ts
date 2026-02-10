import type { ChangeStream, ChangeStreamDocument, Collection, ResumeToken } from 'mongodb';
import lodash from 'lodash';
import type { KnowledgeDocument, KnowledgeType } from '../../types.js';

const { throttle } = lodash;
import type { EventHandler, RemoteChangeEvent, RemoteChangeType } from './types.js';

/**
 * 远程变化监听器
 * 使用 MongoDB Change Streams 监听知识库变化
 */
export class RemoteChangeWatcher {
  private changeStream: ChangeStream | null = null;
  private resumeToken: ResumeToken | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private throttledEmit: ReturnType<typeof throttle>;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;

  constructor(
    private collection: Collection<KnowledgeDocument>,
    private userId: string,
    private currentDeviceId: string,
    private throttleMs: number,
    private onEvent: EventHandler
  ) {
    // 创建节流的事件发射器
    this.throttledEmit = throttle(
      (event: RemoteChangeEvent) => {
        this.onEvent(event);
      },
      this.throttleMs,
      { leading: true, trailing: true }
    );
  }

  /**
   * 启动 Change Stream 监听
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // 构建管道 - 过滤本设备的变更
      const pipeline = [
        {
          $match: {
            // 只监听指定用户的变更
            'fullDocument.userId': this.userId,
            // 忽略本设备的变更（避免循环同步）
            'fullDocument.deviceId': { $ne: this.currentDeviceId },
            // 只监听相关操作
            operationType: { $in: ['insert', 'update', 'replace', 'delete'] },
          },
        },
      ];

      // 创建 Change Stream
      const options: { fullDocument?: 'updateLookup'; resumeAfter?: ResumeToken } = {
        fullDocument: 'updateLookup',
      };

      if (this.resumeToken) {
        options.resumeAfter = this.resumeToken;
      }

      this.changeStream = this.collection.watch(pipeline, options);

      // 监听变更事件
      this.changeStream.on('change', (change: ChangeStreamDocument<KnowledgeDocument>) => {
        this.handleChange(change);
      });

      // 监听错误事件
      this.changeStream.on('error', (error) => {
        console.error('ChangeStream error:', error);
        this.reconnect();
      });

      // 监听关闭事件
      this.changeStream.on('close', () => {
        if (this.isRunning) {
          console.log('ChangeStream closed, attempting to reconnect...');
          this.reconnect();
        }
      });

      this.isRunning = true;
      this.reconnectAttempts = 0;
      console.log('RemoteChangeWatcher started successfully');
    } catch (error) {
      console.error('Failed to start ChangeStream:', error);
      this.reconnect();
    }
  }

  /**
   * 停止 Change Stream 监听
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // 取消重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 取消节流函数
    this.throttledEmit.cancel();

    // 关闭 Change Stream
    if (this.changeStream) {
      try {
        await this.changeStream.close();
      } catch {
        // 忽略关闭错误
      }
      this.changeStream = null;
    }

    console.log('RemoteChangeWatcher stopped');
  }

  /**
   * 检查是否正在运行
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 处理 Change Stream 变更
   */
  private handleChange(change: ChangeStreamDocument<KnowledgeDocument>): void {
    try {
      // 保存 resume token 用于断线重连
      if (change._id) {
        this.resumeToken = change._id;
      }

      const operationType = change.operationType as RemoteChangeType;

      // 对于删除操作，fullDocument 可能为空
      if (operationType === 'delete') {
        // 删除事件需要特殊处理
        // 由于 fullDocument 为空，我们只能获取到 documentId
        // 实际的 documentType 和 documentName 需要从其他地方获取
        // 这里我们跳过删除事件的处理，因为无法获取完整信息
        return;
      }

      // 获取文档信息（仅 insert, update, replace 有 fullDocument）
      const changeWithDoc = change as { fullDocument?: KnowledgeDocument };
      const doc = changeWithDoc.fullDocument;

      if (!doc) {
        return;
      }

      // 构建事件
      const event: RemoteChangeEvent = {
        source: 'remote',
        operationType,
        documentId: doc._id!,
        documentType: doc.type as KnowledgeType,
        documentName: doc.name,
        userId: doc.userId,
        deviceId: doc.deviceId,
        timestamp: new Date(),
      };

      // 使用节流发射事件
      this.throttledEmit(event);
    } catch (error) {
      console.error('Error handling change event:', error);
    }
  }

  /**
   * 重新连接
   */
  private reconnect(): void {
    if (!this.isRunning || this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached, stopping RemoteChangeWatcher');
      this.isRunning = false;
      return;
    }

    // 指数退避重连
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 最大 30 秒
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      // 关闭旧的 Change Stream
      if (this.changeStream) {
        try {
          await this.changeStream.close();
        } catch {
          // 忽略
        }
        this.changeStream = null;
      }

      // 重新启动
      try {
        await this.start();
      } catch (error) {
        console.error('Reconnect failed:', error);
        this.reconnect();
      }
    }, delay);
  }

  /**
   * 更新用户上下文
   */
  updateContext(userId: string, deviceId: string): void {
    this.userId = userId;
    this.currentDeviceId = deviceId;
  }

  /**
   * 重置 resume token
   */
  resetResumeToken(): void {
    this.resumeToken = null;
  }

  /**
   * 获取当前 resume token
   */
  getResumeToken(): ResumeToken | null {
    return this.resumeToken;
  }
}
