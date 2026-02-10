import type { SyncEngine } from '../sync-engine.js';
import { SyncCoordinator } from './coordinator.js';
import { SyncEventQueue } from './event-queue.js';
import { LocalFileWatcher, getDefaultWatchTargets } from './local-watcher.js';
import type { AutoSyncConfig, AutoSyncStatus, FileChangeEvent } from './types.js';
import { defaultAutoSyncConfig } from './types.js';

/**
 * 自动同步调度器
 * 总控模块，管理本地文件变化 → 远程同步（单向）
 * 远程 → 本地同步由用户手动触发
 */
export class AutoSyncScheduler {
  private config: AutoSyncConfig;
  private localWatcher: LocalFileWatcher | null = null;
  private eventQueue: SyncEventQueue | null = null;
  private coordinator: SyncCoordinator | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private startedAt?: Date;

  constructor(
    private syncEngine: SyncEngine,
    config: Partial<AutoSyncConfig> = {}
  ) {
    this.config = { ...defaultAutoSyncConfig, ...config };
  }

  /**
   * 启动自动同步
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('AutoSyncScheduler is already running');
      return;
    }

    console.log('Starting AutoSyncScheduler...');

    try {
      // 创建协调器
      this.coordinator = new SyncCoordinator(this.syncEngine, this.config);

      // 创建事件队列
      this.eventQueue = new SyncEventQueue(
        this.config.batchSize,
        this.config.batchDelay,
        async (events) => {
          if (this.coordinator) {
            await this.coordinator.processBatch(events);
          }
        }
      );

      // 创建事件处理器（仅处理本地文件变化）
      const eventHandler = (event: FileChangeEvent) => {
        if (this.eventQueue) {
          this.eventQueue.enqueue(event);
        }
      };

      // 创建本地文件监听器
      const watchTargets = getDefaultWatchTargets(this.config.watchPaths);
      this.localWatcher = new LocalFileWatcher(
        watchTargets,
        this.config.localDebounce,
        eventHandler
      );

      // 启动本地监听器
      await this.localWatcher.start();

      // 启动健康检查
      this.startHealthCheck();

      this.isRunning = true;
      this.startedAt = new Date();

      console.log('AutoSyncScheduler started successfully (local → remote only)');
    } catch (error) {
      console.error('Failed to start AutoSyncScheduler:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * 停止自动同步
   */
  async stop(): Promise<void> {
    if (!this.isRunning && !this.localWatcher) {
      return;
    }

    console.log('Stopping AutoSyncScheduler...');

    // 停止健康检查
    this.stopHealthCheck();

    // 停止本地监听器
    if (this.localWatcher) {
      await this.localWatcher.stop();
      this.localWatcher = null;
    }

    // 清空事件队列
    if (this.eventQueue) {
      this.eventQueue.clear();
      this.eventQueue = null;
    }

    this.coordinator = null;
    this.isRunning = false;
    this.startedAt = undefined;

    console.log('AutoSyncScheduler stopped');
  }

  /**
   * 重启自动同步
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * 获取同步状态
   */
  getStatus(): AutoSyncStatus {
    const stats = this.coordinator?.getStats() ?? {
      localEventsProcessed: 0,
      remoteEventsProcessed: 0,
      successCount: 0,
      errorCount: 0,
    };

    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      stats: {
        localEventsProcessed: stats.localEventsProcessed,
        remoteEventsProcessed: stats.remoteEventsProcessed,
        queueSize: this.eventQueue?.getQueueSize() ?? 0,
        lastSyncTime: stats.lastSyncTime,
        successCount: stats.successCount,
        errorCount: stats.errorCount,
      },
      config: this.config,
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<AutoSyncConfig>): Promise<void> {
    const needRestart =
      config.enabledIDEs !== undefined ||
      config.localDebounce !== undefined ||
      config.remoteThrottle !== undefined ||
      config.watchPaths !== undefined;

    this.config = { ...this.config, ...config };

    if (this.coordinator) {
      this.coordinator.updateConfig(this.config);
    }

    // 某些配置变更需要重启
    if (needRestart && this.isRunning) {
      await this.restart();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): AutoSyncConfig {
    return { ...this.config };
  }

  /**
   * 检查是否正在运行
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const status = this.getStatus();

    // 检查本地监听器状态
    if (this.localWatcher && !this.localWatcher.getIsRunning()) {
      console.warn('LocalFileWatcher is not running, attempting to restart...');
      this.localWatcher.start().catch((error) => {
        console.error('Failed to restart LocalFileWatcher:', error);
      });
    }

    // 记录状态日志
    console.log(
      `Health check - Queue: ${status.stats.queueSize}, Success: ${status.stats.successCount}, Errors: ${status.stats.errorCount}`
    );
  }

  /**
   * 手动触发刷新（处理所有待处理事件）
   */
  async flush(): Promise<void> {
    if (this.eventQueue) {
      await this.eventQueue.flush();
    }
  }
}
