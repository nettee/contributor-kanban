# Daily PR Triage Brief — for mini bots

这份文档**直接喂给 mini 上的 coding agent**（Claude Code / Codex），告诉它每天 9:00 该做什么。也供运维者参考。

---

## 1. 任务

每天**北京时间 09:00**（= UTC 01:00）触发一次：

1. 拉取 `nexu-io/open-design` 仓库当前所有 **open PR**（含 draft）。
2. 筛选出 **author 超过 72 小时未响应**的 PR（"author 响应" = 最近一次 push / 回复 review / 主动评论）。
3. 给每个 PR 打 0-100 分，配一句中文结论，按阈值分到 priority / consider / skip 三个桶。
4. 从 priority 桶里挑 3-5 个最值得动手的，写成"优先建议"。
5. 把上面整理结果 POST 到 `https://contributor-kanban.vercel.app/api/analysis`，覆盖式更新当日快照。

输出会被 contributor-kanban 的 `/analysis` 页面读取并展示给维护者。

---

## 2. 输入：从哪里拿 PR 数据

**起点**：调用 kanban 自己的 summary 接口拿到 PR 列表（已经按状态分好列）：

```bash
GET https://contributor-kanban.vercel.app/api/kanban?summary=1
```

返回结构：

```jsonc
{
  "repository": "nexu-io/open-design",
  "refreshedAt": "...",
  "columns": [
    {
      "id": "A" | "B" | "C" | "D" | "E",
      "title": "未开始" | "不可合并" | "评审未通过" | "处理中" | "可合并",
      "cards": [
        {
          "number": 1094,
          "title": "fix: ...",
          "url": "https://github.com/.../pull/1094",
          "author": { "login": "...", "isInternal": false },
          "detailStatus": "...",
          "activityAt": "ISO time",
          "updatedAt": "ISO time",
          "column": "A"
        }
      ]
    }
  ]
}
```

**补强信息**（kanban 接口不提供，自己用 `gh` CLI / GitHub API 拿）：

| 字段 | 来源 |
| --- | --- |
| diff 大小 (additions/deletions/files) | `gh pr view <N> --json additions,deletions,files` |
| draft 标志 | `gh pr view <N> --json isDraft` |
| `authorAssociation` = `FIRST_TIME_CONTRIBUTOR` | `gh pr view <N> --json authorAssociation` |
| `awaitingHours` (距离 author 最后动作多少小时) | 自己算：now - max(最后一次该 author 的 commit / 评论时间) |

---

## 3. 筛选条件

- 仓库：`nexu-io/open-design`
- 状态：open（含 draft）
- **author 超过 72h 无响应**

> "author 响应" = author 的 commit push / 评论回复 / review 回应中最新的一次。

不满足以上条件的 PR 不要出现在 `items` 里。

---

## 4. 评分 rubric (0-100)

> 评分是主观判断，但要 **稳定**：相同 PR、相同特征，分数浮动 < 5 分。

### 加分项

| 维度 | 信号 | 权重 |
| --- | --- | --- |
| **用户价值** | fix > feat；面向用户 > 内部工具；解决真实 bug 而非主观偏好 | +30 |
| **改动小** | < 50 行 / 单文件 / 单一职责 | +25 |
| **风险低** | 不动核心模块；有测试；已通过 CI | +20 |
| **可独立性** | 不阻塞其他工作 / 独立 skill / 独立 fix | +15 |
| **维护者立即可收尾** | 评论里没遗留分歧，只缺一两个小修改 | +10 |

### 减分项

| 维度 | 信号 | 权重 |
| --- | --- | --- |
| **明示不可合并** | 标题/描述含 `do not merge` / `draft demo` / `experimental` | -50 |
| **XXL 改动** | > 1000 行 / > 20 文件 / 跨多模块 | -30 |
| **review friction 高** | 已有 3 轮以上 review 分歧未达成共识 | -20 |
| **依赖外部决策** | 等设计稿 / 等产品确认 | -15 |
| **代码质量低** | lint 大量未过 / 测试失败 / 提交散乱 | -10 |

### Bucket 阈值

| Score | bucket | 含义 |
| --- | --- | --- |
| 80–100 | `priority` | 高优先接手 |
| 60–79  | `consider` | 可接手 |
| 0–59   | `skip`     | 不建议接手 |

---

## 5. 优先建议怎么挑

从 `bucket === "priority"` 里挑 **3–5 个**最有可执行性的 PR。

- 优先 score 高的
- 同分时优先 awaitingHours 长的（说明 author 真不回了，接手更必要）
- 同分时优先改动小的（落地快）
- 每条 `reason` 一句话，**≤ 25 字**，写"为什么这个值得最先动手"

> 不必把所有 priority 都列进去。3-5 条是给维护者的"今天最该看这几个"。

---

## 6. 文案要求

- **全部中文**。
- `conclusion` ≤ 80 字，一句话说**为什么得分这个值**——突出最关键的一两个 rubric 因素。例：
  - ✅ "低风险、低成本，修复误导文案，维护者可直接收尾。"
  - ❌ "这是一个很不错的修复，建议优先考虑接手处理。"（空话）
- `reason` ≤ 25 字。
- `summary`（可选，≤ 200 字）：当天的整体观察，比如 "今天有 3 个高优先 bug fix；features 整体 friction 较高，集中在 i18n / RTL。"

---

## 7. 输出 schema

POST 到 `https://contributor-kanban.vercel.app/api/analysis`，body：

```jsonc
{
  "generatedAt": "2026-05-14T01:00:00.000Z",   // 可选，缺省用服务端 now()
  "generatedBy": "claude-code@mini",            // 必填建议，标识来源
  "summary": "...",                              // 可选
  "priorityRecommendations": [                   // 0–20 条
    { "prNumber": 1094, "reason": "≤25 字" }
  ],
  "items": [                                     // 1–500 条；prNumber 不可重复
    {
      "prNumber": 1094,
      "title": "fix: deck PDF export shows all slides, not just current page",
      "url": "https://github.com/nexu-io/open-design/pull/1094",
      "score": 90,                                 // 0-100 整数
      "bucket": "priority",                        // priority | consider | skip
      "draft": false,
      "firstTimeContributor": false,
      "awaitingHours": 94,                         // ≥0 整数
      "conclusion": "高价值 bug fix，范围很小，用户影响直接，容易 salvage 并合并。"
    }
  ]
}
```

约束：

- `priorityRecommendations[*].prNumber` **必须出现在 `items[]` 里**，否则 400。
- `bucket` 必须和 `score` 阈值一致（80+=priority / 60+=consider / 其余 skip）。
- `score` 范围 [0, 100]，浮点会被四舍五入。
- `items` 不能为空。

---

## 8. 调用

```bash
curl -sS -X POST https://contributor-kanban.vercel.app/api/analysis \
  -H "Authorization: Bearer $ANALYSIS_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  --data @snapshot.json
```

`$ANALYSIS_WRITE_TOKEN` 由运维者预先在 mini 的 secrets 里配置（值与 Vercel 项目的 env 一致）。**不要把 token 写进 prompt / 代码 / 日志**。

### 响应码

| Code | 含义 | 处理 |
| --- | --- | --- |
| 200 | 成功 | 结束 |
| 400 | payload 不合 schema | 看 `detail` 字段调整后**重试 1 次** |
| 401 | token 错 | 不要重试，告警 |
| 503 | 服务端没配 `ANALYSIS_WRITE_TOKEN` | 不要重试，告警 |
| 502 | KV 故障 | 30 分钟后重试 1 次，再失败告警 |
| 其他 5xx | 临时故障 | 指数退避（30s → 2m → 10m）最多重试 3 次 |

---

## 9. 工作流总结（伪代码）

```
1. cron 触发（北京 09:00）
2. summary = GET https://contributor-kanban.vercel.app/api/kanban?summary=1
3. pr_list = filter(summary, p => awaitingHours(p) > 72)
4. for each pr in pr_list:
     details = gh pr view pr.number --json additions,deletions,files,isDraft,authorAssociation,...
     score, bucket = evaluate(pr, details, rubric_in_section_4)
     conclusion = write_conclusion(pr, details)
     items.append({...})
5. recommendations = pick_top_priority(items, 3..5)
6. POST /api/analysis with Bearer token
7. 出错按 §8 表格处理
```

---

## 10. 维护说明

- rubric 调整：直接改这份文档，agent 下次运行就生效。
- 不要在 bot 那边硬编码 rubric——以这份文档为唯一来源。
- 想加新字段（比如 `recommendedReviewer`）需要先改 kanban 的 schema 校验（`app/api/analysis/handler.ts`），再改这里。
