/* ============================================================
   编辑器 · 材料/题目画布 editor 的类型声明
   ------------------------------------------------------------
   materialEditor.js 是画布内一站式编辑器的实现；这里只声明对外接口，
   供测试与其他模块以 TypeScript 方式引用。
   ============================================================ */
import type { CqGroup, CqQuestion } from '../../content/types'

export interface MaterialEditorOptions {
  mount: HTMLElement
  group: CqGroup
  /** 属性面板挂载点；缺省时渲染在画布下方（旧布局 / 测试） */
  propsHost?: HTMLElement
  /** 新建一道题（由编辑器提供默认题目结构） */
  createQuestion?: (kind: 'choice' | 'essay') => CqQuestion
  /** 轻确认；缺省退化为 window.confirm */
  confirm?: (message: string, onConfirm: () => void) => void
  onChange?: () => void
  onSelect?: (id: string | null) => void
}

export interface MaterialEditorHandle {
  destroy(): void
  /** 前台切换：多个题组共用外部属性栏时，只有前台实例写属性 */
  setActive(active: boolean): void
  /** 只重绘画布（不重建属性栏） */
  refresh(): void
}

export function createMaterialEditor(options: MaterialEditorOptions): MaterialEditorHandle
