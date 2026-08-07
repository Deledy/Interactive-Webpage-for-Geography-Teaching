# 教学互动网页开发工作流

将初高中地理课程内容转化为可运行的 HTML 教学网页的工程化工作流仓库。

## 三层体系

```
教学互动网页开发工作流/
├── AGENTS.md              # 总工作流规则（供 IDE / Agent 工具自动加载）
├── agents/                # Agent 工作流目录（提示词 / 模板 / 任务输入 / 产出）
│   ├── current_task.md    # 当前任务输入模板
│   ├── prompts/           # 5 个角色提示词
│   ├── templates/         # 交接与开发模板
│   └── output/            # 工作流分析输出（如架构分析报告）
├── scripts/               # 工程脚本（多课构建 / 结构校验 / 部署，纯工程操作）
├── lessons/               # 单课工程目录（每课独立开发、发布）
├── books/                 # 书籍汇编目录（必修一 / 必修二，由脚本自动汇总）
└── shared/                # 共享组件、样式、工具与资源
```

## 单课工程目录规范

每个课题在 `lessons/` 下拥有一个独立目录（Vite 工程），结构统一为：

```
lessons/课题名/
├── lesson.json   # 课程元数据（册别 / 章节 / 顺序 / 入口 / 状态 / 引擎）
├── index.html    # Vite 入口（单课 HTML，样式与脚本由构建管线打包）
├── src/          # 单课源码（单一真源）
│   ├── main.ts         # 入口：按顺序初始化各功能模块
│   ├── styles/         # 样式（style.css）
│   ├── data/           # 课程数据（lessonData.ts，数据驱动）
│   ├── utils/          # 公共工具（DOM 查询等）
│   ├── modules/        # 功能模块（星点/导航/浮层/流星/层级/太阳系/行星/因果链/复习树）
│   └── types.ts        # 数据结构类型定义
├── assets/       # 单课专用资源（images / icons / fonts，构建时内联进 HTML）
├── public/       # 大资源外置（videos / models 等，构建时原样复制、不内联）
├── docs/         # 开发文档与交接材料（01~05 编号）
└── dist/         # 构建产物（vite build 生成，禁止手改）
```

第三方库（如 Three.js）通过 npm 引入（见根目录 `package.json`），不再手工维护 `libs/`。

## 书籍汇编目录规范

未来将单课汇总为整本书时使用 `books/`：

```
books/
├── 必修一/
│   ├── book.json     # 书籍元数据
│   └── chapters/     # 章节内容
└── 必修二/
    └── book.json
```

可通过读取各课 `lesson.json` 自动生成章节目录与书籍首页。

## 常用工作流

1. **开发新课时**：在 `lessons/` 下新建课题目录 → 依次完成教学设计、页面设计、技术实现、总控审查、开发文档 → 按 `agents/templates/开发模板指令.md` 交给 AI 实现 → 按新规范（`src/` 分层 + `lesson.json`）组织代码。
2. **本地开发**：根目录执行 `npm run dev`，直接打开当前课程页面（Vite 热更新）。课程目录通过环境变量 `VITE_LESSON` 指定，未指定时自动选择 `lessons/` 下唯一课程。
3. **单课构建发布**：根目录执行 `npm run build`（先 `tsc` 类型检查，再 `vite build`），产物输出到 `lessons/课题名/dist/`，部署任意静态服务器即可独立访问。
4. **多课构建**：`npm run build:all` 遍历 `lessons/` 下全部课程逐课构建；`npm run build:lesson -- --lesson=<课程目录>` 只构建指定课程。
5. **结构校验**：`npm run check` 校验课程结构（入口存在、资源清单齐全、文档齐备等）；远程资源残留等约束按宽松策略仅告警，不阻塞构建。
6. **功能测试**：根目录执行 `npm run test`（vitest + jsdom，覆盖数据完整性与各模块交互）。
7. **汇编成书**：待单课积累到一定数量后，通过脚本扫描 `lesson.json` 自动汇总。

### 分发模式

所有课程统一采用"**单文件内联 + 大资源外置**"的分发模式（参考 `三角数据图互动网页/` 项目的成功方案）：

- 构建产物：`dist/index.html` —— **JS/CSS/图片/字体全部内联**，双击即可在浏览器打开（无需服务器）。
- 视频/3D 等超大资源放入课程 `public/` 目录，构建时原样复制到 `dist/`（不内联，`<video>` 在 file:// 下可播放）。
- 构建后自动打包为 zip（`dist/<课>.zip`）；分发时整个文件夹（或解压后的 zip）一起使用。
- 注意：3D 模型（经 fetch / GLTFLoader 加载）受浏览器安全限制，file:// 下无法加载，需配一键启动器或在线部署。

## 目录规范

- 单课内容一律放在 `lessons/`，不散落根目录。
- 可复用的公共资源抽离到 `shared/`，单课专用资源留在本课 `assets/`。
- 构建产物与临时输出分别归入 `lessons/*/dist/`、`dist-book/` 与 `agents/output/`。
