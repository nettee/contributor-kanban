---
id: 20260512-rewrite-frontend-to-prototype
name: Rewrite Frontend To Prototype
status: designed
created: '2026-05-12'
---

## Overview

### Problem Statement
- 当前项目前端需要完全重写。
- 新前端需要照着 `prototype.html` 进行视觉还原。

### Goals
- 重写前端界面，使实际产品视觉效果还原 `prototype.html`。
- 以 `prototype.html` 展示的内容和交互作为前端功能范围来源。

### Scope
- 保留 `prototype.html` 中展示的前端功能。
- 删除 `prototype.html` 中没有展示的前端功能，例如 PR 总数。

### Constraints
- `prototype.html` 是视觉和功能范围的基准。
- 未在 `prototype.html` 中出现的功能进入砍掉范围。

### Success Criteria
- 前端完成对 `prototype.html` 的视觉还原。
- 前端功能集合只包含 `prototype.html` 中展示的功能。

## Research

### Existing System
- 项目使用 Next.js 15、React 19、TypeScript、Tailwind，并提供 `dev`、`build`、`lint`、`typecheck`、`test` 脚本。Source: `package.json:7-16,31-33`
- 首页入口只渲染 `KanbanPage`。Source: `app/page.tsx:1-5`
- 当前 `KanbanPage` 负责筛选、刷新间隔、加载状态、错误状态、API 请求和看板渲染编排。Source: `src/components/KanbanPage.tsx:35-48,132-154,203-222`
- 当前前端从 `/api/kanban` 拉取数据，并支持 `summary=1` 的初始摘要请求和后续详细请求。Source: `src/components/KanbanPage.tsx:64-74,132-138`
- 当前页面有原型未展示的 hero/统计区，包含「当前视图」和「全部 PR」总数。Source: `src/components/KanbanPage.tsx:178-199`
- 当前 `KanbanBoard` 渲染 5 列网格，每列显示标题、列编号文案和列内卡片数量。Source: `src/components/KanbanBoard.tsx:12-31`
- 当前 `PullRequestCard` 显示 PR 链接、PR 编号、内外部徽标、作者、标题、状态、活跃时间、更新时间、本次刷新时间。Source: `src/components/PullRequestCard.tsx:13-63`
- 当前全局样式是深色渐变主题。Source: `app/globals.css:5-27`
- API 路由通过 `createKanbanHandler` 提供 GET 接口。Source: `app/api/kanban/route.ts:1-3`
- API handler 读取服务端配置、创建 GitHub client、使用 60 秒缓存，并根据 `summary=1` 选择摘要或详细构建流程。Source: `app/api/kanban/handler.ts:8-34,52-64`
- 看板数据结构包含 `refreshedAt`、5 列、可选 rateLimit；卡片包含 number、title、url、author、detailStatus、activityAt、updatedAt、column。Source: `src/kanban/types.ts:11-32`
- 后端列定义当前使用 `A` 到 `E` 的列 ID，列标题是「未开始 / 不可合并 / 评审未通过 / 处理中 / 可合并」。Source: `src/kanban/types.ts:1-7`
- 分类逻辑将 draft 放入 A，冲突或 CI 失败放入 B，CHANGE_REQUESTED 放入 C，mergeable 计算中或默认状态放入 D，已批准且可合并放入 E。Source: `src/kanban/classifier.ts:19-45`

### Prototype Facts
- `prototype.html` 是中文页面，定义浅色视觉变量、系统字体、白色 surface、紫色 accent、状态色和边框色。Source: `prototype/prototype.html:3-35`
- 原型顶部是 sticky header，左侧显示 repo `acme/platform`，右侧显示贡献者分段控件、刷新间隔分段控件、刷新时间和刷新按钮。Source: `prototype/prototype.html:50-59,383-413`
- 原型贡献者筛选只有「全部 / 内部 / 外部」三个按钮。Source: `prototype/prototype.html:390-396`
- 原型刷新间隔只有 `15m / 30m / 60m` 三个按钮，默认 `30m` active。Source: `prototype/prototype.html:398-404,775-777`
- 原型主体是 5 列看板，列标题为「未开始 / 不可合并 / 评审未通过 / 处理中 / 可合并」，每列只显示列内计数。Source: `prototype/prototype.html:417-422,475-479,532-536,573-577,646-650`
- 原型卡片展示 PR 编号、作者名、内外部徽标、标题、状态徽标和相对活跃时间。Source: `prototype/prototype.html:425-438,798-815`
- 原型卡片没有显示「更新时间」「本次刷新」字段。Source: `prototype/prototype.html:798-815`
- 原型没有全局 PR 总数或 hero 统计区，主体从 header 后直接进入 board。Source: `prototype/prototype.html:383-417`
- 原型列 ID / 分类 key 是 `draft`、`blocked`、`changes-requested`、`in-review`、`approved`，视觉列 class 是 `col-draft`、`col-blocked`、`col-changes`、`col-progress`、`col-ready`。Source: `prototype/prototype.html:736-742`
- 原型分类规则将 draft 放 draft，ci-fail/conflict 放 blocked，changes-requested 放 changes-requested，approved 放 approved，其余放 in-review。Source: `prototype/prototype.html:744-750`
- 原型支持贡献者筛选、手动刷新、刷新间隔定时器和刷新时间显示。Source: `prototype/prototype.html:780-785,833-877`
- 原型空列展示「暂无 PR」。Source: `prototype/prototype.html:818`
- 原型响应式规则在窄屏下保留 5 列横向滚动，列最小宽度在 1200px 以下为 220px，768px 以下为 260px。Source: `prototype/prototype.html:355-372`

### Available Approaches
- **组件级视觉还原**：保留现有 Next.js/React/API 数据流，重写 `KanbanPage`、`FilterControls`、`KanbanBoard`、`PullRequestCard`、`RefreshStatus` 的 markup 和 class，使 React UI 对齐原型。Source: `app/page.tsx:1-5`, `src/components/KanbanPage.tsx:173-222`, `prototype/prototype.html:383-417`
- **样式变量迁移**：将原型 CSS 变量和布局规则迁移到 Tailwind class 或全局 CSS，替换当前深色渐变全局主题。Source: `prototype/prototype.html:8-35,168-244`, `app/globals.css:5-27`
- **功能裁剪**：删除当前 hero/统计区、全局「全部 PR」总数、卡片更新时间/本次刷新、rate limit 展示等原型未展示内容。Source: `src/components/KanbanPage.tsx:178-199`, `src/components/PullRequestCard.tsx:49-61`, `src/components/RefreshStatus.tsx:38-43`, `prototype/prototype.html:383-417,798-815`
- **数据结构适配**：前端可以继续消费当前 `A-E` 列 ID 并只改变展示，也可以在设计阶段决定是否把列 ID 调整为原型语义 key。Source: `src/kanban/types.ts:1-7`, `prototype/prototype.html:736-742`

### Constraints & Dependencies
- 用户要求 `prototype.html` 中没有展示的功能进入砍掉范围；当前实现中的「全部 PR」总数是明确需要移除的候选。Source: `specs/change/20260512-rewrite-frontend-to-prototype/spec.md:18-24`, `src/components/KanbanPage.tsx:190-199`, `prototype/prototype.html:383-417`
- 当前 UI 测试断言了旧页面标题、`PR #101` 文案、作者 `@alice`、活跃/更新时间和刷新错误展示；视觉还原后这些断言会需要同步更新。Source: `app/page.test.tsx:121-135,137-156,213-220`
- 当前看板后端测试断言列 ID 顺序为 `A-E`，因此若设计阶段调整列 ID，会影响后端测试和类型。Source: `src/kanban/build-board.test.ts:63-77`, `src/kanban/types.ts:1-9`
- 当前错误与 rate limit 展示存在独立组件；原型没有对应展示，但开发期失败仍需要可见。Source: `src/components/RefreshStatus.tsx:12-69`, `prototype/prototype.html:383-417`

### Key References
- `prototype/prototype.html:8-35` - 原型视觉变量、字体和颜色基准。
- `prototype/prototype.html:383-417` - 原型页面结构：header 后直接进入 board。
- `prototype/prototype.html:417-702` - 原型 5 列和卡片静态 DOM 示例。
- `prototype/prototype.html:736-877` - 原型列定义、分类、筛选、刷新逻辑。
- `src/components/KanbanPage.tsx:35-222` - 当前前端状态、请求和页面组合入口。
- `src/components/KanbanBoard.tsx:10-49` - 当前 5 列看板渲染。
- `src/components/PullRequestCard.tsx:9-65` - 当前卡片渲染。
- `src/kanban/types.ts:1-39` - 当前前后端共享数据契约。
- `app/api/kanban/handler.ts:15-65` - 当前 kanban API handler。

## Design

### Architecture Overview
```mermaid
flowchart TD
  Prototype[prototype/prototype.html\n视觉与功能范围基准]
  App[Next.js HomePage]
  Page[KanbanPage\n数据请求 + 筛选 + 刷新状态]
  Header[PrototypeHeader\nrepo + segmented controls + refresh]
  Board[KanbanBoard\n5 列原型布局]
  Card[PullRequestCard\n原型卡片信息密度]
  API[/api/kanban]
  Verify[视觉验证\nagent-browser 截图 + DevTools 复核]

  App --> Page
  Page --> API
  Page --> Header
  Page --> Board
  Board --> Card
  Prototype --> Header
  Prototype --> Board
  Prototype --> Card
  Prototype --> Verify
  App --> Verify
```

### Change Scope
- Area: `app/globals.css`。Impact: 将当前深色渐变全局主题替换为原型浅色背景、系统字体、色彩变量、边框和 surface 基调。Source: `app/globals.css:5-27`, `prototype/prototype.html:8-35`
- Area: `src/components/KanbanPage.tsx`。Impact: 保留 API 拉取、贡献者筛选、刷新间隔、定时刷新和手动刷新状态；删除 hero/说明/统计模块；页面结构改为 sticky header + board。Source: `src/components/KanbanPage.tsx:35-48,132-154,178-222`, `prototype/prototype.html:383-417,775-877`
- Area: `src/components/FilterControls.tsx` / `src/components/RefreshStatus.tsx`。Impact: 将贡献者筛选、刷新间隔、刷新时间、刷新按钮合并为原型 header 控件；常态展示与原型一致，异常状态保留可见错误反馈。Source: `src/components/FilterControls.tsx:31-89`, `src/components/RefreshStatus.tsx:12-69`, `prototype/prototype.html:389-413`
- Area: `src/components/KanbanBoard.tsx`。Impact: 重写 5 列布局，移除「列 A/B/C/D/E」展示，只保留列标题与列内计数，窄屏保留横向滚动。Source: `src/components/KanbanBoard.tsx:12-31`, `prototype/prototype.html:168-230,355-372,417-702`
- Area: `src/components/PullRequestCard.tsx`。Impact: 重写卡片视觉与字段，只展示 PR 编号、作者、内外部徽标、标题、状态徽标、相对活跃时间。Source: `src/components/PullRequestCard.tsx:13-63`, `prototype/prototype.html:232-341,798-815`
- Area: tests。Impact: 更新 UI 测试断言，覆盖原型字段、控件形态、功能裁剪和异常态。Source: `app/page.test.tsx:121-135,137-156,213-220`

### Design Decisions
- Decision: `prototype/prototype.html` 是视觉还原和功能范围的唯一基准；页面只呈现原型展示的模块和字段。Source: `specs/change/20260512-rewrite-frontend-to-prototype/spec.md:18-28`, `prototype/prototype.html:383-417,798-815`
- Decision: 保留现有 Next.js/React/API 数据流与 `/api/kanban` 数据来源，重写前端展示层。Source: `app/page.tsx:1-5`, `src/components/KanbanPage.tsx:35-48,64-74`, `app/api/kanban/route.ts:1-3`
- Decision: 保留现有 `A-E` 后端数据契约，在前端增加列视觉映射到 `col-draft`、`col-blocked`、`col-changes`、`col-progress`、`col-ready`，降低后端和测试牵动。Source: `src/kanban/types.ts:1-9`, `src/kanban/build-board.test.ts:63-77`, `prototype/prototype.html:736-742`
- Decision: 默认刷新间隔改为 30 分钟，使初始状态对齐原型 active 的 `30m`。Source: `src/components/KanbanPage.tsx:9,37`, `src/components/FilterControls.tsx:12`, `prototype/prototype.html:401-403,775-777`
- Decision: Header 使用分段按钮实现贡献者筛选与刷新间隔，替换当前独立控制卡片和 select。Source: `src/components/FilterControls.tsx:31-89`, `prototype/prototype.html:390-404`
- Decision: 常态刷新信息以内联 header 文案展示；API 错误作为异常态清晰显示，保持开发期失败可见。Source: `src/components/RefreshStatus.tsx:12-69`, `prototype/prototype.html:406-412`, `app/api/kanban/handler.ts:35-48`
- Decision: 卡片保留点击打开 PR 的能力时，视觉形态按原型 `card` 还原，避免额外链接视觉和多余字段。Source: `src/components/PullRequestCard.tsx:13-20`, `prototype/prototype.html:232-239,425-438`
- Decision: 视觉验收采用截图为主、组件源码为辅；原型与 app 分别通过本地服务打开，再用 agent-browser CLI 与 Chrome DevTools MCP 对比截图和 computed styles。Source: `package.json:7-11`, `prototype/prototype.html:1-889`, `prototype/prototype.html:8-35,355-378`

### Why this design
- 保留数据层可复用现有 GitHub API、分类、缓存和错误处理能力，把风险集中在前端视觉还原。Source: `app/api/kanban/handler.ts:15-65`, `src/kanban/classifier.ts:19-45`
- 前端映射现有 `A-E` 列契约可避免后端类型、分类逻辑和构建测试的大范围连锁修改。Source: `src/kanban/types.ts:1-9`, `src/kanban/build-board.test.ts:63-77`
- 以截图对比作为主验证方式，覆盖布局、颜色、间距、信息密度和响应式这些单元测试难以捕获的视觉目标。Source: `prototype/prototype.html:8-35,168-244,355-378,383-417`

### Test Strategy
- Unit/UI tests: 更新 `app/page.test.tsx`，断言 header repo、贡献者分段按钮、刷新间隔按钮、5 列标题、卡片字段、筛选交互、手动刷新交互和错误态。Source: `app/page.test.tsx:121-171,213-220`
- Feature removal tests: 增加断言，页面常态不展示 hero 标题、全局 PR 总数、rate limit、卡片「更新于」「本次刷新」。Source: `src/components/KanbanPage.tsx:178-199`, `src/components/PullRequestCard.tsx:49-61`, `src/components/RefreshStatus.tsx:38-43`, `prototype/prototype.html:383-417,798-815`
- Visual validation: 单独启动 app 与 prototype 服务，例如 `app=http://localhost:3000`、`prototype=http://localhost:3001/prototype.html`；使用 agent-browser CLI 与 Chrome DevTools MCP 在相同视口截图对比。Source: `package.json:7`, `prototype/prototype.html:1-889`
- Screenshot viewports: 使用常见桌面分辨率，例如 `1440x1200`，每轮在 app 与 prototype 上使用相同视口截图。Source: `prototype/prototype.html:383-417,417-702`
- Visual validation rounds: 进行三轮视觉验证；每轮都先截图对比，再用组件源码和 DevTools computed styles 复核差异。Source: `prototype/prototype.html:8-35,104-166,168-244,232-341`
- Visual pass criteria: 同视口截图中 header 结构、控件形态、列顺序、卡片信息密度、浅色 token、圆角、边框、阴影与原型一致；如截图差异有争议，用 DevTools 检查背景、accent、border、radius、列宽断点。Source: `prototype/prototype.html:8-35,104-166,168-244,232-341,355-378`
- Standard checks: `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。Source: `package.json:7-11`

### Pseudocode
Flow:
  1. KanbanPage 初始化 filter=all、refreshMinutes=30、board/error/loading 状态。
  2. fetch `/api/kanban`，将返回 columns 映射为 prototype 列视觉配置。
  3. Header 渲染 repo 名、贡献者 segmented control、刷新 segmented control、刷新时间、刷新按钮。
  4. Board 渲染 5 列，列头显示 dot、title、count。
  5. Card 渲染 number、author login、internal/external badge、title、detailStatus、activityAt 相对时间。
  6. 筛选按钮更新 visible columns；刷新按钮触发 fetch；定时器按 refreshMinutes 轮询。
  7. 异常态显示错误信息；常态保持原型视觉结构。

### File Structure
- `app/globals.css` - 原型视觉 token、浅色全局背景、字体基线。
- `src/components/KanbanPage.tsx` - 页面状态、请求、header + board 组合。
- `src/components/FilterControls.tsx` - 可删除或重构为 header 内部控件。
- `src/components/RefreshStatus.tsx` - 可删除或收敛为异常态错误组件。
- `src/components/KanbanBoard.tsx` - 原型 5 列布局。
- `src/components/PullRequestCard.tsx` - 原型卡片结构。
- `app/page.test.tsx` - UI 行为、功能裁剪、异常态测试。

### Interfaces / APIs
- `/api/kanban` 响应契约保持 `KanbanResponse`：`refreshedAt`、`columns`、可选 `rateLimit`。Source: `src/kanban/types.ts:28-32`, `app/api/kanban/handler.ts:19-34`
- `PullRequestCard` 数据契约保持 `number/title/url/author/detailStatus/activityAt/updatedAt/column`；UI 使用其中 `number/title/url/author/detailStatus/activityAt`。Source: `src/kanban/types.ts:11-20`, `prototype/prototype.html:798-815`
- 前端列视觉配置新增本地映射：`A -> col-draft`、`B -> col-blocked`、`C -> col-changes`、`D -> col-progress`、`E -> col-ready`。Source: `src/kanban/types.ts:1-7`, `prototype/prototype.html:736-742`

### Edge Cases
- 空列显示「暂无 PR」。Source: `prototype/prototype.html:818`
- 初次加载期间保持布局稳定，列区域可显示加载文案或空列占位，避免跳动。Source: `src/components/KanbanBoard.tsx:35-38`, `prototype/prototype.html:818`
- API 失败时显示明确错误，满足开发期失败可见要求。Source: `src/components/RefreshStatus.tsx:47-69`, `app/api/kanban/handler.ts:35-48`
- 窄屏始终保留 5 列横向滚动，header controls 根据原型断点换行或横向滚动。Source: `prototype/prototype.html:355-378`

## Plan

- [ ] Step 1: 全局视觉 token 与页面外壳
  - [ ] Substep 1.1 Implement: 将 `app/globals.css` 改为原型浅色背景、字体、token 基线。
  - [ ] Substep 1.2 Implement: 将 `KanbanPage` 页面外壳改为 sticky header + board，删除 hero/统计模块。
  - [ ] Substep 1.3 Verify: 更新并运行覆盖页面外壳与功能裁剪的 UI 测试。
- [ ] Step 2: Header 控件视觉还原
  - [ ] Substep 2.1 Implement: 将贡献者筛选改为原型 segmented control。
  - [ ] Substep 2.2 Implement: 将刷新间隔改为 `15m/30m/60m` segmented control，并设置默认 `30m`。
  - [ ] Substep 2.3 Implement: 将刷新时间与手动刷新按钮放入 header，错误态保留清晰反馈。
  - [ ] Substep 2.4 Verify: 测试筛选、刷新间隔、手动刷新、错误态。
- [ ] Step 3: Board 与 Card 视觉还原
  - [ ] Substep 3.1 Implement: 重写 `KanbanBoard` 为原型 5 列浅色布局、dot、title、count、横向滚动断点。
  - [ ] Substep 3.2 Implement: 重写 `PullRequestCard` 为原型字段和状态徽标，裁掉更新时间、本次刷新等字段。
  - [ ] Substep 3.3 Implement: 增加 `A-E` 到原型列 class/status style 的前端映射。
  - [ ] Substep 3.4 Verify: 测试列顺序、列计数、卡片字段、空列文案、功能裁剪。
- [ ] Step 4: 截图验证与最终稳定
  - [ ] Substep 4.1 Implement: 记录本地验证命令，分别启动 app 服务和 prototype 静态服务。
  - [ ] Substep 4.2 Verify: 使用 agent-browser CLI 与 Chrome DevTools MCP 在常见桌面分辨率截图对比。
  - [ ] Substep 4.3 Verify: 执行验证-修复-验证循环；截图对比发现差异后立即修复，再重新截图验证，直到本轮验证通过。
  - [ ] Substep 4.4 Verify: 使用组件源码和 DevTools computed styles 复核截图差异。
  - [ ] Substep 4.5 Verify: 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- [ ] Step 5: 第二轮截图验证与视觉修正
  - [ ] Substep 5.1 Implement: 记录本地验证命令，分别启动 app 服务和 prototype 静态服务。
  - [ ] Substep 5.2 Verify: 使用 agent-browser CLI 与 Chrome DevTools MCP 在常见桌面分辨率截图对比。
  - [ ] Substep 5.3 Verify: 执行验证-修复-验证循环；截图对比发现差异后立即修复，再重新截图验证，直到本轮验证通过。
  - [ ] Substep 5.4 Verify: 使用组件源码和 DevTools computed styles 复核截图差异。
  - [ ] Substep 5.5 Verify: 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- [ ] Step 6: 第三轮截图验证与最终收敛
  - [ ] Substep 6.1 Implement: 记录本地验证命令，分别启动 app 服务和 prototype 静态服务。
  - [ ] Substep 6.2 Verify: 使用 agent-browser CLI 与 Chrome DevTools MCP 在常见桌面分辨率截图对比。
  - [ ] Substep 6.3 Verify: 执行验证-修复-验证循环；截图对比发现差异后立即修复，再重新截图验证，直到本轮验证通过。
  - [ ] Substep 6.4 Verify: 使用组件源码和 DevTools computed styles 复核截图差异。
  - [ ] Substep 6.5 Verify: 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。

## Notes

<!-- Optional sections — add what's relevant. -->

### Implementation

<!-- Files created/modified, decisions made during coding, deviations from design -->

### Verification

<!-- How the feature was verified: tests written, manual testing steps, results -->
