# Developer Roadmap

一个简洁的大模型面试文档管理模板，包含：

- 前端：Vite + React + Axios + Ant Design
- 后端：Go 1.25.1 + Gin + GORM
- 存储：MySQL 8.0
- 部署：Docker Compose + Nginx

## 项目结构

```text
frontend/            React 前端
backend/             Go API 服务
deploy/nginx/        Nginx 构建与配置
docker-compose.yml   一键启动编排
```

## 本地开发

### 1. 启动 MySQL

```bash
docker compose up -d mysql
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
- 文档接口：<http://localhost:8080/api/documents>

## Docker 部署

```bash
docker compose up --build
```

默认访问：

- 网站首页：<http://localhost>
- API：<http://localhost/api/health>
- 文档接口：<http://localhost/api/documents>

## 当前包含的基础能力

- 后端启动时自动建表并写入一篇默认的大模型面试文档
- 支持文档列表查看、详情查看、新建、编辑和删除
- 输入标题和正文后自动保存到 MySQL
- 右侧支持 Markdown 实时预览
- Nginx 负责静态资源托管与 `/api` 反向代理

## 当前接口

- `GET /api/health`
- `GET /api/documents`
- `GET /api/documents/:id`
- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`