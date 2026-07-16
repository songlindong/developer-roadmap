# 开发 Harness

Harness 将仓库的开发约定转换为可重复执行的本地和 CI 命令。配置文件位于
`harness/config.json`，执行器本身不依赖任何第三方包。

| 命令 | 用途 |
| --- | --- |
| `npm run doctor` | 检查开发工具和前端依赖是否就绪 |
| `npm run spec:new -- <slug> "<标题>"` | 创建一套新的 SDD 变更规格 |
| `npm run spec:check` | 校验变更清单、规格文档和生命周期规则 |
| `npm run check` | 检查规格、Go 格式与 vet、前端 lint |
| `npm test` | 运行前后端测试 |
| `npm run build` | 执行前后端生产构建 |
| `npm run verify` | 按顺序运行全部必要质量门 |

需要增加质量门时，编辑 `harness/config.json`。命令必须保持确定性且无需交互，
确保开发者本地、CI 和智能体运行的是同一套规则。

