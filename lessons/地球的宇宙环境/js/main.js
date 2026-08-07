/* ============================================================
   地球的宇宙环境 · 主脚本
   已实现：
   0. 全局星点背景 / 顶部导航滚动高亮 / 拓展浮层（骨架阶段）
   1. M1 宇宙概念：图文开篇 + 逐级放大动画（动画置于 M1 拓展浮层内）
   2. M2 天体卡片档案：露头式堆叠卡片，点击页签向下展开（一次仅一张）+ 底部按类别展示
   3. M3 流星案例：SVG 分步示意图 + 三条件逐条点亮
   4. M3 随堂练习：拖拽分类（原 M4 内容）+ 每模块“✎ 练习”浮层
   5. M5 天体系统层级：SVG 嵌套圆环，点击聚焦 + 上下级切换
   6. M6 太阳系：WebGL 可用时启用 3D（Three.js 本地库，拖拽旋转/点击信息卡），否则自动降级 2D SVG 轨道图
   7. M7 行星分类与三性：分类卡高亮切换 + 三性对照
   8. M8 地球生命条件因果链：双分支 5 条链分步点亮
   9. M9 复习与总结：结构树折叠 + 复习模式切换
   ============================================================ */
(function () {
  'use strict';

  /* 全局状态单例（各模块共用） */
  window.App = window.App || {
    expandedCard: null,     // M2 当前展开的卡片 id
    meteorStep: 0,          // M3 流星案例当前步骤
    level: 0,               // M5 当前聚焦层级索引
    solarAuto: true,        // M6 公转是否自动
    selectedPlanet: null,   // M6 选中的行星 id
    lifeStep: 0,            // M8 因果链当前点亮步
    reviewMode: false,      // M9 复习模式开关
    modal: { open: false, sectionId: null } // M10 浮层状态
  };

  /* 是否偏好减少动效 */
  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 常用查询工具 */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const data = window.lessonData;

  /* ==========================================================
     1. 星点背景
     ========================================================== */
  function initStarfield() {
    const canvas = document.getElementById('starfield');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');

    let stars = [];
    let w = 0, h = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.round((w * h) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        speed: Math.random() * 0.08 + 0.02,
        phase: Math.random() * Math.PI * 2
      }));
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const twinkle = prefersReducedMotion ? 1 : 0.6 + 0.4 * Math.sin(t / 600 + s.phase);
        ctx.globalAlpha = twinkle * 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (!prefersReducedMotion) {
          s.y += s.speed;
          if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(t) {
      draw(t);
      if (!prefersReducedMotion) requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (prefersReducedMotion) { draw(0); } else { requestAnimationFrame(frame); }
  }

  /* ==========================================================
     2. M0 导航：平滑滚动 + 滚动高亮
     ========================================================== */
  function initNav() {
    const navLinks = $$('.topnav__links a');
    const sections = navLinks
      .map(a => document.getElementById(a.dataset.target))
      .filter(Boolean);

    function setActive(targetId) {
      navLinks.forEach(a => a.classList.toggle('is-active', a.dataset.target === targetId));
    }

    if ('IntersectionObserver' in window && sections.length) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      sections.forEach(s => io.observe(s));
    }

    $$('[data-scroll-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.scrollTo);
        if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      });
    });
  }

  /* ==========================================================
     3. M10 拓展浮层
     ========================================================== */
  function initExtendModal() {
    const modal = document.getElementById('extend-modal');
    const titleEl = document.getElementById('extend-title');
    const contentEl = document.getElementById('extend-content');
    if (!modal || !data || !data.extends) return;

    function render(sectionId) {
      const item = data.extends[sectionId];
      contentEl.innerHTML = '';
      if (item && item.content) {
        const items = Array.isArray(item.content) ? item.content : [item.content];
        const list = document.createElement('ul');
        items.forEach(text => {
          const li = document.createElement('li');
          li.textContent = text;
          list.appendChild(li);
        });
        contentEl.appendChild(list);
      } else {
        const p = document.createElement('p');
        p.className = 'panel__placeholder';
        p.textContent = '敬请期待';
        contentEl.appendChild(p);
      }
      /* M1 拓展：追加"从地球出发，逐级飞向可观测宇宙"演示动画 */
      if (sectionId === 'M1') {
        const demoBox = document.createElement('div');
        demoBox.id = 'extend-universe-demo';
        demoBox.className = 'panel extend-demo';
        contentEl.appendChild(demoBox);
        buildUniverseDemo(demoBox);
      }
      titleEl.textContent = item && item.title ? item.title : '拓展材料';
    }

    function open(sectionId) {
      render(sectionId);
      modal.hidden = false;
      window.App.modal = { open: true, sectionId: sectionId };
      document.body.style.overflow = 'hidden';
    }

    function close() {
      /* 关闭时停止仍在进行的逐级放大动画计时器 */
      const demo = document.getElementById('extend-universe-demo');
      if (demo) clearTimeout(demo._universeTimer);
      modal.hidden = true;
      window.App.modal = { open: false, sectionId: null };
      document.body.style.overflow = '';
    }

    $$('.extend-btn').forEach(btn => {
      btn.addEventListener('click', () => open(btn.dataset.section));
    });
    $$('[data-modal-close]', modal).forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  /* ==========================================================
     4. M1 宇宙概念：逐级放大演示动画
        （迁至 M1 "⊕ 拓展"浮层内渲染，功能与视觉效果保持不变）
     ========================================================== */
  function buildUniverseDemo(container) {
    if (!container || !data || !data.universe || !data.universe.scaleLevels) return;
    const levels = data.universe.scaleLevels;

    container.innerHTML = `
      <div class="universe-demo">
        <div class="universe-demo__view">
          ${levels.map((l, i) => `
            <div class="ring" style="--size:${18 + i * 22}%">
              <span class="ring__name">${l.name}</span>
              <span class="ring__desc">${l.desc}</span>
            </div>`).join('')}
          <p class="universe-demo__status">点击"播放"，从地球出发，逐级飞向可观测宇宙</p>
        </div>
        <div class="universe-demo__steps">
          ${levels.map((l, i) => `<span class="universe-demo__step" data-step="${i}">${l.name}</span>`).join('')}
        </div>
        <div class="universe-demo__controls">
          <button type="button" class="btn btn--primary btn--sm" data-universe-play>播放</button>
          <button type="button" class="btn btn--ghost btn--sm" data-universe-replay>重播</button>
        </div>
      </div>`;

    const status = $('.universe-demo__status', container);
    const rings = $$('.ring', container);
    const steps = $$('.universe-demo__step', container);
    const interval = prefersReducedMotion ? 0 : 1200;
    let level = -1;
    let done = false;

    function render() {
      rings.forEach((r, i) => {
        r.classList.toggle('is-visible', i <= level);
        r.classList.toggle('is-active', i === level);
      });
      steps.forEach((s, i) => s.classList.toggle('is-active', i === level));
      status.classList.toggle('is-done', done);
      if (level < 0) {
        status.textContent = '点击"播放"，从地球出发，逐级飞向可观测宇宙';
      } else if (!done) {
        status.textContent = '正在飞向：' + levels[level].name + ' …';
      } else {
        status.textContent = '已到达可观测宇宙边界 —— 空间无边无际、时间无始无终';
      }
    }

    function step() {
      level++;
      render();
      if (level < levels.length - 1) {
        container._universeTimer = setTimeout(step, interval);
      } else {
        container._universeTimer = setTimeout(() => { done = true; render(); }, interval + 400);
      }
    }

    function play() {
      clearTimeout(container._universeTimer);
      level = -1;
      done = false;
      render();
      container._universeTimer = setTimeout(step, 600);
    }

    $('[data-universe-play]', container).addEventListener('click', play);
    $('[data-universe-replay]', container).addEventListener('click', play);
  }

  /* ==========================================================
     5. M2 天体卡片档案：露头式堆叠卡片（纵向堆叠、仅露页签，
        点击向下展开，一次仅一张）+ 底部按类别展示
     ========================================================== */
  function initBodyCards() {
    const conceptBox = document.getElementById('body-concept');
    const stack = document.getElementById('body-stack');
    const classify = document.getElementById('body-classify');
    if (!stack || !classify || !data || !data.celestial) return;
    const celestial = data.celestial;

    /* 概念介绍 + 分类体系（由数据渲染） */
    if (conceptBox) {
      conceptBox.innerHTML =
        '<p class="body-concept__def"><strong>天体</strong>是' + celestial.concept + '</p>' +
        '<p class="body-concept__classify">按来源，天体可分为 ' +
        celestial.categories.map(c => '<span class="tag">' + c.name + '</span>').join(' 与 ') +
        ' 两大类。</p>';
    }

    /* 卡片堆叠渲染：每张卡片注入 --i 索引，控制在卡堆中的纵向位置 */
    stack.innerHTML = celestial.bodies.map((b, i) => `
      <article class="body-card body-card--${b.type}" data-card="${b.id}" style="--i:${i}">
        <button type="button" class="body-card__head" aria-expanded="false">
          <span class="body-card__icon" aria-hidden="true">${b.icon}</span>
          <span class="body-card__name">${b.name}</span>
          <span class="body-card__type${b.type === 'artificial' ? ' body-card__type--artificial' : ''}">${(celestial.categories.find(c => c.id === b.type) || {}).name || ''}</span>
          ${b.easyMistake ? '<span class="badge badge--warn">易错</span>' : ''}
          <span class="body-card__arrow" aria-hidden="true"></span>
        </button>
        <div class="body-card__body">
          <div class="body-card__inner">
            <figure class="body-card__fig">
              <img class="body-card__img" src="${b.img}" alt="${b.name}示意图" loading="lazy" onerror="this.style.display='none'">
            </figure>
            <div class="body-card__info">
              <h3 class="body-card__title">${b.name}</h3>
              <p class="body-card__row"><span class="body-card__label">组成</span>${b.composition}</p>
              <p class="body-card__row body-card__row--list"><span class="body-card__label">特点</span></p>
              <ul class="body-card__list">
                ${b.traits.map(t => `<li>${t}</li>`).join('')}
              </ul>
              <p class="body-card__note">${b.note}</p>
            </div>
          </div>
        </div>
      </article>`).join('');

    /* 底部：全部天体按类别水平排列展示 */
    classify.innerHTML = celestial.categories.map(cat => `
      <div class="body-classify__group body-classify__group--${cat.id}" data-group="${cat.id}">
        <h3 class="body-classify__title">${cat.name}</h3>
        <p class="body-classify__desc">${cat.desc || ''}</p>
        <div class="body-classify__items">
          ${celestial.bodies.filter(b => b.type === cat.id).map(b => `
            <span class="body-classify__item"><i class="body-classify__icon" aria-hidden="true">${b.icon}</i>${b.name}</span>`).join('')}
        </div>
      </div>`).join('');

    /* 交互：点击页签向下展开，一次仅一张。动态撑开容器高度，避免与下方内容重叠 */
    const PEEK = 46;
    const cards = $$('.body-card', stack);
    const recalcStackHeight = () => {
      const openCard = $('.body-card.is-open', stack);
      if (openCard) {
        /* 展开状态：容器高度 = 展开卡片的实际 offsetHeight */
        stack.style.height = openCard.offsetHeight + 'px';
      } else {
        /* 收起状态：容器高度 = (n-1)*peek + headerHeight（62px） */
        stack.style.height = ((cards.length - 1) * PEEK + 62) + 'px';
      }
    };
    /* 初始高度（收起态） */
    recalcStackHeight();

    cards.forEach(card => {
      $('.body-card__head', card).addEventListener('click', () => {
        const isOpen = card.classList.contains('is-open');
        cards.forEach(c => {
          c.classList.remove('is-open');
          $('.body-card__head', c).setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          card.classList.add('is-open');
          $('.body-card__head', card).setAttribute('aria-expanded', 'true');
          window.App.expandedCard = card.dataset.card;
        } else {
          window.App.expandedCard = null;
        }
        /* 等待过渡完成后重新计算高度 */
        setTimeout(recalcStackHeight, 520);
      });
    });

    /* 窗口尺寸变化时（如字号/窗口变动）重新测量 */
    window.addEventListener('resize', recalcStackHeight);
  }

  /* ==========================================================
     6. M3 流星案例：SVG 分步示意图 + 三条件逐条点亮
     ========================================================== */
  function initMeteorCase() {
    const stage = document.getElementById('meteor-stage');
    const condsBox = document.getElementById('meteor-conditions');
    const conclusion = document.getElementById('meteor-conclusion');
    const btn = document.querySelector('[data-widget="meteor-next"]');
    if (!stage || !condsBox || !btn || !data || !data.meteorCase) return;
    const mc = data.meteorCase;

    stage.classList.remove('panel--hint');
    stage.innerHTML = `
      <svg class="meteor-svg" viewBox="0 0 460 300" role="img" aria-label="流星案例分步示意图">
        <!-- 太空 -->
        <rect x="0" y="0" width="460" height="128" fill="#060a1c"/>
        <circle class="meteor-star" cx="26" cy="34" r="1.4"/>
        <circle class="meteor-star" cx="62" cy="18" r="1"/>
        <circle class="meteor-star" cx="120" cy="46" r="1.2"/>
        <circle class="meteor-star" cx="330" cy="90" r="1.1"/>
        <circle class="meteor-star" cx="430" cy="52" r="1.3"/>
        <!-- 大气层 -->
        <rect x="0" y="128" width="460" height="86" fill="rgba(79,195,247,0.10)"/>
        <line class="meteor-boundary" x1="0" y1="128" x2="460" y2="128"/>
        <line class="meteor-boundary" x1="0" y1="214" x2="460" y2="214"/>
        <text x="444" y="24" text-anchor="end" class="meteor-layer-label">太空</text>
        <text x="444" y="172" text-anchor="end" class="meteor-layer-label">大气层</text>
        <!-- 地面 -->
        <rect x="0" y="214" width="460" height="86" fill="#0d1230"/>
        <line class="meteor-ground" x1="0" y1="214" x2="460" y2="214"/>
        <text x="26" y="252" class="meteor-layer-label">地面</text>
        <!-- 流星路径 -->
        <line class="meteor-path" x1="382" y1="22" x2="118" y2="232"/>
        <!-- 节点：太空中 / 大气层燃烧 / 落到地面 -->
        <g class="meteor-node" data-node="0">
          <circle cx="382" cy="22" r="8"/>
          <text x="382" y="8" text-anchor="middle" class="meteor-node-label">流星体（太空中）</text>
        </g>
        <g class="meteor-node" data-node="1">
          <circle cx="250" cy="152" r="10"/>
          <text x="250" y="180" text-anchor="middle" class="meteor-node-label">摩擦燃烧 → 流星现象</text>
        </g>
        <g class="meteor-node" data-node="2">
          <circle cx="118" cy="232" r="7"/>
          <text x="118" y="260" text-anchor="middle" class="meteor-node-label">陨石（落至地面）</text>
        </g>
      </svg>`;

    condsBox.innerHTML = `
      <h3 class="conditions-title">判别三条件</h3>
      <ul class="condition-list">
        ${mc.conditions.map((c, i) => `
          <li class="condition-item" data-cond="${i}">
            <span class="condition-item__key">${c.key}</span>
            <span class="condition-item__desc">${c.desc}</span>
          </li>`).join('')}
      </ul>`;

    const nodes = $$('.meteor-node', stage);
    const conds = $$('.condition-item', condsBox);
    let step = 0; // 0=初始未开始, 1~3=三步, 4=完成

    function render() {
      nodes.forEach((n, i) => {
        n.classList.toggle('is-current', step > 0 && i === step - 1);
        n.classList.toggle('is-lit', step > 1 && i < step - 1);
      });
      conds.forEach((c, i) => c.classList.toggle('is-lit', i < step));

      if (step === 0) {
        conclusion.textContent = '';
      } else if (step <= 3) {
        conclusion.textContent = '第 ' + step + ' 步 · ' + mc.steps[step - 1].title + '：' + mc.steps[step - 1].desc;
      } else {
        conclusion.textContent = '结论：' + mc.conclusion;
        conclusion.classList.add('hint--done');
      }
      if (step <= 3) conclusion.classList.remove('hint--done');
      btn.textContent = step >= 4 ? '重新开始' : '下一步';
      window.App.meteorStep = step;
    }

    btn.addEventListener('click', () => {
      step = step >= 4 ? 0 : step + 1;
      render();
    });
    render();
  }

  /* ==========================================================
     7. M7 行星分类与三性
     ========================================================== */
  function initPlanetCategories() {
    const cats = document.getElementById('planet-categories');
    const feats = document.getElementById('motion-features');
    if (!cats || !feats || !data || !data.planetCategories) return;

    cats.innerHTML = data.planetCategories.map(c => `
      <article class="category-card card" data-cat="${c.id}">
        <h3 class="category-card__name">${c.name}</h3>
        <p class="category-card__members">
          ${c.members.split('、').map(m => `<span class="tag">${m}</span>`).join('')}
        </p>
        <p class="category-card__feature">${c.feature}</p>
      </article>`).join('');

    feats.innerHTML = data.motionFeatures.map(f => `
      <div class="motion-feature card" tabindex="0">
        <h4 class="motion-feature__name">${f.name}</h4>
        <p class="motion-feature__desc">${f.desc}</p>
      </div>`).join('');

    const cards = $$('.category-card', cats);
    cards.forEach(c => c.addEventListener('click', () => {
      cards.forEach(x => x.classList.remove('is-active'));
      c.classList.add('is-active');
    }));
  }

  /* ==========================================================
     8. M8 地球生命条件因果链：双分支 5 条链分步点亮
     ========================================================== */
  function initLifeChain() {
    const box = document.getElementById('life-chain');
    const conclusion = document.getElementById('life-conclusion');
    const btn = document.querySelector('[data-widget="life-next"]');
    if (!box || !conclusion || !btn || !data || !data.lifeConditions) return;
    const lc = data.lifeConditions;

    const external = lc.external.map(c => ({ branch: 'external', cond: c.cond, result: c.result }));
    const internal = lc.internal.map(c => ({ branch: 'internal', cond: c.cond, result: c.result }));
    const all = external.concat(internal);

    function chainHtml(chain, idx) {
      return `
        <div class="chain" data-chain="${idx}">
          <div class="chain-node chain-node--cond">${chain.cond}</div>
          <div class="chain-arrow" aria-hidden="true"></div>
          <div class="chain-node chain-node--result">${chain.result}</div>
        </div>`;
    }

    box.classList.remove('panel--hint');
    box.innerHTML = `
      <div class="life-chain">
        <div class="life-chain__row">
          <h3 class="life-chain__row-title"><span class="tag">外部条件</span></h3>
          <div class="life-chain__chains">
            ${external.map((c, i) => chainHtml(c, i)).join('')}
          </div>
        </div>
        <div class="life-chain__row">
          <h3 class="life-chain__row-title"><span class="tag">自身条件</span></h3>
          <div class="life-chain__chains">
            ${internal.map((c, i) => chainHtml(c, external.length + i)).join('')}
          </div>
        </div>
      </div>`;

    const chains = $$('.chain', box);
    let step = 0; // 0=未开始, 1~5=逐步点亮, 6=完成

    function render() {
      chains.forEach((c, i) => c.classList.toggle('is-lit', i < step));
      if (step === 0) {
        conclusion.textContent = '点击"下一步"，逐条点亮 5 条因果链。';
      } else if (step <= all.length) {
        const cur = all[step - 1];
        conclusion.textContent = '已点亮 ' + step + '/' + all.length + ' · ' + cur.cond + ' → ' + cur.result;
      } else {
        conclusion.textContent = '总结论：' + lc.conclusion;
        conclusion.classList.add('hint--done');
      }
      if (step <= all.length) conclusion.classList.remove('hint--done');
      btn.textContent = step > all.length ? '重新开始' : '下一步';
      window.App.lifeStep = step;
    }

    btn.addEventListener('click', () => {
      step = step > all.length ? 0 : step + 1;
      render();
    });
    render();
  }

  /* ==========================================================
     9. 拖拽分类互动（可复用，供 M3 随堂练习浮层使用）：
        拖拽 + 点击降级 + 即时反馈
     ========================================================== */
  function createDragDrop(root) {
    const area = $('[data-drag-area]', root);
    const zones = $$('.drop-zone', root);
    const feedback = $('[data-drag-feedback]', root);
    if (!area || !zones.length || !feedback || !data || !data.dragCards) return;

    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const clickMode = isTouch || !('DragEvent' in window);
    const results = {}; // 每次打开练习独立计分：{ id: { first: boolean } }，仅记录首次作答
    let selectedId = null;

    /* 渲染 9 张案例卡 */
    area.innerHTML = '';
    data.dragCards.forEach(c => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'drag-card';
      el.dataset.card = c.id;
      el.textContent = c.name;
      el.setAttribute('draggable', clickMode ? 'false' : 'true');
      area.appendChild(el);
    });
    const cards = $$('.drag-card', area);

    function feedbackShow(text, type) {
      feedback.textContent = text;
      feedback.className = 'feedback' + (type ? ' feedback--' + type : '');
    }

    function judge(el, target) {
      const item = data.dragCards.find(c => c.id === el.dataset.card);
      if (!item) return;
      if (el.closest('.drop-zone')) return; // 已正确放入框内，不再判定

      if (item.type === target) {
        if (!(item.id in results)) results[item.id] = { first: true };
        el.classList.add('is-correct');
        el.setAttribute('draggable', 'false');
        const zoneBody = $('[data-drop="' + target + '"]', root);
        if (zoneBody) zoneBody.appendChild(el);
        feedbackShow('正确：' + item.explain, 'correct');

        const done = Object.keys(results).length === data.dragCards.length;
        if (done) {
          const good = Object.values(results).filter(r => r.first).length;
          feedbackShow('全部完成，正确 ' + good + '/9', 'success');
        }
      } else {
        if (!(item.id in results)) results[item.id] = { first: false };
        el.classList.remove('is-selected');
        el.classList.add('is-shake');
        setTimeout(() => el.classList.remove('is-shake'), 550);
        feedbackShow('再想想：' + item.explain, 'error');
      }
    }

    /* 拖拽模式 */
    if (!clickMode) {
      let draggingId = null;
      area.addEventListener('dragstart', e => {
        const el = e.target.closest('.drag-card');
        if (!el) return;
        draggingId = el.dataset.card;
        el.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', el.dataset.card); } catch (_) {}
      });
      area.addEventListener('dragend', e => {
        const el = e.target.closest('.drag-card');
        if (el) el.classList.remove('is-dragging');
        draggingId = null;
      });
      zones.forEach(zone => {
        zone.addEventListener('dragover', e => {
          e.preventDefault();
          zone.classList.add('is-dragover');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
        zone.addEventListener('drop', e => {
          e.preventDefault();
          zone.classList.remove('is-dragover');
          const id = e.dataTransfer.getData('text/plain') || draggingId;
          if (!id) return;
          const el = area.querySelector('.drag-card[data-card="' + id + '"]');
          if (el) judge(el, zone.dataset.type);
        });
      });
    } else {
      /* 点击降级：先点卡片（选中），再点目标框 */
      cards.forEach(card => {
        card.addEventListener('click', () => {
          if (card.closest('.drop-zone')) return;
          cards.forEach(x => x.classList.remove('is-selected'));
          card.classList.add('is-selected');
          selectedId = card.dataset.card;
        });
      });
      zones.forEach(zone => {
        zone.addEventListener('click', () => {
          if (!selectedId) return;
          const el = area.querySelector('.drag-card[data-card="' + selectedId + '"]');
          if (el) {
            judge(el, zone.dataset.type);
            el.classList.remove('is-selected');
          }
          selectedId = null;
        });
      });
    }
  }

  /* ==========================================================
     10. 随堂练习浮层（每模块“✎ 练习”入口，模态弹窗 + 变暗背景）
     ========================================================== */
  function renderPractice(content, item) {
    content.innerHTML = '';
    if (!item || (!item.questions && item.type !== 'drag')) {
      const p = document.createElement('p');
      p.className = 'panel__placeholder';
      p.textContent = '敬请期待';
      content.appendChild(p);
      return;
    }

    if (item.intro) {
      const intro = document.createElement('p');
      intro.className = 'practice-intro';
      intro.textContent = item.intro;
      content.appendChild(intro);
    }

    /* 拖拽分类型（原模块 M4 内容，现置于 M3 练习中） */
    if (item.type === 'drag') {
      content.insertAdjacentHTML('beforeend', `
        <div class="drag-area" data-drag-area></div>
        <div class="drag-zones">
          <div class="drop-zone" data-type="celestial">
            <h3 class="drop-zone__title">天体</h3>
            <div class="drop-zone__body" data-drop="celestial"></div>
          </div>
          <div class="drop-zone" data-type="non">
            <h3 class="drop-zone__title">非天体</h3>
            <div class="drop-zone__body" data-drop="non"></div>
          </div>
        </div>
        <p class="feedback" data-drag-feedback></p>`);
      createDragDrop(content);
      return;
    }

    /* 选择题型：点选即判，高亮正确项并给出解释 */
    (item.questions || []).forEach((q, qi) => {
      const box = document.createElement('div');
      box.className = 'practice-q';

      const text = document.createElement('p');
      text.className = 'practice-q__text';
      text.textContent = (qi + 1) + '. ' + q.q;
      box.appendChild(text);

      const opts = document.createElement('div');
      opts.className = 'practice-q__options';
      (q.options || []).forEach((opt, oi) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'practice-q__opt';
        b.textContent = opt;
        b.addEventListener('click', () => {
          if (b.disabled) return;
          const btns = $$('.practice-q__opt', opts);
          btns.forEach(x => { x.disabled = true; });
          btns[q.answer].classList.add('is-correct');
          const fb = $('.practice-q__feedback', box);
          if (oi === q.answer) {
            fb.textContent = '✓ 正确：' + q.explain;
            fb.className = 'practice-q__feedback is-correct';
          } else {
            b.classList.add('is-wrong');
            fb.textContent = '再想想：' + q.explain;
            fb.className = 'practice-q__feedback is-wrong';
          }
        });
        opts.appendChild(b);
      });
      box.appendChild(opts);

      const fb = document.createElement('p');
      fb.className = 'practice-q__feedback';
      box.appendChild(fb);
      content.appendChild(box);
    });
  }

  function initPracticeModal() {
    const modal = document.getElementById('practice-modal');
    const titleEl = document.getElementById('practice-title');
    const contentEl = document.getElementById('practice-content');
    if (!modal || !titleEl || !contentEl || !data || !data.practices) return;

    function open(sectionId) {
      const item = data.practices[sectionId];
      titleEl.textContent = (item && item.title) ? item.title : '随堂练习';
      renderPractice(contentEl, item);
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      window.App.practiceModal = { open: true, sectionId: sectionId };
    }

    function close() {
      modal.hidden = true;
      contentEl.innerHTML = ''; // 清空内容，避免下次打开残留旧的作答状态
      document.body.style.overflow = '';
      window.App.practiceModal = { open: false, sectionId: null };
    }

    $$('.practice-btn').forEach(btn => {
      btn.addEventListener('click', () => open(btn.dataset.practice));
    });
    $$('[data-practice-close]', modal).forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  /* ==========================================================
     11. M5 天体系统层级：SVG 嵌套圆环 + 聚焦
     ========================================================== */
  function initHierarchy() {
    const box = document.getElementById('hierarchy-ring');
    const info = document.getElementById('hierarchy-info');
    if (!box || !info || !data || !data.hierarchy) return;
    const levels = data.hierarchy; // 由内到外：地月系 → 太阳系 → 银河系 → 可观测宇宙
    const N = levels.length;
    const cx = 300, cy = 300;
    const radii = [76, 152, 228, 296];

    box.classList.remove('panel--hint');
    let svg = '<svg class="hierarchy-svg" viewBox="0 0 600 600" role="img" aria-label="天体系统嵌套层级图">';
    for (let i = N - 1; i >= 0; i--) {
      svg += `
        <g class="hier-ring" data-level="${i}" tabindex="0" role="button" aria-label="${levels[i].name}">
          <circle class="hier-circle" cx="${cx}" cy="${cy}" r="${radii[i]}"/>
          <text class="hier-name" x="${cx}" y="${cy - radii[i] + 18}">${levels[i].name}</text>
        </g>`;
    }
    svg += '</svg>';

    box.innerHTML = `
      <div class="hierarchy-wrap">
        ${svg}
        <div class="hierarchy-controls">
          <button type="button" class="btn btn--ghost btn--sm" data-hier-prev>上一级</button>
          <button type="button" class="btn btn--primary btn--sm" data-hier-next>下一级</button>
        </div>
      </div>`;

    const svgEl = $('.hierarchy-svg', box);
    const rings = $$('.hier-ring', box);
    let level = 0; // 默认从地月系开始

    function render() {
      svgEl.classList.toggle('has-focus', true);
      rings.forEach(g => g.classList.toggle('is-active', +g.dataset.level === level));
      const cur = levels[level];
      info.innerHTML = '<strong>' + cur.name + '</strong>：' + cur.content +
        '<span class="hint__example">' + cur.example + '</span>';
      window.App.level = level;
    }

    rings.forEach(g => g.addEventListener('click', () => {
      level = +g.dataset.level;
      render();
    }));
    rings.forEach(g => g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        level = +g.dataset.level;
        render();
      }
    }));

    $('[data-hier-prev]', box).addEventListener('click', () => {
      level = level <= 0 ? N - 1 : level - 1;
      render();
    });
    $('[data-hier-next]', box).addEventListener('click', () => {
      level = level >= N - 1 ? 0 : level + 1;
      render();
    });

    render();
  }

  /* ==========================================================
     12. M6 太阳系：WebGL 可用时启用 3D（Three.js 本地库），
         否则自动降级为 2D SVG 轨道图
     ========================================================== */
  function detectWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function initSolarSystem() {
    const vp = document.getElementById('solar-viewport');
    const info = document.getElementById('solar-info');
    if (!vp || !info || !data || !data.planets) return;
    if (detectWebGL() && window.THREE) {
      try {
        initSolar3D(vp, info);
      } catch (e) {
        /* 3D 初始化异常（如驱动问题）时兜底 2D */
        if (window.console) console.warn('3D 太阳系初始化失败，已降级为 2D 轨道图：', e);
        initSolar2D(vp, info);
      }
    } else {
      initSolar2D(vp, info);
    }
  }

  /* 2D/3D 共用的信息区：图例 + 状态条 */
  function buildSolarInfo(info, planets, tip) {
    info.innerHTML = '';
    const legend = document.createElement('div');
    legend.className = 'solar-legend';
    legend.innerHTML = planets.map(p =>
      '<span class="solar-legend__item"><i style="background:' + p.color + '"></i>' + p.name + '</span>'
    ).join('');
    const status = document.createElement('p');
    status.className = 'solar-status';
    status.textContent = tip;
    info.appendChild(legend);
    info.appendChild(status);
    return status;
  }

  /* ---------- M6 · 2D SVG 轨道图（降级保底，必须可用） ---------- */
  function initSolar2D(vp, info) {
    const planets = data.planets;
    const W = 900, H = 640, cx = 450, cy = 320;
    const ORBIT_SCALE = 6.8;  // orbit 8~43 → 54~292px
    const SUN_R = 26;
    const TIME_SCALE = 1.2;   // 公转速度缩放（周期 = 数据周期 × TIME_SCALE 秒）

    vp.innerHTML = `
      <svg class="solar-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="太阳系八大行星公转示意图">
        <text class="solar-note" x="${W - 12}" y="24" text-anchor="end">示意图 · 非按比例</text>
        <circle class="solar-sun" cx="${cx}" cy="${cy}" r="${SUN_R}"/>
        <text class="solar-sun-label" x="${cx}" y="${cy + 5}">太阳</text>
        ${planets.map(p => `<circle class="solar-orbit" cx="${cx}" cy="${cy}" r="${p.orbit * ORBIT_SCALE}"/>`).join('')}
        ${planets.map(p => `
          <g class="solar-planet" data-planet="${p.id}" tabindex="0" role="button" aria-label="${p.name}">
            <circle class="solar-planet-dot" r="8" fill="${p.color}"/>
            <text class="solar-planet-name" y="22">${p.name}</text>
          </g>`).join('')}
      </svg>`;

    const planetEls = $$('.solar-planet', vp);
    const status = buildSolarInfo(info, planets, '点击任意行星，查看它的分类与特征。');

    const time0 = performance.now();
    function draw(t) {
      const sec = (t - time0) / 1000;
      planets.forEach((p, i) => {
        const omega = (Math.PI * 2) / (p.period * TIME_SCALE);
        const angle = 0.6 * i + omega * sec; // 同方向匀速公转
        const x = cx + p.orbit * ORBIT_SCALE * Math.cos(angle);
        const y = cy + p.orbit * ORBIT_SCALE * Math.sin(angle);
        planetEls[i].setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      });
    }

    function select(p) {
      planetEls.forEach(g => g.classList.toggle('is-active', g.dataset.planet === p.id));
      status.textContent = p.name + '（' + p.type + '）：' + p.desc;
      status.classList.add('is-active');
      window.App.selectedPlanet = p.id;
    }

    planetEls.forEach((g, i) => {
      g.addEventListener('click', () => select(planets[i]));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select(planets[i]);
        }
      });
    });

    draw(0); // 先画一帧（含 reduce-motion 场景）
    if (!prefersReducedMotion) {
      const loop = t => { draw(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  /* ---------- M6 · 3D 太阳系（Three.js 本地库） ---------- */
  function initSolar3D(vp, info) {
    const planets = data.planets;
    const status = buildSolarInfo(info, planets, '拖拽旋转视角 · 滚轮缩放 · 点击行星查看信息');

    vp.classList.add('is-3d');
    vp.innerHTML = `
      <div class="solar3d">
        <span class="solar3d__note">3D 视窗 · 非按比例</span>
        <div class="solar3d__controls">
          <button type="button" class="btn btn--ghost btn--sm" data-solar-auto>暂停公转</button>
          <button type="button" class="btn btn--ghost btn--sm" data-solar-reset>重置视角</button>
        </div>
      </div>`;

    const wrap = $('.solar3d', vp);
    const autoBtn = $('[data-solar-auto]', vp);
    const resetBtn = $('[data-solar-reset]', vp);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    const CAM_POS = new THREE.Vector3(0, 70, 125);
    camera.position.copy(CAM_POS);
    camera.lookAt(0, 0, 0);

    /* 由 Three.js 自建 canvas（避免与既有的 2D 上下文冲突）；
       WebGL 上下文创建失败时 WebGLRenderer 只警告不抛错，此处显式校验以触发上层 2D 降级 */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    if (!renderer.getContext()) throw new Error('WebGL 上下文不可用');
    window.App.solar3dRenderer = renderer; // 调试/验收用：可通过 info.render 检查渲染统计
    const canvas = renderer.domElement;
    canvas.className = 'solar3d__canvas';
    canvas.setAttribute('aria-label', '太阳系 3D 演示视窗');
    wrap.prepend(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    function resize() {
      const w = wrap.clientWidth || vp.clientWidth || 800;
      const h = wrap.clientHeight || 560;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    /* 光照：环境光 + 太阳点光源 */
    scene.add(new THREE.AmbientLight(0x5566aa, 0.7));
    const sunLight = new THREE.PointLight(0xffd9a0, 2.2, 0, 1.4);
    scene.add(sunLight);

    /* 太阳：发光球体 + 光晕 */
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(6, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd54f })
    );
    scene.add(sun);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(9, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.16, depthWrite: false })
    );
    scene.add(halo);

    /* 背景星点 */
    (function addStars() {
      const n = 900;
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = 320 + Math.random() * 480;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
        const b = 0.5 + Math.random() * 0.5;
        col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b + 0.08;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size: 1.5, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false
      })));
    })();

    /* 轨道环 + 行星球体 */
    const ORBIT_BASE = 9, ORBIT_SCALE = 0.9;
    const planetMeshes = [];
    planets.forEach((p, i) => {
      const r = ORBIT_BASE + p.orbit * ORBIT_SCALE;
      const pts = [];
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
      }
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x8ea2d8, transparent: true, opacity: 0.28 })
      );
      scene.add(ring);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.size, 24, 24),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(p.color), roughness: 0.85, metalness: 0.12
        })
      );
      mesh.userData.index = i;
      scene.add(mesh);
      planetMeshes.push(mesh);

      /* 土星光环 */
      if (p.id === 'saturn') {
        const satRing = new THREE.Mesh(
          new THREE.RingGeometry(2.6, 4.0, 48),
          new THREE.MeshBasicMaterial({
            color: 0xe3c98a, transparent: true, opacity: 0.6, side: THREE.DoubleSide
          })
        );
        satRing.rotation.x = -Math.PI / 2;
        mesh.add(satRing);
      }
    });

    /* 控制器：拖拽旋转 / 滚轮缩放 */
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 40;
    controls.maxDistance = 320;
    controls.autoRotateSpeed = 0.6;
    controls.autoRotate = true;

    /* 拾取：点击选中 + 悬停发光 */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const C_HOVER = new THREE.Color(0x554433);
    const C_SEL = new THREE.Color(0x332200);
    const C_NONE = new THREE.Color(0x000000);
    let selectedIndex = -1;
    let hoverIndex = -1;

    function glow(i, active) {
      if (i < 0) return;
      planetMeshes[i].material.emissive.copy(active ? C_HOVER : (i === selectedIndex ? C_SEL : C_NONE));
    }

    function setPointerFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function selectPlanet(i) {
      selectedIndex = i;
      planetMeshes.forEach((m, k) => {
        m.material.emissive.copy(k === i ? C_SEL : C_NONE);
      });
      const p = planets[i];
      status.textContent = p.name + '（' + p.type + '）：' + p.desc;
      status.classList.add('is-active');
      window.App.selectedPlanet = p.id;
    }

    let downX = 0, downY = 0;
    canvas.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; });
    canvas.addEventListener('pointerup', e => {
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // 拖拽而非点击
      setPointerFromEvent(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(planetMeshes, false);
      if (hits.length) selectPlanet(hits[0].object.userData.index);
    });
    canvas.addEventListener('pointermove', e => {
      setPointerFromEvent(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(planetMeshes, false);
      const idx = hits.length ? hits[0].object.userData.index : -1;
      if (idx !== hoverIndex) {
        glow(hoverIndex, false);
        hoverIndex = idx;
        glow(hoverIndex, true);
        canvas.style.cursor = idx >= 0 ? 'pointer' : '';
      }
    });
    canvas.addEventListener('pointerleave', () => {
      if (hoverIndex >= 0) { glow(hoverIndex, false); hoverIndex = -1; }
    });

    /* 自动/手动公转切换 + 重置视角 */
    let paused = false;
    autoBtn.addEventListener('click', () => {
      paused = !paused;
      autoBtn.textContent = paused ? '开始公转' : '暂停公转';
      controls.autoRotate = !paused;
    });
    resetBtn.addEventListener('click', () => {
      camera.position.copy(CAM_POS);
      controls.target.set(0, 0, 0);
      controls.update();
    });

    /* 动画循环：行星同方向（自西向东）匀速公转；离开屏幕时暂停渲染 */
    const clock = new THREE.Clock();
    let time = 0;
    let rafId = 0;
    let inView = true;
    if ('IntersectionObserver' in window) {
      const sec = document.getElementById('solar');
      if (sec) {
        new IntersectionObserver(entries => {
          entries.forEach(en => {
            inView = en.isIntersecting;
            if (inView && !rafId) tick();
          });
        }, { threshold: 0 }).observe(sec);
      }
    }
    function step() {
      const dt = clock.getDelta();
      if (!paused && !prefersReducedMotion) time += dt;
      planets.forEach((p, i) => {
        const omega = (Math.PI * 2) / (p.period * 2.2);
        const angle = 0.6 * i + omega * time;
        const r = ORBIT_BASE + p.orbit * ORBIT_SCALE;
        planetMeshes[i].position.set(r * Math.cos(angle), 0, r * Math.sin(angle));
      });
      controls.update();
      renderer.render(scene, camera);
    }
    function tick() {
      rafId = 0;
      if (!inView) return;
      step();
      rafId = requestAnimationFrame(tick);
    }
    tick();
  }

  /* ==========================================================
     13. M9 复习与总结：结构树折叠 + 复习模式
     ========================================================== */
  function initReviewTree() {
    const box = document.getElementById('review-tree');
    const modeBtn = document.querySelector('[data-widget="review-mode"]');
    if (!box || !modeBtn || !data || !data.review) return;

    box.classList.remove('panel--hint');
    box.innerHTML = renderTree(data.review.nodes);

    function renderTree(nodes) {
      return '<ul class="tree">' + nodes.map(n => {
        const hasKids = n.children && n.children.length;
        const kids = hasKids ? renderTree(n.children) : '';
        return `
          <li class="tree__item${hasKids ? ' has-children is-open' : ''}" data-node="${n.id}">
            ${hasKids ? '<button type="button" class="tree__toggle" aria-expanded="true" aria-label="折叠"></button>' : ''}
            <span class="tree__label">${n.name}</span>
            ${kids ? '<ul class="tree__children">' + kids + '</ul>' : ''}
          </li>`;
      }).join('') + '</ul>';
    }

    $$('.tree__toggle', box).forEach(t => {
      t.addEventListener('click', () => {
        const li = t.closest('.tree__item');
        li.classList.toggle('is-open');
        t.setAttribute('aria-expanded', li.classList.contains('is-open'));
      });
    });

    modeBtn.addEventListener('click', () => {
      document.body.classList.toggle('review-mode');
      window.App.reviewMode = document.body.classList.contains('review-mode');
      modeBtn.textContent = window.App.reviewMode ? '退出复习模式' : '进入复习模式';
    });
  }

  /* ==========================================================
     启动
     ========================================================== */
  function init() {
    initStarfield();
    initNav();
    initExtendModal();
    initPracticeModal();
    initBodyCards();
    initMeteorCase();
    initHierarchy();
    initSolarSystem();
    initPlanetCategories();
    initLifeChain();
    initReviewTree();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
