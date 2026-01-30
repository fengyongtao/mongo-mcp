/**
 * 结构化日志系统
 * 提供 pino 兼容的日志接口，支持后续迁移到 pino
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  userId?: string;
  deviceId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  time: string;
  module?: string;
  msg: string;
  [key: string]: unknown;
}

/**
 * 日志级别权重
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

/**
 * 全局日志配置
 */
let globalLogLevel: LogLevel = 'info';

/**
 * 设置全局日志级别
 */
export function setLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

/**
 * 获取当前日志级别
 */
export function getLogLevel(): LogLevel {
  return globalLogLevel;
}

/**
 * 格式化日志输出
 */
function formatLog(entry: LogEntry): string {
  // JSON 格式输出，便于日志聚合工具解析
  return JSON.stringify(entry);
}

/**
 * 输出日志
 */
function writeLog(entry: LogEntry): void {
  const currentLevelWeight = LOG_LEVELS[globalLogLevel];
  const entryLevelWeight = LOG_LEVELS[entry.level];

  if (entryLevelWeight >= currentLevelWeight) {
    // 使用 stderr 输出日志，避免干扰 MCP 通信
    console.error(formatLog(entry));
  }
}

/**
 * Logger 类
 */
export class Logger {
  private module: string;
  private context: LogContext;

  constructor(module: string, context: LogContext = {}) {
    this.module = module;
    this.context = context;
  }

  /**
   * 创建子日志器
   */
  child(context: LogContext): Logger {
    return new Logger(this.module, { ...this.context, ...context });
  }

  /**
   * 构建日志条目
   */
  private buildEntry(level: LogLevel, msg: string, data?: LogContext): LogEntry {
    return {
      level,
      time: new Date().toISOString(),
      module: this.module,
      msg,
      ...this.context,
      ...data,
    };
  }

  debug(msg: string, data?: LogContext): void {
    writeLog(this.buildEntry('debug', msg, data));
  }

  info(msg: string, data?: LogContext): void {
    writeLog(this.buildEntry('info', msg, data));
  }

  warn(msg: string, data?: LogContext): void {
    writeLog(this.buildEntry('warn', msg, data));
  }

  error(msg: string, data?: LogContext): void {
    writeLog(this.buildEntry('error', msg, data));
  }

  fatal(msg: string, data?: LogContext): void {
    writeLog(this.buildEntry('fatal', msg, data));
  }
}

/**
 * 创建模块日志器
 */
export function createModuleLogger(module: string, context?: LogContext): Logger {
  return new Logger(module, context);
}

// ============ 预定义日志器 ============

/** 数据库操作日志 */
export const dbLogger = createModuleLogger('db');

/** 同步操作日志 */
export const syncLogger = createModuleLogger('sync');

/** 嵌入服务日志 */
export const embeddingLogger = createModuleLogger('embedding');

/** MCP 工具日志 */
export const toolLogger = createModuleLogger('tool');

/** 服务器日志 */
export const serverLogger = createModuleLogger('server');

// ============ 审计日志 ============

export interface AuditLogEntry {
  action: string;
  userId?: string;
  resourceType?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

/**
 * 记录审计日志
 */
export function auditLog(entry: AuditLogEntry): void {
  const logEntry: LogEntry = {
    level: 'info',
    time: new Date().toISOString(),
    module: 'audit',
    msg: `[AUDIT] ${entry.action}`,
    audit: true,
    ...entry,
  };
  writeLog(logEntry);
}

// ============ 性能日志 ============

/**
 * 性能计时器
 */
export function createTimer(operation: string, logger: Logger = dbLogger) {
  const start = Date.now();
  return {
    end(data?: LogContext): number {
      const duration = Date.now() - start;
      logger.debug(`${operation} completed`, { ...data, duration, op: operation });
      return duration;
    },
    endWithWarn(threshold: number, data?: LogContext): number {
      const duration = Date.now() - start;
      if (duration > threshold) {
        logger.warn(`${operation} slow`, { ...data, duration, threshold, op: operation });
      } else {
        logger.debug(`${operation} completed`, { ...data, duration, op: operation });
      }
      return duration;
    },
  };
}
