import { KnowledgeType } from '../types.js';

/**
 * MCP 工具接口
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * 所有知识类型
 */
export const ALL_KNOWLEDGE_TYPES: KnowledgeType[] = [
  'Memories', 'Skills', 'Rules', 'MCPs',
  'Experiences', 'Commands', 'Contexts', 'Workflows'
];

/**
 * 工具响应接口
 */
export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  count?: number;
}
