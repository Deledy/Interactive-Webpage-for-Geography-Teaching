/* ============================================================
   内容编辑器（通用型）
   ------------------------------------------------------------
   预览直接复用公共运行时（窗口 / 卡片 / 样式），不再自建一套渲染。
   ============================================================ */
import { createPreviewStage } from '../../runtime/src/previewStage'
import { openPracticeWindow } from '../../runtime/src/practiceWindow'
import { createRichField } from './richField'
import './editor.css'

/* ============================================================
   内容编辑器（通用型）
   ------------------------------------------------------------
   职责：
   - 读取「结构清单」（声明有哪些分组）与「内容数据」（分组下的条目），
     以「分组导航 + 逐组编辑 + 实时预览」的方式提供可视化编辑；
   - 导出统一内容数据文件，支持就近写回与下载回退。

   通用化设计：
   - 组件本体不含任何业务名词：全部界面文案来自 CONFIG.labels，
     消费方通过 window.__CONTENT_EDITOR_CONFIG__ 覆盖；
   - 数据文件名、全局变量名、结构抽取选择器同样由 CONFIG.source 提供；
   - 视觉为中性设计语言，业务色/装饰一律不内置。

   引导设计（本版新增）：
   - 顶部「上手步骤」引导条：四步流程 + 当前步高亮 + 情境化下一步按钮；
   - 空态提供分步说明与主操作按钮；分组为空时给出就地引导卡；
   - 校验问题可定位并高亮到具体字段。
   ============================================================ */
(function () {
  'use strict';

  /* ==========================================================
     一、配置
     ========================================================== */
  var DEFAULT_CONFIG = {
    theme: 'auto',                 // 'auto' | 'light' | 'dark'
    density: 'comfortable',        // 'comfortable' | 'compact'

    layout: {
      nav: true,
      preview: true,
      previewPlacement: 'side',    // 'side' | 'bottom'
      previewCollapsible: false,
      allowPanelToggle: true,
      acceptStructureDrop: true,
      guide: true                  // 是否启用上手步骤引导条
    },

    labels: {
      appTitle: '内容编辑器',
      navTitle: '分组',
      editorTitle: '编辑',
      previewTitle: '预览',
      outputSummary: '输出预览 / 手动复制',
      previewCollapse: '收起预览',
      previewExpand: '展开预览',
      emptyNav: '未找到结构',
      selectionEmpty: '请选择左侧分组',
      emptyValue: '—',
      sectionFallback: '分区',
      notLoadedTitle: '尚未载入结构清单',
      notLoadedText: '结构清单决定左侧有哪些分组。载入后即可逐组编辑内容，右侧实时预览效果。',
      dropHint: '也可以把结构文件直接拖到左侧「分组」面板。',
      groupEmpty: '该分组暂无内容',
      auxiliaryEmpty: '附加分区暂无内容',
      auxiliaryFallback: '辅助内容',
      orphanPrefix: '游离分组 · ',
      statusReady: '结构已就绪',
      statusMissing: '未找到结构清单文件',
      sectionTitlePlaceholder: '分区标题',
      itemCount: '{n} 组',
      questionCount: '{n} 道题目',
      addItem: '新增{k}',
      addGroup: '新增题组',
      addSection: '新增题组',
      removeSection: '删除题组',
      addOption: '新增{f}',

      actions: {
        validate: '校验',
        importStructure: '导入结构文件',
        importData: '导入数据',
        loadLocal: '载入同级文件',
        saveLocal: '保存到同级文件',
        export: '导出数据文件',
        copy: '复制',
        more: '更多操作',
        moreShort: '更多'
      },

      guide: {
        label: '上手步骤',
        dismiss: '关闭引导',
        reopen: '上手步骤',
        steps: ['载入结构', '选择分组', '新增题组', '校验并导出'],
        hints: [
          '导入结构文件，确定有哪些分组',
          '在左侧点选一个分组',
          '新增题组，填写材料并添加题目',
          '通过校验后保存或导出'
        ],
        nextImport: '导入结构文件',
        nextSelect: '选择第一个分组',
        nextAdd: '新增题组',
        nextValidate: '开始校验',
        nextExport: '导出数据文件'
      },

      fields: {
        material: '材料',
        stem: '题干',
        options: '候选项',
        optionPlaceholder: '候选项内容',
        answer: '选定项',
        analysis: '说明',
        stems: '问题（每行一条）',
        reference: '参考内容',
        auxiliaryTitle: '标题',
        auxiliarySubtitle: '副标题'
      },

      placeholders: {
        material: '填写本组共用的材料，组内题目将共用这道材料',
        stem: '填写本题的题干内容',
        analysis: '可选，说明判断依据或补充解释',
        stems: '每行一个问题，将渲染为有序列表',
        reference: '填写参考内容，可直接使用 HTML（如 <strong>加粗</strong>）',
        sectionTitle: '分区标题'
      },

      kinds: { choice: '选择题', essay: '综合题' },

      itemActions: { up: '上移', down: '下移', duplicate: '复制', remove: '删除' },

      sectionTitles: {
        content: '分组设置',
        items: '题组'
      },

      hintCard: {
        title: '该分组还没有题组',
        desc: '先新增一个题组，填写材料，再在题组内添加选择题或综合题。'
      },

      validation: {
        structureMissing: '未加载结构清单，无法校验分组映射',
        empty: '尚无任何条目',
        missingField: '{label}：缺少「{field}」',
        tooFewOptions: '{label}：至少需要两个有内容的「{field}」',
        invalidAnswer: '{label}：未设置有效的「{field}」',
        summaryIssues: '校验发现 {n} 处待完善：',
        summaryOk: '校验通过：结构完整，可以保存或导出。',
        moreIssues: ' 等',
        locate: '定位到第一个问题',
        unedited: '{n} 个分组未填写',
        orphan: '{n} 个游离分组'
      },

      toast: {
        validated: '校验发现 {n} 处待完善，可点「{locate}」跳转',
        validateOk: '校验通过，可以保存或导出',
        exported: '已导出 {name}',
        copied: '已复制到剪贴板',
        copyManual: '请手动复制下方文本',
        imported: '导入成功',
        importFailed: '导入失败：{msg}',
        structureLoaded: '已从结构文件解析（分组 {n}）',
        structureFailed: '解析失败：{msg}',
        localLoaded: '已载入同级数据文件',
        localMissing: '未找到同级数据文件',
        saved: '已保存到所选文件',
        saveFallback: '直接保存不可用，已改为下载',
        unparsable: '无法识别的数据结构',
        keepOneSection: '至少保留一个分区',
        keepTwoOptions: '至少保留两个候选项',
        draftLoaded: '已载入本机草稿；如需同级文件请点「{label}」'
      },

      dialog: {
        title: '确认操作',
        cancel: '取消',
        confirm: '确定',
        removeSection: '删除该题组及其全部题目？此操作不可撤销。',
        removeItem: '删除该题目？此操作不可撤销。'
      }
    },

    schema: {
      itemKinds: ['choice', 'essay'],
      hiddenStructureKinds: ['drag']
    },

    source: {
      structureFile: 'assets/lesson-manifest.js',
      structureGlobal: '__LESSON_MANIFEST__',
      dataFile: 'practice-data.js',
      dataGlobal: '__PRACTICE_DATA__',
      themeFile: 'assets/quiz-theme.css',
      exportFile: 'practice-data.js',
      exportGlobal: '__PRACTICE_DATA__',
      draftKey: 'content-editor-draft-v1',
      acceptStructureExt: ['.html', '.htm'],
      acceptDataExt: ['.js', '.json'],
      extract: {
        section: 'section.section',
        num: '.section__tag-num',
        title: '.section__title',
        practiceBtn: '.practice-btn[data-practice]',
        practiceKeyAttr: 'data-practice',
        practiceKindAttr: 'data-practice-kind',
        navAttr: 'data-nav'
      }
    }
  };

  var CFG = deepMerge(clone(DEFAULT_CONFIG), window.__CONTENT_EDITOR_CONFIG__ || {});
  var SRC = CFG.source;
  var EXT = SRC.extract;

  /* ==========================================================
     二、通用工具
     ========================================================== */
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function deepMerge(base, extra) {
    if (!isPlainObject(extra)) return base;
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (isPlainObject(v) && isPlainObject(base[k])) deepMerge(base[k], v);
      else if (v !== undefined) base[k] = v;
    });
    return base;
  }

  function el(sel, root) { return (root || document).querySelector(sel); }
  function els(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function getPath(obj, path) {
    var parts = String(path).split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  }
  function setPath(obj, path, value) {
    var parts = String(path).split('.'), cur = obj;
    for (var i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }

  /** 文案取值与占位符替换：L('fields.stem') / L('itemCount', { n: 3 }) */
  function L(path, vars) {
    var v = getPath(CFG.labels, path);
    if (v == null) return path;
    return String(v).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m;
    });
  }

  /* ==========================================================
     三、HTML 转义工具
     ========================================================== */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }

  /* ==========================================================
     四、数据模型（契约保持不变）
     ========================================================== */
  var manifest = null;
  var state = null;
  var selectedId = '';
  var collapsed = {};
  var guideDismissed = false;
  var guideForced = false;

  function newItem(kind) {
    if (kind === 'essay') {
      return {
        id: '', type: 'essay', stems: [''],
        referenceAnswer: '', analysis: ''
      };
    }
    return {
      id: '', type: 'choice', stem: '',
      options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }],
      answer: 'A', analysis: ''
    };
  }

  /** 新题组：一则材料 + 一组题目 */
  function newGroup() {
    return { id: '', material: '', questions: [] };
  }

  /**
   * 旧数据迁移：把「每题自带材料」的扁平 questions 收敛为「题组共用材料」。
   * 连续且材料相同的题目归入同一题组，保证迁移不丢内容、不改语义。
   */
  function toGroups(questions) {
    var groups = [];
    var last = null;
    (questions || []).forEach(function (q) {
      var copy = clone(q);
      var material = copy.material || '';
      delete copy.material;
      if (last && last.material === material) {
        last.questions.push(copy);
      } else {
        last = { id: '', material: material, questions: [copy] };
        groups.push(last);
      }
    });
    return groups;
  }

  function normalizeModule(mod) {
    if (!mod) return;
    if (!Array.isArray(mod.groups)) {
      mod.groups = toGroups(mod.questions || []);
      delete mod.questions;
    }
    mod.groups.forEach(function (g) {
      if (!g) return;
      if (!Array.isArray(g.questions)) g.questions = [];
      g.questions.forEach(function (q) { if (q) delete q.material; });
    });
  }

  function normalizeSections(sections) {
    var out = [];
    (sections || []).forEach(function (sec) {
      if (!sec) return;
      var qs = Array.isArray(sec.questions) ? sec.questions : [];
      if (typeof sec.material === 'string' || !qs.length) {
        sec.questions = qs;
        if (typeof sec.material !== 'string') sec.material = '';
        sec.questions.forEach(function (q) { if (q) delete q.material; });
        out.push(sec);
        return;
      }
      toGroups(qs).forEach(function (g, gi) {
        out.push({
          id: sec.id ? sec.id + (gi ? '-' + (gi + 1) : '') : '',
          title: sec.title || '',
          material: g.material,
          questions: g.questions
        });
      });
    });
    return out;
  }

  /** 统一迁移内存中的草稿 / 导入数据 */
  function normalizeState() {
    if (!state) return;
    Object.keys(state.modules || {}).forEach(function (id) { normalizeModule(state.modules[id]); });
    if (state.postLesson) {
      state.postLesson.sections = normalizeSections(state.postLesson.sections || []);
    }
  }

  function emptyState() {
    return {
      /* v2：富文本字段为 HTML（与本课运行时一致） */
      version: 2,
      lesson: (manifest && manifest.lesson) || '',
      updatedAt: '',
      modules: {},
      postLesson: {
        title: (manifest && manifest.postLesson && manifest.postLesson.title) || L('auxiliaryFallback'),
        subtitle: '',
        sections: []
      }
    };
  }

  /* ==========================================================
     五、本地存储（草稿 / 主题 / 布局 / 引导，失败静默降级）
     ========================================================== */
  function storeGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storeSet(key, val) { try { window.localStorage.setItem(key, val); } catch (e) {} }

  var THEME_KEY = SRC.draftKey + ':theme';
  var LAYOUT_KEY = SRC.draftKey + ':layout';
  var GUIDE_KEY = SRC.draftKey + ':guide';

  var saveTimer = null;
  function loadDraft() {
    var raw = storeGet(SRC.draftKey);
    if (!raw) return false;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.modules || parsed.postLesson)) {
        state = parsed;
        normalizeState();
        return true;
      }
    } catch (e) { /* 损坏数据忽略 */ }
    return false;
  }
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { storeSet(SRC.draftKey, JSON.stringify(state)); }, 300);
  }

  /* ==========================================================
     六、分组导航
     ========================================================== */
  function hiddenKinds() { return CFG.schema.hiddenStructureKinds || []; }

  function navItems() {
    var items = [];
    if (manifest && manifest.modules) {
      manifest.modules.forEach(function (m) {
        if (m.kind && hiddenKinds().indexOf(m.kind) >= 0) return;
        items.push({ kind: 'group', id: m.id, no: m.no, title: m.title, nav: m.nav });
      });
    }
    if (manifest && manifest.postLesson) {
      items.push({
        kind: 'auxiliary',
        id: manifest.postLesson.id || 'auxiliary',
        no: manifest.postLesson.no,
        title: manifest.postLesson.title || L('auxiliaryFallback'),
        nav: manifest.postLesson.nav
      });
    }
    var known = {};
    items.forEach(function (it) { known[it.id] = true; });
    Object.keys((state && state.modules) || {}).forEach(function (id) {
      if (known[id]) return;
      var mod = state.modules[id];
      if (mod && questionsOf(mod).length) {
        items.push({ kind: 'group', id: id, no: '', title: mod.title || id, nav: '', orphan: true });
      }
    });
    return items;
  }
  function findItem(id) {
    var items = navItems();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function selectedItem() {
    return findItem(selectedId) || navItems()[0] || null;
  }
  function ensureSelected() {
    var all = navItems();
    if (!all.length) { selectedId = ''; return; }
    if (!findItem(selectedId)) selectedId = all[0].id;
  }
  function ensureGroup(it) {
    if (!state.modules) state.modules = {};
    if (!state.modules[it.id]) state.modules[it.id] = { title: '', intro: '', groups: [] };
    var mod = state.modules[it.id];
    if (!Array.isArray(mod.groups)) normalizeModule(mod);
    return mod;
  }
  function questionsOf(mod) {
    return ((mod && mod.groups) || []).reduce(function (acc, g) {
      return acc.concat((g && g.questions) || []);
    }, []);
  }
  function groupCount(id) {
    var mod = state.modules && state.modules[id];
    return questionsOf(mod).length;
  }
  /** 有效题组数（导出口径：至少有 1 道题） */
  function unitCount(id) {
    var mod = state.modules && state.modules[id];
    return ((mod && mod.groups) || []).filter(function (g) {
      return g && g.questions && g.questions.length;
    }).length;
  }
  function auxiliaryCount() {
    var secs = (state.postLesson && state.postLesson.sections) || [];
    return secs.reduce(function (n, s) { return n + ((s.questions && s.questions.length) || 0); }, 0);
  }
  function auxiliaryUnitCount() {
    var secs = (state.postLesson && state.postLesson.sections) || [];
    return secs.filter(function (s) { return s && s.questions && s.questions.length; }).length;
  }
  function totalItems() {
    var n = Object.keys((state && state.modules) || {}).reduce(function (acc, id) { return acc + groupCount(id); }, 0);
    return n + auxiliaryCount();
  }
  function groupLabel(it) {
    return it ? ((it.no ? it.no + ' ' : '') + (it.title || it.id)) : '';
  }

  /* ==========================================================
     七、反馈：吐司 / 状态 / 对话框 / 菜单
     ========================================================== */
  function toast(msg, variant) {
    var t = el('#toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'ce-toast is-show' + (variant ? ' ce-toast--' + variant : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'ce-toast'; }, 2600);
  }

  var dialogState = { onConfirm: null, lastFocus: null };
  var FOCUSABLE = ['button:not([disabled])', '[href]', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'];

  function openDialog(opts) {
    var dlg = el('#dialog');
    if (!dlg) return;
    dialogState.lastFocus = document.activeElement;
    dialogState.onConfirm = opts.onConfirm || null;
    el('#dialog-title').textContent = opts.title || L('dialog.title');
    el('#dialog-body').innerHTML = opts.body || '';
    var ok = el('#dialog-confirm');
    ok.textContent = opts.confirmText || L('dialog.confirm');
    ok.className = 'ce-btn ' + (opts.danger ? 'ce-btn--danger' : 'ce-btn--primary');
    dlg.hidden = false;
    var focusTarget = el('#dialog-body [data-autofocus]') || el('#dialog-cancel');
    if (focusTarget) focusTarget.focus();
  }
  function closeDialog() {
    var dlg = el('#dialog');
    if (!dlg || dlg.hidden) return;
    dlg.hidden = true;
    dialogState.onConfirm = null;
    var back = dialogState.lastFocus;
    if (back && back.focus) back.focus();
  }
  function confirmDialog(message, onYes) {
    openDialog({
      title: L('dialog.title'),
      body: '<p class="ce-dialog__text">' + esc(message) + '</p>',
      confirmText: L('dialog.confirm'),
      danger: true,
      onConfirm: onYes
    });
  }
  function trapFocus(e) {
    var dlg = el('#dialog');
    if (!dlg || dlg.hidden || e.key !== 'Tab') return;
    var panel = el('#dialog .ce-dialog__panel');
    if (!panel) return;
    var nodes = els(FOCUSABLE.join(','), panel);
    if (!nodes.length) return;
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function closeMenu() {
    var panel = el('#more-menu');
    var btn = el('[data-act="toggle-menu"]');
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function toggleMenu() {
    var panel = el('#more-menu');
    var btn = el('[data-act="toggle-menu"]');
    if (!panel || !btn) return;
    var open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      var first = el('.ce-menu__item', panel);
      if (first) first.focus();
    }
  }

  function setBusy(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-loading', !!on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  /* ==========================================================
     八、上手步骤引导
     ========================================================== */
  function guideSteps() {
    var hasStructure = !!manifest;
    var hasSelection = !!selectedId && hasStructure;
    var hasContent = totalItems() > 0;
    var issues = collectIssues();
    var clean = hasContent && issues.length === 0;
    return {
      done: [hasStructure, hasSelection, hasContent, clean],
      issues: issues
    };
  }

  function renderGuide() {
    var node = el('#guide');
    var btn = el('#guide-btn');
    if (!node) return;
    var enabled = !!CFG.layout.guide;
    if (!enabled) {
      node.hidden = true;
      if (btn) btn.hidden = true;
      return;
    }
    var g = guideSteps();
    var complete = g.done.every(Boolean);
    var visible = !guideDismissed && (!complete || guideForced);

    node.hidden = !visible;
    if (btn) btn.hidden = visible;

    if (!visible) return;

    var current = g.done.indexOf(false);
    var steps = CFG.labels.guide.steps || [];
    var stepsHtml = steps.map(function (s, i) {
      var cls = 'ce-guide__step' + (g.done[i] ? ' is-done' : (i === current ? ' is-current' : ''));
      var num = g.done[i] ? '✓' : String(i + 1);
      return '<li class="' + cls + '" title="' + attr((CFG.labels.guide.hints || [])[i] || '') + '">' +
        '<span class="ce-guide__dot">' + num + '</span><span>' + esc(s) + '</span></li>';
    }).join('<li class="ce-guide__sep" aria-hidden="true">›</li>');

    var action = guideAction(current);
    node.innerHTML =
      '<div class="ce-guide__main">' +
        '<span class="ce-guide__label">' + esc(L('guide.label')) + '</span>' +
        '<ol class="ce-guide__steps">' + stepsHtml + '</ol>' +
      '</div>' +
      '<div class="ce-guide__actions">' +
        (action ? '<button class="ce-btn ce-btn--sm ce-btn--primary" type="button" data-act="' + action.act + '">' + esc(action.label) + '</button>' : '') +
        '<button class="ce-iconbtn ce-iconbtn--plain" type="button" data-act="dismiss-guide" title="' + attr(L('guide.dismiss')) + '" aria-label="' + attr(L('guide.dismiss')) + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>';
  }

  function guideAction(current) {
    switch (current) {
      case 0: return { act: 'import-structure', label: L('guide.nextImport') };
      case 1: return { act: 'guide-select', label: L('guide.nextSelect') };
      case 2: return { act: 'guide-add-group', label: L('guide.nextAdd') };
      case 3: return { act: 'validate', label: L('guide.nextValidate') };
      default: return { act: 'export', label: L('guide.nextExport') };
    }
  }

  /* ==========================================================
     九、编辑区渲染
     ========================================================== */
  function ph(key) {
    var v = getPath(CFG.labels.placeholders, key);
    return v ? attr(v) : '';
  }
  function areaHtml(label, path, value, rows, phKey, hint) {
    return '<label class="ce-field"><span class="ce-field__label">' + esc(label) +
      (hint ? '<span class="ce-field__hint">' + esc(hint) + '</span>' : '') + '</span>' +
      '<textarea class="ce-textarea" rows="' + (rows || 2) + '" data-path="' + attr(path) + '"' +
      (phKey ? ' placeholder="' + ph(phKey) + '"' : '') + '>' + esc(value || '') + '</textarea></label>';
  }
  function inputHtml(label, path, value, phKey, hint) {
    return '<label class="ce-field"><span class="ce-field__label">' + esc(label) +
      (hint ? '<span class="ce-field__hint">' + esc(hint) + '</span>' : '') + '</span>' +
      '<input class="ce-input" type="text" data-path="' + attr(path) + '" value="' + attr(value || '') + '"' +
      (phKey ? ' placeholder="' + ph(phKey) + '"' : '') + '></label>';
  }

  /**
   * 富文本字段：可见的块编辑器 + 隐藏的 textarea。
   * 隐藏 textarea 继续承担 data-path 的读写，现有校验与导出逻辑无需改动；
   * 外层用 div 而非 label：label 会把任意点击转发给第一个可标记控件，
   * 即块右上角的「删除此块」按钮，导致点哪都弹删除确认。
   */
  function richAreaHtml(label, path, value, rows, phKey, hint) {
    return '<div class="ce-field"><span class="ce-field__label">' + esc(label) +
      (hint ? '<span class="ce-field__hint">' + esc(hint) + '</span>' : '') + '</span>' +
      '<div class="ce-rich-mount" data-rich-path="' + attr(path) + '"></div>' +
      '<textarea class="ce-textarea ce-rich__source" rows="' + (rows || 3) + '" data-path="' + attr(path) + '"' +
      (phKey ? ' placeholder="' + ph(phKey) + '"' : '') + ' aria-hidden="true" tabindex="-1">' +
      esc(value || '') + '</textarea></div>';
  }

  function optionHtml(base, oi, opt) {
    return '<div class="ce-row-3">' +
      '<input class="ce-input is-key" type="text" data-path="' + attr(base) + '.options.' + oi + '.key" value="' + attr(opt.key) + '" aria-label="' + attr(L('fields.options')) + '">' +
      '<input class="ce-input" type="text" data-path="' + attr(base) + '.options.' + oi + '.text" value="' + attr(opt.text) + '" placeholder="' + ph('optionPlaceholder') + '">' +
      '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" title="' + attr(L('itemActions.remove')) + '" aria-label="' + attr(L('itemActions.remove')) + '" data-act="del-option" data-base="' + attr(base) + '" data-oi="' + oi + '">×</button>' +
      '</div>';
  }

  function answerHtml(base, q) {
    var selected = Array.isArray(q.answer) ? q.answer : [q.answer];
    return '<div class="ce-field"><span class="ce-field__label">' + esc(L('fields.answer')) + '</span>' +
      '<div class="ce-choicegroup">' + (q.options || []).map(function (opt) {
        var on = selected.indexOf(opt.key) >= 0;
        return '<label class="ce-choice"><input type="radio" name="ans-' + attr(base) + '"' +
          ' data-answer="' + attr(base) + '" value="' + attr(opt.key) + '"' + (on ? ' checked' : '') + '>' +
          esc(opt.key) + '</label>';
      }).join('') + '</div></div>';
  }

  function choiceFormHtml(base, q) {
    return areaHtml(L('fields.stem'), base + '.stem', q.stem, 3, 'stem') +
      '<div class="ce-field"><span class="ce-field__label">' + esc(L('fields.options')) + '</span>' +
        (q.options || []).map(function (opt, oi) { return optionHtml(base, oi, opt); }).join('') +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-act="add-option" data-base="' + attr(base) + '">' +
          esc(L('addOption', { f: L('fields.options') })) + '</button></div>' +
      answerHtml(base, q) +
      richAreaHtml(L('fields.analysis'), base + '.analysis', q.analysis, 3, 'analysis');
  }

  function essayFormHtml(base, q) {
    var stems = Array.isArray(q.stems) ? q.stems.join('\n') : (q.stems || '');
    return '' +
      areaHtml(L('fields.stems'), base + '.stems', stems, 3, 'stems') +
      richAreaHtml(L('fields.reference'), base + '.referenceAnswer', q.referenceAnswer, 4, 'reference') +
      richAreaHtml(L('fields.analysis'), base + '.analysis', q.analysis, 3, 'analysis');
  }

  function itemFormHtml(qbase, qi, q) {
    var base = qbase + '.' + qi;
    var isEssay = q.type === 'essay';
    var kindLabel = isEssay ? L('kinds.essay') : L('kinds.choice');
    return '<div class="ce-card ce-card--item" data-base="' + attr(base) + '">' +
      '<div class="ce-card__head">' +
        '<span class="ce-qno">题目 ' + (qi + 1) + '</span>' +
        '<span class="ce-tag' + (isEssay ? ' ce-tag--info' : '') + '">' + esc(kindLabel) + '</span>' +
        '<span class="ce-panel__grow"></span>' +
        '<div class="ce-card__actions">' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" title="' + attr(L('itemActions.up')) + '" aria-label="' + attr(L('itemActions.up')) + '" data-act="up-item" data-qbase="' + attr(qbase) + '" data-qi="' + qi + '">↑</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" title="' + attr(L('itemActions.down')) + '" aria-label="' + attr(L('itemActions.down')) + '" data-act="down-item" data-qbase="' + attr(qbase) + '" data-qi="' + qi + '">↓</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-act="dup-item" data-qbase="' + attr(qbase) + '" data-qi="' + qi + '">' + esc(L('itemActions.duplicate')) + '</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-act="del-item" data-qbase="' + attr(qbase) + '" data-qi="' + qi + '">' + esc(L('itemActions.remove')) + '</button>' +
        '</div>' +
      '</div>' +
      (isEssay ? essayFormHtml(base, q) : choiceFormHtml(base, q)) +
      '</div>';
  }

  function addItemButtonsHtml(qbase, emphasizeFirst) {
    return '<div class="ce-btn-row ce-additems">' + (CFG.schema.itemKinds || []).map(function (k, i) {
      var kindLabel = getPath(CFG.labels.kinds, k) || k;
      var cls = 'ce-btn ce-btn--sm' + (emphasizeFirst && i === 0 ? ' ce-btn--primary' : '');
      return '<button class="' + cls + '" type="button" data-act="add-item" data-kind="' + attr(k) + '" data-qbase="' + attr(qbase) + '">' +
        esc(L('addItem', { k: kindLabel })) + '</button>';
    }).join('') + '</div>';
  }

  function hintCardHtml() {
    return '<div class="ce-hintcard">' +
      '<div class="ce-hintcard__text">' +
        '<p class="ce-hintcard__title">' + esc(L('hintCard.title')) + '</p>' +
        '<p class="ce-hintcard__desc">' + esc(L('hintCard.desc')) + '</p>' +
      '</div>' +
      '</div>';
  }

  /** 题组卡片：材料 + 题目列表；外层为强容器，内层题目为弱卡片 */
  function groupCardHtml(gbase, gi, g, titlePath) {
    var qbase = gbase + '.' + gi + '.questions';
    var qs = g.questions || [];
    var title = titlePath
      ? '<input class="ce-input ce-group__title" type="text" data-path="' + attr(titlePath) + '" value="' + attr(g.title || '') + '" placeholder="' + ph('sectionTitle') + '">'
      : '';
    return '<div class="ce-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">' +
      '<div class="ce-group__head">' +
        '<span class="ce-group__badge">题组 ' + (gi + 1) + '</span>' +
        title +
        '<span class="ce-group__meta">' + esc(L('questionCount', { n: qs.length })) + '</span>' +
        '<span class="ce-panel__grow"></span>' +
        '<div class="ce-group__actions">' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" title="' + attr(L('itemActions.up')) + '" aria-label="' + attr(L('itemActions.up')) + '" data-act="up-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">↑</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" title="' + attr(L('itemActions.down')) + '" aria-label="' + attr(L('itemActions.down')) + '" data-act="down-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">↓</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-act="dup-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">' + esc(L('itemActions.duplicate')) + '</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-act="del-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">' + esc(L('itemActions.remove')) + '</button>' +
        '</div>' +
      '</div>' +
      richAreaHtml(L('fields.material'), gbase + '.' + gi + '.material', g.material, 3, 'material') +
      '<div class="ce-group__questions">' +
        (qs.length ? '' : '<p class="ce-group__empty">该题组还没有题目，从下方新增选择题或综合题。</p>') +
        qs.map(function (q, qi) { return itemFormHtml(qbase, qi, q); }).join('') +
        addItemButtonsHtml(qbase, !qs.length) +
      '</div>' +
      '</div>';
  }

  function addGroupButtonHtml(gbase) {
    return '<button class="ce-btn ce-btn--primary ce-addgroup" type="button" data-act="add-group" data-gbase="' + attr(gbase) + '">' +
      esc(L('addGroup')) + '</button>';
  }

  function groupEditorHtml(it) {
    var mod = ensureGroup(it);
    var gbase = 'modules.' + it.id + '.groups';
    var groups = mod.groups || [];
    return '<div class="ce-headline">' +
        (it.no ? '<span class="ce-index">' + esc(it.no) + '</span>' : '') +
        '<h2 class="ce-headline__title">' + esc((it.orphan ? L('orphanPrefix') : '') + (it.title || it.id)) + '</h2>' +
      '</div>' +
      '<div class="ce-card ce-card--groups">' +
        '<h3 class="ce-subhead">' + esc(L('sectionTitles.items')) +
          '<span class="ce-subhead__count">' + esc(L('itemCount', { n: groups.length })) + '</span></h3>' +
        (groups.length ? '' : hintCardHtml()) +
        groups.map(function (g, gi) { return groupCardHtml(gbase, gi, g, ''); }).join('') +
        addGroupButtonHtml(gbase) +
      '</div>';
  }

  function auxiliaryEditorHtml(it) {
    if (!state.postLesson) state.postLesson = { title: '', subtitle: '', sections: [] };
    var pl = state.postLesson;
    if (!pl.sections) pl.sections = [];
    var gbase = 'postLesson.sections';
    return '<div class="ce-headline">' +
        (it.no ? '<span class="ce-index">' + esc(it.no) + '</span>' : '') +
        '<h2 class="ce-headline__title">' + esc(it.title || pl.title || L('auxiliaryFallback')) + '</h2>' +
      '</div>' +
      '<div class="ce-card">' +
        '<h3 class="ce-subhead">' + esc(L('sectionTitles.content')) + '</h3>' +
        inputHtml(L('fields.auxiliaryTitle'), 'postLesson.title', pl.title, 'sectionTitle') +
        inputHtml(L('fields.auxiliarySubtitle'), 'postLesson.subtitle', pl.subtitle) +
      '</div>' +
      '<div class="ce-card ce-card--groups">' +
        '<h3 class="ce-subhead">' + esc(L('sectionTitles.items')) +
          '<span class="ce-subhead__count">' + esc(L('itemCount', { n: pl.sections.length })) + '</span></h3>' +
        (pl.sections.length ? '' : hintCardHtml()) +
        pl.sections.map(function (sec, si) {
          return groupCardHtml(gbase, si, sec, gbase + '.' + si + '.title');
        }).join('') +
        addGroupButtonHtml(gbase) +
      '</div>';
  }

  function emptyStateHtml() {
    var steps = (CFG.labels.guide.steps || []).map(function (s, i) {
      var hint = (CFG.labels.guide.hints || [])[i] || '';
      return '<li class="ce-empty__step">' +
        '<span class="ce-index">' + (i + 1) + '</span>' +
        '<span><strong>' + esc(s) + '</strong>' + (hint ? '<br><span class="ce-field__hint">' + esc(hint) + '</span>' : '') + '</span></li>';
    }).join('');
    return '<div class="ce-empty">' +
      '<div class="ce-empty__icon" aria-hidden="true">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9 9v11"/></svg>' +
      '</div>' +
      '<p class="ce-empty__title">' + esc(L('notLoadedTitle')) + '</p>' +
      '<p class="ce-empty__text">' + esc(L('notLoadedText')) + '</p>' +
      '<ol class="ce-empty__steps">' + steps + '</ol>' +
      '<div class="ce-empty__actions">' +
        '<button class="ce-btn ce-btn--primary" type="button" data-act="import-structure">' + esc(L('actions.importStructure')) + '</button>' +
        '<button class="ce-btn" type="button" data-act="load-local">' + esc(L('actions.loadLocal')) + '</button>' +
      '</div>' +
      '<p class="ce-empty__text ce-field__hint">' + esc(L('dropHint')) + '</p>' +
    '</div>';
  }

  var richFields = [];

  /** 把当前编辑区里的富文本字段挂载成块编辑器（隐藏 textarea 仍是数据源） */
  function enhanceRichFields() {
    richFields.forEach(function (f) {
      try { f.destroy(); } catch (e) { /* ignore */ }
    });
    richFields = [];
    els('#editor .ce-rich-mount').forEach(function (mount) {
      var path = mount.getAttribute('data-rich-path');
      var source = el('#editor [data-path="' + path + '"]');
      if (!source) return;
      richFields.push(createRichField({
        mount: mount,
        value: source.value,
        onInput: function (html) {
          source.value = html;
          source.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }));
    });
  }

  function renderEditor() {
    var node = el('#editor');
    if (!node) return;
    if (!manifest && navItems().length === 0) {
      node.innerHTML = emptyStateHtml();
      return;
    }
    var it = selectedItem();
    if (!it) { node.innerHTML = '<p class="ce-status">' + esc(L('selectionEmpty')) + '</p>'; return; }
    node.innerHTML = it.kind === 'auxiliary' ? auxiliaryEditorHtml(it) : groupEditorHtml(it);
    enhanceRichFields();
  }

  /* ==========================================================
     十、分组导航渲染
     ========================================================== */
  function renderNav() {
    var items = navItems();
    var html = items.map(function (it) {
      var n = it.kind === 'group' ? unitCount(it.id) : auxiliaryUnitCount();
      var cls = 'ce-nav__item' +
        (it.id === selectedId ? ' is-active' : '') +
        (it.orphan ? ' ce-nav__item--dim' : '');
      return '<button class="' + cls + '" type="button" data-select="' + attr(it.id) + '">' +
        '<span class="ce-nav__line">' +
          (it.no ? '<span class="ce-index">' + esc(it.no) + '</span>' : '') +
          '<span class="ce-nav__name">' + esc(it.title || it.id) + '</span>' +
        '</span>' +
        '<span class="ce-nav__meta' + (n === 0 ? ' is-empty' : '') + '">' + esc(L('itemCount', { n: n })) + '</span>' +
        '</button>';
    }).join('');
    el('#tree').innerHTML = html || '<p class="ce-note">' + esc(L('emptyNav')) + '</p>';

    var sub = el('#context-badge');
    if (sub) {
      var ctx = manifest ? (manifest.title || manifest.lesson || '') : '';
      sub.textContent = ctx || L('statusMissing');
    }
    var st = el('#tree-status');
    if (st) {
      var notes = navSummary();
      st.textContent = manifest
        ? (notes.length ? notes.join('；') : L('statusReady'))
        : L('statusMissing');
      st.className = 'ce-note' + (manifest && notes.length ? ' ce-status--warn' : '');
    }
  }

  function navSummary() {
    var notes = [];
    var unedited = [];
    navItems().forEach(function (it) {
      if (it.kind !== 'group' || it.orphan) return;
      if (!groupCount(it.id)) unedited.push(it.id);
    });
    var known = {};
    ((manifest && manifest.modules) || []).forEach(function (m) { known[m.id] = true; });
    var orphans = Object.keys((state && state.modules) || {}).filter(function (id) {
      var mod = state.modules[id];
      return !known[id] && mod && questionsOf(mod).length;
    });
    if (unedited.length) notes.push(L('validation.unedited', { n: unedited.length }));
    if (orphans.length) notes.push(L('validation.orphan', { n: orphans.length }));
    return notes;
  }

  /* ==========================================================
     十一、预览渲染（公共运行时 · 嵌入整窗）
     ----------------------------------------------------------
     预览不再自建一套卡片 HTML，而是把当前分组 / 课后练习交给
     公共运行时，在 1920×1080 画布里以「嵌入窗口」呈现，
     因此结构与真实课程完全一致。
     ========================================================== */
  var previewStage = null;
  var previewHandle = null;
  var previewZoom = 'fit';

  /** 预览数据：只渲染当前分组 / 课后练习 */
  function previewPayload(it) {
    if (it.kind === 'group') {
      var mod = (state.modules && state.modules[it.id]) || {};
      return {
        kind: 'group',
        title: mod.title || it.title || '',
        subtitle: mod.intro || '',
        groups: mod.groups || []
      };
    }
    var pl = state.postLesson || {};
    return {
      kind: 'auxiliary',
      title: pl.title || L('auxiliaryFallback'),
      subtitle: pl.subtitle || '',
      sections: pl.sections || []
    };
  }

  function disposePreview() {
    if (previewHandle) { previewHandle.close(); previewHandle = null; }
    if (previewStage) { previewStage.destroy(); previewStage = null; }
  }

  function renderPreview() {
    var node = el('#preview');
    if (!node) return;
    disposePreview();
    var it = selectedItem();
    if (!it) {
      node.innerHTML = '<p class="ce-preview__empty">' + esc(L('selectionEmpty')) + '</p>';
      renderOutput();
      return;
    }

    node.innerHTML = '';
    previewStage = createPreviewStage({ zoom: previewZoom });
    node.appendChild(previewStage.root);

    var payload = previewPayload(it);
    var aux = payload.kind === 'auxiliary';
    previewHandle = openPracticeWindow({
      container: previewStage.mount,
      display: 'embedded',
      title: payload.title,
      subtitle: payload.subtitle,
      groups: aux ? undefined : payload.groups,
      sections: aux ? payload.sections : undefined,
      timer: !aux,
      closable: !aux,
      resetBar: !aux,
      emptyTitle: aux ? L('auxiliaryEmpty') : L('groupEmpty')
    });
    renderOutput();
  }

  function applyPreviewZoom(next) {
    previewZoom = next;
    if (previewStage) previewStage.setZoom(next);
    els('#preview-zoom .ce-segment__btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.zoom === String(next)));
    });
  }

  /* ==========================================================
     十二、导出与校验
     ========================================================== */
  function generated() {
    var modules = {};
    Object.keys((state && state.modules) || {}).forEach(function (id) {
      var mod = state.modules[id];
      if (!mod) return;
      var groups = (mod.groups || []).filter(function (g) {
        return g && g.questions && g.questions.length;
      });
      if (!groups.length) return;
      var out = {};
      if (mod.title) out.title = mod.title;
      if (mod.intro) out.intro = mod.intro;
      /* 题组为正式结构；questions 同步扁平化，兼容尚未升级的消费方 */
      out.groups = groups.map(function (g) {
        return { material: g.material || '', questions: g.questions };
      });
      out.questions = [];
      groups.forEach(function (g) {
        g.questions.forEach(function (q) {
          var copy = clone(q);
          if (g.material) copy.material = g.material;
          else delete copy.material;
          out.questions.push(copy);
        });
      });
      modules[id] = out;
    });
    var payload = {
      version: 3,
      lesson: state.lesson || (manifest && manifest.lesson) || '',
      updatedAt: new Date().toISOString(),
      modules: modules
    };
    if (state.postLesson) payload.postLesson = state.postLesson;
    return '/* Generated by Content Editor */\n' +
      'window.' + SRC.exportGlobal + ' = ' + JSON.stringify(payload, null, 2) + ';\n';
  }
  function renderOutput() { var o = el('#output'); if (o) o.value = generated(); }

  /** 校验：返回结构化问题（含可定位的 base 与字段路径），供状态条与高亮共用 */
  function collectIssues() {
    var issues = [];
    function push(label, message, base, paths) {
      issues.push({ label: label, message: message, base: base, paths: paths || [] });
    }
    if (!manifest) {
      push('', L('validation.structureMissing'), '', []);
    }
    if (totalItems() === 0) {
      push('', L('validation.empty'), '', []);
    }

    function check(q, base, label) {
      if (q.type === 'essay') {
        var stems = (Array.isArray(q.stems) ? q.stems : [q.stems]).filter(function (s) { return s && String(s).trim(); });
        if (!stems.length) push(label, L('validation.missingField', { label: label, field: L('fields.stems') }), base, [base + '.stems']);
        if (!q.referenceAnswer) push(label, L('validation.missingField', { label: label, field: L('fields.reference') }), base, [base + '.referenceAnswer']);
        return;
      }
      if (!q.stem) push(label, L('validation.missingField', { label: label, field: L('fields.stem') }), base, [base + '.stem']);
      var optPaths = (q.options || []).map(function (o, i) { return base + '.options.' + i + '.text'; });
      var filled = (q.options || []).filter(function (o) { return o && String(o.text).trim(); });
      if (filled.length < 2) push(label, L('validation.tooFewOptions', { label: label, field: L('fields.options') }), base, optPaths);
      var keys = (q.options || []).map(function (o) { return o.key; });
      var answers = (Array.isArray(q.answer) ? q.answer : [q.answer]).filter(function (a) { return keys.indexOf(a) >= 0; });
      if (!answers.length) push(label, L('validation.invalidAnswer', { label: label, field: L('fields.answer') }), base, []);
    }

    Object.keys((state && state.modules) || {}).forEach(function (id) {
      var mod = state.modules[id];
      if (!mod) return;
      var it = findItem(id);
      var label = groupLabel(it) || id;
      (mod.groups || []).forEach(function (g, gi) {
        (g.questions || []).forEach(function (q, qi) {
          check(q, 'modules.' + id + '.groups.' + gi + '.questions.' + qi,
            label + ' 题组' + (gi + 1) + ' 第' + (qi + 1) + '题');
        });
      });
    });
    var pl = state.postLesson;
    if (pl && pl.sections) {
      pl.sections.forEach(function (sec, si) {
        (sec.questions || []).forEach(function (q, qi) {
          check(q, 'postLesson.sections.' + si + '.questions.' + qi,
            (sec.title || '题组' + (si + 1)) + ' 第' + (qi + 1) + '题');
        });
      });
    }
    return issues;
  }

  /** 把问题标记到编辑区对应字段上 */
  function markInvalid(issues) {
    els('#editor .is-invalid').forEach(function (n) { n.classList.remove('is-invalid'); });
    els('#editor [aria-invalid="true"]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    els('#editor .ce-card--item[data-base]').forEach(function (card) {
      var base = card.getAttribute('data-base');
      var hit = issues.some(function (is) { return is.base === base; });
      card.classList.toggle('is-invalid', hit);
    });
    issues.forEach(function (is) {
      is.paths.forEach(function (p, idx) {
        var node = el('#editor [data-path="' + p + '"]');
        if (!node) return;
        node.classList.add('is-invalid');
        node.setAttribute('aria-invalid', 'true');
        var wrap = node.classList.contains('ce-rich__source') && node.parentElement
          ? node.parentElement.querySelector('.ce-rich-mount')
          : null;
        if (wrap) wrap.classList.add('is-invalid');
        if (idx === 0 && !node.id) node.id = 'inv-' + p.replace(/[^a-zA-Z0-9]/g, '-');
      });
    });
  }

  function renderValidation(issues) {
    issues = issues || collectIssues();
    var notes = navSummary();
    var node = el('#status-bar');
    var badge = el('#issue-badge');
    if (badge) {
      badge.textContent = String(issues.length);
      badge.hidden = issues.length === 0;
    }
    if (node) {
      var ok = issues.length === 0;
      var head = ok
        ? L('validation.summaryOk')
        : L('validation.summaryIssues', { n: issues.length }) + (issues[0] ? issues[0].message : '');
      node.innerHTML = esc(head) +
        (!ok && issues.some(function (i) { return i.base; })
          ? ' <button class="ce-linkbtn" type="button" data-act="locate-issue">' + esc(L('validation.locate')) + '</button>'
          : '') +
        (notes.length ? ' <span class="ce-field__hint">· ' + esc(notes.join('；')) + '</span>' : '');
      node.className = 'ce-status' + (ok ? (notes.length ? ' ce-status--warn' : ' ce-status--ok') : ' ce-status--error');
    }
    return issues;
  }

  function locateFirstIssue(issues) {
    var first = issues.filter(function (i) { return i.paths && i.paths.length; })[0];
    var target = first ? el('#editor [data-path="' + first.paths[0] + '"]')
      : (issues[0] && issues[0].base ? el('#editor .ce-card--item[data-base="' + issues[0].base + '"]') : null);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (target.classList && target.classList.contains('ce-rich__source')) {
        var mount = target.parentElement && target.parentElement.querySelector('.ce-rich-mount');
        var editable = mount && mount.querySelector('.se-contents');
        if (editable) editable.focus({ preventScroll: true });
      } else if (target.focus) {
        target.focus({ preventScroll: true });
      }
    }
  }

  /* ==========================================================
     十三、全量渲染
     ========================================================== */
  function renderAll() {
    ensureSelected();
    renderNav();
    renderEditor();          /* 可能惰性创建分组对象，故先渲染再统一校验 */
    var issues = collectIssues();
    markInvalid(issues);
    renderPreview();
    renderValidation(issues);
    renderGuide();
  }
  /** 仅输入时的轻量更新：不重建编辑区（避免失焦） */
  function renderOnInput() {
    var issues = collectIssues();
    markInvalid(issues);
    renderNav();
    renderPreview();
    renderValidation(issues);
    renderGuide();
  }

  /* ==========================================================
     十四、结构操作
     ========================================================== */
  function renumberOptions(q) {
    q.options.forEach(function (o, i) { o.key = String.fromCharCode(65 + i); });
  }

  function handleStruct(act, t) {
    var qbase = t.dataset.qbase, qi = Number(t.dataset.qi);
    var base = t.dataset.base, oi = Number(t.dataset.oi);
    var gbase = t.dataset.gbase, gi = Number(t.dataset.gi);
    var arr, q;
    switch (act) {
      case 'add-group':
        arr = getPath(state, gbase);
        if (arr) arr.push(newGroup());
        break;
      case 'del-group':
        arr = getPath(state, gbase);
        if (!arr) return;
        confirmDialog(L('dialog.removeSection'), function () {
          getPath(state, gbase).splice(gi, 1);
          saveDraft(); renderAll();
        });
        return;
      case 'dup-group':
        arr = getPath(state, gbase);
        if (arr) arr.splice(gi + 1, 0, clone(arr[gi]));
        break;
      case 'up-group':
        arr = getPath(state, gbase);
        if (arr && gi > 0) arr.splice(gi - 1, 0, arr.splice(gi, 1)[0]);
        break;
      case 'down-group':
        arr = getPath(state, gbase);
        if (arr && gi < arr.length - 1) arr.splice(gi + 1, 0, arr.splice(gi, 1)[0]);
        break;
      case 'add-section':
        if (!state.postLesson) state.postLesson = { title: '', subtitle: '', sections: [] };
        if (!state.postLesson.sections) state.postLesson.sections = [];
        state.postLesson.sections.push(newGroup());
        break;
      case 'del-section':
        arr = getPath(state, 'postLesson.sections');
        if (!arr) return;
        confirmDialog(L('dialog.removeSection'), function () {
          getPath(state, 'postLesson.sections').splice(Number(t.dataset.si), 1);
          saveDraft(); renderAll();
        });
        return;
      case 'add-item':
        arr = getPath(state, qbase);
        if (arr) arr.push(newItem(t.dataset.kind));
        break;
      case 'del-item':
        arr = getPath(state, qbase);
        if (!arr) return;
        confirmDialog(L('dialog.removeItem'), function () {
          getPath(state, qbase).splice(qi, 1);
          saveDraft(); renderAll();
        });
        return;
      case 'dup-item':
        arr = getPath(state, qbase);
        if (arr) arr.splice(qi + 1, 0, clone(arr[qi]));
        break;
      case 'up-item':
        arr = getPath(state, qbase);
        if (arr && qi > 0) arr.splice(qi - 1, 0, arr.splice(qi, 1)[0]);
        break;
      case 'down-item':
        arr = getPath(state, qbase);
        if (arr && qi < arr.length - 1) arr.splice(qi + 1, 0, arr.splice(qi, 1)[0]);
        break;
      case 'add-option':
        q = getPath(state, base);
        if (q && q.options) q.options.push({ key: String.fromCharCode(65 + q.options.length), text: '' });
        break;
      case 'del-option':
        q = getPath(state, base);
        if (!q || !q.options) return;
        if (q.options.length <= 2) { toast(L('toast.keepTwoOptions'), 'warn'); return; }
        q.options.splice(oi, 1); renumberOptions(q);
        if (!Array.isArray(q.answer) && q.options.every(function (o) { return o.key !== q.answer; })) q.answer = q.options[0].key;
        break;
      default: return;
    }
    saveDraft(); renderAll();
  }

  function selectItem(id) {
    selectedId = id;
    var it = findItem(id);
    if (it && it.kind === 'group') ensureGroup(it);
    renderAll();
  }

  /* ==========================================================
     十五、导入 / 导出 / 就近读写
     ========================================================== */
  function download() {
    var blob = new Blob([generated()], { type: 'text/javascript;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = SRC.exportFile;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast(L('toast.exported', { name: SRC.exportFile }), 'ok');
  }

  function manualCopy(text) {
    var ta = el('#output');
    ta.value = text; ta.select();
    toast(L('toast.copyManual'), 'warn');
  }
  function copyOut() {
    var text = generated();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(L('toast.copied'), 'ok'); },
        function () { manualCopy(text); });
    } else { manualCopy(text); }
  }

  function importDataFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var raw = String(reader.result);
        var m = raw.match(/\{[\s\S]*\}/);
        var parsed = JSON.parse(m ? m[0] : raw);
        if (adopt(parsed)) { saveDraft(); ensureSelected(); renderAll(); toast(L('toast.imported'), 'ok'); }
        else throw new Error(L('toast.unparsable'));
      } catch (err) { toast(L('toast.importFailed', { msg: err.message }), 'error'); }
    };
    reader.readAsText(file);
  }

  function adopt(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.modules || data.postLesson) {
      state = {
        version: data.version || 1,
        lesson: data.lesson || (manifest && manifest.lesson) || '',
        updatedAt: data.updatedAt || '',
        modules: data.modules ? clone(data.modules) : {},
        postLesson: data.postLesson ? clone(data.postLesson)
          : { title: L('auxiliaryFallback'), subtitle: '', sections: [] }
      };
      normalizeState();
      return true;
    }
    if (data.sections) {
      state = emptyState();
      state.postLesson = { title: data.title || L('auxiliaryFallback'), subtitle: data.subtitle || '', sections: data.sections };
      normalizeState();
      return true;
    }
    return false;
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { if (s.parentNode) s.parentNode.removeChild(s); resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function loadStructure() {
    if (window[SRC.structureGlobal]) return Promise.resolve(window[SRC.structureGlobal]);
    return loadScript(SRC.structureFile).then(function () { return window[SRC.structureGlobal] || null; });
  }
  function loadContent() {
    if (window[SRC.dataGlobal]) return Promise.resolve(window[SRC.dataGlobal]);
    return loadScript(SRC.dataFile).then(function () { return window[SRC.dataGlobal] || null; });
  }

  /** 结构清单缺失时的回退：用配置中的选择器从结构页面现场抽取 */
  function extractStructureFromDoc(doc) {
    var modules = [], auxiliary = null;
    var sections = doc.querySelectorAll(EXT.section);
    Array.prototype.forEach.call(sections, function (sec) {
      var id = sec.id || '';
      if (!id) return;
      var noEl = EXT.num ? sec.querySelector(EXT.num) : null;
      var titleEl = EXT.title ? sec.querySelector(EXT.title) : null;
      var btn = EXT.practiceBtn ? sec.querySelector(EXT.practiceBtn) : null;
      var clean = function (node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; };
      var no = clean(noEl), title = clean(titleEl);
      var nav = EXT.navAttr ? (sec.getAttribute(EXT.navAttr) || '') : '';
      if (!btn) { auxiliary = { id: id, no: no, nav: nav, title: title }; return; }
      modules.push({
        key: (EXT.practiceKeyAttr && btn.getAttribute(EXT.practiceKeyAttr)) || '',
        id: id, no: no, nav: nav, title: title, practice: true,
        kind: (EXT.practiceKindAttr && btn.getAttribute(EXT.practiceKindAttr)) || 'choice'
      });
    });
    return {
      contract: 'structure-manifest', version: 1, lesson: '', title: doc.title || '',
      generatedAt: new Date().toISOString(), modules: modules, postLesson: auxiliary
    };
  }

  function loadStructureFromFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var doc = new DOMParser().parseFromString(String(reader.result), 'text/html');
        var m = extractStructureFromDoc(doc);
        if (!m.modules.length && !m.postLesson) throw new Error('no sections matched');
        applyManifest(m);
        toast(L('toast.structureLoaded', { n: m.modules.length }), 'ok');
      } catch (err) { toast(L('toast.structureFailed', { msg: err.message }), 'error'); }
    };
    reader.readAsText(file);
  }

  function applyManifest(m) {
    if (!m) return false;
    manifest = m;
    if (!state) state = emptyState();
    state.lesson = state.lesson || manifest.lesson || '';
    if (!state.postLesson) state.postLesson = emptyState().postLesson;
    ensureSelected();
    renderAll();
    return true;
  }

  function saveToFile() {
    var btn = el('[data-act="save-local"]');
    var text = generated();
    if (!window.showSaveFilePicker) { download(); return; }
    setBusy(btn, true);
    window.showSaveFilePicker({
      suggestedName: SRC.exportFile,
      types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }]
    }).then(function (handle) {
      return handle.createWritable().then(function (w) {
        return w.write(text).then(function () { return w.close(); });
      });
    }).then(function () {
      setBusy(btn, false);
      toast(L('toast.saved'), 'ok');
    }).catch(function (err) {
      setBusy(btn, false);
      if (err && err.name === 'AbortError') return;
      toast(L('toast.saveFallback'), 'warn');
      download();
    });
  }

  /* ==========================================================
     十七、主题 / 布局
     ========================================================== */
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolvedTheme() {
    if (CFG.theme === 'light' || CFG.theme === 'dark') return CFG.theme;
    return (mql && mql.matches) ? 'dark' : 'light';
  }
  function applyTheme() {
    document.body.setAttribute('data-theme', resolvedTheme());
  }
  function toggleTheme() {
    var next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    CFG.theme = next;
    storeSet(THEME_KEY, next);
    applyTheme();
  }

  function loadPrefs() {
    var rawTheme = storeGet(THEME_KEY);
    if (rawTheme === 'light' || rawTheme === 'dark') CFG.theme = rawTheme;
    var rawLayout = storeGet(LAYOUT_KEY);
    if (rawLayout) {
      try {
        var saved = JSON.parse(rawLayout);
        if (saved && typeof saved.nav === 'boolean') CFG.layout.nav = saved.nav;
        if (saved && typeof saved.preview === 'boolean') CFG.layout.preview = saved.preview;
      } catch (e) { /* 忽略 */ }
    }
    guideDismissed = storeGet(GUIDE_KEY) === '1';
  }
  function saveLayoutPref() {
    storeSet(LAYOUT_KEY, JSON.stringify({ nav: CFG.layout.nav, preview: CFG.layout.preview }));
  }
  function applyLayout() {
    var b = document.body;
    b.setAttribute('data-density', CFG.density);
    b.setAttribute('data-nav', CFG.layout.nav ? 'on' : 'off');
    b.setAttribute('data-preview', CFG.layout.preview ? 'on' : 'off');
    b.setAttribute('data-preview-placement', CFG.layout.previewPlacement);
    if (CFG.layout.previewCollapsible && CFG.layout.preview) {
      b.setAttribute('data-preview-collapsed', collapsed.preview ? 'on' : 'off');
    } else {
      b.removeAttribute('data-preview-collapsed');
    }
    var btn = el('#preview-collapse-btn');
    if (btn) {
      btn.hidden = !(CFG.layout.previewCollapsible && CFG.layout.preview);
      btn.textContent = collapsed.preview ? L('previewExpand') : L('previewCollapse');
    }
    els('#panel-toggles .ce-segment__btn').forEach(function (b2) {
      var key = b2.dataset.panel;
      b2.setAttribute('aria-pressed', String(!!CFG.layout[key]));
    });
  }

  /* ==========================================================
     十八、顶栏 / 工具条静态结构渲染
     ========================================================== */
  function renderHeaderActions() {
    var node = el('#header-actions');
    if (!node) return;
    var a = CFG.labels.actions;
    node.innerHTML =
      '<div class="ce-actiongroup">' +
        '<button class="ce-btn ce-btn--sm" type="button" data-act="validate">' +
          esc(a.validate) + '<span class="ce-badge" id="issue-badge" hidden>0</span>' +
        '</button>' +
        '<div class="ce-menu">' +
          '<button class="ce-btn ce-btn--sm" type="button" data-act="toggle-menu" aria-haspopup="true" aria-expanded="false" title="' + attr(a.more) + '">' +
            esc(a.moreShort) +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
          '</button>' +
          '<div class="ce-menu__panel" id="more-menu" hidden>' +
            '<button class="ce-menu__item" type="button" data-act="import-structure">' + esc(a.importStructure) + '</button>' +
            '<button class="ce-menu__item" type="button" data-act="import-data">' + esc(a.importData) + '</button>' +
            '<button class="ce-menu__item" type="button" data-act="load-local">' + esc(a.loadLocal) + '</button>' +
            '<button class="ce-menu__item" type="button" data-act="copy">' + esc(a.copy) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<span class="ce-header__divider" aria-hidden="true"></span>' +
      '<div class="ce-actiongroup">' +
        '<button class="ce-btn ce-btn--sm" type="button" data-act="export">' + esc(a.export) + '</button>' +
        '<button class="ce-btn ce-btn--sm ce-btn--primary" type="button" data-act="save-local">' + esc(a.saveLocal) + '</button>' +
      '</div>';
  }

  function renderChrome() {
    document.title = L('appTitle');
    var t = el('#app-title'); if (t) t.textContent = L('appTitle');
    var n = el('#nav-title'); if (n) n.textContent = L('navTitle');
    var e = el('#editor-title'); if (e) e.textContent = L('editorTitle');
    var p = el('#preview-title'); if (p) p.textContent = L('previewTitle');
    var s = el('#output-summary'); if (s) s.textContent = L('outputSummary');
    var g = el('#guide-btn'); if (g) g.title = L('guide.reopen');

    /* 预览缩放：适应宽度 / 50% / 100%（画布固定 1920×1080） */
    var previewHead = el('#panel-preview .ce-panel__head');
    if (previewHead && !el('#preview-zoom')) {
      var zoom = document.createElement('div');
      zoom.className = 'ce-segment';
      zoom.id = 'preview-zoom';
      zoom.setAttribute('role', 'group');
      zoom.setAttribute('aria-label', '预览缩放');
      zoom.innerHTML = [['fit', '适应'], ['0.5', '50%'], ['1', '100%']].map(function (z) {
        return '<button class="ce-segment__btn" type="button" data-zoom="' + z[0] + '" aria-pressed="' +
          (String(previewZoom) === z[0] ? 'true' : 'false') + '">' + z[1] + '</button>';
      }).join('');
      previewHead.insertBefore(zoom, el('#preview-collapse-btn'));
    }

    var toggles = el('#panel-toggles');
    if (toggles) {
      if (CFG.layout.allowPanelToggle) {
        toggles.className = 'ce-toolbar__group ce-segment';
        toggles.innerHTML = ['nav', 'preview'].map(function (key) {
          var label = key === 'nav' ? L('navTitle') : L('previewTitle');
          return '<button class="ce-segment__btn" type="button" data-panel="' + key + '" aria-pressed="true">' + esc(label) + '</button>';
        }).join('');
      } else {
        toggles.className = 'ce-toolbar__group';
        toggles.innerHTML = '';
      }
    }

    var sf = el('#structure-file');
    if (sf) sf.accept = (SRC.acceptStructureExt || []).join(',');
    var df = el('#data-file');
    if (df) df.accept = (SRC.acceptDataExt || []).join(',');
  }

  /* ==========================================================
     十九、事件绑定
     ========================================================== */
  /** 引导第 3 步：新增一个题组并放入第一道题，避免出现空题组 */
  function guideAddGroup() {
    var it = selectedItem();
    if (!it) return;
    var kinds = CFG.schema.itemKinds || [];
    var group = newGroup();
    group.questions.push(newItem(kinds[0] || 'choice'));
    if (it.kind === 'auxiliary') {
      if (!state.postLesson) state.postLesson = { title: '', subtitle: '', sections: [] };
      if (!state.postLesson.sections) state.postLesson.sections = [];
      state.postLesson.sections.push(group);
    } else {
      ensureGroup(it).groups.push(group);
    }
    saveDraft(); renderAll();
  }

  function bindGlobal() {
    /* 输入：按 path 写回状态 */
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!(t.matches && t.matches('[data-path]'))) return;
      var path = t.dataset.path;
      if (/\.stems$/.test(path)) {
        setPath(state, path, t.value.split('\n'));
      } else {
        setPath(state, path, t.value);
      }
      saveDraft(); renderOnInput();
    });

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches && t.matches('[data-answer]')) {
        setPath(state, t.dataset.answer, t.value);
        saveDraft(); renderPreview(); renderValidation(); renderGuide(); return;
      }
      if (t.id === 'structure-file' && t.files && t.files[0]) { loadStructureFromFile(t.files[0]); t.value = ''; return; }
      if (t.id === 'data-file' && t.files && t.files[0]) { importDataFile(t.files[0]); t.value = ''; }
    });

    document.addEventListener('click', function (e) {
      var pick = e.target.closest ? e.target.closest('[data-select]') : null;
      if (pick) { closeMenu(); selectItem(pick.dataset.select); return; }

      var panelBtn = e.target.closest ? e.target.closest('[data-panel]') : null;
      if (panelBtn) {
        var key = panelBtn.dataset.panel;
        CFG.layout[key] = !CFG.layout[key];
        saveLayoutPref(); applyLayout();
        return;
      }

      /* 对话框动作（含遮罩点击）：不限于 button 元素 */
      var actEl = e.target.closest ? e.target.closest('[data-act]') : null;
      if (actEl) {
        var dashAct = actEl.dataset.act;
        if (dashAct === 'dialog-cancel') { closeDialog(); return; }
        if (dashAct === 'dialog-confirm') {
          var fn = dialogState.onConfirm;
          var keep = fn ? fn() : undefined;
          if (keep !== false) closeDialog();
          return;
        }
      }

      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t) { if (!(e.target.closest && e.target.closest('.ce-menu'))) closeMenu(); return; }

      var act = t.dataset.act;
      if (!act) return;

      switch (act) {
        case 'validate': {
          closeMenu();
          var issues = collectIssues();
          if (issues.length) {
            markInvalid(issues);
            toast(L('toast.validated', { n: issues.length, locate: L('validation.locate') }), 'warn');
          } else {
            toast(L('toast.validateOk'), 'ok');
          }
          renderValidation(); renderGuide();
          return;
        }
        case 'locate-issue': locateFirstIssue(collectIssues()); return;
        case 'export': closeMenu(); download(); return;
        case 'copy': closeMenu(); copyOut(); return;
        case 'save-local': closeMenu(); saveToFile(); return;
        case 'import-structure': closeMenu(); { var sf = el('#structure-file'); if (sf) sf.click(); } return;
        case 'import-data': closeMenu(); { var df = el('#data-file'); if (df) df.click(); } return;
        case 'load-local':
          closeMenu();
          loadContent().then(function (data) {
            if (adopt(data)) { ensureSelected(); renderAll(); toast(L('toast.localLoaded'), 'ok'); }
            else toast(L('toast.localMissing'), 'warn');
          });
          return;
        case 'toggle-menu': toggleMenu(); return;
        case 'toggle-theme': toggleTheme(); return;
        case 'preview-zoom': {
          var z = t.dataset.zoom;
          applyPreviewZoom(z === 'fit' ? 'fit' : Number(z));
          return;
        }
        case 'collapse-preview': collapsed.preview = !collapsed.preview; applyLayout(); return;
        case 'dismiss-guide':
          guideDismissed = true; guideForced = false;
          storeSet(GUIDE_KEY, '1'); renderGuide(); return;
        case 'show-guide':
          guideDismissed = false; guideForced = true;
          storeSet(GUIDE_KEY, ''); renderGuide(); return;
        case 'guide-select': {
          var first = navItems()[0];
          if (first) selectItem(first.id);
          return;
        }
        case 'guide-add-group':
          guideAddGroup();
          return;
        default: handleStruct(act, t);
      }
    });

    document.addEventListener('mousedown', function (e) {
      if (!(e.target.closest && e.target.closest('.ce-menu'))) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      trapFocus(e);
      if (e.key === 'Escape') {
        closeMenu();
        var dlg = el('#dialog');
        if (dlg && !dlg.hidden) { e.preventDefault(); closeDialog(); }
      }
    });

    /* 结构文件拖放（可配置关闭） */
    if (CFG.layout.acceptStructureDrop) {
      var nav = el('.ce-panel--nav');
      if (nav) {
        nav.addEventListener('dragover', function (e) { e.preventDefault(); nav.classList.add('is-dragover'); });
        nav.addEventListener('dragleave', function () { nav.classList.remove('is-dragover'); });
        nav.addEventListener('drop', function (e) {
          e.preventDefault(); nav.classList.remove('is-dragover');
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) loadStructureFromFile(f);
        });
      }
    }

    if (mql) {
      var onScheme = function () { if (CFG.theme === 'auto') applyTheme(); };
      if (mql.addEventListener) mql.addEventListener('change', onScheme);
      else if (mql.addListener) mql.addListener(onScheme);
    }
  }

  /* ==========================================================
     二十、启动
     ========================================================== */

  /**
   * 加载本课配色表：与课程共用同一份 quiz-theme.css（随编辑器放在 assets/ 子目录）。
   * 动态追加到 head 末尾，保证后于默认令牌生效；
   * 文件缺失时保持中性默认配色，不阻断编辑器。
   */
  function loadLessonTheme() {
    if (el('link[data-quiz-theme]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = SRC.themeFile || 'assets/quiz-theme.css';
    link.setAttribute('data-quiz-theme', '');
    document.head.appendChild(link);
  }

  function init() {
    loadLessonTheme();
    loadPrefs();
    applyTheme();

    state = emptyState();
    var hadDraft = loadDraft();

    renderChrome();
    renderHeaderActions();
    applyLayout();
    bindGlobal();
    renderAll();

    loadStructure().then(function (m) {
      if (m) manifest = m;
      if (manifest) {
        state.lesson = state.lesson || manifest.lesson || '';
        if (!state.postLesson) state.postLesson = emptyState().postLesson;
      }
      renderAll();
      return loadContent();
    }).then(function (data) {
      if (hadDraft) {
        if (data) toast(L('toast.draftLoaded', { label: L('actions.loadLocal') }));
        return;
      }
      if (adopt(data)) { ensureSelected(); renderAll(); toast(L('toast.localLoaded'), 'ok'); }
    }).catch(function (err) {
      if (window.console) console.error('[内容编辑器] 初始化失败', err);
    });
  }

  init();
})();