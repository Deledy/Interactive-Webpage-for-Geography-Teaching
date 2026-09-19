/** M3 任务二 · 返回舱落在哪：复用选址条件表（与任务一同样式、同交互） */
import { lessonData } from '../data/lessonData'
import { createConditionsTable } from './conditionsTable'

const table = createConditionsTable({
  screen: 'm3',
  title: '任务二 · 返回舱落在哪',
  badge: '航天器着陆场的选址条件',
  intro: lessonData.landingIntro,
  tip: lessonData.landingTip,
  rows: lessonData.conditions.landing
})

export const initLandingConditions = table.init
export const resetLandingConditions = table.reset
