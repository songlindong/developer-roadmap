# 项目学习文档

## 1. 项目是什么

这个项目是一个简洁的学习网站基础模板，目标不是一次性做成完整产品，而是提供一个适合学习的全栈起点。

它包含四部分能力：

- 前端页面展示：`Vite + React + Axios + Ant Design`
- 后端接口服务：`Go + Gin + GORM`
- 数据存储与缓存：`MySQL 8.0 + Redis`
- 本地部署与运行：`Docker Compose + Nginx`

你可以把它理解成一个最小可运行的前后端分离项目。页面能打开，接口能返回数据，数据库和缓存都接上了，后续可以继续扩展登录、课程详情、学习进度、后台管理等功能。

## 2. 整体架构

整个项目的目录结构如下：

```text
developer-roadmap/
  frontend/            React 前端
  backend/             Go API 服务
  deploy/nginx/        Nginx 构建与配置
  docker-compose.yml   一键启动编排
```

各部分职责可以先这样理解：

- `frontend`：负责页面展示、请求接口、把后端数据渲染到浏览器
- `backend`：负责接收请求、处理业务、访问 MySQL、访问 Redis、返回 JSON
- `MySQL`：负责长期保存结构化数据
- `Redis`：负责缓存热点数据，加快接口响应
- `Nginx`：负责对外提供统一入口，既服务前端静态页面，也转发 API 请求
- `Docker Compose`：负责把这些服务一起启动起来

## 3. 一句话理解调用关系

开发环境下：

```text
浏览器 -> Vite 开发服务器 -> Go 后端 -> Redis / MySQL
```

Docker 部署环境下：

```text
浏览器 -> Nginx -> Go 后端 -> Redis / MySQL
```

## 4. 前端部分详解

### 4.1 前端入口

前端入口文件是 `frontend/src/main.jsx`。

它主要做两件事：

- 引入全局样式和 Ant Design 的基础样式
- 把 `App` 组件挂载到页面的 `#root` 节点

也就是说，浏览器真正看到的页面内容，都是从 `App.jsx` 开始渲染出来的。

### 4.2 页面主体

页面主体在 `frontend/src/App.jsx`。

这个文件负责：

- 准备页面状态，例如学习路线、健康状态、加载中状态、错误信息
- 在页面首次加载时主动请求后端接口
- 把返回结果展示成统计卡片、服务状态、学习路线列表

页面初始化时会执行 `fetchData()`，并同时请求两个接口：

- `/api/health`
- `/api/roadmaps`

拿到数据后：

- `health` 用来显示当前服务状态
- `roadmaps` 用来显示学习路线卡片

### 4.3 Axios 是什么

`Axios` 是一个前端 HTTP 请求库，你可以把它理解成“浏览器中专门用来发请求的工具”。

项目里的 Axios 实例在 `frontend/src/api/http.js`：

- `baseURL` 默认是 `/api`
- `timeout` 是 8 秒

这样前端调用时可以写成：

```js
http.get("roadmaps");
```

实际请求地址会变成：

```text
/api/roadmaps
```

### 4.4 Vite 代理是怎么回事

在开发环境下，前端跑在 `5173` 端口，后端跑在 `8080` 端口。

为了避免前端直接写死完整后端地址，项目在 `frontend/vite.config.js` 里做了代理：

- 访问 `/api/...`
- 自动转发到 `http://localhost:8080`

所以本地开发时，真实链路是：

```text
浏览器 -> http://localhost:5173
         -> Vite 代理 /api
         -> http://localhost:8080
```

这也是前后端分离开发中很常见的写法。

## 5. 后端部分详解

### 5.1 后端启动入口

后端启动入口是 `backend/cmd/server/main.go`。

启动顺序很重要，建议你把它当成后端主流程来理解：

1. 读取配置
2. 连接 MySQL
3. 连接 Redis
4. 创建业务服务 `RoadmapService`
5. 自动建表并写入初始化数据
6. 注册路由
7. 启动 Gin 服务监听端口

这就是一个典型的 Web 后端启动流程。

### 5.2 配置层是做什么的

配置文件在 `backend/internal/config/config.go`。

它负责从环境变量中读取：

- `APP_ENV`
- `SERVER_PORT`
- `MYSQL_DSN`
- `REDIS_ADDR`
- `REDIS_PASSWORD`
- `REDIS_DB`

如果环境变量没有传，就使用默认值。

你可以把这一层理解成：

“告诉程序去哪里启动、连接哪个数据库、连接哪个缓存服务”。

### 5.3 路由层是做什么的

路由定义在 `backend/internal/router/router.go`。

它负责告诉 Gin：

- 访问 `/` 时走哪个处理逻辑
- 访问 `/api/health` 时走哪个处理逻辑
- 访问 `/api/roadmaps` 时走哪个处理逻辑

也就是说，路由层的职责是“分发请求”。

当前项目注册了两个主要 API：

- `GET /api/health`
- `GET /api/roadmaps`

### 5.4 Handler 层是做什么的

Handler 在 `backend/internal/handler/roadmap_handler.go`。

它的职责是：

- 接收 HTTP 请求
- 调用业务层
- 把结果返回给前端

你可以把 Handler 理解成“接口控制器”。

当前有两个核心方法：

- `Health()`：检查后端、MySQL、Redis 状态
- `ListRoadmaps()`：获取学习路线列表

### 5.5 Service 层是做什么的

业务逻辑在 `backend/internal/service/roadmap_service.go`。

Service 层的职责是：

- 真正处理业务逻辑
- 访问数据库
- 访问缓存
- 组装返回数据

这是后端里最值得重点学习的一层。

本项目的两个重点方法是：

- `Bootstrap()`：建表并插入示例数据
- `ListRoadmaps()`：优先查 Redis，查不到再查 MySQL

### 5.6 Model 层是做什么的

数据模型在 `backend/internal/model/roadmap.go`。

它定义了数据库表结构对应的 Go 结构体：

- `ID`
- `Title`
- `Description`
- `Level`
- `Duration`
- `LessonCount`
- `TagsCSV`
- `Sort`

这就是 GORM 的核心思路：

- 用 Go 结构体描述数据库表
- 用结构体字段描述表字段

## 6. MySQL 基础讲解

### 6.1 MySQL 是什么

`MySQL` 是关系型数据库，适合存储结构清晰、需要长期保存的数据。

在这个项目里，它保存的是学习路线数据，比如：

- 路线标题
- 路线描述
- 难度等级
- 课程数
- 学习周期

你可以把 MySQL 想象成一个更强大的表格系统，但它支持：

- 稳定存储
- 条件查询
- 索引
- 多人并发访问
- 数据一致性

### 6.2 MySQL 在这个项目里怎么连

连接逻辑在 `backend/internal/database/mysql.go`。

核心做了几件事：

- 使用 `gorm.Open(mysql.Open(dsn), &gorm.Config{})` 建立连接
- 获取底层连接池对象 `sqlDB`
- 设置连接池参数
- 执行 `Ping()` 确认数据库可用

这里的连接池可以先简单理解为：

“程序会维护一组可复用的数据库连接，而不是每次请求都重新创建一个连接”。

### 6.3 GORM 是什么

`GORM` 是 Go 里常用的 ORM 库。

ORM 可以先简单理解成：

“让你用代码对象去操作数据库，而不是全部手写 SQL”。

比如项目里这些操作：

- `AutoMigrate()`：自动建表或更新表结构
- `Count()`：统计行数
- `Create()`：插入数据
- `Find()`：查询数据
- `Order()`：排序查询

对于后端初学者，这种方式很友好，因为你可以先理解“数据流和业务流”，再慢慢深入学习 SQL。

### 6.4 启动时为什么会自动建表

在 `Bootstrap()` 里，项目会执行：

```go
s.db.AutoMigrate(&model.Roadmap{})
```

意思是：

- 如果 `roadmaps` 表不存在，就创建它
- 如果表已经存在，就根据结构体做兼容更新

这让项目第一次运行时不需要你手动建表，非常适合学习和演示。

### 6.5 启动时为什么会自动插入示例数据

`Bootstrap()` 里会先查当前表有多少条数据。

- 如果已经有数据，直接跳过
- 如果没有数据，就插入 4 条示例学习路线

这叫“种子数据”。

它的意义是：

- 项目第一次启动就能看到页面效果
- 不需要你先手工往数据库里插数据
- 更适合作为模板项目

## 7. Redis 基础讲解

### 7.1 Redis 是什么

`Redis` 是一个以内存为主的键值数据库。

它最突出的特点是：

- 读写非常快
- 适合存热点数据
- 常用于缓存、计数器、会话、排行榜等场景

在这个项目里，Redis 的角色不是“主数据库”，而是“缓存层”。

### 7.2 为什么这里要用 Redis

学习路线列表这种数据有一个特点：

- 不会频繁变化
- 但会被频繁读取

这种场景特别适合缓存。

如果每次都查 MySQL：

- 可以查到
- 但会重复占用数据库资源

如果第一次查到后放进 Redis：

- 后续请求就可以直接从 Redis 返回
- 接口响应会更快
- 数据库压力会更小

### 7.3 Redis 在项目里怎么连

连接逻辑在 `backend/internal/database/redis.go`。

代码里做了这些事情：

- 创建 Redis 客户端
- 配置地址、密码、数据库编号
- 设置超时时间
- 调用 `Ping()` 测试连接

你可以把它理解成：

“程序启动时先确认缓存服务可用，再继续启动”。

### 7.4 这个项目是怎么用 Redis 做缓存的

核心逻辑在 `ListRoadmaps()`。

完整流程如下：

1. 先从 Redis 读取键 `roadmaps:all`
2. 如果读到了缓存，就直接返回
3. 如果没读到缓存，就去 MySQL 查询
4. 查到结果后，序列化成 JSON
5. 把 JSON 写回 Redis
6. 设置缓存过期时间为 10 分钟
7. 把结果返回给前端

这就是最经典的“旁路缓存”模式。

### 7.5 什么叫缓存命中和缓存未命中

- 缓存命中：Redis 中已经有数据，直接返回
- 缓存未命中：Redis 里没有数据，需要回源到 MySQL 再查

在这个项目里：

- 第一次访问 `/api/roadmaps`，大概率是缓存未命中
- 第二次访问同一个接口，通常就会命中缓存

### 7.6 为什么缓存里存的是 JSON

Redis 最常见的存储方式就是字符串。

而学习路线列表是一个对象数组，所以项目把它：

- 先转成 JSON 字符串
- 再存进 Redis

取出来时再：

- 从 JSON 字符串反序列化成 Go 结构体数组

这是一种非常常见的后端缓存实现方式。

## 8. 一次完整请求的调用链路

### 8.1 `/api/roadmaps` 的调用链

浏览器打开页面后，React 会触发 `fetchData()`。

然后链路如下：

1. 前端调用 Axios 请求 `/api/roadmaps`
2. 开发环境下由 Vite 代理到后端
3. Gin 路由把请求分发给 `ListRoadmaps()`
4. Handler 调用 Service
5. Service 先查 Redis
6. Redis 有缓存则直接返回
7. Redis 没缓存则查 MySQL
8. 查询结果转换成前端需要的 DTO
9. DTO 序列化成 JSON 写入 Redis
10. 返回给前端
11. React 更新状态并重新渲染页面

可以简化画成这样：

```text
Browser
  -> React App
  -> Axios
  -> Gin Router
  -> Handler
  -> Service
  -> Redis ? hit : MySQL
  -> JSON Response
  -> React Render
```

### 8.2 `/api/health` 的调用链

这个接口的作用是检查服务是否健康。

它的链路是：

1. 前端或浏览器访问 `/api/health`
2. 路由分发到 `Health()`
3. `Health()` 检查 MySQL `Ping()`
4. `Health()` 检查 Redis `Ping()`
5. 返回服务状态 JSON

前端再把它显示成状态标签，例如：

- MySQL: up
- Redis: up
- API: up

## 9. Docker Compose 和 Nginx 部署链路

### 9.1 Docker Compose 的作用

`docker-compose.yml` 是整个项目的服务编排入口。

它会一起启动 4 个服务：

- `mysql`
- `redis`
- `backend`
- `nginx`

这样你不用分别手工启动每个服务，只要一条命令就能把环境带起来。

### 9.2 Docker 服务之间如何通信

这是初学者最容易混淆的一点。

在 Docker Compose 里：

- 容器之间不是通过 `localhost` 通信
- 而是通过服务名通信

例如在后端环境变量里：

- MySQL 地址是 `mysql:3306`
- Redis 地址是 `redis:6379`

这里的 `mysql` 和 `redis` 不是普通域名，而是 Docker Compose 自动创建的服务名解析。

### 9.3 为什么本机 MySQL 端口是 3309

在当前配置里：

```yaml
ports:
  - "3309:3306"
```

含义是：

- 宿主机端口：`3309`
- 容器内部端口：`3306`

所以：

- 你本机连 MySQL，要连 `127.0.0.1:3309`
- 后端容器连 MySQL，要连 `mysql:3306`

两者不是一回事。

### 9.4 Nginx 在这个项目里做什么

Nginx 配置在 `deploy/nginx/default.conf`。

它做两件核心事情：

- `location /`：返回前端打包后的静态页面
- `location /api/`：把 API 请求反向代理到 `backend:8080`

也就是说，生产或容器部署时，浏览器只需要访问 `http://localhost`，Nginx 会负责后面的分发。

### 9.5 前端镜像为什么还要先用 Node 构建

`deploy/nginx/Dockerfile` 采用了多阶段构建：

第一阶段：

- 用 `node:22-alpine`
- 执行 `npm install`
- 执行 `npm run build`
- 生成 `dist` 静态资源

第二阶段：

- 用 `nginx:1.27-alpine`
- 把 `dist` 复制进去
- 用 Nginx 提供静态站点

这样做的好处是：

- 运行镜像更小
- 不需要在生产镜像里保留 Node 构建工具

### 9.6 后端镜像为什么也用多阶段

`backend/Dockerfile` 也是多阶段构建：

第一阶段：

- 用 Go 镜像编译二进制文件

第二阶段：

- 只把编译后的可执行文件放进更轻量的 Alpine 镜像

这样会让后端镜像更小、更干净，也更接近真实生产实践。

## 10. 本地运行步骤

### 10.1 启动数据库和缓存

```bash
docker compose up -d mysql redis
```

### 10.2 启动后端

```bash
cd backend
go mod tidy
go run ./cmd/server
```

### 10.3 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 10.4 访问地址

- 前端页面：`http://localhost:5173`
- 后端健康检查：`http://localhost:8080/api/health`

## 11. 一键 Docker 启动步骤

直接执行：

```bash
docker compose up --build
```

启动后访问：

- 页面首页：`http://localhost`
- API：`http://localhost/api/health`

## 12. 学习这个项目的推荐顺序

如果你后端基础比较薄弱，建议按下面顺序学习。

### 第 1 步：先看前后端如何打通

重点文件：

- `frontend/src/api/http.js`
- `frontend/src/App.jsx`
- `backend/internal/router/router.go`
- `backend/internal/handler/roadmap_handler.go`

这一阶段目标是弄明白：

- 前端怎么发请求
- 后端怎么接请求
- JSON 怎么返回给前端

### 第 2 步：再看 MySQL

重点文件：

- `backend/internal/model/roadmap.go`
- `backend/internal/database/mysql.go`
- `backend/internal/service/roadmap_service.go`

这一阶段目标是弄明白：

- 结构体怎么映射表
- GORM 怎么建表、插入、查询
- 数据是怎么从数据库返回给前端的

### 第 3 步：再看 Redis

重点文件：

- `backend/internal/database/redis.go`
- `backend/internal/service/roadmap_service.go`

这一阶段目标是弄明白：

- Redis 为什么用作缓存
- 缓存命中和未命中的区别
- 为什么查数据库后还要回写缓存

### 第 4 步：最后看 Docker 和 Nginx

重点文件：

- `docker-compose.yml`
- `backend/Dockerfile`
- `deploy/nginx/Dockerfile`
- `deploy/nginx/default.conf`

这一阶段目标是弄明白：

- 多服务是怎么一起跑起来的
- 为什么容器之间用服务名通信
- Nginx 为什么既能服务前端，又能转发 API

## 13. 适合你的学习练习

你可以通过下面这些小实验快速加深理解：

- 停掉 Redis，再访问 `/api/health` 看状态变化
- 删除 Redis 里的 `roadmaps:all`，观察缓存未命中后的接口行为
- 修改初始化种子数据，重新启动后端，看前端页面变化
- 给 `roadmaps` 增加一个字段，比如 `author`
- 前后端同时改造，把 `author` 渲染到页面上
- 给 `/api/roadmaps` 增加查询参数，例如按难度筛选

## 14. 总结

这个项目最核心的学习价值在于，它把一个常见 Web 项目的主干流程串起来了：

- React 负责页面展示
- Axios 负责接口请求
- Gin 负责路由和 HTTP 服务
- Handler 负责接口收发
- Service 负责业务逻辑
- GORM 负责 MySQL 数据操作
- Redis 负责缓存
- Nginx 负责统一入口
- Docker Compose 负责整体编排

如果你把这套调用链真正理解透了，后面再学登录、鉴权、后台管理、消息通知、搜索等功能，会轻松很多。
