import { pipeline, env } from '@xenova/transformers';

// 配置 Transformers.js - 禁用图像处理（不需要 sharp）
env.allowLocalModels = false;
env.useBrowserCache = false;
env.backends.onnx.wasm.numThreads = 1;

/**
 * 嵌入服务 - 使用 Transformers.js 生成文本向量
 */
export class EmbeddingService {
  private extractor: any = null;
  private modelName: string;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(modelName: string = 'Xenova/all-MiniLM-L6-v2') {
    this.modelName = modelName;
  }

  /**
   * 初始化模型（懒加载）
   */
  async initialize(): Promise<void> {
    if (this.extractor) return;
    
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this._loadModel();
    
    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
    }
  }

  private async _loadModel(): Promise<void> {
    console.log(`[Embedding] Loading model: ${this.modelName}`);
    const startTime = Date.now();
    
    this.extractor = await pipeline('feature-extraction', this.modelName, {
      quantized: true,
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`[Embedding] Model loaded in ${elapsed}ms`);
  }

  /**
   * 生成文本的向量嵌入
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();
    
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data);
  }

  /**
   * 批量生成向量嵌入
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.initialize();
    
    const results: number[][] = [];
    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }
    
    return results;
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;
    
    return dotProduct / magnitude;
  }

  /**
   * 从文档中提取用于嵌入的文本
   */
  extractTextForEmbedding(doc: { name: string; description?: string; content?: string | Record<string, unknown>; tags?: string[] }): string {
    const parts: string[] = [doc.name];
    
    if (doc.description) {
      parts.push(doc.description);
    }
    
    if (doc.content) {
      if (typeof doc.content === 'string') {
        parts.push(doc.content.substring(0, 1000));
      } else {
        parts.push(JSON.stringify(doc.content).substring(0, 1000));
      }
    }
    
    if (doc.tags?.length) {
      parts.push(doc.tags.join(' '));
    }
    
    return parts.join(' ');
  }

  /**
   * 获取模型名称
   */
  getModelName(): string {
    return this.modelName;
  }
}

// 单例实例
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
