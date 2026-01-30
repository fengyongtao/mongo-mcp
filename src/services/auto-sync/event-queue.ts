import type { KnowledgeType } from '../../types.js';
import type { BatchEventHandler, FileChangeEvent, RemoteChangeEvent, SyncEvent } from './types.js';

/**
 * 同步事件队列
 * 负责事件聚合、去重、批量处理
 */
export class SyncEventQueue {
  private queue: SyncEvent[] = [];
  private processing = false;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private maxQueueSize = 1000;

  constructor(
    private batchSize: number,
    private batchDelay: number,
    private onBatch: BatchEventHandler
  ) {}

  /**
   * 将事件加入队列
   */
  enqueue(event: FileChangeEvent | RemoteChangeEvent): void {
    const syncEvent: SyncEvent = {
      id: this.generateEventId(event),
      source: event.source,
      priority: this.calculatePriority(event),
      data: event,
      createdAt: new Date(),
    };

    // 队列大小限制
    if (this.queue.length >= this.maxQueueSize) {
      // 移除最老的低优先级事件
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      this.queue.pop();
    }

    // 去重 - 相同 ID 的事件只保留最新的
    const existingIndex = this.queue.findIndex((e) => e.id === syncEvent.id);
    if (existingIndex >= 0) {
      this.queue[existingIndex] = syncEvent;
    } else {
      this.queue.push(syncEvent);
    }

    // 按优先级排序（高优先级在前）
    this.queue.sort((a, b) => b.priority - a.priority);

    // 触发批量处理
    this.scheduleBatchProcess();
  }

  /**
   * 获取当前队列大小
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * 检查是否正在处理
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * 清空队列
   */
  clear(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.queue = [];
  }

  /**
   * 生成事件唯一标识
   */
  private generateEventId(event: FileChangeEvent | RemoteChangeEvent): string {
    if (event.source === 'local') {
      const localEvent = event as FileChangeEvent;
      return `local:${localEvent.ideSource}:${localEvent.filePath}`;
    } else {
      const remoteEvent = event as RemoteChangeEvent;
      return `remote:${remoteEvent.documentType}:${remoteEvent.documentName}`;
    }
  }

  /**
   * 计算事件优先级
   * 优先级规则：
   * - 删除操作优先级最高 (10)
   * - 远程变更优先于本地 (8 vs 5)
   * - Rules 类型优先级高于其他 (+2)
   */
  private calculatePriority(event: FileChangeEvent | RemoteChangeEvent): number {
    let priority = 5;

    if (event.source === 'remote') {
      const remoteEvent = event as RemoteChangeEvent;
      priority = 8;
      if (remoteEvent.operationType === 'delete') {
        priority = 10;
      }
    } else {
      const localEvent = event as FileChangeEvent;
      if (localEvent.type === 'delete') {
        priority = 10;
      }
    }

    // 规则类型加分
    const docType = this.inferTypeFromEvent(event);
    if (docType === 'Rules') {
      priority += 2;
    }

    return priority;
  }

  /**
   * 从事件推断文档类型
   */
  private inferTypeFromEvent(event: FileChangeEvent | RemoteChangeEvent): KnowledgeType {
    if (event.source === 'remote') {
      return (event as RemoteChangeEvent).documentType;
    }

    const localEvent = event as FileChangeEvent;
    const lowerPath = localEvent.filePath.toLowerCase();

    if (lowerPath.includes('rule')) return 'Rules';
    if (lowerPath.includes('memory') || lowerPath.includes('memo')) return 'Memories';
    if (lowerPath.includes('skill')) return 'Skills';
    if (lowerPath.includes('mcp')) return 'MCPs';
    if (lowerPath.includes('experience')) return 'Experiences';
    if (lowerPath.includes('command') || lowerPath.includes('cmd')) return 'Commands';
    if (lowerPath.includes('context')) return 'Contexts';
    if (lowerPath.includes('workflow') || lowerPath.includes('flow')) return 'Workflows';

    return 'Rules'; // 默认类型
  }

  /**
   * 调度批量处理
   */
  private scheduleBatchProcess(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // 达到批量大小立即处理，否则等待延迟
    if (this.queue.length >= this.batchSize) {
      this.processBatch();
    } else {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchDelay);
    }
  }

  /**
   * 处理批量事件
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.onBatch(batch);
    } catch (error) {
      console.error('Batch processing error:', error);
      // 失败的事件重新入队（降低优先级）
      for (const event of batch) {
        event.priority = Math.max(0, event.priority - 1);
        // 检查队列是否已满
        if (this.queue.length < this.maxQueueSize) {
          this.queue.push(event);
        }
      }
    } finally {
      this.processing = false;

      // 如果还有事件，继续处理
      if (this.queue.length > 0) {
        this.scheduleBatchProcess();
      }
    }
  }

  /**
   * 立即处理所有待处理事件
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    while (this.queue.length > 0 && !this.processing) {
      await this.processBatch();
    }
  }

  /**
   * 获取队列中的事件（用于调试）
   */
  getQueuedEvents(): SyncEvent[] {
    return [...this.queue];
  }
}
