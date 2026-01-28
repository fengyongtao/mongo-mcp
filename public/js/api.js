/**
 * API 客户端
 */
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  // 获取统计数据
  async getStats() {
    return this.request('/stats');
  },

  // 获取文档列表
  async listDocuments(params = {}) {
    const query = new URLSearchParams();
    if (params.type) query.set('type', params.type);
    if (params.search) query.set('search', params.search);
    if (params.tags) query.set('tags', params.tags);
    if (params.limit) query.set('limit', params.limit);

    const queryStr = query.toString();
    return this.request(`/knowledge${queryStr ? '?' + queryStr : ''}`);
  },

  // 获取单个文档
  async getDocument(type, name) {
    return this.request(`/knowledge/${type}/${encodeURIComponent(name)}`);
  },

  // 创建文档
  async createDocument(doc) {
    return this.request('/knowledge', {
      method: 'POST',
      body: doc,
    });
  },

  // 更新文档
  async updateDocument(type, name, updates) {
    return this.request(`/knowledge/${type}/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: updates,
    });
  },

  // 删除文档
  async deleteDocument(type, name) {
    return this.request(`/knowledge/${type}/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },

  // 语义搜索
  async semanticSearch(query, options = {}) {
    const params = new URLSearchParams({ q: query });
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', options.limit);
    if (options.threshold) params.set('threshold', options.threshold);

    return this.request(`/search?${params.toString()}`);
  },

  // 生成嵌入
  async generateEmbeddings(type) {
    return this.request('/embeddings', {
      method: 'POST',
      body: { type },
    });
  },
};

// SSE 连接
function connectSSE(onMessage) {
  const eventSource = new EventSource('/api/events');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('SSE parse error:', e);
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection error');
    eventSource.close();
    // 5秒后重连
    setTimeout(() => connectSSE(onMessage), 5000);
  };

  return eventSource;
}
