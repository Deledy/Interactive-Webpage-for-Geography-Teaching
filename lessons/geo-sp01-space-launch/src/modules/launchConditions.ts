/** M2 任务二 · 发射基地建在哪：复用选址条件表（材料描述常显 + 点击查看展开整条） */
import { lessonData } from '../data/lessonData'
import { createConditionsTable } from './conditionsTable'

const table = createConditionsTable({
  screen: 'm2',
  title: '任务二 · 发射基地建在哪',
  badge: '航天发射基地的选址条件',
  intro: lessonData.launchIntro,
  tip: lessonData.launchTip,
  rows: lessonData.conditions.launch
})

export const initLaunchConditions = table.init
export const resetLaunchConditions = table.reset
