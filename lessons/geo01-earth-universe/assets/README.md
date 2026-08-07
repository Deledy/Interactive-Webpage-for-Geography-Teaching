# assets/ 资源目录

本目录存放单课特有的本地静态资源，按类型分目录存放：

| 子目录 | 用途 |
| --- | --- |
| `images/` | 本地图片（示意插图、课程配图等） |
| `icons/` | 图标文件（SVG / PNG） |
| `videos/` | 教学视频 |
| `models/` | 3D 模型（GLB 等） |
| `audio/` | 音频文件 |
| `fonts/` | 本地字体文件 |

## 使用说明

1. 资源文件一律放在 `assets/` 下，不要在 `css/` 或 `js/` 中混放。
2. 文件名使用 snake_case（如 `celestial-nebula.jpg`），便于跨平台分发。
3. 页面内引用使用相对路径，例如 `assets/images/celestial-nebula.jpg`。
4. 所有资源须登记到本课 `lesson.json` 的 `resources` 数组（`path` + `type`），供 `npm run check` 校验与分发清单使用。
5. 单课 HTML/CSS/JS 一律引用本地资源，禁止远程 URL。
6. 可被多课复用的公共资源请抽离到根目录 `shared/assets/`。
7. 构建发布时，`assets/` 下的资源（图片/字体）由构建管线 base64 内联进 `index.html`（保证 file:// 双击可用）；视频/3D 等大资源请放入本课程 `public/` 目录（构建时原样复制、不内联，`<video>` 在 file:// 下可播放）。
8. 外部来源资源（非本课原创，如来自 NASA / Wikimedia 等）还须在本课 `docs/06_资源引用.md`（项目指定资源引用页面）登记作者/版权方、许可类型与来源链接；原创/示意资源无需登记。
