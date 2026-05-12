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
   GITHUB_APP_ID=你的 GitHub App ID
   GITHUB_APP_INSTALLATION_ID=你的 installation ID
   GITHUB_APP_PRIVATE_KEY_BASE64=base64 编码后的 PEM 私钥
   GITHUB_REQUEST_CONCURRENCY=8
   ```

   GitHub App 凭据只在服务端使用。`GITHUB_APP_PRIVATE_KEY_BASE64` 需要是 PEM 私钥文本的 base64 编码结果，可用 `base64 -i path/to/private-key.pem | tr -d '\n'` 生成。`.env` 已被 `.gitignore` 忽略，真实凭据保持在本地。

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
