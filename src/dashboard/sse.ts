import { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
}

/**
 * SSE 管理器 - 实时推送事件到客户端
 */
export class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  /**
   * 添加客户端
   */
  addClient(id: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    this.clients.set(id, { id, res });

    // 发送连接成功消息
    this.sendToClient(id, { type: 'connected', clientId: id });

    // 客户端断开时移除
    res.on('close', () => {
      this.clients.delete(id);
      console.log(`[SSE] Client disconnected: ${id}`);
    });

    console.log(`[SSE] Client connected: ${id}, total: ${this.clients.size}`);
  }

  /**
   * 发送消息到指定客户端
   */
  sendToClient(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(data: unknown): void {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(client => {
      client.res.write(message);
    });
  }

  /**
   * 发送知识库变更事件
   */
  notifyChange(event: {
    operation: 'insert' | 'update' | 'delete';
    documentType: string;
    documentName: string;
  }): void {
    this.broadcast({
      type: 'knowledge_change',
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取连接数
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// 单例实例
let sseManagerInstance: SSEManager | null = null;

export function getSSEManager(): SSEManager {
  if (!sseManagerInstance) {
    sseManagerInstance = new SSEManager();
  }
  return sseManagerInstance;
}
