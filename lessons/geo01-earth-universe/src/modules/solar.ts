/* ============================================================
   M6 太阳系与八大行星
   WebGL 可用时启用 3D（Three.js，npm 引入），否则自动降级 2D SVG 轨道图。
   ============================================================ */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Vector3,
  AmbientLight, PointLight,
  Mesh, SphereGeometry, MeshBasicMaterial, MeshStandardMaterial,
  Points, PointsMaterial, BufferGeometry, BufferAttribute,
  Line, LineBasicMaterial, RingGeometry,
  Color, Raycaster, Vector2, Clock, DoubleSide
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { $, $$, prefersReducedMotion } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'
import type { Planet } from '../types'

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
      if (window.console) console.warn('3D 太阳系初始化失败，已降级为 2D 轨道图：', e);
      initSolar2D(vp, info);
    }
  } else {
    initSolar2D(vp, info);
  }
}

/* 2D/3D 共用的信息区：图例 + 状态条 */
function buildSolarInfo(info: HTMLElement, planets: Planet[], tip: string): HTMLElement {
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
function initSolar2D(vp: HTMLElement, info: HTMLElement): void {
  const planets = lessonData.planets;
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
  function draw(t: number): void {
    const sec = (t - time0) / 1000;
    planets.forEach((p, i) => {
      const omega = (Math.PI * 2) / (p.period * TIME_SCALE);
      const angle = 0.6 * i + omega * sec; // 同方向匀速公转
      const x = cx + p.orbit * ORBIT_SCALE * Math.cos(angle);
      const y = cy + p.orbit * ORBIT_SCALE * Math.sin(angle);
      planetEls[i].setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    });
  }

  function select(p: Planet): void {
    planetEls.forEach(g => g.classList.toggle('is-active', g.getAttribute('data-planet') === p.id));
    status.textContent = p.name + '（' + p.type + '）：' + p.desc;
    status.classList.add('is-active');
    App.selectedPlanet = p.id;
  }

  planetEls.forEach((g, i) => {
    g.addEventListener('click', () => select(planets[i]));
    (g as HTMLElement).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(planets[i]);
      }
    });
  });

  draw(0); // 先画一帧（含 reduce-motion 场景）
  if (!prefersReducedMotion) {
    const loop = (t: number): void => { draw(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}

/* ---------- M6 · 3D 太阳系（Three.js，npm 引入） ---------- */
function initSolar3D(vp: HTMLElement, info: HTMLElement): void {
  const planets = lessonData.planets;
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

  const wrap = $('.solar3d', vp)!;
  const autoBtn = $('[data-solar-auto]', vp)!;
  const resetBtn = $('[data-solar-reset]', vp)!;

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 2000);
  const CAM_POS = new Vector3(0, 70, 125);
  camera.position.copy(CAM_POS);
  camera.lookAt(0, 0, 0);

  /* 由 Three.js 自建 canvas（避免与既有的 2D 上下文冲突）；
     WebGL 上下文创建失败时 WebGLRenderer 只警告不抛错，此处显式校验以触发上层 2D 降级 */
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  if (!renderer.getContext()) throw new Error('WebGL 上下文不可用');
  App.solar3dRenderer = renderer; // 调试/验收用：可通过 info.render 检查渲染统计
  const canvas = renderer.domElement;
  canvas.className = 'solar3d__canvas';
  canvas.setAttribute('aria-label', '太阳系 3D 演示视窗');
  wrap.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  function resize(): void {
    const w = wrap.clientWidth || vp.clientWidth || 800;
    const h = wrap.clientHeight || 560;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* 光照：环境光 + 太阳点光源 */
  scene.add(new AmbientLight(0x5566aa, 0.7));
  const sunLight = new PointLight(0xffd9a0, 2.2, 0, 1.4);
  scene.add(sunLight);

  /* 太阳：发光球体 + 光晕 */
  const sun = new Mesh(
    new SphereGeometry(6, 32, 32),
    new MeshBasicMaterial({ color: 0xffd54f })
  );
  scene.add(sun);
  const halo = new Mesh(
    new SphereGeometry(9, 32, 32),
    new MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.16, depthWrite: false })
  );
  scene.add(halo);

  /* 背景星点 */
  (function addStars(): void {
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
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    scene.add(new Points(geo, new PointsMaterial({
      size: 1.5, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false
    })));
  })();

  /* 轨道环 + 行星球体 */
  const ORBIT_BASE = 9, ORBIT_SCALE = 0.9;
  const planetMeshes: Mesh<SphereGeometry, MeshStandardMaterial>[] = [];
  planets.forEach((p, i) => {
    const r = ORBIT_BASE + p.orbit * ORBIT_SCALE;
    const pts: Vector3[] = [];
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      pts.push(new Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
    }
    const ring = new Line(
      new BufferGeometry().setFromPoints(pts),
      new LineBasicMaterial({ color: 0x8ea2d8, transparent: true, opacity: 0.28 })
    );
    scene.add(ring);

    const mesh = new Mesh(
      new SphereGeometry(p.size, 24, 24),
      new MeshStandardMaterial({
        color: new Color(p.color), roughness: 0.85, metalness: 0.12
      })
    );
    mesh.userData.index = i;
    scene.add(mesh);
    planetMeshes.push(mesh);

    /* 土星光环 */
    if (p.id === 'saturn') {
      const satRing = new Mesh(
        new RingGeometry(2.6, 4.0, 48),
        new MeshBasicMaterial({
          color: 0xe3c98a, transparent: true, opacity: 0.6, side: DoubleSide
        })
      );
      satRing.rotation.x = -Math.PI / 2;
      mesh.add(satRing);
    }
  });

  /* 控制器：拖拽旋转 / 滚轮缩放 */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 40;
  controls.maxDistance = 320;
  controls.autoRotateSpeed = 0.6;
  controls.autoRotate = true;

  /* 拾取：点击选中 + 悬停发光 */
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const C_HOVER = new Color(0x554433);
  const C_SEL = new Color(0x332200);
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
    planetMeshes.forEach((m, k) => {
      m.material.emissive.copy(k === i ? C_SEL : C_NONE);
    });
    const p = planets[i];
    status.textContent = p.name + '（' + p.type + '）：' + p.desc;
    status.classList.add('is-active');
    App.selectedPlanet = p.id;
  }

  let downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; });
  canvas.addEventListener('pointerup', e => {
    if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // 拖拽而非点击
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetMeshes, false);
    if (hits.length) selectPlanet(hits[0].object.userData.index as number);
  });
  canvas.addEventListener('pointermove', e => {
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetMeshes, false);
    const idx = hits.length ? (hits[0].object.userData.index as number) : -1;
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
  const clock = new Clock();
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
  function step(): void {
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
  function tick(): void {
    rafId = 0;
    if (!inView) return;
    step();
    rafId = requestAnimationFrame(tick);
  }
  tick();
}
