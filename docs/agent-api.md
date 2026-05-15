# Agent Integration Cheatsheet

mini 上的 bot 每天只需要调两个 endpoint，按顺序：**读 → 写**。本文档只讲技术契约，不讲怎么评分（评分 rubric 见 [`agent-brief.md`](./agent-brief.md)）。

---

## Endpoints

| # | Method | URL | 用途 | 鉴权 |
|---|---|---|---|---|
| 1 | `GET`  | `https://contributor-kanban.vercel.app/api/kanban?summary=1` | 拉 open PR 列表（已分列） | 无 |
| 2 | `POST` | `https://contributor-kanban.vercel.app/api/analysis` | 写当日分析快照（覆盖式） | `Authorization: Bearer $ANALYSIS_WRITE_TOKEN` |

可选：`GET https://contributor-kanban.vercel.app/api/analysis` 验证刚写入的快照。无鉴权。

---

## Step 1 — GET `/api/kanban?summary=1`

**返回 shape**（仅列重要字段）：

```jsonc
{
  "repository": "nexu-io/open-design",
  "refreshedAt": "2026-05-14T01:00:00.000Z",
  "columns": [
    {
      "id": "A",                        // A=未开始 B=不可合并 C=评审未通过 D=处理中 E=可合并
      "title": "未开始",
      "cards": [
        {
          "number": 1094,
          "title": "fix: deck PDF export ...",
          "url": "https://github.com/nexu-io/open-design/pull/1094",
          "author": { "login": "...", "isInternal": false },
          "detailStatus": "...",         // 该列下的细分状态文案
          "activityAt": "ISO 时间",      // author 最近活跃时间，算 awaitingHours 用
          "updatedAt": "ISO 时间",
          "column": "A"
        }
      ]
    }
  ]
}
```

bot 需要补的字段（kanban 不返回，用 `gh` CLI 或 GitHub REST 取）：
`additions / deletions / changedFiles / isDraft / authorAssociation`。

---

## Step 2 — POST `/api/analysis`

**Headers**

```
Authorization: Bearer $ANALYSIS_WRITE_TOKEN
Content-Type: application/json
```

**Body shape**

```jsonc
{
  "generatedAt": "2026-05-14T01:00:00.000Z",   // 可选，缺省用服务端 now()
  "generatedBy": "claude-code@mini",            // 建议填，标识来源
  "summary": "...",                              // 可选，≤200 字
  "priorityRecommendations": [                   // 0–20 条，prNumber 必须出现在 items
    { "prNumber": 1094, "reason": "≤25 字" }
  ],
  "items": [                                     // 1–500 条，prNumber 不可重复
    {
      "prNumber": 1094,
      "title": "fix: deck PDF export shows all slides, not just current page",
      "url": "https://github.com/nexu-io/open-design/pull/1094",
      "score": 90,                                 // 整数 0–100
      "bucket": "priority",                        // priority | consider | skip
      "draft": false,
      "firstTimeContributor": false,
      "awaitingHours": 94,                         // 整数 ≥0
      "conclusion": "≤80 字，一句话写为什么得这个分"
    }
  ]
}
```

**字段约束**

| 字段 | 类型 | 约束 |
|---|---|---|
| `prNumber` | int > 0 | 必填；`items` 内不可重复 |
| `score` | int [0, 100] | 浮点会被四舍五入 |
| `bucket` | enum | `priority` / `consider` / `skip`，建议和 score 阈值一致（80+ / 60+ / 其余） |
| `draft` / `firstTimeContributor` | bool | 必填 |
| `awaitingHours` | number ≥ 0 | 浮点会被四舍五入 |
| `title` / `url` / `conclusion` | string non-empty | trim 后非空 |
| `priorityRecommendations[*].prNumber` | int | **必须出现在 `items[]` 里**，否则 400 |

**返回**：`200 { "snapshot": {...回显... } }`

---

## 状态码

| Code | 含义 | bot 该怎么做 |
|---|---|---|
| 200 | 成功 | 结束 |
| 400 | payload 不合 schema | 看 `detail` 字段调整，重试 1 次 |
| 401 | Bearer token 不对 | 不重试，告警 |
| 503 | 服务端没配 `ANALYSIS_WRITE_TOKEN` | 不重试，告警（让运维去 Vercel 加 env） |
| 502 | KV 故障 | 30 分钟后重试 1 次，再失败告警 |
| 其他 5xx / 网络错 | 临时故障 | 指数退避 30s → 2m → 10m，最多 3 次 |

---

## 端到端最小可运行示例

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="https://contributor-kanban.vercel.app"

# 1. 读
kanban=$(curl -fsS "$BASE/api/kanban?summary=1")
# ... bot 在这里基于 $kanban + gh CLI 补强 + 评分，组装 snapshot.json ...

# 2. 写
curl -fsS -X POST "$BASE/api/analysis" \
  -H "Authorization: Bearer $ANALYSIS_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  --data @snapshot.json

# 3. 验证（可选）
curl -fsS "$BASE/api/analysis" | jq '.snapshot.items | length'
```

---

## 调试用的最小有效 payload

如果只是想验证写入链路通了（不带评分逻辑），这是能 POST 成功的最小 body：

```json
{
  "items": [
    {
      "prNumber": 1,
      "title": "smoke test",
      "url": "https://example.com/1",
      "score": 50,
      "bucket": "consider",
      "draft": false,
      "firstTimeContributor": false,
      "awaitingHours": 1,
      "conclusion": "smoke"
    }
  ]
}
```

`priorityRecommendations` / `generatedAt` / `generatedBy` / `summary` 都可省略。
