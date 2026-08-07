# 教学互动网页开发工作流

将初高中地理课程内容转化为可运行的 HTML 教学网页的工程化工作流仓库。

## 三层体系

```
教学互动网页开发工作流/
├── AGENTS.md              # 总工作流规则
├── current_task.md        # 当前任务输入
├── prompts/               # 各角色提示词
├── templates/             # 交接与开发模板
├── workflows/             # 自动化流程（扫描 / 汇编 / 构建）
├── output/                # 各阶段产出报告
├── lessons/               # 单课工程目录（每课独立开发、发布）
├── books/                 # 书籍汇编目录（必修一 / 必修二）
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
├── assets/       # 单课专用资源（images / icons / videos / fonts）
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

1. **开发新课时**：在 `lessons/` 下新建课题目录 → 依次完成教学设计、页面设计、技术实现、总控审查、开发文档 → 按 `templates/开发模板指令.md` 交给 AI 实现 → 按新规范（`src/` 分层 + `lesson.json`）组织代码。
2. **本地开发**：根目录执行 `npm run dev`，直接打开当前课程页面（Vite 热更新）。
3. **构建发布**：根目录执行 `npm run build`（先 `tsc` 类型检查，再 `vite build`），产物输出到 `lessons/课题名/dist/`，部署任意静态服务器即可独立访问。
4. **功能测试**：根目录执行 `npm run test`（vitest + jsdom，覆盖数据完整性与各模块交互）。
5. **汇编成书**：待单课积累到一定数量后，通过 `workflows/` 中的脚本扫描 `lesson.json` 自动汇总。

## 目录规范

- 单课内容一律放在 `lessons/`，不散落根目录。
- 可复用的公共资源抽离到 `shared/`，单课专用资源留在本课 `assets/`。
- 构建产物与临时输出分别归入 `dist/` 与 `output/`。
