# workflows/ 自动化流程目录

存放可复用的自动化流程与脚本，例如：

- 扫描 `lessons/` 下所有 `lesson.json`，汇总生成章节目录
- 根据 `lesson.json` 自动汇编书籍（`books/必修一`、`books/必修二`）
- 自动把单课源码复制生成 `dist/` 发布产物
- 检查单课结构完整性（是否存在 `lesson.json`、`index.html`、`docs/` 等）

## 约定

1. 每个流程提供独立脚本或说明文档，命名清晰。
2. 流程脚本默认在仓库根目录下执行。
3. 输出文件写入 `output/` 或对应 `dist/` 目录。
