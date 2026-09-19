/** 全课类型定义（与 docs/05_开发文档.md §3.1 一致） */

export type BaseId = 'jiuquan' | 'taiyuan' | 'xichang' | 'wenchang'

/** 选址条件（发射基地表 / 着陆场表共用结构） */
export interface SiteCondition {
  id: string
  /** 材料描述（导学案原文，不得改写） */
  material: string
  /** 描述角度 */
  angle: string
  /** 有利条件 */
  benefit: string
  /** 材料中需高亮的词 */
  keywords: string[]
  /** 内联 SVG symbol id */
  icon?: string
}

/** M4 选址速览卡（矩形卡片：角度 + 条件描述 + logo 图标） */
export interface SiteCompareItem {
  id: string
  /** 角度名称（卡片标题） */
  angle: string
  /** 条件描述 */
  text: string
  /** 内联 SVG symbol id（卡片 logo，非 emoji） */
  icon: string
}

/** 基地条件框在四角布局中的落位（左上 / 右上 / 左下 / 右下） */
export type BaseSlot = 'tl' | 'tr' | 'bl' | 'br'

/** 我国四大航天发射基地 */
export interface LaunchBase {
  id: BaseId
  name: string
  location: string
  /** 经度（地图定点用） */
  lon: number
  /** 纬度（地图定点用） */
  lat: number
  /** 条件框落位（四角布局） */
  slot: BaseSlot
  /** 该基地应有的有利条件 id（教师确认口径） */
  conditionIds: string[]
}

/** M5 任务三的标题与副标题（模块文案的唯一真源） */
export interface BaseTaskText {
  title: string
  subtitle: string
}

/** 7 条有利条件 */
export interface ConditionItem {
  id: string
  index: string
  text: string
}

/** 随堂练习·单题 */
export interface QuizQuestion {
  id: string
  /** 题源标注（无则留空字符串，界面不渲染） */
  source: string
  /** 情境材料（题干之前的材料句，逐字录入原文，可缺省） */
  material?: string
  stem: string
  /** 需高亮的词（材料 / 题干中） */
  highlight: string[]
  options: { key: string; text: string }[]
  answerKey: string
  /** 解析（逐题详解） */
  analysis: string
  /** 作答小提示（题卡底部） */
  hint: string
  /** 知识点关联（题源【点睛】要点，逐条呈现） */
  knowledge: { title: string; items: string[] }
}

export interface QuizData {
  /** 模块副标题 */
  subtitle: string
  /** 标题后的英文水印 */
  watermark: string
  questions: QuizQuestion[]
}

/** 综合题预切分句子 */
export interface PracticeSentence {
  id: string
  text: string
  /** 该句可对应到的描述角度（参考，非唯一） */
  angles: string[]
  polarity: 'fav' | 'unfav'
  /** 参考"精简语句"（点"揭示参考"后显示） */
  briefRef?: string
  /** 参考"规范表达"（点"揭示参考"后显示） */
  standardRef?: string
}

export interface LatitudePoint {
  id: string
  /** 纬度名称（列表首列，如 60°N / 0°（赤道）） */
  name: string
  /** 纬度值（度；南半球为负） */
  lat: number
  /** 自转线速度（m/s，教学近似值） */
  speed: number
  meter: string
  /** 同一小时（α = 15°）内转过的弧长（km，教科书口径：837 / 1447 / 1670） */
  arcKm: number
}

/** 线速度卡片·赤道结论提示卡 */
export interface LatitudeCallout {
  /** 结论文案 */
  text: string
  /** 数值前缀（如"最高可达约"） */
  valueLabel: string
  value: number
  unit: string
}

/** 评分标准条目 */
export interface PracticeCriteriaItem {
  text: string
  /** 该条下的并列细项（如"必须保证"后的若干要素） */
  items?: string[]
}

/** 综合题答题页·「材料信息梳理」表的一行 */
export interface PracticeMaterialRow {
  id: string
  /** 内联 SVG symbol id（「材料描述」列的小图标） */
  icon: string
  /** 材料描述 */
  material: string
  /** 描述角度 */
  angle: string
  /** 精简语句 */
  brief: string
  polarity: 'fav' | 'unfav'
  /** 可能形成的答案 */
  answer: string
}

export interface PracticeData {
  material: string
  /** 材料页「关键词」按钮的高亮词表（点按后在 `material` 中扫出并高亮 + 下划线） */
  keywords: string[]
  sentences: PracticeSentence[]
  requirement: string
  angleOptions: string[]
  answer: { fav: string[]; unfav: string[] }
  /** 评分标准（点"评分标准"后弹出，序号由数组顺序生成） */
  criteria: PracticeCriteriaItem[]
  /** 答题屏·「材料信息梳理」表（全部条目按材料顺序排列，一屏放不下时表格内部滚动） */
  materialRows: PracticeMaterialRow[]
}

export interface LessonData {
  title: string
  /** 封面标语（显示在标题下方） */
  subtitle: string
  /** 封面·本节课教学目标（按呈现顺序逐条展示） */
  goals: string[]
  /** 任务一（M2）导语：说明材料描述的阅读方式 */
  launchIntro: string
  /** 任务一（M2）表格下方操作提示 */
  launchTip: string
  /** 任务二（M3）导语：与任务一同一呈现方式 */
  landingIntro: string
  /** 任务二（M3）表格下方操作提示 */
  landingTip: string
  conditions: { launch: SiteCondition[]; landing: SiteCondition[] }
  /** M4 一张图看两种选址：两侧速览卡（角度 + 条件描述 + logo） */
  siteCompare: { launch: SiteCompareItem[]; landing: SiteCompareItem[] }
  bases: LaunchBase[]
  /** 任务三（M5）标题与副标题 */
  baseTask: BaseTaskText
  conditionPool: ConditionItem[]
  quiz: QuizData
  practice: PracticeData
  latitudePoints: LatitudePoint[]
  /** 线速度卡片·副标题 */
  latitudeSubtitle: string
  /** 线速度卡片·副标题需强调的词 */
  latitudeSubtitleKeys: string[]
  /** 线速度卡片·列表表头 */
  latitudeTableHead: { lat: string; speed: string }
  /** 线速度卡片·赤道结论提示卡 */
  latitudeCallout: LatitudeCallout
  /** 地图底图合规标注 */
  mapNote: string
}
