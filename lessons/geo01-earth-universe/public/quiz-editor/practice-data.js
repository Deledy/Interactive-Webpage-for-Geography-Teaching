/* ============================================================
 * 随堂练习 · 数据文件（教师可按学情自行编辑）
 * ------------------------------------------------------------
 * 1. 本文件构建后位于分发包的「题目编辑器」文件夹（与编辑器 html 同级），主页面与
 *    题目编辑器都从该目录加载；分发后直接替换本文件即可更新练习，无需重新构建、无需联网。
 * 2. 正式格式为 v3：modules 下只写 groups（题组），材料在题组上保存一次，
 *    题目不再重复携带 material。
 *    - group.layout：stacked 上下 / split 左右；
 *    - group.materialLayout：自由布局材料画布（文字 / 图片 / 表格对象）；
 *    - group.material：旧版 HTML 材料，仅用于兼容；两者同时存在时以 materialLayout 为准。
 * 3. 题型统一为 choice / essay：
 *    - choice：mode 为 "single" 单选（数组 answer 仅兼容旧多选数据）；
 *    - essay ：综合题，stems 设问 + referenceAnswer 参考答案。
 * 4. postLesson 为课后练习（title / subtitle / sections），sections 同样支持
 *    layout / materialLayout / material。
 * 5. 本文件由 scripts/migrate-practice.mjs 首次生成，之后请直接编辑本文件；
 *    构建不会覆盖它。用「题目编辑器」保存时只会导出 v3 groups，不会双写扁平 questions。
 * 6. 富文本字段（material / analysis / referenceAnswer 等）直接写 HTML，
 *    关键词高亮写 <mark class="cq-hl">关键词</mark>；不写 Markdown。
 *    可安全使用的标签：p br strong em u s sub sup mark code a img ul ol li
 *    table thead tbody tr th td figure figcaption h3 h4；类名仅限 cq- 前缀。
 * ============================================================ */
window.__PRACTICE_DATA__ = {
  "version": 3,
  "lesson": "geo01-earth-universe",
  "updatedAt": "2026-10-31T13:40:26.173Z",
  "modules": {
    "universe": {
      "title": "宇宙概念 · 随堂练习",
      "intro": "先想清楚<mark class=\"cq-hl\">宇宙</mark>指的是什么。",
      "groups": []
    },
    "celestial": {
      "title": "天体识别 · 随堂练习",
      "intro": "判断一个物体是不是天体，看它<mark class=\"cq-hl\">在哪里</mark>、有没有<mark class=\"cq-hl\">独立轨道</mark>。",
      "groups": []
    },
    "meteor": {
      "title": "天体判别 · 随堂练习",
      "groups": []
    },
    "hierarchy": {
      "title": "天体系统层级 · 随堂练习",
      "groups": []
    },
    "solar": {
      "title": "八大行星分类 · 随堂练习",
      "groups": []
    },
    "planets": {
      "title": "行星运动特征 · 随堂练习",
      "groups": []
    },
    "earth": {
      "title": "地球的普通性 · 随堂练习",
      "groups": []
    },
    "life": {
      "title": "地球存在生命的原因 · 随堂练习",
      "groups": []
    },
    "review": {
      "title": "复习巩固 · 随堂练习",
      "groups": []
    }
  },
  "postLesson": {
    "title": "练习",
    "subtitle": "教师可按学情增删题目：选择题与综合题，支持表格、图片、答案与解析。",
    "sections": []
  }
};
