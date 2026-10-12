/* ============================================================
   地球的宇宙环境 · 集中教学数据对象 lessonData（TypeScript 版）
   迁移自 js/lesson-data.js（迁移指南：js/lesson-data.js → src/data/lessonData.ts）
   用途：集中管理全部教学数据，便于教师日后增删改。
   ============================================================ */
import type { LessonData } from '../types'

export const lessonData: LessonData = {
  meta: {
    title: "地球的宇宙环境",
    grade: "第一章 第一节 · 高中必修一",
    lesson: "1课时 / 40分钟"
  },

  /* ---------------- M1 宇宙概念 ---------------- */
  universe: {
    intro: "宇宙是空间与时间的统一体，无边无际、无始无终。约 137 亿年前，宇宙在一次大爆炸中诞生。",
    scaleLevels: [
      { id: "earth", name: "地球", desc: "我们所在的星球" },
      { id: "solar", name: "太阳系", desc: "地球所在的行星系" },
      { id: "galaxy", name: "银河系", desc: "太阳系所在的星系" },
      { id: "universe", name: "可观测宇宙", desc: "人类目前能观测到的全部空间" }
    ]
  },

  /* ---------------- M3 流星案例（判别三条件） ---------------- */
  meteorCase: {
    steps: [
      { title: "流星体进入大气层", desc: "尘粒、固体岩石块（流星体）在太空中运行，属于天体。" },
      { title: "与大气摩擦燃烧", desc: "生热燃烧发光，划过夜空，形成流星现象。" },
      { title: "未燃尽落至地面", desc: "成为陨石（例如陨石坑中的陨石），已不属于天体。" }
    ],
    conditions: [
      { key: "是物质", desc: "有质量、占空间的物质实体才可能是天体。" },
      { key: "大气层之外", desc: "天体在太空（大气层之外）运行。" },
      { key: "独立个体", desc: "独立运行、有自身的运动轨道，不是某一天体的附属部分。" }
    ],
    conclusion: "判别天体看的是“此刻在哪、是什么形态”——在太空独立运行的是天体；进入大气层成为现象、落到地面成为地面物质，都不是天体。"
  },

  /* ---------------- M3 拖拽分类（9 张案例卡） ---------------- */
  dragCards: [
    { id: "moon", name: "月球", type: "celestial", explain: "在太空中绕地球运行的天然卫星。" },
    { id: "meteor_light", name: "流星现象", type: "non", explain: "发生在大气层内，是现象不是天体。" },
    { id: "sun", name: "太阳", type: "celestial", explain: "银河系中的一颗恒星，自身发光发热。" },
    { id: "halley", name: "哈雷彗星", type: "celestial", explain: "绕太阳运行的彗星，是独立天体。" },
    { id: "satellite", name: "在轨人造卫星", type: "celestial", explain: "在太空中运行的人造天体。" },
    { id: "meteorite", name: "陨石", type: "non", explain: "已落到地面，不属于天体。" },
    { id: "mars", name: "火星", type: "celestial", explain: "绕太阳运行的类地行星。" },
    { id: "space_junk", name: "太空垃圾", type: "celestial", explain: "在太空中运行，是人造天体。" },
    { id: "lightning", name: "闪电", type: "non", explain: "大气中的放电现象，不是天体。" }
  ],

  /* ---------------- M4 天体系统层级 ---------------- */
  hierarchy: [
    {
      id: "earth-moon", name: "地月系",
      content: "地球与月球相互吸引、相互绕转。",
      example: "同级别案例：火卫一绕火星运行（火星的卫星系统）"
    },
    {
      id: "solar-system", name: "太阳系",
      content: "太阳与八大行星等天体相互绕转。",
      example: "同级别案例：半人马座 α 星系（比邻星所在的三合星系统）"
    },
    {
      id: "milky-way", name: "银河系",
      content: "太阳系等上千亿个恒星系统组成的巨大星系。",
      example: "同级别案例：仙女座星系（河外星系）"
    },
    {
      id: "observable-universe", name: "可观测宇宙",
      content: "银河系等数千亿个星系构成的可观测范围。",
      example: "人类目前所能观测到的宇宙边界"
    }
  ],

  /* ---------------- M5 太阳系八大行星 ---------------- */
  /* size：3D 视窗中球体相对半径（示意图，非按真实比例） */
  planets: [
    { id: "mercury", name: "水星", number: "01", type: "类地行星", typeKey: "terrestrial", color: "#b0b7c6", size: 0.6,  orbit: 8,   period: 10,   distance: "0.39 AU", surfaceTemp: "约 167 ℃",  revolution: "88 天",     rotation: "58.6 天",    desc: "距太阳最近，固体表面，昼夜温差极大。" },
    { id: "venus",   name: "金星", number: "02", type: "类地行星", typeKey: "terrestrial", color: "#e6c87a", size: 0.95, orbit: 12,  period: 16,   distance: "0.72 AU", surfaceTemp: "约 464 ℃",  revolution: "224.7 天",  rotation: "243 天",     desc: "最亮的行星，有浓厚大气，温室效应强烈。" },
    { id: "earth",   name: "地球", number: "03", type: "类地行星", typeKey: "terrestrial", color: "#4f9df7", size: 1.0,  orbit: 16,  period: 25,   distance: "1.00 AU", surfaceTemp: "约 15 ℃",   revolution: "365.25 天", rotation: "23.9 小时",  desc: "人类的家园，目前已知唯一存在生命的行星。" },
    { id: "mars",    name: "火星", number: "04", type: "类地行星", typeKey: "terrestrial", color: "#d96c4f", size: 0.75, orbit: 20,  period: 30,   distance: "1.52 AU", surfaceTemp: "约 −63 ℃",  revolution: "687 天",    rotation: "24.6 小时",  desc: "红色星球，表面覆盖氧化铁（\"铁锈\"）。" },
    { id: "jupiter", name: "木星", number: "05", type: "巨行星", typeKey: "giant",     color: "#d9a05b", size: 2.6,  orbit: 27,  period: 60,   distance: "5.20 AU", surfaceTemp: "约 −108 ℃", revolution: "11.86 年",  rotation: "约 9.9 小时", desc: "体积和质量最大的行星，由氢氦气体组成。" },
    { id: "saturn",  name: "土星", number: "06", type: "巨行星", typeKey: "giant",     color: "#e3c98a", size: 2.1,  orbit: 33,  period: 75,   distance: "9.58 AU", surfaceTemp: "约 −139 ℃", revolution: "29.5 年",   rotation: "约 10.7 小时", desc: "拥有美丽的光环，主要由氢氦气体组成。" },
    { id: "uranus",  name: "天王星", number: "07", type: "远日行星", typeKey: "outer",  color: "#7fd4d4", size: 1.4,  orbit: 38,  period: 105,  distance: "19.20 AU", surfaceTemp: "约 −195 ℃", revolution: "84 年",  rotation: "约 17.2 小时", desc: "距太阳遥远，自转轴几乎\"躺着\"，表面温度极低。" },
    { id: "neptune", name: "海王星", number: "08", type: "远日行星", typeKey: "outer",  color: "#5a7fe0", size: 1.3,  orbit: 43,  period: 165,  distance: "30.05 AU", surfaceTemp: "约 −201 ℃", revolution: "164.8 年", rotation: "约 16.1 小时", desc: "距太阳最远的行星，表面温度极低，风速极快、风暴猛烈。" }
  ],

  /* ---------------- M6 行星的运动特征 ---------------- */
  motionFeatures: [
    { name: "同向性", desc: "八大行星绕日公转的方向都是自西向东。" },
    { name: "近圆性", desc: "行星绕日公转的轨道近似圆形。" },
    { name: "共面性", desc: "行星轨道面几乎位于同一平面上。" }
  ],

  /* ---------------- M7 地球的普通性和特殊性 ---------------- */
  /* 呈现形式为可视化：顶部一张「八大行星」横向示意图（地球高亮），下面两条证据卡
     （运动特征 / 结构特征，各配一张 SVG 示意图 + 一句说明 + 一行图注），最后是
     普通 → 转折 → 特殊的结论。文字只保留要点句，数据以图形呈现（体积用相对大小圆）。
     体积为类地行星相对地球的近似值（地球 = 1），来源见 docs/06_资源引用.md。
     特殊性表述一律加"目前已知"限定，不作绝对结论。 */
  earthOrdinary: {
    lineupCaption: "地球，只是太阳系八颗行星中的一颗。",
    evidences: [
      {
        title: "运动特征",
        desc: "绕日公转的方向、轨道形状与轨道面，与其余七颗行星一致。",
        caption: "同向性 · 近圆性 · 共面性"
      },
      {
        title: "结构特征",
        desc: "体积、质量与类地行星相近，与金星最为接近。",
        caption: "与类地行星同量级"
      }
    ],
    bodies: [
      { id: "mercury", name: "水星", volume: 0.06 },
      { id: "venus", name: "金星", volume: 0.86 },
      { id: "earth", name: "地球", volume: 1 },
      { id: "mars", name: "火星", volume: 0.15 }
    ],
    ordinaryConclusion: "所以，地球是一颗普通的行星。",
    turn: "然而——",
    specialStatement: "地球是太阳系八大行星中目前已知唯一存在高级智慧生命的星球。",
    specialConclusion: "所以，地球其实又是一颗特殊的行星。",
    bridge: "它为什么能孕育生命？→ 下一模块：地球存在生命的原因"
  },
  /* ---------------- M8 地球存在生命的原因 ---------------- */
  lifeConditions: {
    external: [
      { cond: "太阳处于壮年", result: "光照稳定，生命演化连续" },
      { cond: "大小行星各行其道", result: "互不干扰，宇宙环境安全" }
    ],
    internal: [
      { cond: "日地距离适中、自转公转周期适宜", result: "温度适宜，水以液态存在" },
      { cond: "地球体积、质量适中", result: "引力足够吸引大气，经漫长演化形成适宜大气" },
      { cond: "原始地球内部升温产生水汽", result: "水汽逸出地表成云致雨，汇聚成海，孕育生命" }
    ],
    conclusion: "外部条件 + 自身条件共同作用 → 地球成为目前已知唯一适宜生命存在的星球。"
  },

  /* ---------------- M9 复习与总结 ----------------
   * nodes 为知识结构树（单向树状思维导图，根在左）；叶子节点的 link 指向本页
   * 对应模块的 section id，点击即滚动定位，用于把复习导图与前面各模块联动起来；
   * sections 为复习文档，严格按 docs/复习模式知识点.docx
   * 逐节还原（挖空答案已填）。文档结构：天体类型（5 类 + 自然/人造）→ 判别三条件
   * （含判断练习）→ 天体系统（概念 + 层级）→ 太阳系与八大行星（顺序 + 分类 +
   * 小行星带 + 运动三性）→ 地球的普通性 / 特殊性 → 存在生命的条件（外部 + 自身）。 */
  review: {
    nodes: [
      {
        id: "universe", name: "宇宙", children: [
          {
            id: "celestial", name: "天体", children: [
              { id: "types", name: "类型：自然天体（星云 / 恒星 / 行星 / 卫星 / 流星体 / 彗星）、人造天体（人造卫星 / 载人飞船 / 空间站）", link: "#celestial" },
              { id: "judge", name: "判别三条件：是物质 · 大气层之外 · 独立个体（有自身轨道）", link: "#meteor" }
            ]
          },
          {
            id: "system", name: "天体系统", children: [
              { id: "concept", name: "概念：天体相互吸引、相互绕转", link: "#hierarchy" },
              { id: "levels", name: "层级：可观测宇宙 → 银河系 → 太阳系 → 地月系", link: "#hierarchy" },
              {
                id: "solar", name: "太阳系", children: [
                  { id: "order", name: "八大行星（由近及远）：水星、金星、地球、火星、木星、土星、天王星、海王星", link: "#planets" },
                  { id: "classify", name: "分类：类地（水金地火）· 巨（木土）· 远日（天海）", link: "#planets" },
                  { id: "belt", name: "小行星带：火星与木星轨道之间", link: "#planets" },
                  { id: "planets", name: "运动三性：同向性、近圆性、共面性", link: "#planets" },
                  {
                    id: "earth", name: "地球", children: [
                      { id: "nature", name: "普通性（距日远近 / 体积 / 公转方式）＋特殊性（唯一高级智慧生命）", link: "#earth" },
                      { id: "life-cond", name: "存在生命条件：外部（太阳稳定 / 宇宙环境安全）＋自身（温度 / 大气 / 液态水）", link: "#life" }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    sections: [
      {
        heading: "一、天体的类型",
        link: "#celestial",
        blocks: [
          { kind: "line", prefix: "1、", segments: [
            { kind: "text", text: "由气体和尘埃组成的呈云雾状外表的天体类型是" },
            { kind: "blank", answer: "星云" },
            { kind: "text", text: "。" }
          ] },
          { kind: "line", prefix: "2、", segments: [
            { kind: "text", text: "由炽热气体组成的、自身能发出光和热的天体类型是" },
            { kind: "blank", answer: "恒星" },
            { kind: "text", text: "。" }
          ] },
          { kind: "line", prefix: "3、", segments: [
            { kind: "text", text: "在椭圆轨道上绕恒星运行的、近似球状的天体类型是" },
            { kind: "blank", answer: "行星" },
            { kind: "text", text: "。" }
          ] },
          { kind: "line", prefix: "4、", segments: [
            { kind: "text", text: "环绕行星运转的天体类型是" },
            { kind: "blank", answer: "卫星" },
            { kind: "text", text: "。" }
          ] },
          { kind: "line", prefix: "5、", segments: [
            { kind: "text", text: "在扁长轨道上绕太阳运行且一种质量很小的天体类型" },
            { kind: "blank", answer: "彗星" },
            { kind: "text", text: "。" }
          ] },
          { kind: "line", prefix: "以上这些天体统称为", segments: [
            { kind: "blank", answer: "自然天体" },
            { kind: "text", text: "。" }
          ] },
          { kind: "line", prefix: "除此之外，还有人类制造并发射进入太空运行的天体，被称为", segments: [
            { kind: "blank", answer: "人造天体" }
          ] }
        ]
      },
      {
        heading: "二、天体的判别",
        link: "#meteor",
        blocks: [
          { kind: "columns", cols: [
            [
              { kind: "line", prefix: "1、", segments: [
                { kind: "text", text: "判断天体的三个标准：" }
              ] },
              { kind: "line", prefix: "①", segments: [ { kind: "blank", answer: "是物质（有质量、占空间）" } ] },
              { kind: "line", prefix: "②", segments: [ { kind: "blank", answer: "位于大气层之外（在太空中运行）" } ] },
              { kind: "line", prefix: "③", segments: [ { kind: "blank", answer: "独立运行、有自身的运动轨道" } ] }
            ],
            [
              { kind: "line", prefix: "2、", segments: [
                { kind: "text", text: "请判断下列物质哪些是天体，哪些不是" }
              ] },
              { kind: "judge", items: [
                { name: "流星体", isCelestial: true, explain: "在太空中运行，是天体。" },
                { name: "流星现象", isCelestial: false, explain: "发生在大气层内，是现象，不是天体。" },
                { name: "陨石", isCelestial: false, explain: "已落到地面，不属于天体。" },
                { name: "火星车", isCelestial: false, explain: "依附在火星表面，不是独立运行的天体。" },
                { name: "空间站", isCelestial: true, explain: "在太空中运行，是人造天体。" }
              ] }
            ]
          ] }
        ]
      },
      {
        heading: "三、天体系统",
        link: "#hierarchy",
        blocks: [
          { kind: "line", prefix: "1、", segments: [
            { kind: "text", text: "概念：天体之间相互" },
            { kind: "blank", answer: "吸引" },
            { kind: "text", text: "、相互" },
            { kind: "blank", answer: "绕转" },
            { kind: "text", text: "，构成不同级别的天体系统。" }
          ] },
          { kind: "line", segments: [
            { kind: "text", text: "天体系统从大到小依次是：" },
            { kind: "blank", answer: "可观测宇宙" },
            { kind: "sep", text: "→" },
            { kind: "blank", answer: "银河系" },
            { kind: "sep", text: "→" },
            { kind: "blank", answer: "太阳系" },
            { kind: "sep", text: "→" },
            { kind: "blank", answer: "地月系" }
          ] }
        ]
      },
      {
        heading: "四、太阳系与八大行星",
        link: "#planets",
        blocks: [
          { kind: "line", prefix: "1.", segments: [
            { kind: "text", text: "太阳系示意图" }
          ] },
          { kind: "line", segments: [
            { kind: "text", text: "八大行星距太阳由近及远的顺序是：" },
            { kind: "blank", answer: "水星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "金星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "地球" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "火星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "木星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "土星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "天王星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "海王星" }
          ] },
          { kind: "line", prefix: "2.", segments: [
            { kind: "text", text: "八颗行星的分类" }
          ] },
          { kind: "line", prefix: "类地行星：", segments: [
            { kind: "blank", answer: "水星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "金星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "地球" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "火星" }
          ] },
          { kind: "line", prefix: "巨行星：", segments: [
            { kind: "blank", answer: "木星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "土星" }
          ] },
          { kind: "line", prefix: "远日行星：", segments: [
            { kind: "blank", answer: "天王星" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "海王星" }
          ] },
          { kind: "line", prefix: "3.", segments: [
            { kind: "text", text: "小行星带位于" },
            { kind: "blank", answer: "火星" },
            { kind: "text", text: "和" },
            { kind: "blank", answer: "木星" },
            { kind: "text", text: "的运行轨道之间。" }
          ] },
          { kind: "line", prefix: "4.", segments: [
            { kind: "text", text: "八大行星的运动特征？" }
          ] },
          { kind: "line", prefix: "①", segments: [ { kind: "blank", answer: "同向性" } ] },
          { kind: "line", prefix: "②", segments: [ { kind: "blank", answer: "近圆性" } ] },
          { kind: "line", prefix: "③", segments: [ { kind: "blank", answer: "共面性" } ] }
        ]
      },
      {
        heading: "四、地球的普通性和特殊性",
        link: "#earth",
        blocks: [
          { kind: "line", prefix: "1、普通性：", segments: [
            { kind: "text", text: "从" },
            { kind: "blank", answer: "距日远近" },
            { kind: "sep", text: "、" },
            { kind: "blank", answer: "自身的体积" },
            { kind: "text", text: "，还是从" },
            { kind: "blank", answer: "公转方式" },
            { kind: "text", text: "来看，地球都只是太阳系中一颗普通的行星" }
          ] },
          { kind: "line", prefix: "2、特殊性：", segments: [
            { kind: "text", text: "根据人类目前所掌握的宇宙信息，地球是八颗行星中唯一存在" },
            { kind: "blank", answer: "高级智慧生命" },
            { kind: "text", text: "的星球" }
          ] }
        ]
      },
      {
        heading: "五、地球存在生命的条件：",
        link: "#life",
        blocks: [
          { kind: "columns", cols: [
            [
              { kind: "sub", text: "（一）外部条件" },
              { kind: "line", prefix: "①", segments: [ { kind: "blank", answer: "太阳光照稳定" } ] },
              { kind: "line", prefix: "②", segments: [ { kind: "blank", answer: "大小行星各行其道（宇宙环境安全）" } ] }
            ],
            [
              { kind: "sub", text: "（二）内部条件" },
              { kind: "line", prefix: "①", segments: [ { kind: "blank", answer: "日地距离适中，温度适宜" } ] },
              { kind: "line", prefix: "②", segments: [ { kind: "blank", answer: "体积和质量适中，有适宜的大气" } ] },
              { kind: "line", prefix: "③", segments: [ { kind: "blank", answer: "存在液态水" } ] }
            ]
          ] }
        ]
      }
    ]
  },

  /* ---------------- 拓展材料（按模块） ---------------- */
  extends: {
    M1: {
      title: "宇宙的更多奥秘",
      content: [
        "大爆炸理论：约 137 亿年前，宇宙从一个极小、极热的奇点迅速膨胀至今，星系仍在彼此远离。",
        "为什么\"无始无终\"？宇宙没有中心，也没有边界——从任何一个点观察，看到的空间都大致相同。"
      ]
    },
    M2: {
      title: "天体趣闻",
      content: [
        "\"脏雪球\"的来历：彗星由冰物质和尘埃组成，就像一个被尘埃裹住的雪球，因而得名。",
        "恒星为什么会发光？恒星内部的氢在高温高压下发生核聚变，把氢\"烧\"成氦，同时释放出巨大的光和热——太阳就是这样发光的。"
      ]
    },
    M4: {
      title: "其他行星系案例",
      content: [
        "木星的伽利略卫星系统：木星有 90 多颗卫星，其中最亮的四颗（木卫一至木卫四）是伽利略在 1610 年发现的。",
        "半人马座 α 星系：离太阳最近的恒星系统，由三颗恒星组成，其中的比邻星距离我们约 4.2 光年。",
        "仙女座星系：距离银河系约 250 万光年的河外星系，是肉眼可见的最遥远天体之一。"
      ]
    },
    M5: {
      title: "行星数据对比",
      content: [
        "体积最大的是木星，约相当于地球的 1300 倍；最小的是水星。",
        "公转周期：水星约 88 天，地球 1 年，海王星约 165 年——离太阳越远，公转一周越久。",
        "距日距离：水星最近，海王星最远，约是水星距日的 40 倍。",
        "注：上图为示意图，行星大小与轨道间距均未按真实比例绘制。"
      ]
    },
    M7: {
      title: "轨道倾角与偏心率",
      content: [
        "轨道倾角：行星公转轨道面与黄道面（地球公转轨道面）的夹角。八颗行星都小于 7°，所以轨道几乎共面。",
        "偏心率：描述轨道“扁”的程度，等于两焦点距离与长轴之比；0 为正圆，越大越扁。八颗行星都小于 0.21，所以轨道近似正圆。",
        "地球的倾角为 0°、偏心率为 0.017，都落在八颗行星的普通区间——这是判断“共面性、近圆性”的量化依据。"
      ]
    },
    M8: {
      title: "生命的必要条件",
      content: [
        "液态水是生命活动的\"溶剂\"，适宜的温度保证水能以液态存在。",
        "适宜的大气可以阻挡有害辐射、调节昼夜温差，并供给生物呼吸所需的氧气。",
        "科学家在其他行星（如火星）上寻找液态水的痕迹，正是因为它与生命密切相关。"
      ]
    }
  },

  /* ---------------- 随堂练习（每模块"✎ 练习"入口） ---------------- */
  /* 已按要求清空全部随堂练习题目：各模块保留「练习」入口按钮，点开显示空态占位，
     后续可按学情重新补入题目。 */
  practices: {}
}
