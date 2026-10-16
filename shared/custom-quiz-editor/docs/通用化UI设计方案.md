# 内容编辑器（原「练习编辑器」）· 通用化 UI 设计方案

> 范围：对 `shared/custom-quiz-editor/index.html` 做**通用性重构**——移除全部课程业务专属的视觉元素、名词与交互规则，改造为可被任意业务模块复用的通用结构化内容编辑器。
> 原则：**核心功能不减少**，只做「视觉中性化 + 结构可配置化 + 交互标准化 + 文案可注入」。

| 项目 | 内容 |
| --- | --- |
| 组件 | 内容编辑器（单文件离线 HTML，零依赖） |
| 组件根路径 | `shared/custom-quiz-editor/index.html`（路径保持不变，避免打断构建复制与单课入口） |
| 文档版本 | v1.1 |
| 状态 | 设计定稿 + 已按本方案重构代码 |
| 关联文档 | 《自定义练习题内容编辑器 · UI 优化方案（视觉与交互）》（同目录，记录美化/引导/交互细化的改造过程与理由） |

---

## 1. 重构目标与原则

### 1.1 目标

| # | 目标 | 判定标准 |
| --- | --- | --- |
| 1 | 视觉无业务属性 | 不含地理/宇宙/课程语义的配色、图标、装饰；默认外观为中性设计系统 |
| 2 | 结构可配置 | 面板显隐、预览位置、密度、题/条目类型、结构抽取规则均可配置，无需改组件代码 |
| 3 | 交互标准化 | 统一为「悬浮 / 焦点 / 按下 / 禁用 / 载入 / 空态」六态标准模式；无课程专属交互 |
| 4 | 功能完整 | 原有全部能力（结构加载、分组树、逐组编辑、增删改排序、导入导出、就近保存、校验、实时预览、草稿）逐一保留 |
| 5 | 可直接复用 | 业务名词、字段标签、数据文件名、全局变量名、抽取选择器**全部外置为配置**，组件本体不含任何业务词汇 |

### 1.2 设计原则

1. **语义与呈现分离**：数据契约（`modules` / `postLesson` / `questions`）保持不变，呈现层的**名词、颜色、布局**全部可由配置覆盖。
2. **中性优先**：默认主题不使用任何具象业务色（原金色 / 青色 / 深空蓝全部移除），改用中性灰阶 + 单一可主题化强调色。
3. **结构即配置**：布局不做「写死的三栏」，而由配置声明式的面板定义驱动。
4. **向后可读**：未知配置项忽略、缺失项走默认值；旧数据文件结构继续可读可写。

### 1.3 明确不做

- 不改数据契约（`practice-data.js` 的字段结构、`lesson-manifest.js` 的 schema）；
- 不改组件目录名与构建链路（`scripts/build.mjs` 复制路径、`vite.config.ts` dev 中间件、单课 `<a>` 入口）；
- 不引入任何前端框架或第三方库（保持「零依赖单文件」这一核心分发形态）；
- 不做数据统计、协同、账号等超出编辑器本身的能力。

---

## 2. 现状业务绑定审计

对原 `index.html`（v 旧版）逐项审计，共 4 类 19 项业务绑定，处理方式如下。

### 2.1 视觉绑定（配色 / 装饰 / 图标）

| # | 原实现 | 绑定性质 | 处理 |
| --- | --- | --- | --- |
| V1 | `--bg:#0b1026` `--panel:#121a38` 深空蓝底 | 课程宇宙主题色 | 换为中性灰阶令牌 `--ce-bg / --ce-surface`，深浅双主题 |
| V2 | `--gold:#ffd54f` 用于重点/正确答案/序号 | 课程主色 | 换为 `--ce-accent`（中性强调色）+ `--ce-warning`（提示态） |
| V3 | `--cyan:#4fc3f7` 用于材料块、链接、导出摘要 | 课程辅助色 | 换为 `--ce-accent-soft` 底 + `--ce-accent` 边/文字 |
| V4 | 圆形金色序号徽标 `.pno` / `.no`（`border-radius:50%` + 金色底） | 专属装饰 | 换为中性的**方形序号片**（`ce-index`，等宽数字 + 中性底） |
| V5 | 预览区标题金色左侧竖条 `.sec__title{border-left:3px solid gold}` | 专属装饰 | 移除竖条，改用中性字重与字号建立层级 |
| V6 | 虚线题卡 `.q{border:1px dashed}` | 专属装饰 | 换为实线浅边 + 微阴影的标准卡片（`ce-card`） |
| V7 | 材料块青色左条 `.material{border-left:3px solid cyan}` | 专属装饰 | 换为中性「引用块」样式（`ce-callout`，柔和底色，无彩色竖条） |
| V8 | 深色代码底 `#060b1e`、`backdrop-filter: blur` 顶栏 | 主题化外观 | 换为 `--ce-code-bg` 令牌 + 实色顶栏（去除毛玻璃，减少平台差异） |
| V9 | 全站深色单主题 | 课程视觉语言 | 改为 **浅 / 深 / 跟随系统** 三档，默认跟随系统，用户可切换并记忆 |

### 2.2 文案绑定（业务名词）

| # | 原文案 | 绑定性质 | 通用化文案（默认值，可配置） |
| --- | --- | --- | --- |
| T1 | 练习编辑器 | 业务 | 内容编辑器 |
| T2 | 模块 / 模块树 | 课程 | 分组 / 分组导航 |
| T3 | 课后练习 | 课程 | 附加分区（auxiliary） |
| T4 | 分节 | 课程 | 分区（section） |
| T5 | 题目 | 课程 | 条目（item） |
| T6 | 选择题 / 综合题 | 课程题型 | 可选项型 / 文本型 |
| T7 | 单选题 / 多选题 | 课程题型 | 单选 / 多选 |
| T8 | 题干 / 选项 / 正确答案 / 解析 / 知识归纳 / 参考答案 / 评分标准 / 设问 / 来源 / 材料 / 引导语 | 课程字段 | 正文 / 候选项 / 选定项 / 说明 / 补充说明 / 参考内容 / 评价要点 / 问题 / 来源 / 背景 / 分组说明（全部可由 `labels.fields` 覆盖） |
| T9 | 载入课程结构 / 课程结构清单 | 课程 | 导入结构文件 / 结构清单 |
| T10 | 孤儿模块 / 未编辑（将回退内置题目） | 课程 | 游离分组 / 未填写 |
| T11 | lesson-manifest.js / practice-data.js / `__LESSON_MANIFEST__` / `__PRACTICE_DATA__` | 课程契约名 | 全部上移至 `source` 配置，默认值保持历史兼容 |

> 说明：字段名（`stem` / `analysis` / `criteria` …）属**数据契约**而非 UI 文案，保持不变；仅其**界面标签**可配置。

### 2.3 交互绑定

| # | 原实现 | 绑定性质 | 处理 |
| --- | --- | --- | --- |
| I1 | 左侧栏「拖入课程 index.html」解析结构 | 课程专属回退 | 泛化为「结构文件投放区」，投放区可开关（`layout.acceptStructureDrop`），接受的扩展名可配置 |
| I2 | 结构抽取写死 `section.section` / `.practice-btn[data-practice]` / `data-practice-kind` | 课程专属选择器 | 全部移入 `source.extract` 配置 |
| I3 | 题型切换单选→多选时自动把数组答案折叠为首项 | 课程业务规则 | 保留（属数据一致性守卫，非视觉/交互风格） |
| I4 | `kind:'drag'` 特殊题型过滤 | 课程专属题型 | 泛化为 `schema.hiddenStructureKinds`，默认过滤非通用类型 |
| I5 | 原生 `confirm()` 删除确认、`prompt()` 表格行列输入 | 非统一模式 | 换为组件内**统一轻量对话框**（`ce-dialog`），支持键盘 Esc 关闭、焦点回收 |
| I6 | 无统一焦点态（仅 `border` 变色、无 `:focus-visible` 环） | 无障碍缺口 | 全量补齐 `:focus-visible` 焦点环、`aria-*`、`role` |
| I7 | 状态反馈仅 toast，无 `aria-live` | 无障碍缺口 | 状态条与 toast 均带 `role="status"` `aria-live="polite"` |
| I8 | 顶栏按钮平铺 6 个操作，无分组/无优先级 | 信息层级不清 | 分为「主操作（保存/导出）」与「次操作（导入/校验/复制）」，按配置渲染 |

### 2.4 结构绑定

| # | 原实现 | 处理 |
| --- | --- | --- |
| S1 | 固定三栏 `232px + 1fr + 1fr` | 换为配置驱动的面板系统（`layout.nav / layout.preview` + `previewPlacement`） |
| S2 | 预览区始终占一栏 | 支持**侧栏 / 底部 / 隐藏**三态，侧栏可折叠 |

---

## 3. 通用设计令牌

令牌前缀 `--ce-`（content editor），作用域挂在 `.ce-app`，支持整体换肤。
所有取值均为中性、无业务语义的颜色与尺度。

### 3.1 颜色令牌

> 强调色选用中性靛紫（而非 SaaS 品类默认蓝），理由见《UI 优化方案》§2.1。

| 令牌 | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--ce-bg` | `#f4f5f8` | `#131418` | 应用底色 |
| `--ce-surface` | `#ffffff` | `#1b1d23` | 卡片 / 顶栏底 |
| `--ce-surface-2` | `#f1f2f6` | `#212329` | 次级面板（导航栏）/ 引用块 |
| `--ce-surface-3` | `#e7e9ef` | `#2a2d34` | 输入框 / 标签 / 表头底 |
| `--ce-surface-sunken` | `#eef0f4` | `#17191e` | 下沉容器 |
| `--ce-border` | `#e3e6ed` | `#2c2f37` | 常规描边 |
| `--ce-border-strong` | `#ccd2dc` | `#3d414b` | 强调描边 / 悬浮态 |
| `--ce-text` | `#17181c` | `#eceef2` | 主文本 |
| `--ce-text-muted` | `#5b6270` | `#a6acb8` | 次文本 / 标签 |
| `--ce-text-subtle` | `#8b919d` | `#7c8290` | 辅助文本 / 占位 |
| `--ce-accent` | `#5b5bd6` | `#9b9bf5` | 强调（选中、主按钮、链接） |
| `--ce-accent-hover` | `#4f4fc7` | `#adadf9` | 强调悬浮 |
| `--ce-accent-active` | `#4646b5` | `#bcbcfa` | 强调按下 |
| `--ce-accent-soft` | `rgba(91,91,214,.09)` | `rgba(155,155,245,.15)` | 强调弱底 |
| `--ce-accent-border` | `rgba(91,91,214,.38)` | `rgba(155,155,245,.42)` | 强调描边 |
| `--ce-on-accent` | `#ffffff` | `#16171d` | 强调底上的文字 |
| `--ce-on-solid` | `#ffffff` | `#0f1116` | 状态实底（toast / 徽标）上的文字 |
| `--ce-success` / `--ce-success-soft` | `#157f4a` / `rgba(21,127,74,.11)` | `#4ade80` / `rgba(74,222,128,.15)` | 通过 / 校验成功 |
| `--ce-warning` / `--ce-warning-soft` | `#a15c00` / `rgba(161,92,0,.11)` | `#fbbf24` / `rgba(251,191,36,.15)` | 待完善提示 |
| `--ce-danger` / `--ce-danger-soft` | `#d92d20` / `rgba(217,45,32,.09)` | `#f87171` / `rgba(248,113,113,.15)` | 删除 / 错误 |
| `--ce-code-bg` | `#f5f6f9` | `#101216` | 代码 / 输出文本域底 |
| `--ce-ring` | `rgba(91,91,214,.30)` | `rgba(155,155,245,.32)` | 焦点环 |
| `--ce-overlay` | `rgba(20,22,28,.45)` | `rgba(4,5,8,.62)` | 遮罩 |

### 3.2 尺度令牌

| 类别 | 令牌 | 值 |
| --- | --- | --- |
| 间距 | `--ce-space-1…8` | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 px |
| 圆角 | `--ce-radius-sm / md / lg / full` | 6 / 9 / 14 / 999px |
| 字号 | `--ce-fs-2xs / xs / sm / md / lg / xl / 2xl` | 11 / 12 / 13 / 14 / 15 / 18 / 22 px |
| 行高 / 字距 | `--ce-lh-tight` / `--ce-lh-base` / `--ce-tracking` | 1.3 / 1.6 / .06em |
| 阴影 | `--ce-shadow-xs / sm / md` | `0 1px 2px rgba(18,22,33,.05)` / 卡片级 / 浮层级 |
| 动效 | `--ce-dur-fast / base`、`--ce-ease` | 120ms / 200ms / `cubic-bezier(.4,0,.2,1)` |
| 尺寸 | `--ce-control-h` / `--ce-control-h-sm` / `--ce-hit` | 38 / 30 / 40 px |
| 内边距 | `--ce-panel-pad` / `--ce-card-pad` / `--ce-row-gap` / `--ce-nav-w` | 24 / 20 / 14 / 264 px |
| 字体 | `--ce-font` / `--ce-font-mono` | 系统中英文字体栈 / 等宽栈 |

### 3.3 密度（`density` 配置）

| 令牌 | `comfortable`（默认） | `compact` |
| --- | --- | --- |
| 控件高度 | 38px（次要控件 30px） | 32px（次要控件 28px） |
| 命中区域 | 40px | 34px |
| 卡片内边距 | 20px | 16px |
| 字段行间距 | 14px | 10px |
| 面板内边距 | 24px | 16px |
| 导航宽度 | 264px | 232px |

触屏补充：`@media (pointer: coarse)` 下控件高度提升至 44px、命中区域 46px。
实现方式：`data-density="comfortable|compact"` 切换令牌值，组件样式只引用令牌。

### 3.4 主题

- `data-theme="light|dark"` 切换令牌块；`theme:"auto"` 时跟随 `prefers-color-scheme`；
- 用户手动切换后写入 `localStorage`（键名由 `source.draftKey` 派生），下次打开优先用户选择；
- 主题切换按钮提供 `title` 与 `aria-label`；
- 状态实底文字按主题取反（`--ce-on-solid`），保证深色主题下 toast / 徽标可读。

---

## 4. 命名与类名规范

| 规则 | 说明 |
| --- | --- |
| 前缀 | 统一 `ce-`（content editor），避免嵌入宿主页面时样式冲突 |
| 结构 | BEM 风格：`ce-block__element--modifier`，如 `ce-nav__item--active` |
| 状态类 | 统一使用 `is-*`：`is-active` / `is-hover` / `is-disabled` / `is-dragover` / `is-loading` / `is-collapsed` |
| 数据钩子 | 行为绑定一律用 `data-*`（`data-act` / `data-select` / `data-path`），样式不依赖 `data-*` |
| 令牌 | 全部 `--ce-*`，禁止组件样式直接写十六进制颜色（示例代码与降级除外） |

---

## 5. 组件清单与变体

### 5.1 按钮 `ce-btn`

| 变体 | 类名 | 用途 | 视觉 |
| --- | --- | --- | --- |
| 主操作 | `ce-btn--primary` | 保存 / 导出 | 强调实底 + `--ce-on-accent` 文字 |
| 次操作 | `ce-btn`（默认） | 常规动作 | 中性描边 + 悬浮浅底 |
| 幽灵 | `ce-btn--ghost` | 工具条 / 内联动作 | 无描边，悬浮显示浅底 |
| 危险 | `ce-btn--danger` | 删除 | 危险色描边/文字，悬浮危险弱底 |
| 尺寸 | `ce-btn--sm` | 卡片内 / 顶栏动作 | 高 30px，字号 12px |
| 图标 | `ce-iconbtn` / `--plain` | 工具条图标动作 | 命中区 40×40；`--plain` 无底无边 |

统一六态：默认 / 悬浮 / 焦点（`--ce-ring` 环）/ 按下（`translateY(1px)`）/ 禁用（`opacity:.5` + `cursor:not-allowed`）/ **载入**（`is-loading`：文字透明 + 居中旋转环，`aria-busy="true"`）。

### 5.2 表单控件

| 组件 | 类名 | 变体 / 说明 |
| --- | --- | --- |
| 文本框 | `ce-input` | 常规 / 占位 / 只读 |
| 多行文本 | `ce-textarea` | 垂直可调；附工具条（插入图片 / 插入表格，可配置关闭） |
| 下拉选择 | `ce-select` | 原生 select 中性样式 |
| 单选/多选组 | `ce-choicegroup` + `ce-choice` | 用于答案选择，横向自动换行 |
| 分段控件 | `ce-segment` + `ce-segment__btn` | 面板显隐切换；`aria-pressed` 表达选中 |
| 字段容器 | `ce-field` + `ce-field__label` | 标签在上、控件在下，标签行可带 `ce-field__hint` 说明 |
| 计数徽标 | `ce-badge` | 按钮内计数（如校验问题数），0 时隐藏 |

### 5.3 卡片与容器

| 组件 | 类名 | 说明 |
| --- | --- | --- |
| 区块卡 | `ce-card` | 编辑区一级分组；`ce-card__head` 可选标题与动作 |
| 条目卡 | `ce-card ce-card--item` | 单条内容；头部含序号片、类型标签、排序/复制/删除动作 |
| 面板 | `ce-panel` | 三大区域容器；`ce-panel__head` 固定头 |
| 引用块 | `ce-callout` | 背景/材料等引用型长文本；柔和中性底，无彩色竖条 |
| 就地引导卡 | `ce-hintcard` | 分组为空时的下一步引导（虚线卡 + 说明 + 紧随的新增按钮行） |
| 空态 | `ce-empty` | 图标 + 标题 + 说明 + 分步列表（`ce-empty__steps`）+ 主次动作 |
| 分节标题 | `ce-subhead` | 卡片内分节（如「分组设置 / 条目」），带上分隔线与计数 |
| 抽屉 | `ce-drawer` | 折叠区（输出预览等），`<details>` 语义 |

### 5.4 导航（分组列表）`ce-nav`

| 元素 | 类名 | 说明 |
| --- | --- | --- |
| 列表项 | `ce-nav__item` | 整行按钮；含 `ce-index` 序号片 + 标题 + `ce-nav__meta` 计数 |
| 态 | `--active` / `--dim`（游离分组） / `is-empty`（计数为 0，文字用 `--ce-text-subtle`） |
| 索引片 | `ce-index` | 中性方形，等宽数字；替代原金色圆形徽标 |
| 投放态 | `.ce-nav.is-dragover` | 结构文件拖入时显示虚线强调边 |

### 5.5 标签与状态

| 组件 | 类名 | 变体 |
| --- | --- | --- |
| 标签 | `ce-tag` | 默认中性 / `--info` / `--ok` / `--warn` / `--danger` |
| 状态条 | `ce-status` | 内联于工具条，`role="status"`；`--ok` / `--warn` / `--error`；可含内联 `ce-linkbtn` 定位 |
| 吐司 | `ce-toast` | 底部居中；`--ok` / `--warn` / `--error`；2.6s 自动消失，带位移入场 |
| 对话框 | `ce-dialog` | 轻量模态：标题 + 内容 + 取消/确认；Esc / 遮罩关闭、焦点回收与 Tab 循环 |
| 下拉菜单 | `ce-menu` + `ce-menu__item` | 收纳次要动作；`aria-haspopup` / `aria-expanded`；点击项或按 Esc 关闭 |

### 5.6 引导（上手步骤）`ce-guide`

| 元素 | 类名 | 说明 |
| --- | --- | --- |
| 引导条 | `ce-guide` | 顶栏下方横条，强调弱底；未完成且未关闭时显示 |
| 步骤 | `ce-guide__step` | `is-current`（当前）/ `is-done`（已完成，绿色 ✓）；步骤间 `ce-guide__sep` |
| 步骤号 | `ce-guide__dot` | 未开始灰底数字 / 当前强调实底 / 完成成功弱底 |
| 情境按钮 | 复用 `ce-btn--primary` | 只显示"当下这一步该做的事" |
| 回显按钮 | `ce-iconbtn--plain` | 引导收起后在工具条提供 `?` 入口随时调回 |

### 5.7 预览渲染块

| 块 | 类名 | 视觉（中性化后） |
| --- | --- | --- |
| 预览标题 | `ce-preview__title` | 字号 + 字重建立层级（**移除**金色左竖条） |
| 条目 | `ce-preview__item` | 实线浅边白底卡（**移除**虚线） |
| 材料/背景 | `ce-callout` | 中性柔和底（**移除**青色竖条） |
| 选项 | `ce-preview__option` | 常规底；`--correct` 用 `--ce-success-soft` + 成功边 |
| 答案块 | `ce-answer` | 中性弱底 + `--ce-accent` 小标题（**移除**金色块） |
| 表格 | `ce-preview table` | 中性表头底 `--ce-surface-3` |
| 图片 | `ce-preview img` | 圆角 + 中性描边 |
| 代码 | `ce-preview code` | `--ce-code-bg` |

---

## 6. 布局与可配置能力

### 6.1 结构

```
┌─ ce-header ──── 组件标题 + 副标题 · 次要操作组 │ 主路径组 ────────┐
├─ ce-guide ───── 上手步骤（四步流程 + 情境按钮 + 关闭）──────────┤
├─ ce-toolbar ─── 状态条 · 引导回显 · 面板显隐分段 · 主题切换 ────┤
├─ ce-shell ──────────────────────────────────────────────────┤
│  [ce-panel--nav]  [ce-panel--editor]  [ce-panel--preview]   │
└─────────────────────────────────────────────────────────────┘
```

- `ce-shell` 为弹性容器（`display:flex; flex-wrap:wrap`），导航宽度由 `--ce-nav-w` 驱动，编辑与预览各有 `flex:1 1 460px` 基准；
- 面板隐藏通过 `data-nav="off"` / `data-preview="off"` 声明（`display:none`），弹性容器自动收拢，无需改写栅格模板；
- `previewPlacement:"side"` → 编辑与预览并排；`"bottom"` → 预览 `flex-basis:100%` 整行置底；
- 窄屏时弹性容器自然换行，等价于 `"bottom"`，与配置互不冲突。

### 6.2 配置项总表

配置对象 `window.__CONTENT_EDITOR_CONFIG__`（可选，深度合并到内置默认值）。

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `theme` | `'auto'\|'light'\|'dark'` | `auto` | 初始主题 |
| `density` | `'comfortable'\|'compact'` | `comfortable` | 密度 |
| `layout.nav` | boolean | `true` | 显示分组导航 |
| `layout.preview` | boolean | `true` | 显示预览 |
| `layout.previewPlacement` | `'side'\|'bottom'` | `side` | 预览位置 |
| `layout.previewCollapsible` | boolean | `false` | 预览是否可折叠 |
| `layout.allowPanelToggle` | boolean | `true` | 是否允许用户切换面板显隐 |
| `layout.acceptStructureDrop` | boolean | `true` | 是否接受结构文件拖放 |
| `layout.guide` | boolean | `true` | 是否启用「上手步骤」引导条 |
| `labels.*` | string | 见 §2.2 | 全部界面文案（含 `labels.fields.*` / `labels.kinds.*` / `labels.guide.*` / `labels.placeholders.*` / `labels.sectionTitles.*` / `labels.hintCard.*`） |
| `schema.itemKinds` | string[] | `['choice','essay']` | 可新增的条目类型与顺序 |
| `schema.hiddenStructureKinds` | string[] | `['drag']` | 结构清单中出现即跳过的类型 |
| `source.*` | object | 见 §6.3 | 数据/结构文件与全局变量名、草稿键、导出名 |
| `source.extract.*` | object | 见 §6.3 | 结构抽取选择器 |

### 6.3 数据源配置默认值（保持历史兼容）

```js
source: {
  structureFile: 'lesson-manifest.js',
  structureGlobal: '__LESSON_MANIFEST__',
  dataFile: 'practice-data.js',
  dataGlobal: '__PRACTICE_DATA__',
  exportFile: 'practice-data.js',
  exportGlobal: '__PRACTICE_DATA__',
  draftKey: 'content-editor-draft-v1',
  acceptStructureExt: ['.html', '.htm'],
  acceptDataExt: ['.js', '.json'],
  extract: {
    section: 'section.section',
    num: '.section__tag-num',
    title: '.section__title',
    practiceBtn: '.practice-btn[data-practice]',
    practiceKeyAttr: 'data-practice',
    practiceKindAttr: 'data-practice-kind',
    navAttr: 'data-nav'
  }
}
```

> 迁移策略：默认值沿用旧契约名，因此**现有分发包无需改动即可继续工作**；换到别的业务时只改配置，不动组件代码。

---

## 7. 交互规范（统一标准模式）

| 场景 | 规范 |
| --- | --- |
| 悬浮 | 底色/描边/阴影过渡 120–200ms；不使用位移或缩放（避免视觉噪声） |
| 焦点 | 全量 `:focus-visible` 强调环（`0 0 0 3px var(--ce-ring)`）；键盘可遍历全部控件 |
| 按下 | `translateY(1px)`，仅按钮类；主按钮同时切到 `--ce-accent-active` |
| 禁用 | `opacity: .5` + `cursor: not-allowed` + 原生 `disabled` |
| 载入 | `is-loading`（文字透明 + 旋转环 + `aria-busy`），耗时操作（写盘）期间生效 |
| 选择 | 导航项 `is-active` 使用强调弱底 + 强调描边 + 左侧 3px 强调条（中性，非金色） |
| 主次分层 | 顶栏「次要操作组 ─ 分隔线 ─ 主路径组」；全组件同一时刻只有一个 primary 动作 |
| 删除确认 | 统一走 `ce-dialog`，文案含目标名称与"不可撤销"，默认焦点在「取消」 |
| 校验反馈 | 结构化问题 → 状态条计数 + 内联定位链接 + 字段 `is-invalid` 高亮 + 按钮徽标 |
| 输入反馈 | `input` 事件写状态 → 防抖落草稿 → 只更新导航计数/预览/校验/引导，**不重建编辑区**（不丢焦点） |
| 提示 | 轻量结果用 toast；结构性问题用状态条；阻断性确认用对话框 |
| 菜单 | `ce-menu` 点击外部或 Esc 关闭；选中项后自动收起 |
| 键盘 | `Esc` 优先关菜单、再关对话框；对话框内 `Tab` 循环；`Tab` 顺序 = 视觉顺序 |
| 无障碍 | 状态区 `role="status"` `aria-live="polite"`；对话框 `role="dialog"` `aria-modal="true"`；装饰性图形 `aria-hidden="true"`；纯图标按钮补 `aria-label` |

---

## 8. 适配规则

| 断点 | 布局 |
| --- | --- |
| ≥ 1280px | 三栏并排（导航 264px / 编辑弹性 / 预览弹性） |
| 1024–1279px | 导航收窄至 216px，预览仍并排（不足以并排时自动换行） |
| 768–1023px | 预览自动下沉为整行（等同 `previewPlacement:"bottom"`） |
| < 768px | 单列堆叠：导航 → 编辑 → 预览；导航转为横向可滚列表；选项网格转单列；面板内边距降到 16px |
| 触屏 | `pointer: coarse` 下控件高度 44px、图标命中区 46px |
| 打印 | 隐藏 header / toolbar / guide / nav / editor，仅保留预览区 |

- 选项网格：≥ 768px 两列，< 768px 单列；
- 密度、主题、面板显隐、引导开关四者互不影响，可任意组合；
- 遵循 `prefers-reduced-motion`，动效降级为 0ms。

---

## 9. 使用说明

### 9.1 基本接入

1. 直接双击打开 `index.html`（离线、零依赖）；
2. 组件默认读取同级 `lesson-manifest.js` 与 `practice-data.js`（可通过 `source` 覆盖）；
3. 结构缺失时点「导入结构文件」选择 HTML，或把文件拖入分组导航区（可配置关闭）。

### 9.2 定制为具体业务（示例：题库预设）

在组件脚本**之前**注入配置即可，无需改动组件代码：

```html
<script>
  window.__CONTENT_EDITOR_CONFIG__ = {
    density: 'compact',
    labels: {
      appTitle: '练习编辑器',
      navTitle: '模块',
      auxiliaryFallback: '课后练习',
      fields: { stem: '题干', answer: '正确答案', analysis: '解析', material: '材料',
                stems: '设问', reference: '参考答案', criteria: '评分标准' },
      kinds: { choice: '选择题', essay: '综合题', single: '单选题', multiple: '多选题' }
    }
  };
</script>
```

### 9.3 定制为另一套业务（示例：通用文案/页面片段管理）

```html
<script>
  window.__CONTENT_EDITOR_CONFIG__ = {
    labels: {
      appTitle: '内容片段管理',
      navTitle: '页面', auxiliaryFallback: '全局片段',
      itemCount: '{n} 段',
      fields: { stem: '正文', material: '背景说明', notes: '备注' },
      kinds: { choice: '可选项型', essay: '自由文本型' }
    },
    schema: { itemKinds: ['essay', 'choice'] },
    layout: { previewPlacement: 'bottom' },
    source: { structureFile: 'pages-manifest.js', structureGlobal: '__PAGES__',
              dataFile: 'fragments.js', dataGlobal: '__FRAGMENTS__',
              exportFile: 'fragments.js', exportGlobal: '__FRAGMENTS__' }
  };
</script>
```

### 9.4 换肤

只需在 `.ce-app` 作用域覆盖 §3 的任意 `--ce-*` 令牌即可，例如：

```css
.ce-app { --ce-accent: #0f766e; --ce-radius-md: 10px; }
```

---

## 10. 迁移对照表（旧 → 新）

| 旧 | 新 | 备注 |
| --- | --- | --- |
| `--bg / --panel / --panel-2 / --line` | `--ce-bg / --ce-surface / --ce-surface-2 / --ce-border` | 令牌改名 |
| `--gold / --cyan / --blue` | `--ce-accent`（+ `--ce-warning` / `--ce-accent-soft`） | 业务色收敛为单一中性强调色 |
| `.btn / .btn--primary / .btn--ghost / .btn--danger / .btn--sm` | `.ce-btn`（同后缀变体） | 前缀化 |
| `.sec / .sec__head / .subhead` | `.ce-card / .ce-card__head / .ce-subhead` | 命名中性化 |
| `.q / .q__head / .q__badge` | `.ce-card--item / .ce-card__head / .ce-tag` | 命名中性化 + 去虚线 |
| `.tree__item / .tree__no / .tree__meta` | `.ce-nav__item / .ce-index / .ce-nav__meta` | 去圆形金徽标 |
| `.pno / .no`（圆形金色序号） | `.ce-index`（方形中性序号） | 去专属装饰 |
| `.preview .sec__title`（金色左竖条） | `.ce-preview__title` | 去专属装饰 |
| `.material`（青色左竖条） | `.ce-callout` | 去专属装饰 |
| `.preview .answer`（金色块） | `.ce-answer`（中性弱底） | 去专属装饰 |
| `confirm()` / `prompt()` | `ce-dialog` | 交互标准化 |
| 固定三栏 | 配置驱动面板 | 结构可配置 |
| 深色单主题 | 浅/深/跟随系统 | 主题可配置 |

---

## 11. 交付自检清单

- [x] 组件样式不含任何课程业务色（金/青/深空蓝已全部移除）与装饰（圆形金徽标、彩色左竖条、虚线卡）
- [x] 组件界面文案不含课程业务名词（默认中性；可由 `labels` 覆盖为任意业务词）
- [x] 数据文件名、全局变量名、结构抽取选择器全部外置为配置
- [x] 面板显隐、预览位置、密度、主题、引导开关均可配置，且互不干扰
- [x] 组件样式内**零硬编码颜色**，全部走 `--ce-*` 令牌（校验：hardcoded color decls = 0）
- [x] 全部控件具备 hover / focus-visible / active / disabled / loading 五态
- [x] 主要可交互元素命中区域 ≥ 40px；触屏（`pointer:coarse`）提升至 ≥ 44px
- [x] 状态区与 toast 具备 `aria-live`；对话框 Esc/遮罩关闭、焦点回收与 `Tab` 循环
- [x] 首次打开有上手步骤引导（四步 + 情境按钮），空态/空分组/字段三层引导齐备
- [x] 校验问题可定位到字段并高亮，顶栏徽标同步计数
- [x] 深色主题下状态实底文字对比可读（`--ce-on-solid` 按主题取反）
- [x] 响应式覆盖 375 / 768 / 1024 / 1280 / 1440px
- [x] `prefers-reduced-motion` 已降级
- [x] 核心功能零缺失：结构加载、分组导航、增删改排序、导入导出、就近保存、校验、实时预览、草稿
- [x] 保持单文件零依赖、路径不变，构建复制与单课入口无需改动
- [x] jsdom 无头回归 56/56 通过（含引导、菜单、焦点陷阱、校验定位、配置注入、空态四场景）
