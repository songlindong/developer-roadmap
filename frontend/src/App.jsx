import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  ConfigProvider,
  Layout,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import http from './api/http';

const { Content } = Layout;
const { Paragraph, Text, Title } = Typography;

const featureItems = [
  'React + Vite 前端骨架',
  'Gin + GORM 后端 API',
  'MySQL 持久化学习路线',
  'Redis 缓存热门数据',
  'Docker Compose 一键启动',
  'Nginx 统一对外访问',
];

function AppContent() {
  const [roadmaps, setRoadmaps] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const stats = useMemo(() => {
    const roadmapCount = roadmaps.length;
    const lessonCount = roadmaps.reduce((total, item) => total + item.lessonCount, 0);
    const beginnerCount = roadmaps.filter((item) => item.level === 'Beginner').length;

    return [
      { title: '学习路线', value: roadmapCount },
      { title: '课程节数', value: lessonCount },
      { title: '入门路线', value: beginnerCount },
    ];
  }, [roadmaps]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [healthResponse, roadmapResponse] = await Promise.all([
        http.get('health'),
        http.get('roadmaps'),
      ]);

      setHealth(healthResponse.data);
      setRoadmaps(roadmapResponse.data.data || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || '暂时无法连接后端服务，请先启动后端或 Docker Compose。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Layout className="page-layout">
      <Content className="page-content">
        <section className="hero-section">
          <Space direction="vertical" size={24} className="full-width">
            <Tag color="blue" className="hero-tag">
              学习网站基础版
            </Tag>
            <Title className="hero-title">用一套简洁的全栈模板开始你的学习平台</Title>
            <Paragraph className="hero-text">
              这个模板包含前端展示页、后端 API、MySQL 持久化、Redis 缓存，以及 Docker Compose + Nginx
              的基础部署方式，适合继续扩展登录、课程、笔记、刷题等功能。
            </Paragraph>
            <Space wrap>
              {featureItems.map((item) => (
                <Tag key={item} color="geekblue" className="feature-tag">
                  {item}
                </Tag>
              ))}
            </Space>
            <Space>
              <Button type="primary" size="large" onClick={fetchData} loading={loading}>
                刷新数据
              </Button>
              <Button size="large" href="/api/health" target="_blank">
                查看 API 状态
              </Button>
            </Space>
          </Space>
        </section>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        <Row gutter={[16, 16]}>
          {stats.map((item) => (
            <Col xs={24} md={8} key={item.title}>
              <Card>
                <Statistic title={item.title} value={item.value} />
              </Card>
            </Col>
          ))}
        </Row>

        <Card className="status-card">
          <Space direction="vertical" size={8}>
            <Title level={4} className="section-title">
              服务状态
            </Title>
            <Text>接口消息：{health?.message || '等待检查'}</Text>
            <Space wrap>
              <Tag color={health?.services?.mysql === 'up' ? 'success' : 'default'}>
                MySQL: {health?.services?.mysql || 'unknown'}
              </Tag>
              <Tag color={health?.services?.redis === 'up' ? 'success' : 'default'}>
                Redis: {health?.services?.redis || 'unknown'}
              </Tag>
              <Tag color={health?.services?.api === 'up' ? 'success' : 'default'}>
                API: {health?.services?.api || 'unknown'}
              </Tag>
            </Space>
          </Space>
        </Card>

        <Card>
          <Space direction="vertical" size={20} className="full-width">
            <div>
              <Title level={3} className="section-title">
                学习路线推荐
              </Title>
              <Paragraph className="section-text">
                后端启动后会自动创建示例数据，前端通过 Axios 读取 `/api/roadmaps` 展示内容。
              </Paragraph>
            </div>

            {loading ? (
              <div className="loading-box">
                <Spin size="large" />
              </div>
            ) : (
              <Row gutter={[16, 16]}>
                {roadmaps.map((item) => (
                  <Col xs={24} md={12} xl={8} key={item.id}>
                    <Card className="roadmap-card" title={item.title}>
                      <Space direction="vertical" size={12} className="full-width">
                        <Paragraph className="roadmap-description">{item.description}</Paragraph>
                        <Space wrap>
                          <Tag color="blue">{item.level}</Tag>
                          <Tag color="purple">{item.duration}</Tag>
                          <Tag color="cyan">{item.lessonCount} 节</Tag>
                        </Space>
                        <Space wrap>
                          {item.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Space>
        </Card>
      </Content>
    </Layout>
  );
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
