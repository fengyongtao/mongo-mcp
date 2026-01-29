import { hostname } from 'os';

/**
 * IDE 来源类型
 */
export type IdeSourceType = 'qoder' | 'trae' | 'cursor' | 'windsurf' | 'vscode' | 'manual' | 'other';

/**
 * 服务器配置接口
 */
export interface ServerConfig {
  /** MongoDB 连接字符串 */
  mongoUri: string;
  /** 数据库名称 */
  database: string;
  /** 集合名称 */
  collection: string;
  /** 用户标识 */
  userId: string;
  /** 设备标识 */
  deviceId: string;
  /** IDE 来源 */
  ideSource: IdeSourceType;
  /** 是否启用向量嵌入 */
  enableEmbedding: boolean;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 生成默认设备标识
 */
function generateDeviceId(ideSource: IdeSourceType): string {
  const host = hostname() || 'unknown';
  return `${ideSource}-${host}`;
}

/**
 * 解析布尔值环境变量
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * 验证 IDE 来源类型
 */
function parseIdeSource(value: string | undefined): IdeSourceType {
  const validSources: IdeSourceType[] = ['qoder', 'trae', 'cursor', 'windsurf', 'vscode', 'manual', 'other'];
  if (value && validSources.includes(value as IdeSourceType)) {
    return value as IdeSourceType;
  }
  return 'other';
}

/**
 * 验证日志级别
 */
function parseLogLevel(value: string | undefined): 'debug' | 'info' | 'warn' | 'error' {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (value && validLevels.includes(value)) {
    return value as 'debug' | 'info' | 'warn' | 'error';
  }
  return 'info';
}

/**
 * 从环境变量加载配置
 * 
 * 配置优先级：
 * 1. MCP 客户端传入的 env 环境变量（最高）
 * 2. 系统环境变量
 * 3. 内置默认值（最低）
 */
export function loadConfig(): ServerConfig {
  const ideSource = parseIdeSource(process.env.IDE_SOURCE);
  
  const config: ServerConfig = {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    database: process.env.MONGO_DATABASE || 'mongo_mcp',
    collection: process.env.MONGO_COLLECTION || 'knowledge',
    userId: process.env.USER_ID || 'default',
    deviceId: process.env.DEVICE_ID || generateDeviceId(ideSource),
    ideSource,
    enableEmbedding: parseBoolean(process.env.ENABLE_EMBEDDING, false),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
  };

  return config;
}

/**
 * 验证配置有效性
 */
export function validateConfig(config: ServerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.mongoUri) {
    errors.push('MONGO_URI is required');
  }

  if (!config.database) {
    errors.push('MONGO_DATABASE is required');
  }

  if (!config.collection) {
    errors.push('MONGO_COLLECTION is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 日志工具
 */
export function createLogger(config: ServerConfig) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[config.logLevel];

  return {
    debug: (message: string, ...args: unknown[]) => {
      if (currentLevel <= levels.debug) {
        console.error(`[DEBUG] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (currentLevel <= levels.info) {
        console.error(`[INFO] ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (currentLevel <= levels.warn) {
        console.error(`[WARN] ${message}`, ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (currentLevel <= levels.error) {
        console.error(`[ERROR] ${message}`, ...args);
      }
    },
  };
}
