# 规格驱动开发（SDD）

每项有实际意义的变更都存放在 `specs/changes/<slug>/` 中，并包含以下文件：

- `change.json`：供程序读取的变更标识和生命周期状态。
- `spec.md`：问题背景、范围、需求和可观察的验收标准。
- `plan.md`：技术设计、影响范围、测试、发布和回滚方案。
- `tasks.md`：开发过程中持续维护的小粒度任务清单。
- `verification.md`：证明变更结果的命令和验证证据。

## 生命周期

`proposed（提议） -> approved（已批准） -> implemented（已实现） -> verified（已验证）`

- `proposed`：正在讨论需求和设计，尚不能开始实现。
- `approved`：范围和设计已经通过评审，可以开始实现。
- `implemented`：代码和文档已完成，但尚未完成最终验证。
- `verified`：所有任务和验收标准都有验证证据，完整 Harness 已通过。

使用 `npm run spec:new -- <kebab-case-slug> "<标题>"` 创建变更规格。每次修改
变更范围、设计或状态时，都应更新 `updated` 日期。已完成的变更继续保留在仓库中，
作为项目的决策历史。

