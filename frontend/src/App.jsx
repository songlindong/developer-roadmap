import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  ConfigProvider,
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
import http from './api/http';

const { Content } = Layout;
const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

const EMPTY_DOCUMENT = {
  id: null,
  title: '',
  content: '',
  createdAt: '',
  updatedAt: '',
};

function AppContent() {
  const [messageApi, contextHolder] = message.useMessage();
  const [documents, setDocuments] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(EMPTY_DOCUMENT);
  const [savedDraft, setSavedDraft] = useState({ title: '', content: '' });
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [error, setError] = useState('');
  const autoSaveTimerRef = useRef(null);

  const isEditing = Boolean(currentDocument.id);

  const stats = useMemo(
    () => [
      { label: '文档总数', value: documents.length },
      { label: '当前模式', value: isEditing ? '编辑文档' : '新建文档' },
      { label: '自动保存', value: autoSaveStatusLabel(autoSaveStatus) },
    ],
    [documents.length, isEditing, autoSaveStatus],
  );

  const resetEditor = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setCurrentDocument(EMPTY_DOCUMENT);
    setSavedDraft({ title: '', content: '' });
    setAutoSaveStatus('idle');
  };

  const applyDocument = (item) => {
    setCurrentDocument(item);
    setSavedDraft({
      title: item.title || '',
      content: item.content || '',
    });
    setAutoSaveStatus('saved');
  };

  const loadDocumentDetail = async (id, sourceDocuments = documents) => {
    if (!id) {
      resetEditor();
      return;
    }

    const exists = sourceDocuments.some((item) => item.id === id);
    if (!exists) {
      resetEditor();
      return;
    }

    setDetailLoading(true);
    setError('');

    try {
      const response = await http.get(`documents/${id}`);
      applyDocument(response.data.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || '暂时无法加载文档详情。');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadDocuments = async (preferredId) => {
    setListLoading(true);
    setError('');

    try {
      const response = await http.get('documents');
      const items = response.data.data || [];
      setDocuments(items);

      if (items.length === 0) {
        resetEditor();
        return;
      }

      const targetId = preferredId || currentDocument.id || items[0].id;
      await loadDocumentDetail(targetId, items);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || '暂时无法加载文档列表，请确认后端服务已启动。');
    } finally {
      setListLoading(false);
    }
  };

  const persistDocument = async ({ silent = false } = {}) => {
    const payload = {
      title: currentDocument.title.trim(),
      content: currentDocument.content.trim(),
    };

    if (!payload.title || !payload.content) {
      if (!silent) {
        messageApi.warning('请先填写标题和正文内容');
      }
      return null;
    }

    setSaving(true);
    setError('');
    if (silent) {
      setAutoSaveStatus('saving');
    }

    try {
      const response = currentDocument.id
        ? await http.put(`documents/${currentDocument.id}`, payload)
        : await http.post('documents', payload);

      const savedItem = response.data.data;
      applyDocument(savedItem);

      const listResponse = await http.get('documents');
      setDocuments(listResponse.data.data || []);

      if (!silent) {
        messageApi.success(currentDocument.id ? '文档已更新' : '文档已创建');
      }

      return savedItem;
    } catch (requestError) {
      const nextError = requestError?.response?.data?.message || '保存文档失败，请稍后重试。';
      setError(nextError);
      setAutoSaveStatus('error');
      if (!silent) {
        messageApi.error(nextError);
      }
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async () => {
    if (!currentDocument.id) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await http.delete(`documents/${currentDocument.id}`);
      messageApi.success('文档已删除');
      const remaining = documents.filter((item) => item.id !== currentDocument.id);
      setDocuments(remaining);
      const nextId = remaining[0]?.id;
      if (nextId) {
        await loadDocumentDetail(nextId, remaining);
      } else {
        resetEditor();
      }
    } catch (requestError) {
      const nextError = requestError?.response?.data?.message || '删除文档失败，请稍后重试。';
      setError(nextError);
      messageApi.error(nextError);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (detailLoading) {
      return undefined;
    }

    const currentDraft = {
      title: currentDocument.title,
      content: currentDocument.content,
    };

    if (!currentDraft.title.trim() && !currentDraft.content.trim()) {
      setAutoSaveStatus('idle');
      return undefined;
    }

    if (currentDraft.title === savedDraft.title && currentDraft.content === savedDraft.content) {
      return undefined;
    }

    setAutoSaveStatus('waiting');
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      persistDocument({ silent: true });
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentDocument.title, currentDocument.content, currentDocument.id, savedDraft, detailLoading]);

  return (
    <Layout className="page-layout">
      <Content className="page-content">
        {contextHolder}
        <section className="hero-section">
          <Space direction="vertical" size={18} className="full-width">
            <Title className="hero-title">大模型面试文档</Title>
            <Paragraph className="hero-text">
              页面只保留一个模块，用来管理大模型面试文档。输入标题和正文后会自动保存，右侧直接显示 Markdown 预览。
            </Paragraph>
            <Space wrap size={12}>
              {stats.map((item) => (
                <Card key={item.label} className="mini-stat-card">
                  <Text type="secondary">{item.label}</Text>
                  <Title level={4} className="mini-stat-value">
                    {item.value}
                  </Title>
                </Card>
              ))}
            </Space>
            <Space wrap>
              <Button type="primary" onClick={() => persistDocument()} loading={saving}>
                {isEditing ? '立即保存' : '创建文档'}
              </Button>
              <Button onClick={() => loadDocuments(currentDocument.id)} loading={listLoading}>
                刷新列表
              </Button>
              <Button onClick={() => { setError(''); resetEditor(); }}>
                新建空白文档
              </Button>
              {isEditing ? (
                <Popconfirm title="确认删除这篇文档吗？" okText="删除" cancelText="取消" onConfirm={deleteDocument}>
                  {/* <Button danger loading={deleting}>删除文档</Button> */}
                </Popconfirm>
              ) : null}
            </Space>
          </Space>
        </section>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        <div className="workspace-grid">
          <Card title="文档列表" extra={<Button size="small" type="link" onClick={() => loadDocuments(currentDocument.id)}>刷新</Button>} className="panel-card">
            {listLoading ? (
              <div className="loading-box"><Spin /></div>
            ) : documents.length === 0 ? (
              <Empty description="还没有文档，先创建一篇吧" />
            ) : (
              <List
                dataSource={documents}
                renderItem={(item) => (
                  <List.Item
                    className={item.id === currentDocument.id ? 'doc-list-item active' : 'doc-list-item'}
                    onClick={() => loadDocumentDetail(item.id)}
                  >
                    <Space direction="vertical" size={6} className="full-width">
                      <Text strong>{item.title}</Text>
                      <Text type="secondary">{item.excerpt}</Text>
                      <Text type="secondary">最近更新：{item.updatedAt}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Space direction="vertical" size={16} className="full-width">
            <Card title={isEditing ? '编辑文档' : '新建文档'} extra={currentDocument.updatedAt ? <Text type="secondary">最近更新：{currentDocument.updatedAt}</Text> : null} className="panel-card">
              <Space direction="vertical" size={16} className="full-width">
                <Input
                  size="large"
                  placeholder="请输入文档标题"
                  value={currentDocument.title}
                  onChange={(event) => setCurrentDocument((previous) => ({ ...previous, title: event.target.value }))}
                />
                <TextArea
                  rows={18}
                  placeholder="支持 Markdown，例如 # 标题、- 列表、``` 代码块"
                  value={currentDocument.content}
                  onChange={(event) => setCurrentDocument((previous) => ({ ...previous, content: event.target.value }))}
                />
                <Text type="secondary">{autoSaveStatusText(autoSaveStatus)}</Text>
              </Space>
            </Card>

            <Card title="Markdown 预览" className="panel-card">
              {detailLoading ? (
                <div className="loading-box"><Spin /></div>
              ) : currentDocument.content ? (
                <Space direction="vertical" size={12} className="full-width">
                  <Title level={4} className="section-title">{currentDocument.title || '未命名文档'}</Title>
                  <Text type="secondary">
                    创建时间：{currentDocument.createdAt || '尚未保存'}，更新时间：{currentDocument.updatedAt || '尚未保存'}
                  </Text>
                  <div className="document-preview markdown-preview">
                    <ReactMarkdown>{currentDocument.content}</ReactMarkdown>
                  </div>
                </Space>
              ) : (
                <Empty description="请选择左侧文档，或先新建一篇文档" />
              )}
            </Card>
          </Space>
        </div>
      </Content>
    </Layout>
  );
}

function autoSaveStatusLabel(status) {
  if (status === 'saving') return '保存中';
  if (status === 'waiting') return '待自动保存';
  if (status === 'saved') return '已保存';
  if (status === 'error') return '保存失败';
  return '未开始';
}

function autoSaveStatusText(status) {
  if (status === 'saving') return '正在自动保存...';
  if (status === 'waiting') return '检测到修改，将在短暂停顿后自动保存';
  if (status === 'saved') return '内容已保存到数据库';
  if (status === 'error') return '自动保存失败，请检查服务状态后重试';
  return '输入标题和正文后会自动保存';
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 16,
        },
      }}
    >
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  );
}