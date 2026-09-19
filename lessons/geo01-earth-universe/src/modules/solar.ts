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
  DoubleSide, Group, BoxGeometry, SRGBColorSpace
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

/* 2D/3D 共用的信息区：状态条 */
function buildSolarInfo(info: HTMLElement, tip: string): HTMLElement {
  info.innerHTML = '';
  const status = document.createElement('p');
  status.className = 'solar-status';
  status.textContent = tip;
  info.appendChild(status);
  return status;
}

/* 与 3D 视窗一致的"由近及远"排列：半径 / 光环外缘 / 间隔（单位一致，非按比例）。
   间隔较上一版收紧，避免整体过宽；木火之间仍预留小行星带空间 */
const SOLAR_REACH = [0.72, 1.3, 1.35, 0.9, 2.7, 4.1, 2.7, 1.55];
const SOLAR_RADII = [0.72, 1.3, 1.35, 0.9, 2.7, 2.25, 1.55, 1.55];
const SOLAR_GAPS = [1.2, 1.4, 1.5, 4.2, 2.2, 1.9, 2.0];

/* 小行星带：约定 id 与讲解文本（2D/3D 共用） */
const BELT_ID = 'asteroid-belt';
const BELT_DESC = '小行星带（火星与木星之间）：由大量岩石碎块组成，它们是太阳系形成早期未能聚集成行星的遗留物质。';

/* 行星分组（类地 / 巨 / 远日），用于虚线圆角分组框 */
const SOLAR_GROUPS = [
  { name: '类地行星', idxs: [0, 1, 2, 3] },
  { name: '巨行星', idxs: [4, 5] },
  { name: '远日行星', idxs: [6, 7] }
];

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

/** 计算分组虚线框在场景坐标下的包围盒（按光环外缘 + 留白） */
function groupBox(
  idxs: number[],
  xs: number[],
  padX = 0.8,
  padY = 0.7
): { cx: number; halfW: number; halfH: number } {
  let minX = Infinity, maxX = -Infinity, maxR = 0;
  idxs.forEach(i => {
    minX = Math.min(minX, xs[i] - SOLAR_REACH[i]);
    maxX = Math.max(maxX, xs[i] + SOLAR_REACH[i]);
    maxR = Math.max(maxR, SOLAR_REACH[i]);
  });
  return { cx: (minX + maxX) / 2, halfW: (maxX - minX) / 2 + padX, halfH: maxR + padY };
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

  /* 分组虚线圆角框（类地 / 巨 / 远日） */
  const groupsSvg = SOLAR_GROUPS.map(g => {
    const b = groupBox(g.idxs, xs);
    const x = px(b.cx - b.halfW);
    const y = cy - b.halfH * SCALE;
    return `
        <g class="solar-group">
          <rect class="solar-group__box" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(b.halfW * 2 * SCALE).toFixed(1)}" height="${(b.halfH * 2 * SCALE).toFixed(1)}" rx="18"/>
          <text class="solar-group__label" x="${px(b.cx).toFixed(1)}" y="${(y - 10).toFixed(1)}">${g.name}</text>
        </g>`;
  }).join('');

  vp.innerHTML = `
      <svg class="solar-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="太阳系八大行星由近及远排列示意图">
        <text class="solar-note" x="${W - 12}" y="24" text-anchor="end">示意图 · 非按比例</text>
        ${groupsSvg}
        <g class="solar-belt" tabindex="0" role="button" aria-label="小行星带（点击查看介绍）">${dots.join('')}
          <text class="solar-belt-label" x="${beltMidX.toFixed(1)}" y="${(cy + BY + 16).toFixed(1)}">小行星带</text>
        </g>
        ${planets.map((p, i) => {
          const r = SOLAR_RADII[i] * SCALE;
          const ring = i === 5 || i === 6
            ? `<ellipse class="solar-ring" rx="${(SOLAR_REACH[i] * SCALE).toFixed(1)}" ry="${(SOLAR_REACH[i] * SCALE * 0.32).toFixed(1)}" stroke="${i === 5 ? '#e3c98a' : '#a9c7d8'}"/>`
            : '';
          return `
          <g class="solar-planet" data-planet="${p.id}" transform="translate(${px(xs[i]).toFixed(1)} ${cy})" tabindex="0" role="button" aria-label="${p.name}">
            ${ring}
            <circle class="solar-planet-dot" r="${r.toFixed(1)}" fill="${p.color}"/>
            <text class="solar-planet-name" y="${(r + 30).toFixed(1)}">${p.name}</text>
          </g>`;
        }).join('')}
      </svg>`;

  const planetEls = $$('.solar-planet', vp);
  const beltEl = $('.solar-belt', vp)!;
  const status = buildSolarInfo(info, '从左到右依次为八大行星，点击行星或小行星带查看分类与特征。');

  function selectBelt(): void {
    planetEls.forEach(g => g.classList.remove('is-active'));
    beltEl.classList.add('is-active');
    status.textContent = BELT_DESC;
    status.classList.add('is-active');
    App.selectedPlanet = BELT_ID;
  }

  function select(p: Planet): void {
    planetEls.forEach(g => g.classList.toggle('is-active', g.getAttribute('data-planet') === p.id));
    beltEl.classList.remove('is-active');
    status.textContent = p.name + '（' + p.type + '）：' + p.desc;
    status.classList.add('is-active');
    App.selectedPlanet = p.id;
  }

  beltEl.addEventListener('click', selectBelt);
  (beltEl as HTMLElement).addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectBelt();
    }
  });

  planetEls.forEach((g, i) => {
    g.addEventListener('click', () => select(planets[i]));
    (g as HTMLElement).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(planets[i]);
      }
    });
  });
}

/* ---------- M6 · 3D 行星模型走廊（Three.js，npm 引入） ---------- */
function initSolar3D(vp: HTMLElement, info: HTMLElement): void {
  const planets = lessonData.planets;
  const status = buildSolarInfo(info, '从左到右依次为八大行星，点击行星查看分类与特征。');

  vp.classList.add('is-3d');
  vp.innerHTML = `
      <div class="solar3d">
        <span class="solar3d__note">行星模型 · 非按比例</span>
        <div class="solar3d__labels"></div>
      </div>`;

  const wrap = $('.solar3d', vp)!;
  const labelsBox = $('.solar3d__labels', vp)!;

  const scene = new Scene();
  const HALF_W = 24;
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
  wrap.prepend(canvas);
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
  /* 自转轴倾角（度，取真实值）：天王星约 98°，几乎是"躺着转"；
     金星 177° 表示逆向自转；地球 23.4° 即黄赤交角。
     TILT_X 仅天王星非 0：在保持"躺着"的同时让自转轴略向镜头前倾，
     使近乎侧立的光环不再完全侧视消失，而是呈现为可见的倾斜椭圆 */
  const TILT_Z = [0.03, 177.4, 23.4, 25.2, 3.1, 26.7, 97.8, 28.3];
  const TILT_X = [0, 0, 0, 0, 0, 0, 20, 0];
  planets.forEach((p, i) => {
    const r = SOLAR_RADII[i];
    /* holder 承载自转轴倾角：对 holder 整体旋转，球体在自身局部 Y 轴自转，
       从而让"自转轴倾斜 + 绕倾斜轴自转"同时成立 */
    const holder = new Group();
    holder.position.set(xs[i], 0, 0);
    holder.rotation.order = 'ZXY';
    holder.rotation.set(TILT_X[i] * Math.PI / 180, 0, TILT_Z[i] * Math.PI / 180);
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

  /* 小行星带命中区域：透明盒覆盖整条竖向长条带，供点击/悬停拾取（碎石稀疏，直接点碎石易漏选） */
  const beltHit = new Mesh(
    new BoxGeometry(BX * 2, BY * 2, 1),
    new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  beltHit.position.set(beltMid, 0, 0);
  beltHit.userData.isBelt = true;
  scene.add(beltHit);

  /* 相机取景：按容器宽高设定正射视域（横向固定 HALF_W，纵向按宽高比换算），
     确保八颗行星 + 竖向小行星带整体可见 */
  function fit(): void {
    const w = wrap.clientWidth || vp.clientWidth || 800;
    const h = wrap.clientHeight || 560;
    renderer.setSize(w, h, false);
    const halfH = HALF_W * (h / Math.max(w, 1));
    camera.left = -HALF_W;
    camera.right = HALF_W;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  camera.position.set(0, CAM_Z * 0.16, CAM_Z);
  camera.lookAt(0, 0, 0);
  fit();

  /* 行星名称标签（HTML 覆盖层，跟随 3D 投影位置） */
  const labels: HTMLElement[] = [];
  planets.forEach((p, i) => {
    const el = document.createElement('span');
    el.className = 'solar3d__label';
    el.textContent = p.name;
    el.dataset.planet = p.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', p.name + '：' + p.desc);
    labelsBox.appendChild(el);
    labels.push(el);
  });
  /* 小行星带标签（可交互：点击查看介绍） */
  const beltLabel = document.createElement('span');
  beltLabel.className = 'solar3d__label solar3d__label--belt';
  beltLabel.textContent = '小行星带';
  beltLabel.tabIndex = 0;
  beltLabel.setAttribute('role', 'button');
  beltLabel.setAttribute('aria-label', BELT_DESC);
  labelsBox.appendChild(beltLabel);

  /* 分组虚线圆角框（HTML 覆盖层，随投影每帧更新位置与尺寸） */
  const groupBoxes = SOLAR_GROUPS.map(g => groupBox(g.idxs, xs));
  const groupEls = SOLAR_GROUPS.map(g => {
    const box = document.createElement('div');
    box.className = 'solar3d__group';
    const label = document.createElement('span');
    label.className = 'solar3d__group-label';
    label.textContent = g.name;
    box.appendChild(label);
    labelsBox.appendChild(box);
    return box;
  });

  const projV = new Vector3();
  function updateLabels(): void {
    const w = wrap.clientWidth || 800;
    const h = wrap.clientHeight || 560;
    for (let i = 0; i < planets.length; i++) {
      projV.set(xs[i], -SOLAR_RADII[i] - 0.7, 0).project(camera);
      const left = (projV.x * 0.5 + 0.5) * w;
      const top = (-projV.y * 0.5 + 0.5) * h;
      labels[i].style.transform =
        `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) translate(-50%, -50%)`;
    }
    projV.set(beltMid, -BY - 0.9, 0).project(camera);
    beltLabel.style.transform =
      `translate(${(projV.x * 0.5 + 0.5) * w}px, ${(-projV.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
    /* 分组虚线框：正交相机下像素/场景单位一致，按中心投影 + 固定单位换算 */
    const pxPerUnit = w / (2 * HALF_W);
    groupBoxes.forEach((b, k) => {
      projV.set(b.cx, 0, 0).project(camera);
      const gx = (projV.x * 0.5 + 0.5) * w;
      const gy = (-projV.y * 0.5 + 0.5) * h;
      const el = groupEls[k];
      el.style.width = (b.halfW * 2 * pxPerUnit).toFixed(1) + 'px';
      el.style.height = (b.halfH * 2 * pxPerUnit).toFixed(1) + 'px';
      el.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px) translate(-50%, -50%)`;
    });
  }

  /* 拾取：点击选中 + 悬停发光 */
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const C_HOVER = new Color(0x223344);
  const C_SEL = new Color(0x443322);
  const C_NONE = new Color(0x000000);
  let selectedIndex = -1;
  let hoverIndex = -1;

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
    beltLabel.classList.remove('is-active');
    planetMeshes.forEach((m, k) => {
      m.material.emissive.copy(k === i ? C_SEL : C_NONE);
    });
    labels.forEach((el, k) => el.classList.toggle('is-active', k === i));
    const p = planets[i];
    status.textContent = p.name + '（' + p.type + '）：' + p.desc;
    status.classList.add('is-active');
    App.selectedPlanet = p.id;
  }

  function selectBelt(): void {
    selectedIndex = -1;
    planetMeshes.forEach(m => { m.material.emissive.copy(C_NONE); });
    labels.forEach(el => el.classList.remove('is-active'));
    beltLabel.classList.add('is-active');
    status.textContent = BELT_DESC;
    status.classList.add('is-active');
    App.selectedPlanet = BELT_ID;
  }

  let downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; });
  canvas.addEventListener('pointerup', e => {
    if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // 判定为点击而非拖拽
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...planetMeshes, beltHit], false);
    if (!hits.length) return;
    const obj = hits[0].object;
    if (obj.userData.isBelt) selectBelt();
    else selectPlanet(obj.userData.index as number);
  });
  canvas.addEventListener('pointermove', e => {
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...planetMeshes, beltHit], false);
    let idx = -1;
    let overBelt = false;
    if (hits.length) {
      const o = hits[0].object;
      if (o.userData.isBelt) overBelt = true;
      else idx = o.userData.index as number;
    }
    if (idx !== hoverIndex) {
      glow(hoverIndex, false);
      hoverIndex = idx;
      glow(idx, true);
    }
    canvas.style.cursor = (idx >= 0 || overBelt) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => {
    if (hoverIndex >= 0) { glow(hoverIndex, false); hoverIndex = -1; }
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
  beltLabel.addEventListener('click', selectBelt);
  beltLabel.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectBelt();
    }
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
      planetMeshes.forEach((m, i) => { m.rotation.y += dt * SPIN[i]; });
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
    fit();
    updateLabels();
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', onResize);

  updateLabels();
  if (prefersReducedMotion) {
    renderer.render(scene, camera); // 静态渲染一帧；resize 时由 onResize 重绘
  } else {
    tick();
  }
}
