import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { SourceType, KnowledgeType, KnowledgeDocument } from '../types.js';
import type { IDEAdapter, IDEEntry, ParseResult, ExportOptions, ConfigFormat } from './types.js';

/**
 * IDE 适配器基类
 * 提供共享的文件操作和工具方法
 */
export abstract class BaseAdapter implements IDEAdapter {
  abstract readonly source: SourceType;
  abstract readonly displayName: string;
  abstract readonly supportedFormats: ConfigFormat[];
  abstract readonly defaultConfigPath: string;

  /**
   * 获取平台相关的配置目录
   */
  protected getPlatformConfigDir(): string {
    const platform = os.platform();
    const home = os.homedir();

    switch (platform) {
      case 'win32':
        return process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      case 'darwin':
        return path.join(home, 'Library', 'Application Support');
      default:
        return process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    }
  }

  /**
   * 展开路径中的环境变量和 ~
   */
  protected expandPath(configPath: string): string {
    let expanded = configPath;

    // 展开 ~
    if (expanded.startsWith('~')) {
      expanded = path.join(os.homedir(), expanded.slice(1));
    }

    // 展开环境变量
    expanded = expanded.replace(/\$(\w+)|\$\{(\w+)\}/g, (_, name1, name2) => {
      return process.env[name1 || name2] || '';
    });

    // Windows 展开 %VAR%
    expanded = expanded.replace(/%(\w+)%/g, (_, name) => {
      return process.env[name] || '';
    });

    return expanded;
  }

  /**
   * 检查文件是否存在
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 读取文件内容
   */
  protected async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * 写入文件内容
   */
  protected async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 列出目录中的文件
   */
  protected async listFiles(dir: string, pattern?: RegExp): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile())
        .map(e => path.join(dir, e.name));

      if (pattern) {
        return files.filter(f => pattern.test(path.basename(f)));
      }
      return files;
    } catch {
      return [];
    }
  }

  /**
   * 检测 IDE 配置是否存在
   */
  async detect(): Promise<boolean> {
    const configPath = this.expandPath(this.defaultConfigPath);
    return this.fileExists(configPath);
  }

  /**
   * 获取配置文件路径
   */
  async getConfigPaths(): Promise<string[]> {
    const defaultPath = this.expandPath(this.defaultConfigPath);
    if (await this.fileExists(defaultPath)) {
      return [defaultPath];
    }
    return [];
  }

  /**
   * 解析配置文件 - 子类需要实现
   */
  abstract parse(configPath?: string): Promise<ParseResult>;

  /**
   * 转换为 IDE 格式 - 子类需要实现
   */
  abstract toIDEFormat(documents: KnowledgeDocument[], options?: ExportOptions): string;

  /**
   * 将 IDE 条目转换为知识文档格式
   */
  toKnowledgeDocument(entry: IDEEntry, type: KnowledgeType): Partial<KnowledgeDocument> {
    return {
      type,
      name: entry.name,
      content: entry.content,
      description: entry.description,
      tags: entry.tags,
      enabled: entry.enabled ?? true,
      sourcePath: entry.filePath,
    };
  }

  /**
   * 写入配置到 IDE
   */
  async write(content: string, configPath?: string): Promise<void> {
    const targetPath = configPath || this.expandPath(this.defaultConfigPath);
    await this.writeFile(targetPath, content);
  }

  /**
   * 备份现有配置
   */
  async backup(configPath?: string): Promise<string> {
    const sourcePath = configPath || this.expandPath(this.defaultConfigPath);

    if (!(await this.fileExists(sourcePath))) {
      throw new Error(`Config file not found: ${sourcePath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${sourcePath}.backup.${timestamp}`;

    const content = await this.readFile(sourcePath);
    await this.writeFile(backupPath, content);

    return backupPath;
  }

  /**
   * 生成 Markdown 格式输出
   */
  protected toMarkdown(documents: KnowledgeDocument[], options?: ExportOptions): string {
    const filtered = this.filterDocuments(documents, options);
    const lines: string[] = [];

    // 按类型分组
    const byType = new Map<KnowledgeType, KnowledgeDocument[]>();
    for (const doc of filtered) {
      const group = byType.get(doc.type) || [];
      group.push(doc);
      byType.set(doc.type, group);
    }

    for (const [type, docs] of byType) {
      lines.push(`# ${type}\n`);
      for (const doc of docs) {
        lines.push(`## ${doc.name}`);
        if (doc.description) {
          lines.push(`> ${doc.description}`);
        }
        lines.push('');
        if (typeof doc.content === 'string') {
          lines.push(doc.content);
        } else {
          lines.push('```json');
          lines.push(JSON.stringify(doc.content, null, 2));
          lines.push('```');
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 生成 JSON 格式输出
   */
  protected toJSON(documents: KnowledgeDocument[], options?: ExportOptions): string {
    const filtered = this.filterDocuments(documents, options);
    const output = filtered.map(doc => ({
      type: doc.type,
      name: doc.name,
      content: doc.content,
      description: doc.description,
      tags: doc.tags,
      enabled: doc.enabled,
    }));
    return JSON.stringify(output, null, 2);
  }

  /**
   * 过滤文档
   */
  protected filterDocuments(
    documents: KnowledgeDocument[],
    options?: ExportOptions
  ): KnowledgeDocument[] {
    let filtered = documents;

    if (!options?.includeDisabled) {
      filtered = filtered.filter(d => d.enabled !== false);
    }

    if (options?.types?.length) {
      filtered = filtered.filter(d => options.types!.includes(d.type));
    }

    if (options?.tags?.length) {
      filtered = filtered.filter(d =>
        d.tags?.some(t => options.tags!.includes(t))
      );
    }

    return filtered;
  }
}
