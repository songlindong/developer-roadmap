import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  AutoComplete,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Input,
  Layout,
  List,
  Modal,
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

const { Content } = Layout;
const { Paragraph, Text, Title } = Typography;
const { TextArea, Password } = Input;

const ADMIN_TOKEN_KEY = 'roadmap_admin_token';
const AUTO_SAVE_DELAY = 1200;
const SHOW_ADMIN_ENTRY = import.meta.env.VITE_SHOW_ADMIN_ENTRY === 'true';
const ADMIN_LOGIN_HASH = '#/admin-login';
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

function AppContent() {
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminTokenInput, setAdminTokenInput] = useState('');
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const autoSaveTimerRef = useRef(null);
  const imageInputRef = useRef(null);
  const tocListRef = useRef(null);

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

  const articleMarkdownComponents = createHeadingComponents(articleTocItems);

  useEffect(() => {
    loadAdminStatus();
    loadDocuments();
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
    if (isAdmin || tocCollapsed || articleTocItems.length === 0) {
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
  }, [articleTocItems, isAdmin, selectedDocument.id, tocCollapsed]);

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
      setIsAdmin(Boolean(data.authenticated));
      setAdminConfigured(Boolean(data.configured));
      return data;
    } catch {
      setIsAdmin(false);
      setAdminConfigured(false);
      return { authenticated: false, configured: false };
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
      return;
    }

    if (!items.some((item) => item.id === selectedDocument.id)) {
      await loadDocumentDetail(items[0].id, documents);
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
      }
    } finally {
      setDeleting(false);
    }
  };

  const submitAdminToken = async () => {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, adminTokenInput.trim());
    const data = await loadAdminStatus();

    if (data.authenticated) {
      setAdminModalOpen(false);
      setAdminTokenInput('');
      messageApi.success('已进入管理模式');
      return;
    }

    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    messageApi.error('管理员口令不正确');
  };

  const logoutAdmin = async () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminTokenInput('');
    closeEditor();
    await loadAdminStatus();
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
    if (!isAdmin || !editorVisible) {
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
  }, [editorDocument, editorVisible, isAdmin, savedDraft]);

  const editorTitle = editorDocument.id ? '编辑文章' : '新增文章';
  const showVisitorToc = !isAdmin && articleTocItems.length > 0 && Boolean(selectedDocument.content);

  const scrollToHeading = (headingId) => {
    setActiveHeadingId(headingId);
    const element = document.getElementById(headingId);
    if (!element) {
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <Layout className="page-layout">
      <Content className="page-content">
        {contextHolder}
        {error ? <Alert type="error" showIcon message={error} className="page-alert" /> : null}

        <section className="hero-section">
          <div className="hero-copy">
            <Text className="hero-eyebrow">Knowledge Base</Text>
            <Title level={2} className="hero-title">文章与文档</Title>
            <Paragraph className="hero-text">
              用更简洁的方式管理分类、文章与内容预览，界面保持克制，重点只留给内容本身。
            </Paragraph>
            <Space wrap size={10} className="hero-meta">
              <span className="hero-meta-item">分类 {categoryStats.length}</span>
              <span className="hero-meta-item">文章 {documents.length}</span>
              <span className="hero-meta-item">{isAdmin ? '当前为管理模式' : '当前为访客模式'}</span>
            </Space>
          </div>
          <div className="hero-actions">
            <Space wrap>
              <Button className="soft-button" onClick={() => loadDocuments(selectedDocument.id, activeCategory)} loading={listLoading}>
                刷新内容
              </Button>
              {isAdmin ? (
                <Button type="primary" className="primary-button" onClick={openCreateEditor}>
                  新建文章
                </Button>
              ) : null}
              {SHOW_ADMIN_ENTRY && !isAdmin && adminConfigured ? (
                <Button type="text" className="ghost-link-button" onClick={() => setAdminModalOpen(true)}>
                  管理员入口
                </Button>
              ) : null}
              {isAdmin ? (
                <Button type="text" className="ghost-link-button" onClick={logoutAdmin}>
                  退出管理
                </Button>
              ) : null}
            </Space>
          </div>
        </section>

        <div className="workspace-grid">
          <Space direction="vertical" size={16} className="full-width">
            <Card className="panel-card sidebar-card">
              <div className="panel-heading">
                <Text className="panel-eyebrow">Categories</Text>
                <Title level={4} className="panel-title">文章分类</Title>
              </div>
              {listLoading ? (
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
              )}
            </Card>

            <Card className="panel-card sidebar-card">
              <div className="panel-heading panel-heading-tight">
                <div>
                  <Text className="panel-eyebrow">Titles</Text>
                  <Title level={4} className="panel-title">{activeCategory || '文章标题'}</Title>
                </div>
              </div>
              {listLoading ? (
                <div className="loading-box"><Spin /></div>
              ) : categoryDocuments.length === 0 ? (
                <Empty description="当前分类下还没有文章" />
              ) : (
                <List
                  dataSource={categoryDocuments}
                  renderItem={(item) => (
                    <List.Item
                      className={item.id === selectedDocument.id ? 'doc-list-item active title-only-item' : 'doc-list-item title-only-item'}
                      onClick={() => loadDocumentDetail(item.id)}
                    >
                      <Text strong={item.id === selectedDocument.id}>{item.title}</Text>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Space>

          <Space direction="vertical" size={16} className="full-width">
            {isAdmin && editorVisible ? (
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

            <div className={showVisitorToc ? 'content-layout with-toc' : 'content-layout'}>
              <Card className="panel-card content-card">
                <div className="content-head">
                  <div>
                    <Text className="panel-eyebrow">Preview</Text>
                    <Title level={4} className="panel-title">文章内容</Title>
                  </div>
                  {isAdmin && selectedDocument.id ? (
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
                  <Empty description="请选择左侧文章标题查看内容" />
                )}
              </Card>

              {showVisitorToc ? (
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
                  {!tocCollapsed ? (
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
                  ) : null}
                </Card>
              ) : null}
            </div>
          </Space>
        </div>

        <Modal
          title="管理员验证"
          open={adminModalOpen}
          onOk={submitAdminToken}
          onCancel={() => setAdminModalOpen(false)}
          okText="进入管理"
          cancelText="取消"
          className="admin-modal"
          okButtonProps={{ className: 'primary-button' }}
        >
          <Space direction="vertical" size={12} className="full-width">
            <Text className="modal-tip">输入你配置在后端环境变量里的管理员口令。</Text>
            <Password
              placeholder="请输入管理员口令"
              value={adminTokenInput}
              onChange={(event) => setAdminTokenInput(event.target.value)}
              onPressEnter={submitAdminToken}
            />
          </Space>
        </Modal>
      </Content>
    </Layout>
  );
}

function AdminLoginPage({ onSuccess, onBack }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        messageApi.success('已进入管理模式');
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
    <Layout className="page-layout">
      <Content className="login-page-content">
        {contextHolder}
        <section className="login-shell">
          <div className="login-copy">
            <Text className="hero-eyebrow">Private Access</Text>
            <Title level={2} className="login-title">管理员登录</Title>
            <Paragraph className="login-text">
              这是一个不在首页暴露的隐藏管理页。输入管理员口令后进入管理模式，用于新建、编辑和删除文章。
            </Paragraph>
          </div>
          <Card className="login-card">
            <Space direction="vertical" size={18} className="full-width">
              <Text className="modal-tip">仅管理员可访问，验证成功后会自动返回首页。</Text>
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
                    返回首页
                  </Button>
                  <Button type="primary" className="primary-button" onClick={submitLogin} loading={submitting}>
                    登录管理
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

function autoSaveStatusText(status) {
  if (status === 'saving') return '自动保存中...';
  if (status === 'waiting') return '检测到修改，即将自动保存';
  if (status === 'saved') return '内容已自动保存';
  if (status === 'error') return '自动保存失败';
  if (status === 'draft') return '填写标题和正文后会自动保存';
  return '编辑区已打开';
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

function extractMarkdownHeadings(content) {
  if (!content) {
    return [];
  }

  const items = [];
  const usedIds = new Map();
  const lines = content.split('\n');
  let inCodeBlock = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) {
      return;
    }

    const match = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) {
      return;
    }

    const level = match[1].length;
    if (level > 2) {
      return;
    }

    const text = cleanupHeadingText(match[2]);
    if (!text) {
      return;
    }

    const baseId = slugifyHeading(text);
    const count = (usedIds.get(baseId) || 0) + 1;
    usedIds.set(baseId, count);

    items.push({
      id: count === 1 ? baseId : `${baseId}-${count}`,
      level,
      text,
    });
  });

  return items;
}

function cleanupHeadingText(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function slugifyHeading(value) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'section';
}

function createHeadingComponents(items) {
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
  };
}

function normalizeCategory(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '未分类';
}

function pickCategory(items, preferredCategory) {
  const names = Array.from(new Set(items.map((item) => normalizeCategory(item.category))));
  if (preferredCategory && names.includes(preferredCategory)) {
    return preferredCategory;
  }
  return names[0] || '';
}

function AppRoutes() {
  const [route, setRoute] = useState(window.location.hash || '');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const goHome = () => {
    window.location.hash = '';
    setRoute('');
  };

  if (route === ADMIN_LOGIN_HASH) {
    return <AdminLoginPage onSuccess={goHome} onBack={goHome} />;
  }

  return <AppContent />;
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
