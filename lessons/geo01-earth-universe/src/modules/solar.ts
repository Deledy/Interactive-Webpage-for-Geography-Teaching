/* ============================================================
   M6 太阳系与八大行星
   从左到右依次展示八大行星的 3D 模型（Three.js，npm 引入），
   火星与木星之间绘制小行星带；WebGL 不可用时自动降级 2D 示意。
   说明：已移除原"太阳居中 + 公转轨道"模型及其公转动画；
   新方案为"行星走廊"式横向排列，仅保留行星缓慢自转与小行星
   缓慢翻滚（便于观察表面纹理，且尊重 prefers-reduced-motion）。
   ============================================================ */
import {
  Scene, OrthographicCamera, WebGLRenderer, Vector3,
  AmbientLight, DirectionalLight,
  Mesh, SphereGeometry, MeshStandardMaterial,
  RingGeometry, MeshBasicMaterial, IcosahedronGeometry,
  Raycaster, Vector2, Color, Texture, TextureLoader, Clock,
  DoubleSide, Group, SRGBColorSpace
} from 'three'
import { $, $$, prefersReducedMotion } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'
import type { Planet } from '../types'
import mercuryTex from '../assets/textures/mercury.jpg'
import venusTex from '../assets/textures/venus.jpg'
import earthTex from '../assets/textures/earth.jpg'
import marsTex from '../assets/textures/mars.jpg'
import jupiterTex from '../assets/textures/jupiter.jpg'
import saturnTex from '../assets/textures/saturn.jpg'
import uranusTex from '../assets/textures/uranus.jpg'
import neptuneTex from '../assets/textures/neptune.jpg'
import saturnRingTex from '../assets/textures/saturn_ring.png'
import uranusRingTex from '../assets/textures/uranus_ring.png'
/* 详情卡片行星影像：真实行星全盘照片（外部来源资源，登记见 docs/06_资源引用.md；
   地球、木星复用模块 02 已有影像，其余 6 颗取材自 docs/行星图片.docx） */
import planetMercury from '../../assets/images/celestial-planet-mercury.jpg'
import planetVenus from '../../assets/images/celestial-planet-venus.jpg'
import planetEarth from '../../assets/images/celestial-planet-earth.jpg'
import planetMars from '../../assets/images/celestial-planet-mars.jpg'
import planetJupiter from '../../assets/images/celestial-planet-jupiter.jpg'
import planetSaturn from '../../assets/images/celestial-planet-saturn.jpg'
import planetUranus from '../../assets/images/celestial-planet-uranus.jpg'
import planetNeptune from '../../assets/images/celestial-planet-neptune.jpg'
/* 分类与数据项图标（课内 assets/icons/ 下的 SVG 素材） */
import iconTerrestrial from '../../assets/icons/类地行星.svg'
import iconGiant from '../../assets/icons/巨行星.svg'
import iconOuter from '../../assets/icons/远日行星.svg'
import iconTemp from '../../assets/icons/温度.svg'
import iconRevolution from '../../assets/icons/公转周期.svg'
import iconRotation from '../../assets/icons/自转周期.svg'

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

export function initSolarSystem(): void {
  const vp = document.getElementById('solar-viewport');
  const info = document.getElementById('solar-info');
  if (!vp || !info || !lessonData.planets) return;
  if (detectWebGL()) {
    try {
      initSolar3D(vp, info);
    } catch (e) {
      /* 3D 初始化异常（如驱动问题）时兜底 2D */
      if (window.console) console.warn('3D 行星模型初始化失败，已降级为 2D 示意：', e);
      initSolar2D(vp, info);
    }
  } else {
    initSolar2D(vp, info);
  }
}

/* ---------- 信息面板（2D/3D 共用）：横向知识卡片 ---------- */
/* 面板选择态：tip（初始提示）/ planet（某行星） */
type SolarSel = { kind: 'tip' } | { kind: 'planet'; index: number };

/* 卡片行星影像：真实行星全盘照片（非 3D 球面贴图） */
const PLANET_PHOTO: Record<string, string> = {
  mercury: planetMercury, venus: planetVenus, earth: planetEarth, mars: planetMars,
  jupiter: planetJupiter, saturn: planetSaturn, uranus: planetUranus, neptune: planetNeptune
};

/* 详情卡片左侧的行星影像：所有行星共用同一个固定尺寸的圆角矩形媒体框（与土星卡片同款取景）。
   框内直接铺真实行星照片 —— object-fit: contain 按原始比例完整显示，不裁剪、不拉伸；
   点击影像由 lightbox 模块（data-lightbox）弹出图片查看器放大查看。
   结构：<div class="planet-detail-media"><img class="planet-detail-media__image"></div> */
function planetMediaHTML(p: Planet): string {
  return `
      <div class="planet-detail-media">
        <img class="planet-detail-media__image" src="${PLANET_PHOTO[p.id]}" alt="${p.name}影像" data-lightbox decoding="async">
      </div>`;
}

/** 影像加载：成功后淡入；失败时收起 <img>，由容器兜底为行星渐变占位（不出现破损图标） */
function bindPlanetMedia(root: HTMLElement): void {
  $$('img', root).forEach(node => {
    const img = node as HTMLImageElement;
    const loaded = (): void => img.classList.add('is-loaded');
    const failed = (): void => {
      img.classList.add('is-error');
      if (img.classList.contains('planet-detail-media__image')) {
        img.closest('.planet-detail-media')?.classList.add('is-fallback');
      }
    };
    if (img.complete) {
      if (img.naturalWidth > 0) loaded();
      else failed();
      return;
    }
    img.addEventListener('load', loaded, { once: true });
    img.addEventListener('error', failed, { once: true });
  });
}

/* 数据项前的图标（设计方提供的 SVG，渲染时经 CSS 反相为浅色以适应深色面板） */
const DATA_ICON = {
  temp: iconTemp,
  orbit: iconRevolution,
  spin: iconRotation
};

/* 单张数据小卡：圆形图标徽章 + 标签 + 数值 */
function dataItem(label: string, value: string, icon = ''): string {
  const ico = icon ? `<img class="solar-card__data-ico" src="${icon}" alt="" aria-hidden="true">` : '';
  return `
    <div class="solar-card__data-item">
      <div class="solar-card__data-head">
        <span class="solar-card__data-badge" aria-hidden="true">${ico}</span>
        <span class="solar-card__data-text">
          <span class="solar-card__data-label">${label}</span>
        </span>
      </div>
      <span class="solar-card__data-value">${value}</span>
    </div>`;
}

/** 生成信息面板内容（切换时由 buildSolarPanel 统一编排入场动画）。
    带 solar-card__enter 标记的区块会在入场时依次错峰落位 */
function solarPanelHTML(sel: SolarSel): string {
  if (sel.kind === 'planet') {
    const p = lessonData.planets[sel.index];
    return `
      <div class="solar-card__inner" data-kind="planet">
        <div class="solar-card__identity">
          ${planetMediaHTML(p)}
          <div class="solar-card__ident-text">
            <div class="solar-card__title solar-card__enter">
              <span class="solar-card__num">${p.number}</span>
              <h3 class="solar-card__name">${p.name}</h3>
              <span class="solar-card__name-type" data-type="${p.typeKey}">（${p.type}）</span>
            </div>
            <p class="solar-card__desc solar-card__enter">${p.desc}</p>
          </div>
        </div>
        <div class="solar-card__data solar-card__enter">
          ${dataItem('表面温度', p.surfaceTemp, DATA_ICON.temp)}
          ${dataItem('公转周期', p.revolution, DATA_ICON.orbit)}
          ${dataItem('自转周期', p.rotation, DATA_ICON.spin)}
        </div>
      </div>`;
  }
  return `
    <div class="solar-card__inner solar-card__inner--tip" data-kind="tip">
      <p class="solar-card__tip">点击上方任意行星，查看它的类型与关键数据。</p>
    </div>`;
}

/* ---------- 信息面板切换动效（点击天体后的过渡） ----------
   1) 交叉淡化 + 方向性位移：旧内容克隆为"退场幽灵层"（绝对定位、脱离文档流）淡出并
      反向轻移；新内容淡入并沿行星走廊方向（序号增大 → 自右）滑入，与上方"由近及远"
      的横向排列保持空间连续性；
   2) 高度连续：仅当新旧高度差 > 2px 时对槽位做一次 height 补间（FLIP），避免窄屏
      堆叠布局下面板突然跳动；桌面端各态等高（min-height 锁定）时完全跳过、零开销；
   3) 极少量错峰：卡内"身份区 / 数据区"以 60ms 间隔依次落位。
   主体只动 opacity / transform（高度补间为一次性布局动画，此处按手风琴惯例容忍），
   且全部走 Web Animations API → 天然可打断：连点不同行星时新动画直接接管，
   不像关键帧那样从头重放。prefers-reduced-motion 时不做任何动画，直接换内容。 */
const SWAP_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';    // 入场：快出慢收
const SWAP_EASE_MOVE = 'cubic-bezier(0.77, 0, 0.175, 1)';  // 高度补间：平滑位移
const SWAP_IN = 300;      // 新内容入场时长（ms，收在 UI 300ms 上限）
const SWAP_OUT = 220;     // 旧内容退场时长（ms，略快 → 视线更快落到新内容）
const SWAP_STAGGER = 80;  // 卡内区块错峰间隔（ms）
const SWAP_HEIGHT = 280;  // 槽位高度补间时长（ms）
const SWAP_SHIFT = 32;    // 方向性位移距离（px）
const SWAP_THUMB = 420;       // 缩略图缩放弹入时长（ms）
const SWAP_THUMB_DELAY = 60;  // 缩略图弹入延迟（ms，等父级淡入起势后再弹）
const SWAP_ITEM = 200;        // 卡内区块落位时长（ms）
const SWAP_ITEM_SHIFT = 10;   // 卡内区块落位位移（px）
/* 数据子卡（表面温度 + 公转周期 + 自转周期）：点击行星时依次弹入 ——
   缩放 + 淡入，从左到右每张比前一张延后一拍，形成方向性的依次弹出 */
const SWAP_DATA_POP = 300;        // 弹入时长（ms）
const SWAP_DATA_POP_DELAY = 180;  // 首张起势时间，与数据区落位同步
const SWAP_DATA_POP_STAGGER = 90; // 相邻子卡的间隔（ms，左 → 右依次弹出）
const SWAP_DATA_POP_FROM = 0.82;  // 起始缩放（明显缩小 → 放大弹出）
const SWAP_DATA_POP_OVER = 1.06;  // 过冲缩放（略微超出再收回，形成"弹"的手感）

/* Web Animations API 可用性检测：不支持时（极旧浏览器 / jsdom 测试环境）退化为瞬时切换，
   内容与选中态的更新不受影响 */
const CAN_ANIMATE =
  typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

/** 选择态在"行星走廊"中的次序，用于判断切换方向 */
function selOrder(sel: SolarSel | null): number {
  if (!sel || sel.kind === 'tip') return -1;
  return sel.index;
}

/** 是否为同一选择态（重复点击同一目标时不重放动画） */
function sameSel(a: SolarSel | null, b: SolarSel): boolean {
  if (!a || a.kind !== b.kind) return false;
  return a.kind === 'planet' && b.kind === 'planet' ? a.index === b.index : true;
}

/** 搭建信息面板容器，返回“渲染某选择态”的函数（带交叉过渡动画） */
function buildSolarPanel(info: HTMLElement): (sel: SolarSel) => void {
  info.innerHTML = `
      <div class="solar-card">
        <div class="solar-card__slot"></div>
      </div>`;
  const slot = $('.solar-card__slot', info) as HTMLElement;
  let prev: SolarSel | null = null;
  let current: HTMLElement | null = null;
  let ghost: HTMLElement | null = null;
  let heightAnim: Animation | null = null;

  return (sel: SolarSel) => {
    if (sameSel(prev, sel)) return;

    /* 复位上一次可能残留的退场层与高度补间（连点场景） */
    if (ghost) { ghost.remove(); ghost = null; }
    heightAnim?.cancel();
    heightAnim = null;
    slot.style.height = '';
    const h0 = slot.offsetHeight;   // 旧内容仍在文档流中，即其真实高度

    const old = current;
    const dir = selOrder(sel) >= selOrder(prev) ? 1 : -1;   // 1 = 自右进入
    const reduce = prefersReducedMotion || !CAN_ANIMATE;

    /* 旧内容 → 退场幽灵层（克隆后脱离文档流，不参与槽位高度计算） */
    if (old && prev && !reduce) {
      const g = old.cloneNode(true) as HTMLElement;
      g.classList.add('solar-card__ghost');
      g.setAttribute('aria-hidden', 'true');
      slot.appendChild(g);
      ghost = g;
      g.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: `translateX(${-dir * SWAP_SHIFT}px)` }
        ],
        { duration: SWAP_OUT, easing: SWAP_EASE_OUT, fill: 'both' }
      ).finished.then(() => {
        if (ghost === g) { g.remove(); ghost = null; }
      }).catch(() => { /* 动画被取消（连点）时忽略 */ });
    }

    /* 换入新内容 */
    if (old) old.remove();
    slot.insertAdjacentHTML('beforeend', solarPanelHTML(sel));
    const inner = slot.lastElementChild as HTMLElement;
    current = inner;
    bindPlanetMedia(inner);   // 影像加载 / 失败兜底

    if (old && !reduce) {
      /* 高度连续：仅在高度差明显时补间（桌面端等高时完全跳过） */
      const h1 = inner.offsetHeight;
      if (Math.abs(h1 - h0) > 2) {
        slot.style.height = h0 + 'px';
        const a = slot.animate(
          [{ height: h0 + 'px' }, { height: h1 + 'px' }],
          { duration: SWAP_HEIGHT, easing: SWAP_EASE_MOVE }
        );
        a.onfinish = () => {
          if (heightAnim === a) { slot.style.height = ''; heightAnim = null; }  // 交回 auto
        };
        heightAnim = a;
      }

      /* 入场：交叉淡化 + 方向性位移 */
      inner.animate(
        [
          { opacity: 0, transform: `translateX(${dir * SWAP_SHIFT}px)` },
          { opacity: 1, transform: 'none' }
        ],
        { duration: SWAP_IN, easing: SWAP_EASE_OUT, fill: 'both' }
      );
      /* 行星影像：单独做一次轻微缩放弹入（不透明度交给父级淡入，避免叠成双重淡化） */
      const thumb = $('.planet-detail-media__image', inner);
      thumb?.animate(
        [
          { transform: 'scale(0.86)' },
          { transform: 'scale(1.05)', offset: 0.6 },
          { transform: 'scale(1)' }
        ],
        { duration: SWAP_THUMB, delay: SWAP_THUMB_DELAY, easing: SWAP_EASE_OUT, fill: 'both' }
      );
      /* 名称 → 简介 → 数据卡：三档错峰依次落位（仅位移，不动透明度） */
      $$('.solar-card__enter', inner).forEach((el, i) => {
        el.animate(
          [{ transform: `translateY(${SWAP_ITEM_SHIFT}px)` }, { transform: 'none' }],
          { duration: SWAP_ITEM, easing: SWAP_EASE_OUT, delay: 20 + i * SWAP_STAGGER, fill: 'both' }
        );
      });
      /* 三张数据子卡（温度 + 两个周期）从左到右依次弹入：
         参数完全一致，仅延迟逐张递增，形成方向性的依次弹出 */
      $$('.solar-card__data-item', inner).forEach((item, i) => {
        item.animate(
          [
            { opacity: 0, transform: `scale(${SWAP_DATA_POP_FROM})` },
            { opacity: 1, transform: `scale(${SWAP_DATA_POP_OVER})`, offset: 0.62 },
            { opacity: 1, transform: 'scale(1)' }
          ],
          {
            duration: SWAP_DATA_POP,
            delay: SWAP_DATA_POP_DELAY + i * SWAP_DATA_POP_STAGGER,
            easing: SWAP_EASE_OUT,
            fill: 'both'
          }
        );
      });
    }

    prev = sel;
  };
}

/* 与 3D 视窗一致的"由近及远"排列：半径 / 光环外缘 / 间隔（单位一致，非按比例）。
   间隔较上一版收紧，避免整体过宽；木火之间仍预留小行星带空间 */
const SOLAR_REACH = [0.72, 1.3, 1.35, 0.9, 2.7, 4.1, 2.7, 1.55];
const SOLAR_RADII = [0.72, 1.3, 1.35, 0.9, 2.7, 2.25, 1.55, 1.55];
const SOLAR_GAPS = [1.2, 1.4, 1.5, 4.2, 2.2, 2.8, 2.0];

/* 卡片头部的分类图标（设计方提供的 SVG，渲染时经 CSS 反相为白色以适配蓝色胶囊） */
const GROUP_ICON: Record<string, string> = {
  terrestrial: iconTerrestrial,
  giant: iconGiant,
  outer: iconOuter
};

/* 行星分组（类地 / 巨行星 / 远日行星）：key 对应分类主题色，desc 为卡片副标题，
   pad 为该组左右各留的卡片内边距（远日行星仅两颗且跨度窄，留宽一些以容纳头部内容） */
const SOLAR_GROUPS: { name: string; key: string; desc: string; pad: number; idxs: number[] }[] = [
  { name: '类地行星', key: 'terrestrial', desc: '岩石组成 · 体积较小', pad: 0.8, idxs: [0, 1, 2, 3] },
  { name: '巨行星', key: 'giant', desc: '体积巨大 · 主要由氢氦组成', pad: 0.8, idxs: [4, 5] },
  { name: '远日行星', key: 'outer', desc: '距日遥远 · 极寒', pad: 1.5, idxs: [6, 7] }
];

/* 选中态改为"克制、局部、卡片内部高亮"：取消大范围光环与扩散粒子后，
   反馈只由行星名称金色标签 + 名称下方一条短金线 + 行星轻微提亮承担，
   装饰一律不出所属分类卡片的圆角边界（见 style.css 的 .solar-planet-tag__rule） */

/** 粗略估算文字渲染宽度（px / SVG 单位）：中日韩字符按 1 em、其余按 0.55 em、空格按 0.3 em */
function estTextWidth(s: string, fontSize: number): number {
  let w = 0;
  for (const ch of s) {
    if (ch === ' ') w += fontSize * 0.3;
    else if (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch)) w += fontSize;
    else w += fontSize * 0.55;
  }
  return w;
}

/* 各行星自转轴的真实空间指向（黄道系），由 IAU/NASA 公布的极轴赤经赤纬（J2000）换算：
   lambda = 极轴黄道经度（决定"往哪边倒"）
   tilt   = 极轴与黄道面法线的夹角（含该行星轨道倾角；地球恰为黄赤交角）
   retro  = 是否为逆向自转（IAU 北极定义下，仅金星、天王星逆向）
   画面中可见的倾倒角 = tilt × |cos(lambda − 日心方向经度)|，其余分量朝向/背向镜头 */
const POLE: Record<string, { lambda: number; tilt: number; retro: boolean }> = {
  mercury: { lambda: 318.35, tilt: 7.12,  retro: false },
  venus:   { lambda: 29.65,  tilt: 1.18,  retro: true  },
  earth:   { lambda: 90.00,  tilt: 23.44, retro: false },
  mars:    { lambda: 352.97, tilt: 26.72, retro: false },
  jupiter: { lambda: 247.87, tilt: 2.25,  retro: false },
  saturn:  { lambda: 79.53,  tilt: 28.06, retro: false },
  uranus:  { lambda: 257.63, tilt: 82.27, retro: true  },
  neptune: { lambda: 319.26, tilt: 28.02, retro: false }
};

/* 画面整体方位（自由量）：日心方向（画面右 +X）取黄道经度 90°，
   即与地球极轴同向 —— 太阳在画面左侧，地球北极背向太阳（≈北半球冬至）。
   改成 270° 则整体镜像（地球北极朝向太阳，≈夏至）。 */
const RADIAL_LAMBDA = 90;

/** 该行星极轴在场景坐标中的单位向量。
    黄道面 = 场景 XZ 平面（法线 +Y，与 M7 公转演示一致），+X = 日心方向 */
function poleVector(id: string): Vector3 {
  const { lambda, tilt } = POLE[id];
  const d = (lambda - RADIAL_LAMBDA) * Math.PI / 180;
  const t = tilt * Math.PI / 180;
  return new Vector3(
    Math.sin(t) * Math.cos(d), // 画面横向：>0 向右倾（背离太阳），<0 向左倾
    Math.cos(t),
    -Math.sin(t) * Math.sin(d)
  );
}

/** 计算行星的 x 坐标（单位：场景单位），相邻间隔 = 两者外缘 + gap，木火之间留出小行星带空间 */
function planetXs(count: number): number[] {
  const xs: number[] = [];
  let x = 0;
  for (let i = 0; i < count; i++) {
    xs.push(x);
    if (i < count - 1) x += SOLAR_REACH[i] + SOLAR_REACH[i + 1] + SOLAR_GAPS[i];
  }
  const mid = (xs[0] + xs[count - 1]) / 2;
  return xs.map(v => v - mid);
}

/** 分组卡片度量（场景单位）：中心 x、半宽、最大光环外缘、最大球体半径 */
function groupMetrics(
  idxs: number[],
  xs: number[],
  padX = 0.8
): { cx: number; halfW: number; maxReach: number; maxR: number } {
  let minX = Infinity, maxX = -Infinity, maxReach = 0, maxR = 0;
  idxs.forEach(i => {
    minX = Math.min(minX, xs[i] - SOLAR_REACH[i]);
    maxX = Math.max(maxX, xs[i] + SOLAR_REACH[i]);
    maxReach = Math.max(maxReach, SOLAR_REACH[i]);
    maxR = Math.max(maxR, SOLAR_RADII[i]);
  });
  return { cx: (minX + maxX) / 2, halfW: (maxX - minX) / 2 + padX, maxReach, maxR };
}

/* ---------- M6 · 2D SVG 示意（降级保底，必须可用） ---------- */
function initSolar2D(vp: HTMLElement, info: HTMLElement): void {
  const planets = lessonData.planets;
  const W = 1000, H = 440, cy = 210, SCALE = 20;
  const xs = planetXs(planets.length);
  const px = (u: number) => W / 2 + u * SCALE;

  /* 小行星带：火星与木星之间的竖向长条带（矩形分布，非环形） */
  const beltMidU = (xs[3] + SOLAR_REACH[3] + 0.2 + xs[4] - SOLAR_REACH[4] - 0.2) / 2;
  const beltMidX = px(beltMidU);
  const BX = 0.8 * SCALE;
  const BY = 3.6 * SCALE;
  const dots: string[] = [];
  for (let i = 0; i < 60; i++) {
    const dx = (Math.random() * 2 - 1) * BX;
    const dy = (Math.random() * 2 - 1) * BY;
    const dr = 1.5 + Math.random() * 2.2;
    const op = (0.45 + Math.random() * 0.55).toFixed(2);
    dots.push(`<circle class="solar-belt__dot" cx="${(beltMidX + dx).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="${dr.toFixed(1)}" opacity="${op}"/>`);
  }

  /* 小行星带名称标签：与行星名称标签同款胶囊（仅作标注，不可交互） */
  const BELT_NAME = '小行星带';
  const BELT_TAG_W = 28 + BELT_NAME.length * 13;
  const BELT_TAG_TOP = cy + BY + 8;

  /* 分组矩形卡片（类地 / 巨行星 / 远日行星）：图标 + 标题 + 副标题（两行头部）
     三类卡片统一顶线与高度（取全体行星的最大外缘 / 半径），避免高低不一 */
  const metrics = SOLAR_GROUPS.map(g => groupMetrics(g.idxs, xs, g.pad));
  const CARD_HEAD = 56;   // 卡片头部高度（SVG 单位）
  const maxReach = Math.max(...metrics.map(m => m.maxReach));
  const maxR = Math.max(...metrics.map(m => m.maxR));
  const topSvg = maxReach * SCALE + 14 + CARD_HEAD;   // 头部 + 行星上方留白
  const botSvg = maxR * SCALE + 44;                   // 行星下方：名称标签留白
  const cardY = cy - topSvg;
  const cardH = topSvg + botSvg;
  const groupsSvg = SOLAR_GROUPS.map((g, gi) => {
    const m = metrics[gi];
    /* 宽度左右各内缩，制造卡片间的明确间隙，避免相邻分组卡片相互压叠 */
    const cardW = m.halfW * 2 * SCALE - 14;
    const cardX = px(m.cx) - cardW / 2;
    /* 头部：蓝色渐变胶囊（图标 + 标题）+ 深色描边说明标签，与 3D 卡片同款 */
    const headCy = cardY + CARD_HEAD / 2;
    const pillX = cardX + 14;
    const pillW = 58 + estTextWidth(g.name, 17);   // 内边距 + 28px 图标 + 间距 + 标题字宽
    const pillIconX = pillX + 11;
    const pillTextX = pillX + 11 + 28 + 7;
    const tagX = pillX + pillW + 9;
    const tagW = 20 + estTextWidth(g.desc, 11);
    return `
        <g class="solar-group" data-type="${g.key}">
          <rect class="solar-group__card" x="${cardX.toFixed(1)}" y="${cardY.toFixed(1)}" width="${cardW.toFixed(1)}" height="${cardH.toFixed(1)}" rx="14"/>
          <rect class="solar-group__accent" x="${(cardX + 14).toFixed(1)}" y="${(cardY + 1).toFixed(1)}" width="${(cardW - 28).toFixed(1)}" height="2" rx="1"/>
          <rect class="solar-group__badge" x="${pillX.toFixed(1)}" y="${(headCy - 18).toFixed(1)}" width="${pillW.toFixed(1)}" height="36" rx="18"/>
          <image class="solar-group__icon" x="${pillIconX.toFixed(1)}" y="${(headCy - 14).toFixed(1)}" width="28" height="28" href="${GROUP_ICON[g.key]}"/>
          <text class="solar-group__title" x="${pillTextX.toFixed(1)}" y="${(headCy + 6).toFixed(1)}">${g.name}</text>
          <rect class="solar-group__tag" x="${tagX.toFixed(1)}" y="${(headCy - 13).toFixed(1)}" width="${tagW.toFixed(1)}" height="26" rx="13"/>
          <text class="solar-group__sub" x="${(tagX + 10).toFixed(1)}" y="${(headCy + 4).toFixed(1)}">${g.desc}</text>
        </g>`;
  }).join('');

  vp.innerHTML = `
      <svg class="solar-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="太阳系八大行星由近及远排列示意图">
        ${groupsSvg}
        <g class="solar-belt">${dots.join('')}
          <g class="solar-planet-tag">
            <rect class="solar-planet-tag__bg" x="${(beltMidX - BELT_TAG_W / 2).toFixed(1)}" y="${BELT_TAG_TOP.toFixed(1)}" width="${BELT_TAG_W.toFixed(1)}" height="22" rx="11"/>
            <text class="solar-planet-tag__name" x="${beltMidX.toFixed(1)}" y="${(BELT_TAG_TOP + 15).toFixed(1)}">${BELT_NAME}</text>
          </g>
        </g>
        ${planets.map((p, i) => {
          const r = SOLAR_RADII[i] * SCALE;
          const ring = i === 5 || i === 6
            ? `<ellipse class="solar-ring" rx="${(SOLAR_REACH[i] * SCALE).toFixed(1)}" ry="${(SOLAR_REACH[i] * SCALE * 0.32).toFixed(1)}" stroke="${i === 5 ? '#e3c98a' : '#a9c7d8'}"/>`
            : '';
          const tagW = 28 + p.name.length * 13;
          const tagTop = r + 8;
          /* 选中指示线（2D 降级）：名称标签正下方一小段金线，选中时由 0 展开到 28px，
             与 3D 版同款 —— 不出卡片、不成环、不发光 */
          const tagRule = `<rect class="solar-planet-tag__rule" x="-14" y="${(tagTop + 26).toFixed(1)}" width="28" height="2.5" rx="1.25"/>`;
          return `
          <g class="solar-planet" data-planet="${p.id}" transform="translate(${px(xs[i]).toFixed(1)} ${cy})" tabindex="0" role="button" aria-pressed="false" aria-label="${p.number} ${p.name}·${p.type}">
            ${ring}
            <circle class="solar-planet-dot" r="${r.toFixed(1)}" fill="${p.color}"/>
            <g class="solar-planet-tag">
              <rect class="solar-planet-tag__bg" x="${(-tagW / 2).toFixed(1)}" y="${tagTop.toFixed(1)}" width="${tagW.toFixed(1)}" height="22" rx="11"/>
              <text class="solar-planet-tag__name" x="0" y="${(tagTop + 15).toFixed(1)}">${p.name}</text>
              ${tagRule}
            </g>
          </g>`;
        }).join('')}
      </svg>`;

  const planetEls = $$('.solar-planet', vp);
  const groupEls = $$('.solar-group', vp);
  const renderPanel = buildSolarPanel(info);
  renderPanel({ kind: 'tip' });

  /** 高亮所属分类卡片（顶沿金色强调线 + 卡片描边略微提亮，卡片底色与尺寸不变） */
  function setActiveGroup(active: number): void {
    groupEls.forEach((g, k) => {
      g.classList.toggle('is-active', SOLAR_GROUPS[k].idxs.includes(active));
    });
  }

  function setPressed(active: number): void {
    planetEls.forEach((g, k) => {
      g.classList.toggle('is-active', k === active);
      g.setAttribute('aria-pressed', String(k === active));
    });
    setActiveGroup(active);
  }

  function select(p: Planet, i: number): void {
    setPressed(i);
    renderPanel({ kind: 'planet', index: i });
    App.selectedPlanet = p.id;
  }

  planetEls.forEach((g, i) => {
    g.addEventListener('click', () => select(planets[i], i));
    (g as HTMLElement).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(planets[i], i);
      }
    });
  });
}

/* ---------- M6 · 3D 行星模型走廊（Three.js，npm 引入） ---------- */
function initSolar3D(vp: HTMLElement, info: HTMLElement): void {
  const planets = lessonData.planets;
  const renderPanel = buildSolarPanel(info);
  renderPanel({ kind: 'tip' });

  vp.classList.add('is-3d');
  vp.innerHTML = `
      <div class="solar3d">
        <div class="solar3d__groups"></div>
        <div class="solar3d__labels"></div>
      </div>`;

  const wrap = $('.solar3d', vp)!;
  const groupsBox = $('.solar3d__groups', vp)!;
  const labelsBox = $('.solar3d__labels', vp)!;

  const scene = new Scene();
  const HALF_W = 26.5;   // 横向半视域：略大于行星与卡片总跨度，保证卡片四周留有余量、互不重叠
  const CAM_Z = 100;
  /* 正射相机（正射投影）：视域内物体平行等大、无透视变形，
     适合"从左到右依次展示行星模型"的教学场景 */
  const camera = new OrthographicCamera(-HALF_W, HALF_W, HALF_W, -HALF_W, 0.1, 2000);
  /* 由 Three.js 自建 canvas（避免与既有的 2D 上下文冲突）；
     WebGL 上下文创建失败时 WebGLRenderer 只警告不抛错，此处显式校验以触发上层 2D 降级 */
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  if (!renderer.getContext()) throw new Error('WebGL 上下文不可用');
  App.solar3dRenderer = renderer; // 调试/验收用：可通过 info.render 检查渲染统计
  const canvas = renderer.domElement;
  canvas.className = 'solar3d__canvas';
  canvas.setAttribute('aria-label', '八大行星由近及远排列的 3D 模型示意');
  groupsBox.after(canvas);   // canvas 位于分组卡片之上、名称标签之下
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  /* 光照：环境光 + 主方向光 + 轮廓光 */
  scene.add(new AmbientLight(0x99aaff, 0.95));
  const mainLight = new DirectionalLight(0xfff3e0, 1.5);
  mainLight.position.set(10, 16, 14);
  scene.add(mainLight);
  const rimLight = new DirectionalLight(0x6688ff, 0.45);
  rimLight.position.set(-12, -6, -10);
  scene.add(rimLight);

  /* 行星表面纹理：构建时由 Vite 静态导入并 base64 内联（见 vite.config.ts assetsInlineLimit），
     避免运行时相对路径 `./textures/` 随页面地址漂移、以及 file:// 下 WebGL 上传外部图片被安全策略拦截。
     注意：three r152+ 默认启用色彩管理，sRGB 贴图必须显式标记 colorSpace，
     否则会被当作线性数据采样，导致贴图发灰、过亮、饱和度失真 */
  const loader = new TextureLoader();
  const tex = (url: string): Texture => {
    const t = loader.load(url);
    t.colorSpace = SRGBColorSpace;
    return t;
  };
  const TEX: Record<string, Texture> = {
    mercury: tex(mercuryTex),
    venus: tex(venusTex),
    earth: tex(earthTex),
    mars: tex(marsTex),
    jupiter: tex(jupiterTex),
    saturn: tex(saturnTex),
    uranus: tex(uranusTex),
    neptune: tex(neptuneTex),
    saturn_ring: tex(saturnRingTex),
    uranus_ring: tex(uranusRingTex)
  };

  /* 行星球体：从左到右按序排列（水星 → 海王星）。
     注：场景透明（alpha），不额外绘制星点，直接透出页面深空背景，让行星"跳出容器" */
  const xs = planetXs(planets.length);
  const planetMeshes: Mesh<SphereGeometry, MeshStandardMaterial>[] = [];
  /* 缓慢自转角速度（rad/s，示意值，非真实比例） */
  const SPIN = [0.12, 0.08, 0.3, 0.28, 0.5, 0.45, 0.35, 0.4];
  /* 自转方向：逆向自转（金星、天王星）取负，与真实极轴指向配套 */
  const SPIN_SIGN = planets.map(p => (POLE[p.id].retro ? -1 : 1));
  planets.forEach((p, i) => {
    const r = SOLAR_RADII[i];
    /* holder 承载自转轴指向：把 holder 的局部 Y 轴旋转到该行星真实的极轴方向，
       球体再绕自身局部 Y 轴自转，从而让"极轴指向真实 + 绕该轴自转"同时成立 */
    const holder = new Group();
    holder.position.set(xs[i], 0, 0);
    holder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), poleVector(p.id));
    scene.add(holder);
    const mesh = new Mesh(
      new SphereGeometry(r, 48, 48),
      new MeshStandardMaterial({ map: TEX[p.id], roughness: 0.92, metalness: 0.05 })
    );
    mesh.userData.index = i;
    holder.add(mesh);
    planetMeshes.push(mesh);

    /* 土星 / 天王星光环（环形贴图，随 holder 一起倾斜） */
    if (p.id === 'saturn' || p.id === 'uranus') {
      const ring = new Mesh(
        new RingGeometry(r * 1.08, SOLAR_REACH[i], 64),
        new MeshBasicMaterial({
          map: p.id === 'saturn' ? TEX.saturn_ring : TEX.uranus_ring,
          side: DoubleSide, transparent: true, depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      mesh.add(ring);
    }
  });

  /* 小行星带：火星与木星之间的竖向长条带（矩形分布，非环形） */
  const beltGroup = new Group();
  const beltStart = xs[3] + SOLAR_REACH[3] + 0.2;
  const beltEnd = xs[4] - SOLAR_REACH[4] - 0.2;
  const beltMid = (beltStart + beltEnd) / 2;
  const BX = 0.8, BY = 3.6;
  const ROCK_COLORS = [0x9b9286, 0x8a8072, 0xa89f92, 0x7d7568];
  for (let i = 0; i < 200; i++) {
    const s = 0.06 + Math.random() * 0.1;
    const rock = new Mesh(
      new IcosahedronGeometry(s, 0),
      new MeshStandardMaterial({
        color: ROCK_COLORS[i % ROCK_COLORS.length],
        roughness: 1, metalness: 0, flatShading: true
      })
    );
    rock.position.set(
      beltMid + (Math.random() * 2 - 1) * BX,
      (Math.random() * 2 - 1) * BY,
      (Math.random() * 2 - 1) * 0.5
    );
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.userData.tumble = {
      x: (Math.random() - 0.5) * 0.5,
      y: (Math.random() - 0.5) * 0.5,
      z: (Math.random() - 0.5) * 0.5
    };
    beltGroup.add(rock);
  }
  scene.add(beltGroup);

  const HEAD_PX = 66;        // 卡片头部高度（px，固定不随视口缩放）
  const TAG_BOTTOM_PX = 46;  // 名称标签高度 + 卡片下沿留白
  const CARD_GAP_PX = 18;    // 相邻卡片之间的水平净间距（由两侧各内缩一半得到）

  /* 分组卡片的度量（场景单位）：取三类分组的最大光环外缘 / 最大球体半径 */
  const groupMetricsArr = SOLAR_GROUPS.map(g => groupMetrics(g.idxs, xs, g.pad));
  const maxReach = Math.max(...groupMetricsArr.map(m => m.maxReach));
  const maxR = Math.max(...groupMetricsArr.map(m => m.maxR));

  /* 相机取景：按容器宽高设定正射视域（横向固定 HALF_W，纵向按宽高比换算），
     确保八颗行星 + 竖向小行星带整体可见。
     纵向中心不取 y=0（行星球心连线），而是取"分组卡片的几何中心"：
     卡片顶沿比底沿多出一个头部高度，若以 y=0 居中，卡片下方就会多出一段空白，
     把下方信息卡片推远。中心上移半个偏差 (ΔmaxReach + 头部/留白之差) ÷ pxPerUnit，
     卡片的上下留白即相等，且只由容器高度决定 —— 容器越贴合内容，间距越紧。
     注意：容器尺寸由调用方（updateLabels 的尺寸守卫）传入，不在 init 时单独算一次 */
  function fit(w: number, h: number): void {
    renderer.setSize(w, h, false);
    const pxPerUnit = w / (2 * HALF_W);
    const halfH = HALF_W * (h / Math.max(w, 1));
    const centerY =
      ((maxReach - maxR) + (HEAD_PX - TAG_BOTTOM_PX) / pxPerUnit) / 2;
    camera.left = -HALF_W;
    camera.right = HALF_W;
    camera.top = halfH + centerY;
    camera.bottom = -halfH + centerY;
    camera.updateProjectionMatrix();
  }
  camera.position.set(0, CAM_Z * 0.16, CAM_Z);
  camera.lookAt(0, 0, 0);

  /* 行星名称标签（HTML 覆盖层，跟随 3D 投影位置）。
     外层 label 仅负责定位与交互，内层 pill 负责视觉（胶囊 / 悬停上移 / 选中金色） */
  const labels: HTMLElement[] = [];
  planets.forEach((p, i) => {
    const el = document.createElement('span');
    el.className = 'solar3d__label';
    el.dataset.planet = p.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-pressed', 'false');
    el.setAttribute('aria-label', `${p.number} ${p.name}：${p.type}，${p.desc}`);
    el.innerHTML = `<span class="solar3d__tag"><span class="solar3d__pill">${p.name}</span></span>`;
    labelsBox.appendChild(el);
    labels.push(el);
  });
  /* 小行星带名称标签：与行星名称标签同款胶囊（仅作标注，不可交互） */
  const beltLabel = document.createElement('span');
  beltLabel.className = 'solar3d__label solar3d__label--belt';
  beltLabel.innerHTML = `<span class="solar3d__tag"><span class="solar3d__pill">小行星带</span></span>`;
  labelsBox.appendChild(beltLabel);

  /* 分组矩形卡片（HTML 覆盖层，位于 canvas 之下；随投影每帧更新位置与尺寸） */
  const groupEls = SOLAR_GROUPS.map(g => {
    const box = document.createElement('div');
    box.className = 'solar3d__group';
    box.innerHTML = `
      <div class="solar3d__group-head">
        <span class="solar3d__group-badge"><img class="solar3d__group-icon" src="${GROUP_ICON[g.key]}" alt="" aria-hidden="true"><span class="solar3d__group-title">${g.name}</span></span>
        <span class="solar3d__group-tag">${g.desc}</span>
      </div>`;
    groupsBox.appendChild(box);
    return box;
  });

  const projV = new Vector3();

  /* 最近一次已按此尺寸取景的容器尺寸（-1 表示尚未取景） */
  let lastW = -1;
  let lastH = -1;

  /** 读取容器真实尺寸，变化时重新取景，并把本次尺寸返回给调用方。
      取景高度必须始终等于容器的 CSS 高度：正射相机的竖向视域与画布缓冲高度都由它决定，
      一旦两者不一致（例如初始化时样式尚未生效、读到偏大的高度），
      画布位图会被浏览器等比压进容器 —— 表现就是行星被"压扁"，
      同时按该高度换算的覆盖层坐标（分组卡片 / 名称标签）会整体落到模型下方。
      因此这里只按"读到什么就用什么、与上次不同就重算"，由 ResizeObserver 兜底触发 */
  function applySize(): { w: number; h: number } {
    const w = wrap.clientWidth || vp.clientWidth || 800;
    const h = wrap.clientHeight || 560;
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      fit(w, h);
    }
    return { w, h };
  }

  function updateLabels(): void {
    const { w, h } = applySize();
    const pxPerUnit = w / (2 * HALF_W);
    for (let i = 0; i < planets.length; i++) {
      /* 名称标签锚在行星下方（顶部对齐）；选中指示线由标签自身伪元素绘制 */
      projV.set(xs[i], -SOLAR_RADII[i] - 0.7, 0).project(camera);
      labels[i].style.transform =
        `translate(${((projV.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-projV.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, 0)`;
    }
    /* 小行星带名称标签：与行星名称标签同款锚定方式（贴在小行星带下沿、顶部对齐） */
    projV.set(beltMid, -BY - 0.7, 0).project(camera);
    beltLabel.style.transform =
      `translate(${((projV.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-projV.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, 0)`;
    /* 分组卡片：正交相机下像素/场景单位一致。
       顶 / 底留白取全体分组的最大值，使三类卡片高度一致、顶线对齐 */
    const topExt = maxReach + 0.7 + HEAD_PX / pxPerUnit;
    const botExt = maxR + 0.7 + TAG_BOTTOM_PX / pxPerUnit;
    const cardH = ((topExt + botExt) * pxPerUnit).toFixed(1) + 'px';
    /* 先算出三张卡片各自的中心与宽度（宽度左右各内缩半个间距，制造明确间隙） */
    const boxes = groupMetricsArr.map(m => {
      const boxW = Math.max(m.halfW * 2 * pxPerUnit - CARD_GAP_PX, 60);
      projV.set(m.cx, 0, 0).project(camera);
      const gx = (projV.x * 0.5 + 0.5) * w;
      const gy = (-projV.y * 0.5 + 0.5) * h;
      return { boxW, left: gx - boxW / 2, top: gy - topExt * pxPerUnit };
    });
    /* 整体统一平移（而非各自裁切）：既避免贴边，又不会改变卡片间的相对间距、杜绝重叠 */
    const minLeft = Math.min(...boxes.map(b => b.left));
    const maxRight = Math.max(...boxes.map(b => b.left + b.boxW));
    let shift = 0;
    const MARGIN_PX = 20;
    if (minLeft < MARGIN_PX) shift = MARGIN_PX - minLeft;
    else if (maxRight > w - MARGIN_PX) shift = Math.min(w - MARGIN_PX - maxRight, MARGIN_PX - minLeft);
    boxes.forEach((b, k) => {
      const el = groupEls[k];
      el.style.width = b.boxW.toFixed(1) + 'px';
      el.style.height = cardH;
      el.style.transform =
        `translate(${(b.left + shift).toFixed(1)}px, ${b.top.toFixed(1)}px)`;
    });
  }

  /* 拾取：点击选中 + 悬停发光 */
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const C_HOVER = new Color(0x223344);
  const C_SEL = new Color(0x4a3608);   // 选中：柔和金色自发光（仅轻微提亮，不放大球体）
  const C_NONE = new Color(0x000000);
  /* 悬停轻微放大：只记录目标值，由帧循环逐帧插值，避免突变。
     选中不再放大 —— 选中反馈交给名称标签、下方短金线与所属卡片内部描边 */
  const HOVER_SCALE = 1.05;
  const targetScale = planets.map(() => 1);
  let selectedIndex = -1;
  let hoverIndex = -1;

  /** 按"悬停 > 常态"重算目标缩放（选中不改变行星尺寸） */
  function computeTargetScale(): void {
    for (let k = 0; k < planets.length; k++) {
      targetScale[k] = k === hoverIndex ? HOVER_SCALE : 1;
    }
  }

  function glow(i: number, active: boolean): void {
    if (i < 0) return;
    planetMeshes[i].material.emissive.copy(active ? C_HOVER : (i === selectedIndex ? C_SEL : C_NONE));
  }

  function setPointerFromEvent(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function selectPlanet(i: number): void {
    selectedIndex = i;
    planetMeshes.forEach((m, k) => {
      m.material.emissive.copy(k === i ? C_SEL : C_NONE);
    });
    labels.forEach((el, k) => {
      el.classList.toggle('is-active', k === i);
      el.setAttribute('aria-pressed', String(k === i));
    });
    /* 所属分类卡片进入轻微激活：顶沿细金线 + 内侧一圈淡蓝描边（不改变卡片尺寸与底色） */
    groupEls.forEach((el, k) => {
      el.classList.toggle('is-active', SOLAR_GROUPS[k].idxs.includes(i));
    });
    renderPanel({ kind: 'planet', index: i });
    App.selectedPlanet = planets[i].id;
  }

  let downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; });
  canvas.addEventListener('pointerup', e => {
    if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // 判定为点击而非拖拽
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetMeshes, false);
    if (!hits.length) return;
    selectPlanet(hits[0].object.userData.index as number);
  });
  canvas.addEventListener('pointermove', e => {
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetMeshes, false);
    const idx = hits.length ? (hits[0].object.userData.index as number) : -1;
    if (idx !== hoverIndex) {
      glow(hoverIndex, false);
      hoverIndex = idx;
      glow(idx, true);
    }
    /* 悬停行星轻微放大（目标值，逐帧插值） */
    computeTargetScale();
    canvas.style.cursor = idx >= 0 ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => {
    if (hoverIndex >= 0) { glow(hoverIndex, false); hoverIndex = -1; }
    computeTargetScale();
    canvas.style.cursor = '';
  });

  /* 标签点击 / 键盘选择（无障碍） */
  labels.forEach((el, i) => {
    el.addEventListener('click', () => selectPlanet(i));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPlanet(i);
      }
    });
  });

  /* 动画循环：仅行星缓慢自转 + 小行星带缓慢翻滚（无公转）；
     离开屏幕时暂停渲染；prefers-reduced-motion 时渲染静态一帧 */
  const clock = new Clock();
  let rafId = 0;
  let inView = true;
  if ('IntersectionObserver' in window) {
    const sec = document.getElementById('solar');
    if (sec) {
      new IntersectionObserver(entries => {
        entries.forEach(en => {
          inView = en.isIntersecting;
          if (inView && !prefersReducedMotion) tick();
        });
      }, { threshold: 0 }).observe(sec);
    }
  }

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!prefersReducedMotion) {
      planetMeshes.forEach((m, i) => {
        m.rotation.y += dt * SPIN[i] * SPIN_SIGN[i];
        /* 悬停缩放平滑过渡 */
        const s = m.scale.x + (targetScale[i] - m.scale.x) * Math.min(1, dt * 12);
        m.scale.setScalar(s);
      });
      beltGroup.children.forEach(rock => {
        const t = rock.userData.tumble as { x: number; y: number; z: number };
        rock.rotation.x += dt * t.x;
        rock.rotation.y += dt * t.y;
        rock.rotation.z += dt * t.z;
      });
    }
    updateLabels();
    renderer.render(scene, camera);
  }

  function tick(): void {
    rafId = 0;
    if (!inView) return;
    frame();
    rafId = requestAnimationFrame(tick);
  }

  function onResize(): void {
    /* 窗口尺寸变化：强制重新取景 + 重算覆盖层位置，并立即重绘一帧 */
    lastW = -1;
    lastH = -1;
    updateLabels();
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', onResize);

  /* 容器尺寸一旦真实变化（样式生效、资源加载完成、布局收敛、面板开合等）就重算并重绘。
     不能只依赖窗口 resize 与渲染循环：循环在模块离开视口时会暂停，
     prefers-reduced-motion 下更是完全不启动 —— 此时窗口尺寸没变、但容器尺寸变了，
     取景与覆盖层位置就会永久停留在错误尺寸上（行星被压扁、光环落在模型下方） */
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      lastW = -1;
      lastH = -1;
      updateLabels();
      renderer.render(scene, camera);
    }).observe(wrap);
  }

  updateLabels();   // 首帧：完成相机取景 + 覆盖层定位
  if (prefersReducedMotion) {
    renderer.render(scene, camera); // 静态渲染一帧；尺寸变化时由 ResizeObserver / onResize 重绘
  } else {
    tick();
  }
}
