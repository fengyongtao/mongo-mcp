/**
 * Embedding 服务类型定义
 */

/**
 * 嵌入输出结构
 */
export interface EmbeddingOutput {
  data: Float32Array;
  dims: number[];
}

/**
 * 嵌入选项
 */
export interface EmbedOptions {
  pooling?: 'mean' | 'cls' | 'none';
  normalize?: boolean;
}

/**
 * 特征提取器类型
 * 使用泛型函数签名以匹配 @xenova/transformers 的返回类型
 */
export type FeatureExtractor = (
  text: string | string[],
  options?: EmbedOptions
) => Promise<EmbeddingOutput>;

/**
 * 嵌入服务配置
 */
export interface EmbeddingConfig {
  modelName: string;
  quantized?: boolean;
  maxLength?: number;
}

/**
 * 嵌入结果
 */
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  timestamp: Date;
}
