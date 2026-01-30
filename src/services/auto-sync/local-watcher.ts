import chokidar, { type FSWatcher } from 'chokidar';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import lodash from 'lodash';
import type { SourceType } from '../../types.js';

const { debounce } = lodash;
import type { LocalEventHandler, FileChangeEvent, FileChangeType, WatchTarget } from './types.js';

/**
 * 本地文件监听器
 * 使用 Chokidar 监控 IDE 配置文件变化
 */
export class LocalFileWatcher {
  private watchers: Map<SourceType, FSWatcher> = new Map();
  private fileHashCache: Map<string, string> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private debouncedHandlers: Map<string, ReturnType<typeof debounce>> = new Map();
  private isRunning = false;

  constructor(
    private targets: WatchTarget[],
    private debounceMs: number,
    private onEvent: LocalEventHandler
  ) {}

  /**
   * 启动文件监听
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    for (const target of this.targets) {
      const watcher = chokidar.watch(target.paths, {
        ignored: [
          /(^|[/\\])\../, // 忽略隐藏文件
          '**/node_modules/**',
          '**/.git/**',
        ],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
        depth: 10,
      });

      watcher
        .on('add', (path) => this.handleChange('add', path, target.ideSource))
        .on('change', (path) => this.handleChange('change', path, target.ideSource))
        .on('unlink', (path) => this.handleChange('delete', path, target.ideSource))
        .on('error', (error) => {
          console.error(`Watcher error for ${target.ideSource}:`, error);
        });

      this.watchers.set(target.ideSource, watcher);
    }

    this.isRunning = true;
  }

  /**
   * 停止文件监听
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // 关闭所有监听器
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();

    // 清除所有定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // 取消所有防抖处理器
    for (const handler of this.debouncedHandlers.values()) {
      handler.cancel();
    }
    this.debouncedHandlers.clear();

    // 清空哈希缓存
    this.fileHashCache.clear();

    this.isRunning = false;
  }

  /**
   * 检查是否正在运行
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 处理文件变更
   */
  private handleChange(
    type: FileChangeType,
    filePath: string,
    ideSource: SourceType
  ): void {
    const key = `${ideSource}:${filePath}`;

    // 获取或创建防抖处理器
    if (!this.debouncedHandlers.has(key)) {
      const debouncedFn = debounce(
        (t: FileChangeType, p: string, ide: SourceType) => {
          this.processChange(t, p, ide);
        },
        this.debounceMs
      );
      this.debouncedHandlers.set(key, debouncedFn);
    }

    const debouncedHandler = this.debouncedHandlers.get(key)!;
    debouncedHandler(type, filePath, ideSource);
  }

  /**
   * 实际处理文件变更（防抖后执行）
   */
  private async processChange(
    type: FileChangeType,
    filePath: string,
    ideSource: SourceType
  ): Promise<void> {
    try {
      // 差异检测 - 计算文件 Hash
      if (type !== 'delete') {
        const newHash = await this.calculateFileHash(filePath);
        const oldHash = this.fileHashCache.get(filePath);

        if (newHash === oldHash) {
          // 内容未变化，忽略
          return;
        }
        this.fileHashCache.set(filePath, newHash);
      } else {
        this.fileHashCache.delete(filePath);
      }

      // 发送事件
      const event: FileChangeEvent = {
        source: 'local',
        ideSource,
        type,
        filePath,
        timestamp: new Date(),
      };

      this.onEvent(event);
    } catch (error) {
      console.error(`Error processing change for ${filePath}:`, error);
    }
  }

  /**
   * 计算文件内容 Hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return createHash('sha256').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  /**
   * 更新监听目标
   */
  async updateTargets(targets: WatchTarget[]): Promise<void> {
    await this.stop();
    this.targets = targets;
    await this.start();
  }

  /**
   * 清除指定文件的哈希缓存
   */
  clearHashCache(filePath?: string): void {
    if (filePath) {
      this.fileHashCache.delete(filePath);
    } else {
      this.fileHashCache.clear();
    }
  }
}

/**
 * 获取默认监听目标配置
 */
export function getDefaultWatchTargets(basePaths: string[] = []): WatchTarget[] {
  const targets: WatchTarget[] = [];

  // 如果没有指定基础路径，使用当前工作目录
  const paths = basePaths.length > 0 ? basePaths : [process.cwd()];

  for (const basePath of paths) {
    // Qoder
    targets.push({
      ideSource: 'qoder',
      paths: [
        `${basePath}/.qoder/rules/**/*.md`,
        `${basePath}/.qoder/memories/**/*.json`,
        `${basePath}/.qoder/skills/**/*.md`,
        `${basePath}/AGENTS.md`,
      ],
      patterns: ['*.md', '*.json'],
    });

    // Cursor
    targets.push({
      ideSource: 'cursor',
      paths: [
        `${basePath}/.cursorrules`,
        `${basePath}/.cursor/**/*.md`,
      ],
      patterns: ['.cursorrules', '*.md'],
    });

    // VSCode
    targets.push({
      ideSource: 'vscode',
      paths: [
        `${basePath}/.vscode/**/*.json`,
      ],
      patterns: ['*.json'],
    });

    // Windsurf
    targets.push({
      ideSource: 'windsurf',
      paths: [
        `${basePath}/.windsurfrules`,
      ],
      patterns: ['.windsurfrules'],
    });

    // Trae
    targets.push({
      ideSource: 'trae',
      paths: [
        `${basePath}/.trae/**/*.md`,
      ],
      patterns: ['*.md'],
    });
  }

  return targets;
}
