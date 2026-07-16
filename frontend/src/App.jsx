import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  AutoComplete,
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Empty,
  Input,
  Layout,
  List,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import http from './api/http';
import {
  extractMarkdownHeadings,
  normalizeCategory,
  pickCategory,
} from './lib/documents';

const { Content } = Layout;
const { Paragraph, Text, Title } = Typography;
const { TextArea, Password } = Input;

const ADMIN_TOKEN_KEY = 'roadmap_admin_token';
const AUTO_SAVE_DELAY = 1200;
const ADMIN_LOGIN_HASH = '#/admin-login';
const ADMIN_DASHBOARD_HASH = '#/admin';
const MAX_IMAGE_SIDE = 1600;
const WEBP_QUALITY = 0.82;
const EMPTY_DOCUMENT = {
  id: null,
  title: '',
  category: '未分类',
  content: '',
  createdAt: '',
  updatedAt: '',
};

function AppContent({
  viewMode = 'reader',
  onNavigateToAdmin,
  onNavigateToReader,
  onAuthLost,
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(EMPTY_DOCUMENT);
  const [editorDocument, setEditorDocument] = useState(EMPTY_DOCUMENT);
  const [savedDraft, setSavedDraft] = useState({ title: '', category: '未分类', content: '' });
  const [activeCategory, setActiveCategory] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [isMobile, setIsMobile] = useState(() => detectPhoneDevice());
  const [mobilePanel, setMobilePanel] = useState('');
  const autoSaveTimerRef = useRef(null);
  const imageInputRef = useRef(null);
  const tocListRef = useRef(null);
  const isManagementMode = viewMode === 'admin';

  const categoryStats = useMemo(() => {
    const counts = new Map();
    documents.forEach((item) => {
      const name = normalizeCategory(item.category);
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
      .map(([name, count]) => ({ name, count }));
  }, [documents]);

  const categoryOptions = useMemo(
    () => categoryStats.map((item) => ({ value: item.name })),
    [categoryStats],
  );

  const categoryDocuments = useMemo(() => {
    if (!activeCategory) {
      return [];
    }
    return documents
      .filter((item) => normalizeCategory(item.category) === activeCategory)
      .sort((left, right) => {
        const leftTime = Date.parse((left.createdAt || '').replace(' ', 'T'));
        const rightTime = Date.parse((right.createdAt || '').replace(' ', 'T'));
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      });
  }, [activeCategory, documents]);

  const articleTocItems = useMemo(
    () => extractMarkdownHeadings(selectedDocument.content),
    [selectedDocument.content],
  );

  const articleMarkdownComponents = createMarkdownComponents(articleTocItems);

  useEffect(() => {
    loadAdminStatus();
    loadDocuments();
  }, []);

  useEffect(() => {
    const updateMobileLayout = () => setIsMobile(detectPhoneDevice());
    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 980px)')
      : null;

    updateMobileLayout();
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', updateMobileLayout);
    } else {
      mediaQuery?.addListener?.(updateMobileLayout);
    }
    window.addEventListener('resize', updateMobileLayout);
    window.addEventListener('orientationchange', updateMobileLayout);

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', updateMobileLayout);
      } else {
        mediaQuery?.removeListener?.(updateMobileLayout);
      }
      window.removeEventListener('resize', updateMobileLayout);
      window.removeEventListener('orientationchange', updateMobileLayout);
    };
  }, []);

  useEffect(() => () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setTocCollapsed(false);
  }, [selectedDocument.id]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanel('');
    }
  }, [isMobile]);

  useEffect(() => {
    if (isManagementMode || tocCollapsed || articleTocItems.length === 0) {
      setActiveHeadingId('');
      return undefined;
    }

    const headings = articleTocItems
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);

    if (headings.length === 0) {
      setActiveHeadingId('');
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

        if (visibleEntries.length > 0) {
          setActiveHeadingId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: '0px 0px -70% 0px',
        threshold: [0, 1],
      },
    );

    headings.forEach((heading) => observer.observe(heading));
    setActiveHeadingId(headings[0].id);

    return () => observer.disconnect();
  }, [articleTocItems, isManagementMode, selectedDocument.id, tocCollapsed]);

  useEffect(() => {
    if (!activeHeadingId || tocCollapsed) {
      return;
    }

    const listElement = tocListRef.current;
    const activeElement = listElement?.querySelector(`button[data-heading-id="${activeHeadingId}"]`);
    if (!listElement || !activeElement) {
      return;
    }

    const nextTop = activeElement.offsetTop - (listElement.clientHeight / 2) + (activeElement.clientHeight / 2);
    listElement.scrollTo({
      top: Math.max(0, nextTop),
      behavior: 'smooth',
    });
  }, [activeHeadingId, tocCollapsed]);

  const loadAdminStatus = async () => {
    try {
      const response = await http.get('admin/status');
      const data = response.data.data || {};
      if (!data.authenticated) {
        onAuthLost?.();
      }
      return data;
    } catch {
      const nextStatus = { authenticated: false, configured: false };
      onAuthLost?.();
      return nextStatus;
    }
  };

  const loadDocumentDetail = async (id, sourceDocuments = documents) => {
    if (!id) {
      setSelectedDocument(EMPTY_DOCUMENT);
      return;
    }

    const exists = sourceDocuments.some((item) => item.id === id);
    if (!exists) {
      setSelectedDocument(EMPTY_DOCUMENT);
      return;
    }

    setDetailLoading(true);
    setError('');

    try {
      const response = await http.get(`documents/${id}`);
      setSelectedDocument(response.data.data || EMPTY_DOCUMENT);
    } catch (requestError) {
      if (requestError?.response?.status === 403) {
        onAuthLost?.();
      }
      setError(requestError?.response?.data?.message || '暂时无法加载文章详情。');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadDocuments = async (preferredId, preferredCategory) => {
    setListLoading(true);
    setError('');

    try {
      const response = await http.get('documents');
      const items = response.data.data || [];
      setDocuments(items);

      if (items.length === 0) {
        setActiveCategory('');
        setSelectedDocument(EMPTY_DOCUMENT);
        return;
      }

      const nextCategory = pickCategory(items, preferredCategory || activeCategory);
      const visibleItems = items.filter((item) => normalizeCategory(item.category) === nextCategory);
      const currentVisible = visibleItems.some((item) => item.id === selectedDocument.id);
      const preferredVisible = visibleItems.some((item) => item.id === preferredId);
      const targetId = preferredVisible
        ? preferredId
        : currentVisible
          ? selectedDocument.id
          : visibleItems[0]?.id;

      setActiveCategory(nextCategory);
      if (targetId) {
        await loadDocumentDetail(targetId, items);
      } else {
        setSelectedDocument(EMPTY_DOCUMENT);
      }
    } catch (requestError) {
      if (requestError?.response?.status === 403) {
        onAuthLost?.();
      }
      setError(requestError?.response?.data?.message || '暂时无法加载文章列表，请确认后端服务已启动。');
    } finally {
      setListLoading(false);
    }
  };

  const handleCategoryClick = async (categoryName) => {
    setActiveCategory(categoryName);
    const items = documents.filter((item) => normalizeCategory(item.category) === categoryName);

    if (items.length === 0) {
      setSelectedDocument(EMPTY_DOCUMENT);
      if (isMobile) {
        setMobilePanel('');
      }
      return;
    }

    if (!items.some((item) => item.id === selectedDocument.id)) {
      await loadDocumentDetail(items[0].id, documents);
    }

    if (isMobile) {
      setMobilePanel('titles');
    }
  };

  const openCreateEditor = () => {
    const nextCategory = activeCategory || categoryStats[0]?.name || '未分类';
    setError('');
    setEditorDocument({ ...EMPTY_DOCUMENT, category: nextCategory });
    setSavedDraft({ title: '', category: nextCategory, content: '' });
    setEditorVisible(true);
  };

  const openEditEditor = () => {
    if (!selectedDocument.id) {
      return;
    }

    setError('');
    setEditorDocument({
      id: selectedDocument.id,
      title: selectedDocument.title,
      category: normalizeCategory(selectedDocument.category),
      content: selectedDocument.content,
      createdAt: selectedDocument.createdAt,
      updatedAt: selectedDocument.updatedAt,
    });
    setSavedDraft({
      title: selectedDocument.title || '',
      category: normalizeCategory(selectedDocument.category),
      content: selectedDocument.content || '',
    });
    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setEditorVisible(false);
    setEditorDocument(EMPTY_DOCUMENT);
    setSavedDraft({ title: '', category: '未分类', content: '' });
  };

  const syncSavedDocument = (savedItem, draftSnapshot) => {
    const summary = {
      id: savedItem.id,
      title: draftSnapshot.title,
      category: draftSnapshot.category,
    };

    setDocuments((previous) => {
      const index = previous.findIndex((item) => item.id === savedItem.id);
      if (index === -1) {
        return [summary, ...previous];
      }

      const next = [...previous];
      next[index] = { ...next[index], ...summary };
      return next;
    });

    setSelectedDocument((previous) => {
      if (previous.id && previous.id !== savedItem.id) {
        return previous;
      }

      return {
        ...previous,
        ...savedItem,
        title: draftSnapshot.title,
        category: draftSnapshot.category,
        content: draftSnapshot.content,
      };
    });

    setActiveCategory(draftSnapshot.category);
  };

  const persistDocument = async ({ silent = false } = {}) => {
    const payload = {
      title: editorDocument.title.trim(),
      category: normalizeCategory(editorDocument.category),
      content: editorDocument.content.trim(),
    };

    if (!payload.title || !payload.content) {
      if (silent) {
        return null;
      }
      messageApi.warning('请先填写标题和正文内容');
      return null;
    }

    const draftSnapshot = { ...payload };

    if (!silent) {
      setSaving(true);
      setError('');
    }

    try {
      const response = editorDocument.id
        ? await http.put(`documents/${editorDocument.id}`, payload)
        : await http.post('documents', payload);

      const savedItem = response.data.data;
      const nextCategory = normalizeCategory(savedItem.category);

      setSavedDraft(draftSnapshot);

      if (silent) {
        setEditorDocument((previous) => ({
          ...previous,
          id: savedItem.id ?? previous.id,
          createdAt: savedItem.createdAt || previous.createdAt,
          updatedAt: savedItem.updatedAt || previous.updatedAt,
        }));
        syncSavedDocument(savedItem, { ...draftSnapshot, category: nextCategory });
      } else {
        setEditorDocument(savedItem);
        await loadDocuments(savedItem.id, nextCategory);
        messageApi.success(editorDocument.id ? '文章已更新' : '文章已创建');
      }
      return savedItem;
    } catch (requestError) {
      const nextError = requestError?.response?.data?.message || '保存文章失败，请稍后重试。';
      if (!silent) {
        setError(nextError);
        messageApi.error(nextError);
      }
      if (requestError?.response?.status === 403) {
        await loadAdminStatus();
        onAuthLost?.();
      }
      return null;
    } finally {
      if (!silent) {
        setSaving(false);
      }
    }
  };

  const deleteDocument = async () => {
    if (!selectedDocument.id) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await http.delete(`documents/${selectedDocument.id}`);
      messageApi.success('文章已删除');
      closeEditor();
      await loadDocuments(undefined, activeCategory);
    } catch (requestError) {
      const nextError = requestError?.response?.data?.message || '删除文章失败，请稍后重试。';
      setError(nextError);
      messageApi.error(nextError);
      if (requestError?.response?.status === 403) {
        await loadAdminStatus();
        onAuthLost?.();
      }
    } finally {
      setDeleting(false);
    }
  };

  const logoutAdmin = async () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    closeEditor();
    onAuthLost?.();
  };

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const compressedFile = await compressImageBeforeUpload(file);
    const formData = new FormData();
    formData.append('file', compressedFile);

    setUploadingImage(true);
    setError('');

    try {
      const response = await http.post('upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const rawUrl = response.data?.data?.url;
      if (!rawUrl) {
        throw new Error('图片地址为空');
      }

      const imageUrl = rawUrl.startsWith('http') ? rawUrl : `${window.location.origin}${rawUrl}`;
      const nextLineBreak = editorDocument.content && !editorDocument.content.endsWith('\n') ? '\n' : '';
      const markdown = `${nextLineBreak}![图片说明](${imageUrl})\n`;

      setEditorDocument((previous) => ({
        ...previous,
        content: `${previous.content}${markdown}`,
      }));
      if (compressedFile.size < file.size) {
        messageApi.success(`图片已压缩并上传，体积减少 ${formatSize(file.size - compressedFile.size)}`);
      } else {
        messageApi.success('图片上传成功，已插入正文');
      }
    } catch (requestError) {
      const nextError = requestError?.response?.data?.message || '图片上传失败，请稍后重试。';
      setError(nextError);
      messageApi.error(nextError);
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    if (!isManagementMode || !editorVisible) {
      return undefined;
    }

    const currentDraft = {
      title: editorDocument.title,
      category: normalizeCategory(editorDocument.category),
      content: editorDocument.content,
    };

    if (!currentDraft.title.trim() && !currentDraft.content.trim()) {
      return undefined;
    }

    if (
      currentDraft.title === savedDraft.title
      && currentDraft.category === savedDraft.category
      && currentDraft.content === savedDraft.content
    ) {
      return undefined;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      persistDocument({ silent: true });
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [editorDocument, editorVisible, isManagementMode, savedDraft]);

  const editorTitle = editorDocument.id ? '编辑文章' : '新增文章';
  const showVisitorToc = !isManagementMode && articleTocItems.length > 0 && Boolean(selectedDocument.content);
  const hasActiveCategory = Boolean(activeCategory);
  const openMobilePanel = (panelName) => setMobilePanel(panelName);
  const closeMobilePanel = () => setMobilePanel('');

  const openDocumentFromList = async (id) => {
    await loadDocumentDetail(id);
    if (isMobile) {
      closeMobilePanel();
    }
  };

  const scrollToHeading = (headingId) => {
    setActiveHeadingId(headingId);
    const element = document.getElementById(headingId);
    if (!element) {
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
    if (isMobile) {
      closeMobilePanel();
    }
  };

  const categoryPanelContent = listLoading ? (
    <div className="loading-box"><Spin /></div>
  ) : categoryStats.length === 0 ? (
    <Empty description="还没有分类" />
  ) : (
    <div className="category-list">
      {categoryStats.map((item) => (
        <button
          key={item.name}
          type="button"
          className={item.name === activeCategory ? 'category-item active' : 'category-item'}
          onClick={() => handleCategoryClick(item.name)}
        >
          <span className="category-name">{item.name}</span>
          <span className="category-count">({item.count})</span>
        </button>
      ))}
    </div>
  );

  const titlePanelContent = listLoading ? (
    <div className="loading-box"><Spin /></div>
  ) : categoryDocuments.length === 0 ? (
    <Empty description="当前分类下还没有文章" />
  ) : (
    <List
      dataSource={categoryDocuments}
      renderItem={(item) => (
        <List.Item
          className={item.id === selectedDocument.id ? 'doc-list-item active title-only-item' : 'doc-list-item title-only-item'}
          onClick={() => openDocumentFromList(item.id)}
        >
          {isMobile ? (
            <div className="doc-list-copy">
              <Text strong={item.id === selectedDocument.id}>{item.title}</Text>
              <Text className="doc-list-meta">{item.updatedAt || item.createdAt || '最近更新未知'}</Text>
            </div>
          ) : (
            <Text strong={item.id === selectedDocument.id}>{item.title}</Text>
          )}
        </List.Item>
      )}
    />
  );

  const tocPanelContent = articleTocItems.length === 0 ? (
    <Empty description="当前文章暂无目录" />
  ) : (
    <div ref={tocListRef} className="toc-list">
      {articleTocItems.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.text}
          data-heading-id={item.id}
          className={`toc-item toc-level-${Math.min(item.level, 4)}${item.id === activeHeadingId ? ' active' : ''}`}
          onClick={() => scrollToHeading(item.id)}
        >
          <span className="toc-item-text">{item.text}</span>
        </button>
      ))}
    </div>
  );

  return (
    <Layout className={`page-layout${isMobile ? ' phone-mode' : ''}`}>
      <Content className="page-content">
        {contextHolder}
        {error ? <Alert type="error" showIcon message={error} className="page-alert" /> : null}

        <section className="hero-section">
          <div className="hero-copy">
            <Text className="hero-eyebrow">Knowledge Base</Text>
            <Title level={2} className="hero-title">{isManagementMode ? '私有管理台' : '私有阅读站'}</Title>
            <Paragraph className="hero-text">
              {isManagementMode
                ? '这里是私有管理台，用最简洁的方式维护分类、文章与内容编辑。'
                : '这里是私有阅读站，只保留克制的阅读体验，方便你专注查看内容本身。'}
            </Paragraph>
            <Space wrap size={10} className="hero-meta">
              <span className="hero-meta-item">分类 {categoryStats.length}</span>
              <span className="hero-meta-item">文章 {documents.length}</span>
              <span className="hero-meta-item">{isManagementMode ? '当前为私有管理台' : '当前为私有阅读站'}</span>
            </Space>
          </div>
          <div className="hero-actions">
            <Space wrap>
              <Button className="soft-button" onClick={() => loadDocuments(selectedDocument.id, activeCategory)} loading={listLoading}>
                刷新内容
              </Button>
              {isManagementMode ? (
                <Button type="primary" className="primary-button" onClick={openCreateEditor}>
                  新建文章
                </Button>
              ) : (
                <Button type="text" className="ghost-link-button" onClick={onNavigateToAdmin}>
                  进入管理台
                </Button>
              )}
              {isManagementMode ? (
                <Button type="text" className="ghost-link-button" onClick={onNavigateToReader}>
                  返回阅读站
                </Button>
              ) : null}
              <Button type="text" className="ghost-link-button" onClick={logoutAdmin}>
                退出登录
              </Button>
            </Space>
          </div>
        </section>

        {isMobile ? (
          <Card className="panel-card mobile-overview-card">
            <div className="mobile-quick-summary">
              <Text className="panel-eyebrow">Mobile Navigation</Text>
              <Title level={5} className="mobile-quick-title">{selectedDocument.title || '请选择文章'}</Title>
              <Text className="mobile-quick-meta">
                {activeCategory ? `当前分类：${activeCategory}` : '先从分类中选择你想看的内容'}
              </Text>
            </div>
            <Space wrap size={8} className="hero-meta mobile-overview-meta">
              <span className="hero-meta-item">分类 {categoryStats.length}</span>
              <span className="hero-meta-item">当前文章 {categoryDocuments.length}</span>
              {showVisitorToc ? <span className="hero-meta-item">目录 {articleTocItems.length}</span> : null}
            </Space>
          </Card>
        ) : null}

        <div className="workspace-grid">
          {!isMobile ? (
            <Space direction="vertical" size={16} className="full-width">
              <Card className="panel-card sidebar-card">
                <div className="panel-heading">
                  <Text className="panel-eyebrow">Categories</Text>
                  <Title level={4} className="panel-title">文章分类</Title>
                </div>
                {categoryPanelContent}
              </Card>

              <Card className="panel-card sidebar-card">
                <div className="panel-heading panel-heading-tight">
                  <div>
                    <Text className="panel-eyebrow">Titles</Text>
                    <Title level={4} className="panel-title">{activeCategory || '文章标题'}</Title>
                  </div>
                </div>
                {titlePanelContent}
              </Card>
            </Space>
          ) : null}

          <Space direction="vertical" size={16} className="full-width">
            {isManagementMode && editorVisible ? (
              <Card className="panel-card editor-card">
                <div className="editor-head">
                  <div>
                    <Text className="panel-eyebrow">Editor</Text>
                    <Title level={4} className="panel-title">{editorTitle}</Title>
                    <Paragraph className="editor-tip">支持自动保存、Markdown 编辑与图片上传。</Paragraph>
                  </div>
                  <Text className="editor-status">自动保存已开启</Text>
                </div>
                <div className="editor-split-layout">
                  <div className="editor-form-panel">
                    <Space direction="vertical" size={16} className="full-width editor-form-stack">
                      <Input
                        size="large"
                        placeholder="请输入文章标题"
                        value={editorDocument.title}
                        onChange={(event) => setEditorDocument((previous) => ({ ...previous, title: event.target.value }))}
                      />
                      <AutoComplete
                        options={categoryOptions}
                        value={editorDocument.category}
                        onChange={(value) => setEditorDocument((previous) => ({ ...previous, category: value }))}
                      >
                        <Input placeholder="请选择或输入文章分类" />
                      </AutoComplete>
                      <TextArea
                        className="editor-textarea"
                        rows={18}
                        placeholder="支持 Markdown，例如 # 标题、- 列表、``` 代码块"
                        value={editorDocument.content}
                        onChange={(event) => setEditorDocument((previous) => ({ ...previous, content: event.target.value }))}
                      />
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        className="hidden-file-input"
                        onChange={uploadImage}
                      />
                      <div className="editor-actions">
                        <Space wrap>
                          <Button className="soft-button" onClick={openImagePicker} loading={uploadingImage}>
                            上传图片
                          </Button>
                          <Button className="soft-button" onClick={closeEditor}>
                            取消
                          </Button>
                          <Button type="primary" className="primary-button" onClick={() => persistDocument()} loading={saving}>
                            {editorDocument.id ? '保存修改' : '保存文章'}
                          </Button>
                        </Space>
                      </div>
                    </Space>
                  </div>
                  <div className="editor-preview-panel">
                    <div className="editor-preview-head">
                      <Text className="panel-eyebrow">Live Preview</Text>
                      <Text className="panel-count">实时预览</Text>
                    </div>
                    <div className="editor-preview-meta">
                      <Title level={4} className="editor-preview-title">{editorDocument.title || '未命名文章'}</Title>
                      <Tag bordered={false} className="article-tag">{normalizeCategory(editorDocument.category)}</Tag>
                    </div>
                    <div className="document-preview markdown-preview editor-live-preview">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {editorDocument.content || '从左侧开始输入内容，这里会实时显示预览效果。'}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            <div className={!isMobile && showVisitorToc ? 'content-layout with-toc' : 'content-layout'}>
              <Card className="panel-card content-card">
                <div className="content-head">
                  <div>
                    <Text className="panel-eyebrow">Preview</Text>
                    <Title level={4} className="panel-title">文章内容</Title>
                  </div>
                  {isManagementMode && selectedDocument.id ? (
                    <Space size={8}>
                      <Button size="small" className="soft-button" onClick={openEditEditor}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="确认删除这篇文章吗？"
                        description="删除后不可恢复，请谨慎操作。"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={deleteDocument}
                      >
                        <Button size="small" danger className="danger-button" loading={deleting}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ) : null}
                </div>
                {detailLoading ? (
                  <div className="loading-box"><Spin /></div>
                ) : selectedDocument.content ? (
                  <Space direction="vertical" size={16} className="full-width">
                    <div className="article-head">
                      <div className="article-title-row">
                        <Title level={3} className="article-title">{selectedDocument.title || '未命名文章'}</Title>
                        <Tag bordered={false} className="article-tag">{normalizeCategory(selectedDocument.category)}</Tag>
                      </div>
                      <Text className="article-meta">
                        发布时间：{selectedDocument.createdAt || '尚未保存'} · 最近更新：{selectedDocument.updatedAt || '尚未保存'}
                      </Text>
                    </div>
                    <div className="document-preview markdown-preview">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={articleMarkdownComponents}
                      >
                        {selectedDocument.content}
                      </ReactMarkdown>
                    </div>
                  </Space>
                ) : (
                  <Empty description={isMobile ? '请先打开下方的分类或文章面板开始阅读' : '请选择左侧文章标题查看内容'} />
                )}
              </Card>

              {showVisitorToc && !isMobile ? (
                <Card className={`panel-card toc-card${tocCollapsed ? ' collapsed' : ''}`}>
                  <div className="panel-heading panel-heading-tight toc-head">
                    <div>
                      <Text className="panel-eyebrow">Outline</Text>
                      <Title level={4} className="panel-title">目录</Title>
                    </div>
                    <Button
                      type="text"
                      className="ghost-link-button toc-toggle"
                      onClick={() => setTocCollapsed((previous) => !previous)}
                    >
                      {tocCollapsed ? '展开' : '收起'}
                    </Button>
                  </div>
                  {!tocCollapsed ? tocPanelContent : null}
                </Card>
              ) : null}
            </div>
          </Space>
        </div>

        {isMobile ? (
          <>
            <nav className="mobile-quick-nav">
              <Button
                className={`soft-button mobile-nav-button${mobilePanel === 'categories' ? ' is-active' : ''}`}
                onClick={() => openMobilePanel('categories')}
              >
                分类
              </Button>
              <Button
                className={`soft-button mobile-nav-button${mobilePanel === 'titles' ? ' is-active' : ''}`}
                onClick={() => openMobilePanel('titles')}
                disabled={!hasActiveCategory}
              >
                文章
              </Button>
              {showVisitorToc ? (
                <Button
                  className={`soft-button mobile-nav-button${mobilePanel === 'toc' ? ' is-active' : ''}`}
                  onClick={() => openMobilePanel('toc')}
                >
                  目录
                </Button>
              ) : null}
            </nav>
            <Drawer
              title="文章分类"
              placement="bottom"
              height="72vh"
              open={mobilePanel === 'categories'}
              onClose={closeMobilePanel}
              className="mobile-panel-drawer"
            >
              {categoryPanelContent}
            </Drawer>
            <Drawer
              title={activeCategory ? `${activeCategory} · 文章` : '文章列表'}
              placement="bottom"
              height="72vh"
              open={mobilePanel === 'titles'}
              onClose={closeMobilePanel}
              className="mobile-panel-drawer"
            >
              {titlePanelContent}
            </Drawer>
            <Drawer
              title="文章目录"
              placement="bottom"
              height="72vh"
              open={mobilePanel === 'toc'}
              onClose={closeMobilePanel}
              className="mobile-panel-drawer"
            >
              {tocPanelContent}
            </Drawer>
          </>
        ) : null}
      </Content>
    </Layout>
  );
}

function PrivateAccessPage({ mode = 'reader', onSuccess, onBack }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isMobile = detectPhoneDevice();
  const isManagementMode = mode === 'admin';

  const submitLogin = async () => {
    const nextToken = token.trim();
    if (!nextToken) {
      messageApi.warning('请输入管理员口令');
      return;
    }

    setSubmitting(true);
    window.localStorage.setItem(ADMIN_TOKEN_KEY, nextToken);

    try {
      const response = await http.get('admin/status');
      if (response.data?.data?.authenticated) {
        messageApi.success(isManagementMode ? '已进入私有管理台' : '已进入私有阅读站');
        onSuccess();
        return;
      }

      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      messageApi.error('管理员口令不正确');
    } catch (requestError) {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      messageApi.error(requestError?.response?.data?.message || '验证失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout className={`page-layout${isMobile ? ' phone-mode' : ''}`}>
      <Content className="login-page-content">
        {contextHolder}
        <section className="login-shell">
          <div className="login-copy">
            <Text className="hero-eyebrow">Private Access</Text>
            <Title level={2} className="login-title">{isManagementMode ? '私有管理台' : '私有阅读站'}</Title>
            <Paragraph className="login-text">
              {isManagementMode
                ? '输入管理员口令后进入私有管理台，用于新建、编辑和删除文章。'
                : '输入管理员口令后进入私有阅读站，只保留阅读体验，不展示编辑能力。'}
            </Paragraph>
          </div>
          <Card className="login-card">
            <Space direction="vertical" size={18} className="full-width">
              <Text className="modal-tip">
                {isManagementMode ? '仅你自己可进入私有管理台。' : '仅你自己可进入私有阅读站。'}
              </Text>
              <Password
                size="large"
                placeholder="请输入管理员口令"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onPressEnter={submitLogin}
              />
              <div className="login-actions">
                <Space wrap>
                  <Button className="soft-button" onClick={onBack}>
                    {isManagementMode ? '前往阅读站' : '刷新验证'}
                  </Button>
                  <Button type="primary" className="primary-button" onClick={submitLogin} loading={submitting}>
                    {isManagementMode ? '进入管理台' : '进入阅读站'}
                  </Button>
                </Space>
              </div>
            </Space>
          </Card>
        </section>
      </Content>
    </Layout>
  );
}

function detectPhoneDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (typeof navigator.userAgentData?.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }

  const userAgent = navigator.userAgent || '';
  const touchPoints = navigator.maxTouchPoints || 0;
  const coarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const screenShortSide = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight,
  );
  const viewportShortSide = Math.min(window.innerWidth, window.innerHeight);
  const looksLikePhoneUa = /iPhone|iPod|Windows Phone|IEMobile|Mobile|Opera Mini|webOS/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Tablet|Pad/i.test(userAgent));
  const looksLikePhoneHardware = (coarsePointer || touchPoints > 0)
    && screenShortSide <= 820
    && viewportShortSide <= 980;

  return looksLikePhoneUa || looksLikePhoneHardware;
}

async function compressImageBeforeUpload(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / image.width, MAX_IMAGE_SIDE / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const outputType = 'image/webp';
  const blob = await canvasToBlob(canvas, outputType, WEBP_QUALITY);
  if (!blob) {
    return file;
  }

  if (blob.size >= file.size && scale === 1) {
    return file;
  }

  return new File([blob], renameFileExtension(file.name, outputType), {
    type: outputType,
    lastModified: file.lastModified,
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片读取失败'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function renameFileExtension(filename, mimeType) {
  const extension = mimeType === 'image/webp' ? '.webp' : '.jpg';
  return filename.replace(/\.[^.]+$/, '') + extension;
}

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function MarkdownPre({ children, node, ...props }) {
  return (
    <div className="markdown-code-scroll">
      <pre {...props}>{children}</pre>
    </div>
  );
}

function MarkdownTable({ children, node, ...props }) {
  const rows = Children.toArray(children);
  const headerLabels = [];

  rows.forEach((section) => {
    if (!isValidElement(section) || section.type !== 'thead') {
      return;
    }

    Children.forEach(section.props.children, (row) => {
      if (!isValidElement(row)) {
        return;
      }

      Children.forEach(row.props.children, (cell) => {
        if (!isValidElement(cell)) {
          return;
        }
        headerLabels.push(extractTextContent(cell.props.children));
      });
    });
  });

  const nextChildren = rows.map((section) => {
    if (!isValidElement(section)) {
      return section;
    }

    if (section.type !== 'tbody') {
      return section;
    }

    const bodyRows = Children.toArray(section.props.children).map((row) => {
      if (!isValidElement(row)) {
        return row;
      }

      const cells = Children.toArray(row.props.children).map((cell, index) => {
        if (!isValidElement(cell)) {
          return cell;
        }

        const label = headerLabels[index] || `列 ${index + 1}`;

        return cloneElement(cell, {
          'data-table-label': label,
        });
      });

      return cloneElement(row, undefined, cells);
    });

    return cloneElement(section, undefined, bodyRows);
  });

  return (
    <div className="markdown-table-scroll">
      <table {...props}>{nextChildren}</table>
    </div>
  );
}

function extractTextContent(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(extractTextContent).join('').trim();
  }

  if (isValidElement(value)) {
    return extractTextContent(value.props.children);
  }

  return '';
}

function createMarkdownComponents(items) {
  let headingIndex = 0;

  const renderHeading = (Tag) => function HeadingComponent({ children }) {
    const current = items[headingIndex];
    const headingId = current?.id || `section-${headingIndex + 1}`;
    headingIndex += 1;

    return <Tag id={headingId} className="article-anchor-heading">{children}</Tag>;
  };

  return {
    h1: renderHeading('h1'),
    h2: renderHeading('h2'),
    h3: renderHeading('h3'),
    h4: renderHeading('h4'),
    h5: renderHeading('h5'),
    h6: renderHeading('h6'),
    pre: MarkdownPre,
    table: MarkdownTable,
  };
}

function normalizeRoute(hash) {
  if (hash === ADMIN_DASHBOARD_HASH) {
    return ADMIN_DASHBOARD_HASH;
  }

  if (hash === ADMIN_LOGIN_HASH) {
    return ADMIN_LOGIN_HASH;
  }

  return '';
}

function AppRoutes() {
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash || ''));
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    configured: false,
  });

  const syncAuthStatus = async () => {
    try {
      const response = await http.get('admin/status');
      const data = response.data?.data || {};
      setAuthState({
        loading: false,
        authenticated: Boolean(data.authenticated),
        configured: Boolean(data.configured),
      });
      return data;
    } catch {
      setAuthState({
        loading: false,
        authenticated: false,
        configured: false,
      });
      return { authenticated: false, configured: false };
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(normalizeRoute(window.location.hash || ''));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    syncAuthStatus();
  }, []);

  const navigateTo = (nextRoute = '') => {
    window.location.hash = nextRoute;
    setRoute(normalizeRoute(nextRoute));
  };

  const handleAuthLost = async () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    const targetRoute = route === ADMIN_DASHBOARD_HASH ? ADMIN_LOGIN_HASH : '';
    await syncAuthStatus();
    navigateTo(targetRoute);
  };

  const handleLoginSuccess = async (nextRoute) => {
    await syncAuthStatus();
    navigateTo(nextRoute);
  };

  if (authState.loading) {
    return (
      <Layout className="page-layout">
        <Content className="login-page-content">
          <div className="loading-box"><Spin /></div>
        </Content>
      </Layout>
    );
  }

  if (!authState.authenticated) {
    const loginMode = route === ADMIN_DASHBOARD_HASH || route === ADMIN_LOGIN_HASH ? 'admin' : 'reader';
    return (
      <PrivateAccessPage
        mode={loginMode}
        onSuccess={() => handleLoginSuccess(loginMode === 'admin' ? ADMIN_DASHBOARD_HASH : '')}
        onBack={() => navigateTo('')}
      />
    );
  }

  return (
    <AppContent
      viewMode={route === ADMIN_DASHBOARD_HASH || route === ADMIN_LOGIN_HASH ? 'admin' : 'reader'}
      onNavigateToAdmin={() => navigateTo(ADMIN_DASHBOARD_HASH)}
      onNavigateToReader={() => navigateTo('')}
      onAuthLost={handleAuthLost}
    />
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#111827',
          colorBgBase: '#f4f1ea',
          colorText: '#151515',
          colorTextSecondary: '#6f6a61',
          borderRadius: 18,
          borderRadiusLG: 24,
          colorBorderSecondary: '#e7e0d4',
          boxShadowSecondary: '0 24px 80px rgba(34, 29, 20, 0.08)',
        },
      }}
    >
      <AntdApp>
        <AppRoutes />
      </AntdApp>
    </ConfigProvider>
  );
}
