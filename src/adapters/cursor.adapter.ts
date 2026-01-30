import * as path from 'path';
import type { KnowledgeDocument } from '../types.js';
import type { IDEEntry, ParseResult, ExportOptions, ConfigFormat } from './types.js';
import { BaseAdapter } from './base.adapter.js';
import { registerAdapter } from './types.js';

/**
 * Cursor IDE 适配器
 * 
 * Cursor 配置结构:
 * - .cursor/rules/*.mdc - 规则文件（MDC 格式）
 * - .cursorrules - 项目规则（旧格式）
 * - ~/.cursor/rules/ - 全局规则
 */
export class CursorAdapter extends BaseAdapter {
  readonly source = 'cursor' as const;
  readonly displayName = 'Cursor';
  readonly supportedFormats: ConfigFormat[] = ['markdown', 'plaintext'];
  readonly defaultConfigPath = '.cursor/rules';

  /**
   * 获取配置文件路径
   */
  async getConfigPaths(): Promise<string[]> {
    const paths: string[] = [];

    // 项目级规则目录
    const projectRulesDir = this.expandPath(this.defaultConfigPath);
    const mdcFiles = await this.listFiles(projectRulesDir, /\.mdc?$/);
    paths.push(...mdcFiles);

    // 旧格式 .cursorrules
    const legacyPath = '.cursorrules';
    if (await this.fileExists(legacyPath)) {
      paths.push(legacyPath);
    }

    // 全局规则目录
    const globalRulesDir = path.join(this.getPlatformConfigDir(), 'Cursor', 'rules');
    const globalFiles = await this.listFiles(globalRulesDir, /\.mdc?$/);
    paths.push(...globalFiles);

    return paths;
  }

  /**
   * 解析 Cursor 配置
   */
  async parse(configPath?: string): Promise<ParseResult> {
    const entries: IDEEntry[] = [];
    const errors: Array<{ file: string; message: string }> = [];

    const paths = configPath ? [configPath] : await this.getConfigPaths();

    for (const filePath of paths) {
      try {
        const content = await this.readFile(filePath);

        if (filePath.endsWith('.cursorrules')) {
          // 旧格式：单一规则文件
          entries.push({
            name: 'project-rules',
            content: content.trim(),
            description: 'Project-level Cursor rules',
            filePath,
            metadata: { format: 'legacy' },
          });
        } else {
          // MDC 格式
          const parsed = this.parseMDC(content, filePath);
          entries.push(...parsed);
        }
      } catch (err) {
        errors.push({
          file: filePath,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { entries, errors };
  }

  /**
   * 解析 MDC 格式文件
   * MDC 格式类似 Markdown，但有特殊的元数据语法
   */
  private parseMDC(content: string, filePath: string): IDEEntry[] {
    const fileName = path.basename(filePath, path.extname(filePath));

    // 解析 frontmatter（类似 YAML）
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

    let metadata: Record<string, unknown> = {};
    let body = content;

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      body = frontmatterMatch[2];

      for (const line of frontmatter.split('\n')) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          if (value === 'true') metadata[key] = true;
          else if (value === 'false') metadata[key] = false;
          else if (value.startsWith('[') && value.endsWith(']')) {
            // 数组格式
            metadata[key] = value.slice(1, -1).split(',').map(s => s.trim());
          } else {
            metadata[key] = value;
          }
        }
      }
    }

    // 提取描述
    const descMatch = body.match(/^>\s*(.+)$/m);
    const description = descMatch ? descMatch[1].trim() : metadata.description as string;

    return [{
      name: fileName,
      content: body.trim(),
      description,
      tags: Array.isArray(metadata.tags) ? metadata.tags as string[] : undefined,
      enabled: metadata.enabled !== false,
      filePath,
      metadata,
    }];
  }

  /**
   * 转换为 Cursor 格式
   */
  toIDEFormat(documents: KnowledgeDocument[], options?: ExportOptions): string {
    const filtered = this.filterDocuments(documents, options);

    // Cursor 支持单文件多规则或目录结构
    // 这里生成单文件格式
    const output: string[] = [];

    for (const doc of filtered) {
      const lines: string[] = [];

      // MDC frontmatter
      lines.push('---');
      lines.push(`name: ${doc.name}`);
      if (doc.description) {
        lines.push(`description: ${doc.description}`);
      }
      if (doc.tags?.length) {
        lines.push(`tags: [${doc.tags.join(', ')}]`);
      }
      lines.push(`enabled: ${doc.enabled !== false}`);
      lines.push('---');
      lines.push('');

      // Content
      if (typeof doc.content === 'string') {
        lines.push(doc.content);
      } else {
        lines.push('```json');
        lines.push(JSON.stringify(doc.content, null, 2));
        lines.push('```');
      }

      output.push(lines.join('\n'));
    }

    return output.join('\n\n');
  }

  /**
   * 检测 Cursor 配置
   */
  async detect(): Promise<boolean> {
    // 检查项目级配置
    if (await this.fileExists('.cursor')) return true;
    if (await this.fileExists('.cursorrules')) return true;

    // 检查全局配置
    const globalDir = path.join(this.getPlatformConfigDir(), 'Cursor');
    return this.fileExists(globalDir);
  }
}

// 注册适配器
registerAdapter(new CursorAdapter());

export const cursorAdapter = new CursorAdapter();
