# Contributor Kanban

Next.js 单页看板，用于展示 `nexu-io/open-design` 的 open PR 状态。

## 本地运行

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 创建本地环境变量文件：

   ```bash
   cp .env.example .env
   ```

3. 编辑 `.env`：

   ```dotenv
   GITHUB_OWNER=nexu-io
   GITHUB_REPO=open-design
   GITHUB_ORG=nexu-io
   GITHUB_TOKEN=你的 GitHub token
   GITHUB_REQUEST_CONCURRENCY=8
   ```

   `GITHUB_TOKEN` 只在服务端使用。`.env` 已被 `.gitignore` 忽略，真实 token 保持在本地。

4. 启动开发服务器：

   ```bash
   pnpm dev
   ```

5. 打开 `http://localhost:3000`。

## 验证命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
