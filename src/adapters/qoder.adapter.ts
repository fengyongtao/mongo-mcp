import * as path from 'path';
import type { KnowledgeDocument } from '../types.js';
import type { IDEEntry, ParseResult, ExportOptions, ConfigFormat } from './types.js';
import { BaseAdapter } from './base.adapter.js';
import { registerAdapter } from './types.js';

/**
 * Qoder IDE 适配器
 * 
 * Qoder 配置结构:
 * - .qoder/rules/*.md - 规则文件（Markdown 格式）
 * - .qoder/AGENTS.md - Agent 配置
 * - .qoder/settings.json - 项目设置
 */
export class QoderAdapter extends BaseAdapter {
  readonly source = 'qoder' as const;
  readonly displayName = 'Qoder';
  readonly supportedFormats: ConfigFormat[] = ['markdown', 'json'];
  readonly defaultConfigPath = '.qoder/rules';

  /**
   * 获取配置文件路径
   */
  async getConfigPaths(): Promise<string[]> {
    const rulesDir = this.expandPath(this.defaultConfigPath);
    const paths: string[] = [];

    // 获取所有 .md 文件
    const mdFiles = await this.listFiles(rulesDir, /\.md$/);
    paths.push(...mdFiles);

    // 检查 AGENTS.md
    const agentsPath = path.join(path.dirname(rulesDir), 'AGENTS.md');
    if (await this.fileExists(agentsPath)) {
      paths.push(agentsPath);
    }

    return paths;
  }

  /**
   * 解析 Qoder 配置
   */
  async parse(configPath?: string): Promise<ParseResult> {
    const entries: IDEEntry[] = [];
    const errors: Array<{ file: string; message: string }> = [];

    const paths = configPath ? [configPath] : await this.getConfigPaths();

    for (const filePath of paths) {
      try {
        const content = await this.readFile(filePath);
        const parsed = this.parseMarkdownRule(content, filePath);
        entries.push(...parsed);
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
   * 解析 Markdown 格式的规则文件
   */
  private parseMarkdownRule(content: string, filePath: string): IDEEntry[] {
    const entries: IDEEntry[] = [];
    const fileName = path.basename(filePath, '.md');

    // 解析 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

    let metadata: Record<string, unknown> = {};
    let body = content;

    if (frontmatterMatch) {
      try {
        // 简单解析 YAML frontmatter
        const frontmatter = frontmatterMatch[1];
        body = frontmatterMatch[2];

        for (const line of frontmatter.split('\n')) {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match) {
            const [, key, value] = match;
            // 处理布尔值
            if (value === 'true') metadata[key] = true;
            else if (value === 'false') metadata[key] = false;
            else metadata[key] = value;
          }
        }
      } catch {
        // 忽略解析错误，使用原始内容
      }
    }

    // 提取描述（第一个段落或 > 引用）
    const descMatch = body.match(/^>\s*(.+)$/m) || body.match(/^([^#\n].+)$/m);
    const description = descMatch ? descMatch[1].trim() : undefined;

    entries.push({
      name: fileName,
      content: body.trim(),
      description,
      tags: metadata.tags ? String(metadata.tags).split(',').map(t => t.trim()) : undefined,
      enabled: metadata.alwaysApply !== false,
      filePath,
      metadata: {
        trigger: metadata.trigger,
        alwaysApply: metadata.alwaysApply,
      },
    });

    return entries;
  }

  /**
   * 转换为 Qoder 格式（Markdown）
   */
  toIDEFormat(documents: KnowledgeDocument[], options?: ExportOptions): string {
    const format = options?.format || 'markdown';

    if (format === 'json') {
      return this.toJSON(documents, options);
    }

    // 默认使用 Markdown 格式
    const filtered = this.filterDocuments(documents, options);
    const output: string[] = [];

    for (const doc of filtered) {
      const lines: string[] = [];

      // Frontmatter
      lines.push('---');
      lines.push('trigger: always_on');
      lines.push('alwaysApply: true');
      if (doc.tags?.length) {
        lines.push(`tags: ${doc.tags.join(', ')}`);
      }
      lines.push('---');
      lines.push('');

      // Description
      if (doc.description) {
        lines.push(`> ${doc.description}`);
        lines.push('');
      }

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

    return output.join('\n\n---\n\n');
  }

  /**
   * 检测 Qoder 配置
   */
  async detect(): Promise<boolean> {
    const qoderDir = '.qoder';
    return this.fileExists(qoderDir);
  }
}

// 注册适配器
registerAdapter(new QoderAdapter());

export const qoderAdapter = new QoderAdapter();
