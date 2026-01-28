import { Router, Request, Response } from 'express';
import { KnowledgeService } from '../services/knowledge-service.js';
import { KnowledgeType } from '../types.js';

/**
 * 创建 Dashboard API 路由
 */
export function createDashboardRoutes(knowledgeService: KnowledgeService): Router {
  const router = Router();

  // 获取知识库列表
  router.get('/knowledge', async (req: Request, res: Response) => {
    try {
      const { type, search, tags, enabled, source, limit, skip } = req.query;
      
      const docs = await knowledgeService.list(
        type as KnowledgeType | undefined,
        {
          search: search as string,
          tags: tags ? (tags as string).split(',') : undefined,
          enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
          source: source as string,
          limit: limit ? parseInt(limit as string) : undefined,
          skip: skip ? parseInt(skip as string) : undefined,
        }
      );

      res.json({
        success: true,
        data: docs.map(doc => ({
          id: doc._id?.toString(),
          type: doc.type,
          name: doc.name,
          description: doc.description,
          content: doc.content,
          tags: doc.tags,
          enabled: doc.enabled,
          source: doc.source,
          hasEmbedding: !!doc.embedding,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        })),
        count: docs.length,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // 获取单个文档
  router.get('/knowledge/:type/:name', async (req: Request, res: Response) => {
    try {
      const { type, name } = req.params;
      const doc = await knowledgeService.get(type as KnowledgeType, decodeURIComponent(name));

      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      res.json({
        success: true,
        data: {
          id: doc._id?.toString(),
          type: doc.type,
          name: doc.name,
          description: doc.description,
          content: doc.content,
          tags: doc.tags,
          enabled: doc.enabled,
          source: doc.source,
          hasEmbedding: !!doc.embedding,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // 创建文档
  router.post('/knowledge', async (req: Request, res: Response) => {
    try {
      const doc = await knowledgeService.createWithEmbedding(req.body);
      res.json({
        success: true,
        data: { id: doc._id?.toString(), type: doc.type, name: doc.name },
        message: `${doc.type} "${doc.name}" created`,
      });
    } catch (error: unknown) {
      const err = error as Error & { code?: number };
      if (err.code === 11000) {
        return res.status(409).json({ success: false, error: 'Document already exists' });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 更新文档
  router.put('/knowledge/:type/:name', async (req: Request, res: Response) => {
    try {
      const { type, name } = req.params;
      const doc = await knowledgeService.update(
        type as KnowledgeType,
        decodeURIComponent(name),
        req.body
      );

      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      res.json({
        success: true,
        data: { id: doc._id?.toString(), type: doc.type, name: doc.name },
        message: `${doc.type} "${doc.name}" updated`,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // 删除文档
  router.delete('/knowledge/:type/:name', async (req: Request, res: Response) => {
    try {
      const { type, name } = req.params;
      const deleted = await knowledgeService.delete(type as KnowledgeType, decodeURIComponent(name));

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      res.json({ success: true, message: `${type} "${name}" deleted` });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // 统计数据
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const counts = await knowledgeService.count();
      res.json({ success: true, data: counts });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // 语义搜索
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const { q, type, limit, threshold } = req.query;

      if (!q) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
      }

      const results = await knowledgeService.semanticSearch(q as string, {
        type: type as KnowledgeType | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        threshold: threshold ? parseFloat(threshold as string) : undefined,
      });

      res.json({
        success: true,
        data: results.map(doc => ({
          id: doc._id?.toString(),
          type: doc.type,
          name: doc.name,
          description: doc.description,
          score: Math.round(doc.score * 100) / 100,
          tags: doc.tags,
        })),
        count: results.length,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // 生成嵌入
  router.post('/embeddings', async (req: Request, res: Response) => {
    try {
      const { type } = req.body;
      const count = await knowledgeService.generateEmbeddings(type);
      res.json({
        success: true,
        message: `Generated embeddings for ${count} documents`,
        data: { count },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
}
