/* ============================================================
   内容编辑器（通用型）
   ------------------------------------------------------------
   预览直接复用公共运行时（窗口 / 卡片 / 样式），不再自建一套渲染。
   ============================================================ */
import { createPreviewStage } from '../../runtime/src/previewStage'
import { openPracticeWindow } from '../../runtime/src/practiceWindow'
import { createMaterialEditor } from './materialEditor'
import { ensureSlot } from '../../content/questionObjects'
import {
  buildPracticeData,
  ensureGroupKey,
  newGroup,
  newItem,
  normalizeModule,
  normalizeState,
  serializePracticeData,
  validQuestions
} from './model'
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
      inspector: true,
      allowPanelToggle: true,
      acceptStructureDrop: true,
      guide: true                  // 是否启用上手步骤引导条
    },

    labels: {
      appTitle: '内容编辑器',
      navTitle: '分组',
      inspectorTitle: '检查器',
      editorTitle: '画布',
      previewTitle: '预览',
      inspectorProps: '属性',
      inspectorPreview: '预览',
      previewFull: '放大',
      previewClose: '关闭',
      outputSummary: '输出预览 / 手动复制',
      groupTab: '题组 {n}',
      addGroupTab: '＋ 新增题组',
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

      groupToggle: { collapse: '收起题组', expand: '展开题组' },

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
        savedNamed: '已保存到 {name}',
        draftMerged: '已从同级题库补齐 {n} 个模块',
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
        removeItem: '删除该题目？此操作不可撤销。',
        lossySave: '当前草稿中缺少以下模块的题目：{list}。继续保存会覆盖同级数据文件并丢失这些题目，确定继续吗？',
        draftMissing: '当前草稿缺少同级题库中的这些模块：{list}。可以从同级文件补齐（只补空白模块，不改动草稿已有内容）。',
        fillFromLocal: '补齐缺失模块'
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
  /** 同级题库文件快照：用于保存前检测“草稿缺模块”的覆盖风险 */
  var sourceSnapshot = null;
  var selectedId = '';
  /** 当前分组模块下正在编辑的题组下标：item.id（课后练习用 'postLesson'） → index */
  var activeGroupIndex = {};
  /** 题组画布实例缓存：gkey → { editor, host, group }，切组只切显隐以保留各自的撤销栈 */
  var editorCache = {};
  /** 检查器当前页签：'props' | 'preview' */
  var activeTab = 'props';
  var guideDismissed = false;
  var guideForced = false;

  function emptyState() {
    return {
      /* v4：题组 groups + 自由布局材料（可含题目对象）+ 题目稳定 id */
      version: 4,
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

  /* 文件句柄持久化（IndexedDB）
     浏览器不允许网页按相对路径静默写盘，首次保存必须由用户在系统窗口中选择目标文件。
     记住该句柄后，后续「保存到同级文件」可直接覆盖，不再要求教师每次找路径。 */
  var FILE_DB = 'content-editor-fs';
  var FILE_STORE = 'handles';

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('indexedDB unavailable')); return; }
      var req = window.indexedDB.open(FILE_DB, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(FILE_STORE)) req.result.createObjectStore(FILE_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('indexedDB open failed')); };
    });
  }

  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(FILE_STORE, 'readonly').objectStore(FILE_STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbSet(key, value) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(FILE_STORE, 'readwrite');
        tx.objectStore(FILE_STORE).put(value, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  /** 草稿按课程隔离：同一浏览器编辑多课，避免互相覆盖 */
  function draftKey() {
    var lesson = (manifest && manifest.lesson) || (state && state.lesson) || '';
    return SRC.draftKey + (lesson ? ':' + lesson : '');
  }

  var saveTimer = null;
  function loadDraft() {
    var key = draftKey();
    var raw = storeGet(key);
    var legacy = false;
    if (!raw) { raw = storeGet(SRC.draftKey); legacy = !!raw; }
    if (!raw) return false;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.modules || parsed.postLesson)) {
        var lesson = (manifest && manifest.lesson) || (state && state.lesson) || '';
        // 旧版全局草稿未按课程隔离：只有 lesson 一致时才采用，避免串课
        if (legacy && lesson && parsed.lesson !== lesson) return false;
        state = parsed;
        normalizeState();
        if (legacy) storeSet(key, raw);
        return true;
      }
    } catch (e) { /* 损坏数据忽略 */ }
    return false;
  }
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { storeSet(draftKey(), JSON.stringify(state)); }, 300);
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
  function hintCardHtml() {
    return '<div class="ce-hintcard">' +
      '<div class="ce-hintcard__text">' +
        '<p class="ce-hintcard__title">' + esc(L('hintCard.title')) + '</p>' +
        '<p class="ce-hintcard__desc">' + esc(L('hintCard.desc')) + '</p>' +
      '</div>' +
      '</div>';
  }

  /* ---------- 题组工作区：顶部题组导航 + 单个画布 ---------- */

  /** 当前分组模块下的题组数组与数据路径 */
  function groupScope(it) {
    if (it.kind === 'auxiliary') {
      if (!state.postLesson) state.postLesson = { title: '', subtitle: '', sections: [] };
      if (!Array.isArray(state.postLesson.sections)) state.postLesson.sections = [];
      return { gbase: 'postLesson.sections', groups: state.postLesson.sections };
    }
    var mod = ensureGroup(it);
    return { gbase: 'modules.' + it.id + '.groups', groups: mod.groups || [] };
  }

  function scopeKey(it) {
    return it.kind === 'auxiliary' ? 'postLesson' : it.id;
  }

  function clampIndex(value, length) {
    if (!length) return 0;
    var n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n > length - 1 ? length - 1 : n;
  }

  function activeGroupOf(it, groups) {
    var key = scopeKey(it);
    var index = clampIndex(activeGroupIndex[key], groups.length);
    activeGroupIndex[key] = index;
    return index;
  }

  function renderGroupNav(it, groups, activeIndex) {
    var nav = el('#group-nav');
    if (!nav) return;
    if (!it) { nav.innerHTML = ''; return; }
    var gbase = it.kind === 'auxiliary' ? 'postLesson.sections' : 'modules.' + it.id + '.groups';
    nav.innerHTML = groups.map(function (g, gi) {
      var current = gi === activeIndex;
      return '<button class="ce-groupnav__tab' + (current ? ' is-active' : '') + '" type="button"' +
        ' role="tab" data-gslot="' + gi + '" aria-selected="' + String(current) + '">' +
        '<span>' + esc(L('groupTab', { n: gi + 1 })) + '</span>' +
        '<span class="ce-groupnav__count">' + esc(L('questionCount', { n: (g.questions || []).length })) + '</span>' +
        '</button>';
    }).join('') +
      '<button class="ce-groupnav__add" type="button" data-act="add-group" data-gbase="' + attr(gbase) + '">' +
        esc(L('addGroupTab')) + '</button>';
  }

  /** 当前题组条：序号、题数、上移 / 下移 / 复制 / 删除 */
  function workspaceBarHtml(gbase, gi, g) {
    return '<div class="ce-workspace__bar">' +
        '<span class="ce-group__badge">题组 ' + (gi + 1) + '</span>' +
        '<span class="ce-group__meta">' + esc(L('questionCount', { n: (g.questions || []).length })) + '</span>' +
        '<span class="ce-panel__grow"></span>' +
        '<div class="ce-group__actions">' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" title="' + attr(L('itemActions.up')) + '" aria-label="' + attr(L('itemActions.up')) + '" data-act="up-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">↑</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" title="' + attr(L('itemActions.down')) + '" aria-label="' + attr(L('itemActions.down')) + '" data-act="down-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">↓</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-act="dup-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">' + esc(L('itemActions.duplicate')) + '</button>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-act="del-group" data-gbase="' + attr(gbase) + '" data-gi="' + gi + '">' + esc(L('itemActions.remove')) + '</button>' +
        '</div>' +
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

  /* ---------- 题组画布实例：按题组稳定键缓存，切组只切显隐 ---------- */
  /** 当前前台实例：{ key, entry } */
  var currentEditor = null;

  function disposeEditor(key) {
    var entry = editorCache[key];
    if (!entry) return;
    try { entry.editor.destroy(); } catch (e) { /* ignore */ }
    delete editorCache[key];
    if (currentEditor && currentEditor.key === key) currentEditor = null;
  }

  /** 题库数据被整份替换（导入 / 载入 / 应用结构）后，旧实例全部作废 */
  function disposeEditorCache() {
    Object.keys(editorCache).forEach(disposeEditor);
    editorCache = {};
    currentEditor = null;
    var props = el('#inspector-props');
    if (props) props.innerHTML = '';
  }

  /** 当前前台实例失活：停止向共用属性栏写入 */
  function deactivateCurrentEditor() {
    if (!currentEditor) return;
    try { currentEditor.entry.editor.setActive(false); } catch (e) { /* ignore */ }
    currentEditor = null;
  }

  /** 挂载当前题组画布：已缓存则直接复用，保留该题组自己的撤销栈 */
  function mountGroupEditor(group) {
    var host = el('#workspace-canvas');
    if (!host) return;
    var propsHost = el('#inspector-props');
    var gkey = ensureGroupKey(group);

    if (currentEditor && currentEditor.key !== gkey) deactivateCurrentEditor();

    var entry = editorCache[gkey];
    if (entry && entry.group !== group) {
      disposeEditor(gkey);
      entry = null;
    }
    if (!entry) {
      var box = document.createElement('div');
      box.className = 'ce-mat-mount';
      box.setAttribute('data-gkey', gkey);
      var editor = createMaterialEditor({
        mount: box,
        group: group,
        propsHost: propsHost,
        createQuestion: newItem,
        confirm: function (message, onYes) {
          openDialog({
            title: L('dialog.title'),
            body: '<p class="ce-dialog__text">' + esc(message) + '</p>',
            confirmText: L('dialog.confirm'),
            danger: true,
            onConfirm: function () { onYes(); }
          });
        },
        onChange: function () {
          saveDraft();
          renderNav();
          invalidatePreview();
          renderValidation();
          renderGuide();
        }
      });
      entry = { editor: editor, host: box, group: group };
      editorCache[gkey] = entry;
    }

    host.appendChild(entry.host);
    entry.editor.setActive(true);
    currentEditor = { key: gkey, entry: entry };
  }

  /** 外部字段改动后只刷新前台画布，不重建实例 */
  function refreshActiveEditor() {
    if (!currentEditor) return;
    try { currentEditor.entry.editor.refresh(); } catch (e) { /* ignore */ }
  }

  function renderEditor() {
    var node = el('#editor');
    if (!node) return;
    if (!manifest && navItems().length === 0) {
      node.innerHTML = emptyStateHtml();
      renderGroupNav(null, [], 0);
      return;
    }
    var it = selectedItem();
    if (!it) {
      node.innerHTML = '<p class="ce-status">' + esc(L('selectionEmpty')) + '</p>';
      renderGroupNav(null, [], 0);
      return;
    }

    var scope = groupScope(it);
    var groups = scope.groups;
    var gi = activeGroupOf(it, groups);
    renderGroupNav(it, groups, gi);

    if (!groups.length) {
      deactivateCurrentEditor();
      var emptyProps = el('#inspector-props');
      if (emptyProps) emptyProps.innerHTML = '<p class="ce-mat-hint">当前分组还没有题组，点上方「＋ 新增题组」开始。</p>';
      node.innerHTML = hintCardHtml();
      return;
    }

    node.innerHTML = workspaceBarHtml(scope.gbase, gi, groups[gi]) +
      '<div class="ce-workspace__canvas" id="workspace-canvas"></div>';
    mountGroupEditor(groups[gi]);
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
  var overlayStage = null;
  var overlayHandle = null;
  var previewZoom = 'fit';
  /** 数据变更后置脏，切到预览页签或防抖到点时才真正重建（避免每次输入重绘整窗） */
  var previewDirty = true;
  var previewTimer = null;

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
      subtitle: '',
      /* 课后练习也按题组渲染，预览效果与题库模块完全一致 */
      groups: pl.sections || []
    };
  }

  /** 在指定容器里搭一套 1920×1080 预览舞台 + 嵌入练习窗口 */
  function mountPreview(container) {
    container.innerHTML = '';
    var it = selectedItem();
    if (!it) {
      container.innerHTML = '<p class="ce-preview__empty">' + esc(L('selectionEmpty')) + '</p>';
      return null;
    }
    var stage = createPreviewStage({ zoom: previewZoom });
    container.appendChild(stage.root);
    /* 挂载后重新按容器宽度计算缩放，避免离屏创建时按 0 宽度定尺寸 */
    stage.setZoom(previewZoom);

    var payload = previewPayload(it);
    var handle = openPracticeWindow({
      container: stage.mount,
      display: 'embedded',
      title: payload.title,
      subtitle: payload.subtitle,
      groups: payload.groups,
      timer: true,
      closable: true,
      resetBar: true,
      emptyTitle: it.kind === 'auxiliary' ? L('auxiliaryEmpty') : L('groupEmpty')
    });
    return { stage: stage, handle: handle };
  }

  function disposePreview() {
    if (previewHandle) { previewHandle.close(); previewHandle = null; }
    if (previewStage) { previewStage.destroy(); previewStage = null; }
  }

  function disposeOverlayPreview() {
    if (overlayHandle) { overlayHandle.close(); overlayHandle = null; }
    if (overlayStage) { overlayStage.destroy(); overlayStage = null; }
  }

  /** 只在预览页签可见时渲染；force 用于切页签 / 打开浮层 */
  function renderPreview(force) {
    if (activeTab !== 'preview') { previewDirty = true; return; }
    if (!force && !previewDirty && previewStage) return;
    var node = el('#preview');
    if (!node) return;
    disposePreview();
    previewDirty = false;
    var built = mountPreview(node);
    if (built) { previewStage = built.stage; previewHandle = built.handle; }
    renderOutput();
  }

  /** 数据变更：置脏；预览页签可见时防抖重建 */
  function invalidatePreview() {
    previewDirty = true;
    renderOutput();
    clearTimeout(previewTimer);
    if (activeTab !== 'preview') return;
    previewTimer = setTimeout(function () {
      previewTimer = null;
      renderPreview(true);
    }, 400);
  }

  function setInspectorTab(tab) {
    activeTab = tab === 'preview' ? 'preview' : 'props';
    els('#inspector-tabs .ce-segment__btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.inspectorTab === activeTab));
    });
    var isPreview = activeTab === 'preview';
    var props = el('#inspector-props');
    var pane = el('#inspector-preview');
    var zoom = el('#preview-zoom');
    var full = el('#preview-full-btn');
    if (props) props.hidden = isPreview;
    if (pane) pane.hidden = !isPreview;
    if (zoom) zoom.hidden = !isPreview;
    if (full) full.hidden = !isPreview;
    if (isPreview) renderPreview(true);
    else { disposePreview(); previewDirty = true; }
  }

  function openPreviewOverlay() {
    var overlay = el('#preview-overlay');
    var host = el('#preview-overlay-stage');
    if (!overlay || !host) return;
    disposeOverlayPreview();
    overlay.hidden = false;
    var built = mountPreview(host);
    if (built) {
      overlayStage = built.stage;
      overlayHandle = built.handle;
      /* 浮层刚显示时容器尺寸可能还没稳定，下一帧再按实际宽度缩放一次 */
      window.requestAnimationFrame(function () {
        if (overlayStage) overlayStage.setZoom(previewZoom);
      });
    } else overlay.hidden = true;
    var title = el('#preview-overlay-title');
    var it = selectedItem();
    if (title) title.textContent = (it && (it.title || it.id)) || L('previewTitle');
  }

  function closePreviewOverlay() {
    var overlay = el('#preview-overlay');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    disposeOverlayPreview();
  }

  function applyPreviewZoom(next) {
    previewZoom = next;
    if (previewStage) previewStage.setZoom(next);
    if (overlayStage) overlayStage.setZoom(next);
    els('#preview-zoom .ce-segment__btn, #preview-zoom-full .ce-segment__btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.zoom === String(next)));
    });
  }

  /* ==========================================================
     十二、导出与校验
     ========================================================== */
  /** 统计题库模块的题目数（兼容 groups / questions 两种结构） */
  function moduleQuestionCount(mod) {
    if (!mod) return 0;
    var n = (mod.questions || []).length;
    (mod.groups || []).forEach(function (g) { n += ((g && g.questions) || []).length; });
    return n;
  }
  function auxiliaryQuestionCount(pl) {
    return ((pl && pl.sections) || []).reduce(function (n, s) {
      return n + (((s && s.questions) || []).length);
    }, 0);
  }

  /** 同级题库中有、当前草稿中没有的模块（保存会丢失它们） */
  function missingSourceModules() {
    if (!sourceSnapshot) return [];
    var missing = [];
    Object.keys(sourceSnapshot.modules || {}).forEach(function (id) {
      if (!moduleQuestionCount(sourceSnapshot.modules[id])) return;
      if (questionsOf((state.modules || {})[id]).length) return;
      var it = findItem(id);
      missing.push(groupLabel(it) || id);
    });
    if (auxiliaryQuestionCount(sourceSnapshot.postLesson) && !auxiliaryCount()) {
      var auxId = (manifest && manifest.postLesson && manifest.postLesson.id) || 'auxiliary';
      var aux = findItem(auxId);
      missing.push((aux && groupLabel(aux)) || L('auxiliaryFallback'));
    }
    return missing;
  }

  /** 当前内存状态快照，保存成功后作为新的比较基线 */
  function snapshotFromState() {
    return {
      modules: clone((state && state.modules) || {}),
      postLesson: state && state.postLesson ? clone(state.postLesson) : null
    };
  }

  /** 用同级题库补齐草稿中为空的模块（不覆盖草稿已有内容） */
  function mergeMissingFromSource(data) {
    if (!data) return 0;
    if (!state.modules) state.modules = {};
    var added = 0;
    Object.keys(data.modules || {}).forEach(function (id) {
      if (questionsOf(state.modules[id]).length) return;
      if (!moduleQuestionCount(data.modules[id])) return;
      state.modules[id] = clone(data.modules[id]);
      added++;
    });
    if (auxiliaryQuestionCount(data.postLesson) && !auxiliaryCount()) {
      state.postLesson = clone(data.postLesson);
      added++;
    }
    if (added) { normalizeState(); disposeEditorCache(); saveDraft(); }
    return added;
  }

  function generated() {
    var payload = buildPracticeData(state, {
      lesson: state.lesson || (manifest && manifest.lesson) || ''
    });
    return serializePracticeData(payload, SRC.exportGlobal);
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

  /** 校验定位：切到问题所在的模块 / 题组，并滚动到画布 */
  function locateIssue(issue) {
    var base = (issue && issue.base) || '';
    var mod = /^modules\.([^.]+)\.groups\.(\d+)/.exec(base);
    if (mod) {
      selectedId = mod[1];
      var target = findItem(selectedId);
      if (target && target.kind === 'group') ensureGroup(target);
      activeGroupIndex[mod[1]] = Number(mod[2]);
      renderAll();
      var canvas = el('#workspace-canvas');
      if (canvas) canvas.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return true;
    }
    var sec = /^postLesson\.sections\.(\d+)/.exec(base);
    if (sec) {
      selectedId = (manifest && manifest.postLesson && manifest.postLesson.id) || 'auxiliary';
      activeGroupIndex.postLesson = Number(sec[1]);
      renderAll();
      var auxCanvas = el('#workspace-canvas');
      if (auxCanvas) auxCanvas.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return true;
    }
    return false;
  }

  function locateFirstIssue(issues) {
    var first = issues.filter(function (i) { return i.base; })[0] || issues[0];
    if (first && locateIssue(first)) return;
    var canvas = el('#workspace-canvas');
    if (canvas) canvas.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    invalidatePreview();
    renderValidation(issues);
    renderGuide();
  }
  /** 仅输入时的轻量更新：不重建编辑区（避免失焦） */
  function renderOnInput() {
    var issues = collectIssues();
    markInvalid(issues);
    renderNav();
    refreshActiveEditor();      /* 题目表单改动后画布中的题目对象同步刷新 */
    invalidatePreview();
    renderValidation(issues);
    renderGuide();
  }

  /* ==========================================================
     十四、结构操作
     ========================================================== */
  function handleStruct(act, t) {
    var gbase = t.dataset.gbase, gi = Number(t.dataset.gi);
    var arr;
    var it = selectedItem();
    var key = it ? scopeKey(it) : '';
    switch (act) {
      case 'add-group':
        arr = getPath(state, gbase);
        if (arr) {
          arr.push(newGroup());
          if (key) activeGroupIndex[key] = arr.length - 1;
        }
        break;
      case 'del-group':
        arr = getPath(state, gbase);
        if (!arr) return;
        var removed = arr[gi];
        confirmDialog(L('dialog.removeSection'), function () {
          var list = getPath(state, gbase) || [];
          var index = list.indexOf(removed);
          if (index >= 0) list.splice(index, 1);
          if (removed) disposeEditor(ensureGroupKey(removed));
          if (key) activeGroupIndex[key] = clampIndex(activeGroupIndex[key], list.length);
          saveDraft(); renderAll();
        });
        return;
      case 'dup-group':
        arr = getPath(state, gbase);
        if (arr) {
          var dupGroup = clone(arr[gi]);
          delete dupGroup._k;   /* 复制出的题组重新分配稳定键，避免与原题组联动 */
          arr.splice(gi + 1, 0, dupGroup);
          if (key) activeGroupIndex[key] = gi + 1;
        }
        break;
      case 'up-group':
        arr = getPath(state, gbase);
        if (arr && gi > 0) {
          arr.splice(gi - 1, 0, arr.splice(gi, 1)[0]);
          if (key) activeGroupIndex[key] = gi - 1;
        }
        break;
      case 'down-group':
        arr = getPath(state, gbase);
        if (arr && gi < arr.length - 1) {
          arr.splice(gi + 1, 0, arr.splice(gi, 1)[0]);
          if (key) activeGroupIndex[key] = gi + 1;
        }
        break;
      default: return;
    }
    saveDraft(); renderAll();
  }

  function selectItem(id) {
    selectedId = id;
    var it = findItem(id);
    if (it && it.kind === 'group') ensureGroup(it);
    deactivateCurrentEditor();
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
      disposeEditorCache();
      return true;
    }
    if (data.sections) {
      state = emptyState();
      state.postLesson = { title: data.title || L('auxiliaryFallback'), subtitle: data.subtitle || '', sections: data.sections };
      normalizeState();
      disposeEditorCache();
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
    disposeEditorCache();
    ensureSelected();
    renderAll();
    return true;
  }

  /** 句柄按课程隔离：同一浏览器编辑多课，避免静默覆盖另一课的 practice-data.js */
  function handleKey() {
    var lesson = (manifest && manifest.lesson) || (state && state.lesson) || '';
    return SRC.exportFile + (lesson ? '@' + lesson : '');
  }

  function writeFile(handle, text) {
    return handle.createWritable().then(function (w) {
      return w.write(text).then(function () { return w.close(); });
    });
  }

  /** 用上次记住的句柄直接覆盖；不可用时返回 null（不抛错，交给选择窗口） */
  function writeRemembered(text) {
    return idbGet(handleKey()).then(function (handle) {
      if (!handle || typeof handle.queryPermission !== 'function') return null;
      return handle.queryPermission({ mode: 'readwrite' }).then(function (state) {
        if (state === 'granted') return true;
        return handle.requestPermission({ mode: 'readwrite' }).then(function (next) { return next === 'granted'; });
      }).then(function (granted) {
        if (!granted) return null;
        return writeFile(handle, text).then(function () { return handle; });
      });
    }).catch(function () { return null; });
  }

  /** 首次保存或句柄失效：弹系统窗口；选中后记住句柄，后续一键覆盖 */
  function pickAndWrite(text) {
    return idbGet(handleKey()).catch(function () { return null; }).then(function (handle) {
      // 有旧句柄时让窗口直接定位到它所在目录；首次无法指定任意路径，退到「文档」
      if (!handle) return null;
      return handle.getFile().then(function () { return handle; }).catch(function () { return null; });
    }).then(function (handle) {
      var options = {
        suggestedName: SRC.exportFile,
        types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }],
        startIn: handle || 'documents'
      };
      return window.showSaveFilePicker(options);
    }).then(function (picked) {
      return writeFile(picked, text).then(function () {
        idbSet(handleKey(), picked).catch(function () {});
        return picked;
      });
    });
  }

  /** 保存前防护：草稿缺少同级题库中的模块时先确认，避免静默覆盖 */
  function saveToFile() {
    var missing = missingSourceModules();
    if (!missing.length) { doSaveToFile(); return; }
    openDialog({
      title: L('dialog.title'),
      body: '<p class="ce-dialog__text">' + esc(L('dialog.lossySave', { list: missing.join('、') })) + '</p>',
      confirmText: L('dialog.confirm'),
      danger: true,
      onConfirm: doSaveToFile
    });
  }

  function doSaveToFile() {
    var btn = el('[data-act="save-local"]');
    var text = generated();
    if (!window.showSaveFilePicker) { sourceSnapshot = snapshotFromState(); download(); return; }
    setBusy(btn, true);
    writeRemembered(text).then(function (handle) {
      return handle || pickAndWrite(text);
    }).then(function (handle) {
      setBusy(btn, false);
      sourceSnapshot = snapshotFromState();
      toast(L('toast.savedNamed', { name: (handle && handle.name) || SRC.exportFile }), 'ok');
    }).catch(function (err) {
      setBusy(btn, false);
      if (err && err.name === 'AbortError') return;
      toast(L('toast.saveFallback'), 'warn');
      sourceSnapshot = snapshotFromState();
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
        if (saved && typeof saved.inspector === 'boolean') CFG.layout.inspector = saved.inspector;
      } catch (e) { /* 忽略 */ }
    }
    guideDismissed = storeGet(GUIDE_KEY) === '1';
  }
  function saveLayoutPref() {
    storeSet(LAYOUT_KEY, JSON.stringify({ nav: CFG.layout.nav, inspector: CFG.layout.inspector }));
  }
  function applyLayout() {
    var b = document.body;
    b.setAttribute('data-density', CFG.density);
    b.setAttribute('data-nav', CFG.layout.nav ? 'on' : 'off');
    b.setAttribute('data-inspector', CFG.layout.inspector ? 'on' : 'off');
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
    var s = el('#output-summary'); if (s) s.textContent = L('outputSummary');
    var g = el('#guide-btn'); if (g) g.title = L('guide.reopen');
    var full = el('#preview-full-btn'); if (full) full.textContent = L('previewFull');
    var overlap = el('#preview-overlay-title'); if (overlap) overlap.textContent = L('previewTitle');
    els('#inspector-tabs .ce-segment__btn').forEach(function (b) {
      b.textContent = b.dataset.inspectorTab === 'preview' ? L('inspectorPreview') : L('inspectorProps');
    });

    /* 预览缩放：适应宽度 / 50% / 100%（画布固定 1920×1080），检查器与全屏浮层共用 */
    var zoomHtml = [['fit', '适应'], ['0.5', '50%'], ['1', '100%']].map(function (z) {
      return '<button class="ce-segment__btn" type="button" data-act="preview-zoom" data-zoom="' + z[0] + '" aria-pressed="' +
        (String(previewZoom) === z[0] ? 'true' : 'false') + '">' + z[1] + '</button>';
    }).join('');
    ['#preview-zoom', '#preview-zoom-full'].forEach(function (sel) {
      var host = el(sel);
      if (host) host.innerHTML = zoomHtml;
    });

    var toggles = el('#panel-toggles');
    if (toggles) {
      if (CFG.layout.allowPanelToggle) {
        toggles.className = 'ce-toolbar__group ce-segment';
        toggles.innerHTML = ['nav', 'inspector'].map(function (key) {
          var label = key === 'nav' ? L('navTitle') : L('inspectorTitle');
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
    var question = newItem(kinds[0] || 'choice');
    question.id = 'q-1';
    group.questions.push(question);
    group.materialLayout = ensureSlot(group.materialLayout, true, question).layout;
    if (it.kind === 'auxiliary') {
      if (!state.postLesson) state.postLesson = { title: '', subtitle: '', sections: [] };
      if (!state.postLesson.sections) state.postLesson.sections = [];
      state.postLesson.sections.push(group);
      activeGroupIndex.postLesson = state.postLesson.sections.length - 1;
    } else {
      var mod = ensureGroup(it);
      mod.groups.push(group);
      activeGroupIndex[it.id] = mod.groups.length - 1;
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
        saveDraft(); invalidatePreview(); renderValidation(); renderGuide(); return;
      }
      if (t.id === 'structure-file' && t.files && t.files[0]) { loadStructureFromFile(t.files[0]); t.value = ''; return; }
      if (t.id === 'data-file' && t.files && t.files[0]) { importDataFile(t.files[0]); t.value = ''; }
    });

    document.addEventListener('click', function (e) {
      var pick = e.target.closest ? e.target.closest('[data-select]') : null;
      if (pick) { closeMenu(); selectItem(pick.dataset.select); return; }

      var slotPick = e.target.closest ? e.target.closest('[data-gslot]') : null;
      if (slotPick) {
        var it = selectedItem();
        if (it) activeGroupIndex[scopeKey(it)] = Number(slotPick.dataset.gslot);
        deactivateCurrentEditor();
        renderEditor();
        return;
      }

      var tabBtn = e.target.closest ? e.target.closest('[data-inspector-tab]') : null;
      if (tabBtn) { setInspectorTab(tabBtn.dataset.inspectorTab); return; }

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
        if (dashAct === 'preview-close') { closePreviewOverlay(); return; }
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
            if (adopt(data)) {
              sourceSnapshot = data;
              ensureSelected(); renderAll(); toast(L('toast.localLoaded'), 'ok');
            } else toast(L('toast.localMissing'), 'warn');
          });
          return;
        case 'toggle-menu': toggleMenu(); return;
        case 'toggle-theme': toggleTheme(); return;
        case 'preview-zoom': {
          var z = t.dataset.zoom;
          applyPreviewZoom(z === 'fit' ? 'fit' : Number(z));
          return;
        }
        case 'preview-full': openPreviewOverlay(); return;
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
        var overlay = el('#preview-overlay');
        if (overlay && !overlay.hidden) { e.preventDefault(); closePreviewOverlay(); return; }
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
    var hadDraft = false;

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
      /* 草稿键依赖课程 id，必须在结构清单载入后再读取 */
      hadDraft = loadDraft();
      if (hadDraft) ensureSelected();
      renderAll();
      return loadContent();
    }).then(function (data) {
      sourceSnapshot = data;
      if (hadDraft) {
        var missing = missingSourceModules();
        if (missing.length) {
          openDialog({
            title: L('dialog.title'),
            body: '<p class="ce-dialog__text">' + esc(L('dialog.draftMissing', { list: missing.join('、') })) + '</p>',
            confirmText: L('dialog.fillFromLocal'),
            onConfirm: function () {
              var added = mergeMissingFromSource(data);
              if (added) {
                ensureSelected(); renderAll();
                toast(L('toast.draftMerged', { n: added }), 'ok');
              }
            }
          });
        } else if (data) {
          toast(L('toast.draftLoaded', { label: L('actions.loadLocal') }));
        }
        return;
      }
      if (adopt(data)) { ensureSelected(); renderAll(); toast(L('toast.localLoaded'), 'ok'); }
    }).catch(function (err) {
      if (window.console) console.error('[内容编辑器] 初始化失败', err);
    });
  }

  init();
})();