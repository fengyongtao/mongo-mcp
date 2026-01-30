import type { SourceType } from '../../types.js';
import type { SyncEngine, SyncResult } from '../sync-engine.js';
import type { AutoSyncConfig, FileChangeEvent, RemoteChangeEvent, SyncEvent } from './types.js';

/**
 * 同步统计信息
 */
export interface SyncStats {
  localEventsProcessed: number;
  remoteEventsProcessed: number;
  successCount: number;
  errorCount: number;
  lastSyncTime?: Date;
}

/**
 * 同步协调器
 * 负责决策同步方向、调用 SyncEngine 执行同步
 */
export class SyncCoordinator {
  private stats: SyncStats = {
    localEventsProcessed: 0,
    remoteEventsProcessed: 0,
    successCount: 0,
    errorCount: 0,
  };

  // 正在同步的标记，用于防止循环同步
  private syncingPaths: Set<string> = new Set();
  private syncingDocuments: Set<string> = new Set();

  constructor(
    private syncEngine: SyncEngine,
    private config: AutoSyncConfig
  ) {}

  /**
   * 处理批量事件
   */
  async processBatch(events: SyncEvent[]): Promise<void> {
    // 按来源分组
    const localEvents = events.filter((e) => e.source === 'local');
    const remoteEvents = events.filter((e) => e.source === 'remote');

    // 根据同步模式决定处理顺序
    if (this.config.mode === 'pull_only') {
      // 仅从本地同步到远程
      for (const event of localEvents) {
        await this.handleLocalEvent(event.data as FileChangeEvent);
      }
    } else if (this.config.mode === 'push_only') {
      // 仅从远程同步到本地
      for (const event of remoteEvents) {
        await this.handleRemoteEvent(event.data as RemoteChangeEvent);
      }
    } else {
      // 双向同步：先处理远程事件（优先级高），再处理本地事件
      for (const event of remoteEvents) {
        await this.handleRemoteEvent(event.data as RemoteChangeEvent);
      }
      for (const event of localEvents) {
        await this.handleLocalEvent(event.data as FileChangeEvent);
      }
    }
  }

  /**
   * 处理本地文件变更事件
   * 本地变更 -> 推送到 MongoDB
   */
  private async handleLocalEvent(event: FileChangeEvent): Promise<void> {
    // 检查是否是由远程同步触发的本地变更（防止循环）
    if (this.syncingPaths.has(event.filePath)) {
      return;
    }

    // 检查 IDE 是否启用
    if (!this.config.enabledIDEs.includes(event.ideSource)) {
      return;
    }

    this.stats.localEventsProcessed++;

    try {
      // 标记正在同步的路径
      this.syncingPaths.add(event.filePath);

      const result = await this.syncEngine.syncFromIDE(
        event.ideSource,
        event.filePath
      );

      this.handleSyncResult(result, 'local', event.filePath);
    } catch (error) {
      this.stats.errorCount++;
      console.error(`Local sync error for ${event.filePath}:`, error);
    } finally {
      // 延迟移除标记，避免快速连续的事件
      setTimeout(() => {
        this.syncingPaths.delete(event.filePath);
      }, 1000);
    }
  }

  /**
   * 处理远程变更事件
   * 远程变更 -> 拉取到本地 IDE
   */
  private async handleRemoteEvent(event: RemoteChangeEvent): Promise<void> {
    // 检查是否是由本地同步触发的远程变更（防止循环）
    const docKey = `${event.documentType}:${event.documentName}`;
    if (this.syncingDocuments.has(docKey)) {
      return;
    }

    this.stats.remoteEventsProcessed++;

    try {
      // 标记正在同步的文档
      this.syncingDocuments.add(docKey);

      // 确定目标 IDE 列表
      const targetIDEs = this.determineTargetIDEs(event);

      for (const ideSource of targetIDEs) {
        const result = await this.syncEngine.syncToIDE(
          ideSource,
          undefined, // 使用默认配置路径
          [event.documentType]
        );

        this.handleSyncResult(result, 'remote', docKey);
      }
    } catch (error) {
      this.stats.errorCount++;
      console.error(`Remote sync error for ${docKey}:`, error);
    } finally {
      // 延迟移除标记
      setTimeout(() => {
        this.syncingDocuments.delete(docKey);
      }, 1000);
    }
  }

  /**
   * 处理同步结果
   */
  private handleSyncResult(
    result: SyncResult,
    source: 'local' | 'remote',
    identifier: string
  ): void {
    if (result.success) {
      this.stats.successCount++;
      this.stats.lastSyncTime = new Date();
      console.log(
        `Sync ${source} success: ${identifier} - created: ${result.created}, updated: ${result.updated}, deleted: ${result.deleted}`
      );
    } else {
      this.stats.errorCount++;
      console.error(`Sync ${source} failed: ${identifier} - errors:`, result.errors);
    }
  }

  /**
   * 确定远程变更需要同步到哪些 IDE
   */
  private determineTargetIDEs(event: RemoteChangeEvent): SourceType[] {
    // 返回所有已启用的 IDE
    // 未来可以根据文档的 ideSource 字段智能决策
    return this.config.enabledIDEs.filter((ide) => ide !== 'manual' && ide !== 'other');
  }

  /**
   * 获取同步统计信息
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      localEventsProcessed: 0,
      remoteEventsProcessed: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AutoSyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查路径是否正在同步
   */
  isSyncingPath(path: string): boolean {
    return this.syncingPaths.has(path);
  }

  /**
   * 检查文档是否正在同步
   */
  isSyncingDocument(type: string, name: string): boolean {
    return this.syncingDocuments.has(`${type}:${name}`);
  }
}
