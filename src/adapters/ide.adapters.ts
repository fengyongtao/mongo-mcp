import * as path from 'path';
import type { KnowledgeDocument } from '../types.js';
import type { IDEEntry, ParseResult, ExportOptions, ConfigFormat } from './types.js';
import { BaseAdapter } from './base.adapter.js';
import { registerAdapter } from './types.js';

/**
 * VSCode 适配器
 * 
 * VSCode 配置结构:
 * - .vscode/settings.json - 项目设置
 * - .vscode/extensions.json - 扩展推荐
 * - .vscode/ai-rules.json - AI 规则（自定义）
 */
export class VSCodeAdapter extends BaseAdapter {
  readonly source = 'vscode' as const;
  readonly displayName = 'Visual Studio Code';
  readonly supportedFormats: ConfigFormat[] = ['json'];
  readonly defaultConfigPath = '.vscode/ai-rules.json';

  async getConfigPaths(): Promise<string[]> {
    const paths: string[] = [];
    const defaultPath = this.expandPath(this.defaultConfigPath);
    
    if (await this.fileExists(defaultPath)) {
      paths.push(defaultPath);
    }

    // 检查全局配置
    const globalPath = path.join(this.getPlatformConfigDir(), 'Code', 'User', 'ai-rules.json');
    if (await this.fileExists(globalPath)) {
      paths.push(globalPath);
    }

    return paths;
  }

  async parse(configPath?: string): Promise<ParseResult> {
    const entries: IDEEntry[] = [];
    const errors: Array<{ file: string; message: string }> = [];

    const paths = configPath ? [configPath] : await this.getConfigPaths();

    for (const filePath of paths) {
      try {
        const content = await this.readFile(filePath);
        const config = JSON.parse(content);

        if (Array.isArray(config.rules)) {
          for (const rule of config.rules) {
            entries.push({
              name: rule.name || `rule-${entries.length}`,
              content: rule.content || rule.rule || '',
              description: rule.description,
              tags: rule.tags,
              enabled: rule.enabled !== false,
              filePath,
              metadata: rule,
            });
          }
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

  toIDEFormat(documents: KnowledgeDocument[], options?: ExportOptions): string {
    const filtered = this.filterDocuments(documents, options);

    const config = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      rules: filtered.map(doc => ({
        name: doc.name,
        description: doc.description,
        content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content),
        tags: doc.tags,
        enabled: doc.enabled !== false,
        type: doc.type,
      })),
    };

    return JSON.stringify(config, null, 2);
  }

  async detect(): Promise<boolean> {
    if (await this.fileExists('.vscode')) return true;
    const globalPath = path.join(this.getPlatformConfigDir(), 'Code');
    return this.fileExists(globalPath);
  }
}

/**
 * Windsurf 适配器
 * 
 * Windsurf 配置结构:
 * - .windsurf/rules/*.md - Markdown 规则
 * - .windsurfrules - 旧格式
 */
export class WindsurfAdapter extends BaseAdapter {
  readonly source = 'windsurf' as const;
  readonly displayName = 'Windsurf';
  readonly supportedFormats: ConfigFormat[] = ['markdown', 'plaintext'];
  readonly defaultConfigPath = '.windsurf/rules';

  async getConfigPaths(): Promise<string[]> {
    const paths: string[] = [];

    const rulesDir = this.expandPath(this.defaultConfigPath);
    const mdFiles = await this.listFiles(rulesDir, /\.md$/);
    paths.push(...mdFiles);

    const legacyPath = '.windsurfrules';
    if (await this.fileExists(legacyPath)) {
      paths.push(legacyPath);
    }

    return paths;
  }

  async parse(configPath?: string): Promise<ParseResult> {
    const entries: IDEEntry[] = [];
    const errors: Array<{ file: string; message: string }> = [];

    const paths = configPath ? [configPath] : await this.getConfigPaths();

    for (const filePath of paths) {
      try {
        const content = await this.readFile(filePath);
        const fileName = path.basename(filePath, path.extname(filePath));

        if (filePath.endsWith('.windsurfrules')) {
          entries.push({
            name: 'windsurf-rules',
            content: content.trim(),
            description: 'Windsurf project rules',
            filePath,
          });
        } else {
          // Markdown 格式，类似 Qoder
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
          let body = content;
          let metadata: Record<string, unknown> = {};

          if (frontmatterMatch) {
            body = frontmatterMatch[2];
            for (const line of frontmatterMatch[1].split('\n')) {
              const match = line.match(/^(\w+):\s*(.+)$/);
              if (match) {
                metadata[match[1]] = match[2];
              }
            }
          }

          entries.push({
            name: fileName,
            content: body.trim(),
            description: metadata.description as string,
            tags: metadata.tags ? String(metadata.tags).split(',').map(t => t.trim()) : undefined,
            enabled: true,
            filePath,
            metadata,
          });
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

  toIDEFormat(documents: KnowledgeDocument[], options?: ExportOptions): string {
    return this.toMarkdown(documents, options);
  }

  async detect(): Promise<boolean> {
    if (await this.fileExists('.windsurf')) return true;
    return this.fileExists('.windsurfrules');
  }
}

/**
 * Trae 适配器
 * 
 * Trae 配置结构:
 * - .trae/rules/*.md - 规则文件
 * - .trae/config.json - 配置文件
 */
export class TraeAdapter extends BaseAdapter {
  readonly source = 'trae' as const;
  readonly displayName = 'Trae';
  readonly supportedFormats: ConfigFormat[] = ['markdown', 'json'];
  readonly defaultConfigPath = '.trae/rules';

  async getConfigPaths(): Promise<string[]> {
    const paths: string[] = [];

    const rulesDir = this.expandPath(this.defaultConfigPath);
    const mdFiles = await this.listFiles(rulesDir, /\.md$/);
    paths.push(...mdFiles);

    const configPath = '.trae/config.json';
    if (await this.fileExists(configPath)) {
      paths.push(configPath);
    }

    return paths;
  }

  async parse(configPath?: string): Promise<ParseResult> {
    const entries: IDEEntry[] = [];
    const errors: Array<{ file: string; message: string }> = [];

    const paths = configPath ? [configPath] : await this.getConfigPaths();

    for (const filePath of paths) {
      try {
        const content = await this.readFile(filePath);

        if (filePath.endsWith('.json')) {
          // JSON 配置
          const config = JSON.parse(content);
          if (config.rules) {
            for (const rule of config.rules) {
              entries.push({
                name: rule.name,
                content: rule.content || rule.prompt || '',
                description: rule.description,
                tags: rule.tags,
                enabled: rule.enabled !== false,
                filePath,
                metadata: rule,
              });
            }
          }
        } else {
          // Markdown 格式
          const fileName = path.basename(filePath, '.md');
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
          let body = content;
          let metadata: Record<string, unknown> = {};

          if (frontmatterMatch) {
            body = frontmatterMatch[2];
            for (const line of frontmatterMatch[1].split('\n')) {
              const match = line.match(/^(\w+):\s*(.+)$/);
              if (match) {
                metadata[match[1]] = match[2];
              }
            }
          }

          entries.push({
            name: fileName,
            content: body.trim(),
            description: metadata.description as string,
            tags: metadata.tags ? String(metadata.tags).split(',').map(t => t.trim()) : undefined,
            enabled: true,
            filePath,
            metadata,
          });
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

  toIDEFormat(documents: KnowledgeDocument[], options?: ExportOptions): string {
    const format = options?.format || 'markdown';
    if (format === 'json') {
      return this.toJSON(documents, options);
    }
    return this.toMarkdown(documents, options);
  }

  async detect(): Promise<boolean> {
    return this.fileExists('.trae');
  }
}

// 注册适配器
registerAdapter(new VSCodeAdapter());
registerAdapter(new WindsurfAdapter());
registerAdapter(new TraeAdapter());

export const vscodeAdapter = new VSCodeAdapter();
export const windsurfAdapter = new WindsurfAdapter();
export const traeAdapter = new TraeAdapter();
