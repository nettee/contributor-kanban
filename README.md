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

## `/api/analysis` 接口

供外部 agent（部署在 mac mini 上的 bot）每天定时写入"PR 接手价值评估"快照，前端 `/analysis` 页面读取展示。**只存最新一份**，无历史快照。

### 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | 生产建议 | Vercel KV (Upstash Redis) 凭据。在 Vercel 项目里加 KV 集成会自动注入。本地缺失时落到单进程 in-memory，重启即失。 |
| `ANALYSIS_WRITE_TOKEN` | 写入必填 | `POST /api/analysis` 需要 `Authorization: Bearer <ANALYSIS_WRITE_TOKEN>`，未配置时该接口返回 503。 |

### `GET /api/analysis`

公开。返回 `{ snapshot: AnalysisSnapshot | null }`。无快照时 `snapshot` 为 `null`。

### `POST /api/analysis`

写入当天快照（覆盖式）。Body schema：

```jsonc
{
  "generatedAt": "2026-05-14T01:00:00.000Z",     // 可选，不传用服务端 now()
  "generatedBy": "claude-code@mini",              // 可选，标识来源
  "summary": "今日待接手 PR 评估",                // 可选
  "priorityRecommendations": [                     // 0–20 条，prNumber 必须出现在 items 里
    { "prNumber": 1094, "reason": "高价值 bug fix，改动小" }
  ],
  "items": [                                       // 1–500 条，prNumber 不重复
    {
      "prNumber": 1094,
      "title": "fix: deck PDF export shows all slides, not just current page",
      "url": "https://github.com/.../pull/1094",
      "score": 90,                                  // 0–100 整数
      "bucket": "priority",                         // priority | consider | skip
      "draft": false,
      "firstTimeContributor": false,
      "awaitingHours": 94,                          // ≥0 整数
      "conclusion": "高价值 bug fix，范围很小，用户影响直接，容易 salvage 并合并。"
    }
  ]
}
```

成功返回 `200 { snapshot }`，校验失败 `400`，未鉴权 `401`，未配置写 token `503`，KV 故障 `502`。

### 调用示例

```bash
curl -sS -X POST https://contributor-kanban.vercel.app/api/analysis \
  -H "Authorization: Bearer $ANALYSIS_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  --data @snapshot.json
```
