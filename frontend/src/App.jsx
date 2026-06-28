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
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminTokenInput, setAdminTokenInput] = useState('');
  const autoSaveTimerRef = useRef(null);
  const imageInputRef = useRef(null);

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
    return documents.filter((item) => normalizeCategory(item.category) === activeCategory);
  }, [activeCategory, documents]);

  useEffect(() => {
    loadAdminStatus();
    loadDocuments();
  }, []);

  useEffect(() => () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

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
    setAutoSaveStatus('idle');
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
    setAutoSaveStatus('saved');
    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setEditorVisible(false);
    setEditorDocument(EMPTY_DOCUMENT);
    setSavedDraft({ title: '', category: '未分类', content: '' });
    setAutoSaveStatus('idle');
  };

  const persistDocument = async ({ silent = false } = {}) => {
    const payload = {
      title: editorDocument.title.trim(),
      category: normalizeCategory(editorDocument.category),
      content: editorDocument.content.trim(),
    };

    if (!payload.title || !payload.content) {
      if (silent) {
        setAutoSaveStatus('draft');
        return null;
      }
      messageApi.warning('请先填写标题和正文内容');
      return null;
    }

    setSaving(true);
    if (silent) {
      setAutoSaveStatus('saving');
    }
    setError('');

    try {
      const response = editorDocument.id
        ? await http.put(`documents/${editorDocument.id}`, payload)
        : await http.post('documents', payload);

      const savedItem = response.data.data;
      const nextCategory = normalizeCategory(savedItem.category);

      setEditorDocument(savedItem);
      setSavedDraft({
        title: savedItem.title || '',
        category: nextCategory,
        content: savedItem.content || '',
      });
      setAutoSaveStatus('saved');
      await loadDocuments(savedItem.id, nextCategory);
      if (!silent) {
        messageApi.success(editorDocument.id ? '文章已更新' : '文章已创建');
      }
      return savedItem;
    } catch (requestError) {
      const nextError = requestError?.response?.data?.message || '保存文章失败，请稍后重试。';
      setError(nextError);
      setAutoSaveStatus('error');
      if (!silent) {
        messageApi.error(nextError);
      }
      if (requestError?.response?.status === 403) {
        await loadAdminStatus();
      }
      return null;
    } finally {
      setSaving(false);
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
      setAutoSaveStatus('idle');
      return undefined;
    }

    if (
      currentDraft.title === savedDraft.title
      && currentDraft.category === savedDraft.category
      && currentDraft.content === savedDraft.content
    ) {
      return undefined;
    }

    setAutoSaveStatus('waiting');
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

  return (
    <Layout className="page-layout">
      <Content className="page-content">
        {contextHolder}
        {error ? <Alert type="error" showIcon message={error} className="page-alert" /> : null}

        <section className="toolbar-section">
          <div>
            <Title level={3} className="toolbar-title">文章</Title>
            <Paragraph className="toolbar-text">按分类浏览文章，点击标题直接预览内容。</Paragraph>
          </div>
          <Space wrap>
            <Button onClick={() => loadDocuments(selectedDocument.id, activeCategory)} loading={listLoading}>
              刷新
            </Button>
            {isAdmin ? (
              <Button type="primary" onClick={openCreateEditor}>
                新增文章
              </Button>
            ) : null}
            {SHOW_ADMIN_ENTRY && !isAdmin && adminConfigured ? (
              <Button type="text" onClick={() => setAdminModalOpen(true)}>
                管理员入口
              </Button>
            ) : null}
            {isAdmin ? (
              <Button type="text" onClick={logoutAdmin}>
                退出管理
              </Button>
            ) : null}
          </Space>
        </section>

        <div className="workspace-grid">
          <Space direction="vertical" size={16} className="full-width">
            <Card title="文章分类" className="panel-card">
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

            <Card title={activeCategory ? `${activeCategory} 文章` : '文章标题'} className="panel-card">
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
              <Card
                title={editorTitle}
                extra={<Text type="secondary">{autoSaveStatusText(autoSaveStatus)}</Text>}
                className="panel-card"
              >
                <Space direction="vertical" size={16} className="full-width">
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
                    rows={14}
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
                      <Button onClick={openImagePicker} loading={uploadingImage}>
                        上传图片
                      </Button>
                      <Button onClick={closeEditor}>
                        取消
                      </Button>
                      <Button type="primary" onClick={() => persistDocument()} loading={saving}>
                        {editorDocument.id ? '保存修改' : '保存文章'}
                      </Button>
                    </Space>
                  </div>
                </Space>
              </Card>
            ) : null}

            <Card
              title="文章内容"
              extra={isAdmin && selectedDocument.id ? (
                <Space size={8}>
                  <Button size="small" onClick={openEditEditor}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除这篇文章吗？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={deleteDocument}
                  >
                    <Button size="small" danger loading={deleting}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null}
              className="panel-card content-card"
            >
              {detailLoading ? (
                <div className="loading-box"><Spin /></div>
              ) : selectedDocument.content ? (
                <Space direction="vertical" size={12} className="full-width">
                  <Space size={8} wrap>
                    <Title level={4} className="section-title">{selectedDocument.title || '未命名文章'}</Title>
                    <Tag color="blue">{normalizeCategory(selectedDocument.category)}</Tag>
                  </Space>
                  <Text type="secondary">
                    发布时间：{selectedDocument.createdAt || '尚未保存'}，最近更新：{selectedDocument.updatedAt || '尚未保存'}
                  </Text>
                  <div className="document-preview markdown-preview">
                    <ReactMarkdown>{selectedDocument.content}</ReactMarkdown>
                  </div>
                </Space>
              ) : (
                <Empty description="请选择左侧文章标题查看内容" />
              )}
            </Card>
          </Space>
        </div>

        <Modal
          title="管理员验证"
          open={adminModalOpen}
          onOk={submitAdminToken}
          onCancel={() => setAdminModalOpen(false)}
          okText="进入管理"
          cancelText="取消"
        >
          <Space direction="vertical" size={12} className="full-width">
            <Text type="secondary">输入你配置在后端环境变量里的管理员口令。</Text>
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
        <Card title="管理员登录" className="login-card">
          <Space direction="vertical" size={16} className="full-width">
            <Text type="secondary">这是一个不在首页暴露的隐藏管理页，输入管理员口令后进入管理模式。</Text>
            <Password
              size="large"
              placeholder="请输入管理员口令"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onPressEnter={submitLogin}
            />
            <div className="login-actions">
              <Space wrap>
                <Button onClick={onBack}>
                  返回首页
                </Button>
                <Button type="primary" onClick={submitLogin} loading={submitting}>
                  登录管理
                </Button>
              </Space>
            </div>
          </Space>
        </Card>
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
          colorPrimary: '#1677ff',
          borderRadius: 14,
        },
      }}
    >
      <AntdApp>
        <AppRoutes />
      </AntdApp>
    </ConfigProvider>
  );
}
