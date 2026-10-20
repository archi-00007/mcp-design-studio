# MCP Design Studio

可视化设计 MCP Server 的工具：管理 Server 与 Tool，用表单编辑入参 / 出参的 JSON Schema，导出可直接使用的 MCP 配置。

## 功能

- Server 与 Tool 的增删改查，本地持久化
- 入参 / 出参 JSON Schema 可视化编辑（string / number / integer / boolean / array / object / null / any，支持嵌套、必填、枚举）
- 导入 / 导出 MCP 配置，支持单文件发布版本
- 内联 Markdown 描述预览与代码高亮

## 开发

```bash
npm install
npm run dev        # 本地开发
npm run build      # 类型检查 + 打包到 dist/
npm run release    # 打包单文件版本到 release/
```

## 技术栈

React 18 + TypeScript + Vite 6 + Tailwind CSS 3
