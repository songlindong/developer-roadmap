# Developer Roadmap

一个简洁的学习网站基础模板，包含：

- 前端：Vite + React + Axios + Ant Design
- 后端：Go 1.25.1 + Gin + GORM
- 存储：MySQL 8.0 + Redis
- 部署：Docker Compose + Nginx

## 学习文档

- 详细项目说明：`docs/project-guide.md`

## 项目结构

```text
frontend/            React 前端
backend/             Go API 服务
deploy/nginx/        Nginx 构建与配置
docker-compose.yml   一键启动编排
```

## 本地开发

### 1. 启动 MySQL 和 Redis

可以直接使用 Docker：

```bash
docker compose up -d mysql redis
```

### 2. 启动后端

```bash
cd backend
go mod tidy
go run ./cmd/server
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认访问：

- 前端：<http://localhost:5173>
- 后端健康检查：<http://localhost:8080/api/health>

## Docker 部署

```bash
docker compose up --build
```

默认访问：

- 网站首页：<http://localhost>
- API：<http://localhost/api/health>

## 当前包含的基础能力

- 后端启动时自动建表并写入示例学习路线
- Redis 缓存 `/api/roadmaps`
- Nginx 负责静态资源托管与 `/api` 反向代理
- 前端首页调用后端接口并展示学习路线卡片

## 后续建议扩展

- 用户登录与 JWT 鉴权
- 课程详情、章节与学习进度
- 搜索、标签过滤与收藏
- 后台管理与内容发布
