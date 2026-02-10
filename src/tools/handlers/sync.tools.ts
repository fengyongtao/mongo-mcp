import type { SourceType, KnowledgeType } from '../../types.js';
import type { KnowledgeService } from '../../services/knowledge-service.js';
import type { SyncHistoryService } from '../../services/sync-history-service.js';
import type { ConflictResolver } from '../../services/conflict-resolver.js';
import { SyncEngine } from '../../services/sync-engine.js';
import { getAllAdapters } from '../../adapters/types.js';
import type { McpTool } from '../types.js';

/**
 * 创建同步相关的 MCP 工具
 */
export function createSyncTools(
  knowledgeService: KnowledgeService,
  historyService: SyncHistoryService,
  conflictResolver: ConflictResolver
): McpTool[] {
  const syncEngine = new SyncEngine(knowledgeService, historyService);

  return [
    // 从 IDE 同步到知识库
    {
      name: 'sync_from_ide',
      description: '从指定 IDE 同步配置到知识库（Pull）。支持 qoder、cursor、vscode、windsurf、trae',
      inputSchema: {
        type: 'object',
        properties: {
          ideSource: {
            type: 'string',
            enum: ['qoder', 'cursor', 'vscode', 'windsurf', 'trae'],
            description: 'IDE 来源',
          },
          configPath: {
            type: 'string',
            description: '配置文件路径（可选，默认使用 IDE 默认路径）',
          },
        },
        required: ['ideSource'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { ideSource, configPath } = args as { ideSource: SourceType; configPath?: string };
        const result = await syncEngine.syncFromIDE(ideSource, configPath);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              summary: `从 ${ideSource} 同步完成`,
              created: result.created,
              updated: result.updated,
              conflicts: result.conflicts,
              errors: result.errors,
              duration: `${result.duration}ms`,
            }, null, 2),
          }],
        };
      },
    },

    // 从知识库同步到 IDE
    {
      name: 'sync_to_ide',
      description: '从知识库同步配置到指定 IDE（Push）',
      inputSchema: {
        type: 'object',
        properties: {
          ideSource: {
            type: 'string',
            enum: ['qoder', 'cursor', 'vscode', 'windsurf', 'trae'],
            description: 'IDE 来源',
          },
          configPath: {
            type: 'string',
            description: '配置文件路径（可选）',
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['Rules', 'Memories', 'Skills', 'MCPs', 'Experiences', 'Commands', 'Contexts', 'Workflows'],
            },
            description: '要同步的文档类型（可选，默认同步 Rules、Memories、Skills、MCPs）',
          },
        },
        required: ['ideSource'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { ideSource, configPath, types } = args as { ideSource: SourceType; configPath?: string; types?: KnowledgeType[] };
        const result = await syncEngine.syncToIDE(ideSource, configPath, types);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              summary: `同步到 ${ideSource} 完成`,
              updated: result.updated,
              errors: result.errors,
              duration: `${result.duration}ms`,
            }, null, 2),
          }],
        };
      },
    },

    // 双向同步
    {
      name: 'sync_bidirectional',
      description: '与指定 IDE 进行双向同步（先 Pull 后 Push）',
      inputSchema: {
        type: 'object',
        properties: {
          ideSource: {
            type: 'string',
            enum: ['qoder', 'cursor', 'vscode', 'windsurf', 'trae'],
            description: 'IDE 来源',
          },
          configPath: {
            type: 'string',
            description: '配置文件路径（可选）',
          },
        },
        required: ['ideSource'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { ideSource, configPath } = args as { ideSource: SourceType; configPath?: string };
        const result = await syncEngine.syncBidirectional(ideSource, configPath);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              summary: `与 ${ideSource} 双向同步完成`,
              created: result.created,
              updated: result.updated,
              conflicts: result.conflicts,
              errors: result.errors,
              duration: `${result.duration}ms`,
            }, null, 2),
          }],
        };
      },
    },

    // 获取同步状态
    {
      name: 'sync_status',
      description: '获取当前同步状态摘要',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const status = await syncEngine.getSyncStatus('current');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              summary: {
                pending: status.pendingCount,
                conflicts: status.conflictCount,
                synced: status.syncedCount,
                localOnly: status.localOnlyCount,
              },
              lastSync: status.lastSyncAt?.toISOString() || 'Never',
              byType: status.byType,
            }, null, 2),
          }],
        };
      },
    },

    // 检测可用的 IDE
    {
      name: 'detect_ides',
      description: '检测当前系统中可用的 IDE 配置',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const adapters = getAllAdapters();
        const results: Array<{
          ide: string;
          source: SourceType;
          detected: boolean;
          configPaths: string[];
        }> = [];

        for (const adapter of adapters) {
          const detected = await adapter.detect();
          const configPaths = detected ? await adapter.getConfigPaths() : [];

          results.push({
            ide: adapter.displayName,
            source: adapter.source,
            detected,
            configPaths,
          });
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              detectedIDEs: results.filter(r => r.detected).map(r => r.ide),
              details: results,
            }, null, 2),
          }],
        };
      },
    },

    // 获取未解决的冲突
    {
      name: 'list_conflicts',
      description: '列出所有未解决的同步冲突',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['Rules', 'Memories', 'Skills', 'MCPs', 'Experiences', 'Commands', 'Contexts', 'Workflows'],
            description: '按类型过滤（可选）',
          },
        },
      },
      handler: async (args: Record<string, unknown>) => {
        const { type } = args as { type?: KnowledgeType };
        const conflicts = await conflictResolver.getUnresolvedConflicts('current', type);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: conflicts.length,
              conflicts: conflicts.map(c => ({
                id: c._id?.toString(),
                document: c.documentName,
                type: c.documentType,
                local: {
                  device: c.localSnapshot.deviceId,
                  ide: c.localSnapshot.ideSource,
                  modified: c.localSnapshot.modifiedAt,
                },
                remote: {
                  device: c.remoteSnapshot.deviceId,
                  ide: c.remoteSnapshot.ideSource,
                  modified: c.remoteSnapshot.modifiedAt,
                },
                detectedAt: c.detectedAt,
              })),
            }, null, 2),
          }],
        };
      },
    },

    // 解决冲突
    {
      name: 'resolve_conflict',
      description: '解决同步冲突',
      inputSchema: {
        type: 'object',
        properties: {
          conflictId: {
            type: 'string',
            description: '冲突 ID',
          },
          resolution: {
            type: 'string',
            enum: ['keep_local', 'keep_remote', 'merge'],
            description: '解决策略：keep_local（保留本地）、keep_remote（保留远程）、merge（合并）',
          },
          mergedContent: {
            type: 'string',
            description: '合并后的内容（当 resolution 为 merge 时需要提供）',
          },
        },
        required: ['conflictId', 'resolution'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { conflictId, resolution, mergedContent } = args as {
          conflictId: string;
          resolution: 'keep_local' | 'keep_remote' | 'merge';
          mergedContent?: string;
        };
        const { ObjectId } = await import('mongodb');
        const result = await conflictResolver.resolveConflict(
          new ObjectId(conflictId),
          resolution,
          'current',
          mergedContent
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              strategy: result.strategy,
              message: result.message || '冲突已解决',
            }, null, 2),
          }],
        };
      },
    },

    // 同步历史
    {
      name: 'sync_history',
      description: '查看同步历史记录',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '返回数量限制（默认 20）',
          },
          status: {
            type: 'string',
            enum: ['success', 'failed', 'partial'],
            description: '按状态过滤',
          },
        },
      },
      handler: async (args: Record<string, unknown>) => {
        const { limit, status } = args as { limit?: number; status?: 'success' | 'failed' | 'partial' };
        const history = await historyService.findByUser('current', {
          limit: limit || 20,
          status,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: history.length,
              records: history.map(h => ({
                id: h._id?.toString(),
                direction: h.direction,
                operation: h.operation,
                document: h.documentName,
                type: h.documentType,
                status: h.status,
                duration: h.durationMs ? `${h.durationMs}ms` : undefined,
                error: h.errorMessage,
                time: h.startedAt,
              })),
            }, null, 2),
          }],
        };
      },
    },
  ];
}
