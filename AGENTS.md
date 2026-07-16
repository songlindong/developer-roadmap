# 仓库协作约定

本仓库采用规格驱动开发（Specification-Driven Development，SDD）和可执行的
开发 Harness。以下规则同时适用于开发者和编码智能体。

## 开始工作前

1. 阅读 `specs/project.md` 和 `docs/architecture.md`。
2. 首次配置开发环境时运行 `npm run doctor`。
3. 在 `specs/changes/` 中找到与任务对应的变更。新增用户行为或架构变更时，
   使用 `npm run spec:new -- <slug> "<标题>"` 创建变更规格。
4. 不得实现尚未批准的变更。需求和设计通过评审后，将 `change.json` 的状态
   从 `proposed` 修改为 `approved`。
5. 实现过程中持续更新 `tasks.md`；状态改为 `verified` 前，在
   `verification.md` 中记录验证命令及结果。
6. 交付前运行 `npm run verify`。

## 哪些变更需要编写规格

用户可见行为、API 或数据模型、安全决策、新增依赖、部署方式和架构变更都必须
编写变更规格。仅修正错别字、修改注释或不改变行为的小型重构可以不新建变更目录，
但仍须通过 Harness 检查。

## 架构边界

- `frontend/` 负责界面展示、浏览器状态和 HTTP 客户端行为。
- `backend/internal/handler/` 负责 HTTP 协议转换和边界参数校验。
- `backend/internal/service/` 负责应用规则和用例。
- `backend/internal/model/` 只负责持久化实体。
- `backend/internal/database/` 负责数据库创建和连接策略。
- Handler 中不得放置业务规则；前端代码不得依赖数据库实现细节。
- API 或数据库结构变更必须在 `plan.md` 中说明兼容性和发布方案。
- 禁止提交密钥。新增环境变量时，必须同步更新 `.env.example` 和相关文档。

## 质量约定

- 行为发生变化时，必须新增或更新测试。
- 不得为了让检查通过而擅自降低质量门槛；确需调整时，必须在变更规格中记录并批准。
- 在条件允许时，一个提交只处理一个变更。
- 不提交生成产物，例如 `frontend/dist`、上传文件和覆盖率文件。

