# Developer Roadmap

一个基于 React、Go 和 MySQL 的私有知识/面试文档站点。本仓库采用
规格驱动开发（Specification-Driven Development，SDD）和统一开发 Harness。

## SDD 开发流程

```powershell
# 首次检查本机环境
npm run doctor

# 为一个新需求创建规格（先填写并评审规格，再开始编码）
npm run spec:new -- document-search "文档搜索"

# 实现期间随时运行快速检查/测试
npm run check
npm test

# 交付前运行完整质量门
npm run verify
```

新需求的规格在 `specs/changes/<slug>/`。状态依次为
`proposed（提议） -> approved（已批准） -> implemented（已实现） -> verified（已验证）`。详细流程见
`specs/README.md`，架构边界见 `docs/architecture.md`，所有开发者与 AI
协作规则见 `AGENTS.md`。

一个简洁的文档管理模板，包含：

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
- 管理状态：<http://localhost:8080/api/admin/status>
- 文档接口：<http://localhost:8080/api/documents>

## Docker 部署

```bash
docker compose up --build
```

默认访问：

- 网站首页：<http://localhost>
- API：<http://localhost/api/health>
- 管理状态：<http://localhost/api/admin/status>
- 文档接口：<http://localhost/api/documents>

## 管理员权限

- 生产环境默认启用管理员口令校验，请在环境变量中配置 `ADMIN_TOKEN`
- 前端普通访客只能查看文章列表和内容，不能看到新增、编辑、删除入口
- 可通过 `VITE_SHOW_ADMIN_ENTRY=false` 隐藏首页上的“管理员入口”
- 即使隐藏首页入口，也可通过 `/#/admin-login` 打开隐藏管理登录页
- 管理员点击页面上的“管理员入口”并输入正确口令后，才能进入管理模式
- `POST /api/documents`、`PUT /api/documents/:id`、`DELETE /api/documents/:id` 都会校验 `X-Admin-Token`
- 管理员编辑文章时支持上传本地图片，接口为 `POST /api/upload/image`，上传成功后会插入 Markdown 图片链接

## 当前包含的基础能力

- 后端启动时自动建表
- 支持文章列表查看、详情查看、按时间筛选和分页
- 编辑区默认隐藏，点击新增或编辑后才会展开
- 普通访客仅可查看，管理员登录后才可新建、编辑和删除
- 右侧支持 Markdown 实时预览
- Nginx 负责静态资源托管与 `/api` 反向代理

## 当前接口

- `GET /api/health`
- `GET /api/admin/status`
- `GET /api/documents`
- `GET /api/documents/:id`
- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
