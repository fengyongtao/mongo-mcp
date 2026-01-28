/**
 * Dashboard 主应用
 */
(function() {
  // 状态
  let currentType = 'all';
  let documents = [];
  let isSearchMode = false;

  // DOM 元素
  const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    addNewBtn: document.getElementById('addNew'),
    documentList: document.getElementById('documentList'),
    contentTitle: document.getElementById('contentTitle'),
    detailPanel: document.getElementById('detailPanel'),
    closePanel: document.getElementById('closePanel'),
    documentForm: document.getElementById('documentForm'),
    deleteDoc: document.getElementById('deleteDoc'),
    generateEmbeddings: document.getElementById('generateEmbeddings'),
    toast: document.getElementById('toast'),
    statCards: document.querySelectorAll('.stat-card'),
  };

  // 类型图标映射
  const typeIcons = {
    Memories: '🧠',
    Skills: '⚡',
    Rules: '📋',
    MCPs: '🔌',
  };

  // 初始化
  async function init() {
    bindEvents();
    await loadStats();
    await loadDocuments();
    connectSSE(handleSSEMessage);
  }

  // 绑定事件
  function bindEvents() {
    // 导航点击
    elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const type = item.dataset.type;
        setActiveNav(type);
        currentType = type;
        isSearchMode = false;
        loadDocuments();
      });
    });

    // 统计卡片点击
    elements.statCards.forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        setActiveNav(type);
        currentType = type;
        isSearchMode = false;
        loadDocuments();
      });
    });

    // 搜索
    elements.searchBtn.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch();
    });

    // 新建文档
    elements.addNewBtn.addEventListener('click', () => openPanel());

    // 关闭面板
    elements.closePanel.addEventListener('click', closePanel);

    // 表单提交
    elements.documentForm.addEventListener('submit', handleFormSubmit);

    // 删除文档
    elements.deleteDoc.addEventListener('click', handleDelete);

    // 生成嵌入
    elements.generateEmbeddings.addEventListener('click', handleGenerateEmbeddings);
  }

  // 设置活动导航
  function setActiveNav(type) {
    elements.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.type === type);
    });
    elements.contentTitle.textContent = type === 'all' ? 'All Documents' : type;
  }

  // 加载统计数据
  async function loadStats() {
    try {
      const result = await API.getStats();
      document.getElementById('statMemories').textContent = result.data.Memories || 0;
      document.getElementById('statSkills').textContent = result.data.Skills || 0;
      document.getElementById('statRules').textContent = result.data.Rules || 0;
      document.getElementById('statMCPs').textContent = result.data.MCPs || 0;
    } catch (error) {
      showToast('Failed to load stats: ' + error.message, 'error');
    }
  }

  // 加载文档列表
  async function loadDocuments() {
    try {
      elements.documentList.innerHTML = '<div class="loading">Loading...</div>';
      
      const params = {};
      if (currentType !== 'all') params.type = currentType;

      const result = await API.listDocuments(params);
      documents = result.data;
      renderDocuments(documents);
    } catch (error) {
      elements.documentList.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${error.message}</p></div>`;
    }
  }

  // 执行搜索
  async function performSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) {
      isSearchMode = false;
      loadDocuments();
      return;
    }

    try {
      elements.documentList.innerHTML = '<div class="loading">Searching...</div>';
      isSearchMode = true;

      const options = {};
      if (currentType !== 'all') options.type = currentType;

      const result = await API.semanticSearch(query, options);
      documents = result.data;
      elements.contentTitle.textContent = `Search Results (${result.count})`;
      renderDocuments(documents, true);
    } catch (error) {
      elements.documentList.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${error.message}</p></div>`;
    }
  }

  // 渲染文档列表
  function renderDocuments(docs, showScore = false) {
    if (!docs.length) {
      elements.documentList.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>No documents found</p></div>`;
      return;
    }

    elements.documentList.innerHTML = docs.map(doc => `
      <div class="document-item" data-type="${doc.type}" data-name="${escapeHtml(doc.name)}">
        <div class="doc-icon">${typeIcons[doc.type] || '📄'}</div>
        <div class="doc-info">
          <div class="doc-name">${escapeHtml(doc.name)}</div>
          <div class="doc-desc">${escapeHtml(doc.description || '')}</div>
        </div>
        <div class="doc-meta">
          ${showScore && doc.score ? `<span class="doc-score">${(doc.score * 100).toFixed(0)}%</span>` : ''}
          ${doc.tags?.slice(0, 2).map(t => `<span class="doc-tag">${escapeHtml(t)}</span>`).join('') || ''}
          ${doc.hasEmbedding ? '<span class="doc-embedding" title="Has embedding"></span>' : ''}
        </div>
      </div>
    `).join('');

    // 绑定点击事件
    elements.documentList.querySelectorAll('.document-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        const name = item.dataset.name;
        openPanel(type, name);
      });
    });
  }

  // 打开详情面板
  async function openPanel(type, name) {
    const panel = elements.detailPanel;
    const form = elements.documentForm;

    if (type && name) {
      // 编辑模式
      try {
        const result = await API.getDocument(type, name);
        const doc = result.data;

        document.getElementById('panelTitle').textContent = 'Edit Document';
        document.getElementById('docId').value = doc.id;
        document.getElementById('docType').value = doc.type;
        document.getElementById('docType').disabled = true;
        document.getElementById('docName').value = doc.name;
        document.getElementById('docName').disabled = true;
        document.getElementById('docDescription').value = doc.description || '';
        document.getElementById('docTags').value = (doc.tags || []).join(', ');
        document.getElementById('docContent').value = typeof doc.content === 'string' 
          ? doc.content 
          : JSON.stringify(doc.content, null, 2);
        document.getElementById('docEnabled').checked = doc.enabled !== false;
        elements.deleteDoc.classList.remove('hidden');
      } catch (error) {
        showToast('Failed to load document: ' + error.message, 'error');
        return;
      }
    } else {
      // 新建模式
      document.getElementById('panelTitle').textContent = 'New Document';
      form.reset();
      document.getElementById('docId').value = '';
      document.getElementById('docType').disabled = false;
      document.getElementById('docName').disabled = false;
      document.getElementById('docType').value = currentType !== 'all' ? currentType : 'Memories';
      document.getElementById('docEnabled').checked = true;
      elements.deleteDoc.classList.add('hidden');
    }

    panel.classList.add('open');
    document.querySelector('.main').classList.add('panel-open');
  }

  // 关闭面板
  function closePanel() {
    elements.detailPanel.classList.remove('open');
    document.querySelector('.main').classList.remove('panel-open');
  }

  // 处理表单提交
  async function handleFormSubmit(e) {
    e.preventDefault();

    const type = document.getElementById('docType').value;
    const name = document.getElementById('docName').value;
    const isEdit = document.getElementById('docId').value;

    let content = document.getElementById('docContent').value;
    try {
      content = JSON.parse(content);
    } catch (e) {
      // 保持为字符串
    }

    const data = {
      type,
      name,
      description: document.getElementById('docDescription').value || undefined,
      tags: document.getElementById('docTags').value.split(',').map(t => t.trim()).filter(Boolean),
      content,
      enabled: document.getElementById('docEnabled').checked,
    };

    try {
      if (isEdit) {
        await API.updateDocument(type, name, data);
        showToast('Document updated successfully', 'success');
      } else {
        await API.createDocument(data);
        showToast('Document created successfully', 'success');
      }

      closePanel();
      loadStats();
      loadDocuments();
    } catch (error) {
      showToast('Failed to save: ' + error.message, 'error');
    }
  }

  // 处理删除
  async function handleDelete() {
    const type = document.getElementById('docType').value;
    const name = document.getElementById('docName').value;

    if (!confirm(`Delete "${name}"?`)) return;

    try {
      await API.deleteDocument(type, name);
      showToast('Document deleted', 'success');
      closePanel();
      loadStats();
      loadDocuments();
    } catch (error) {
      showToast('Failed to delete: ' + error.message, 'error');
    }
  }

  // 处理生成嵌入
  async function handleGenerateEmbeddings() {
    const type = currentType !== 'all' ? currentType : undefined;
    const btn = elements.generateEmbeddings;

    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      const result = await API.generateEmbeddings(type);
      showToast(result.message, 'success');
      loadDocuments();
    } catch (error) {
      showToast('Failed: ' + error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Embeddings';
    }
  }

  // SSE 消息处理
  function handleSSEMessage(data) {
    if (data.type === 'knowledge_change') {
      loadStats();
      if (!isSearchMode) loadDocuments();
    }
  }

  // 显示 Toast
  function showToast(message, type = 'info') {
    const toast = elements.toast;
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // HTML 转义
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 启动应用
  init();
})();
