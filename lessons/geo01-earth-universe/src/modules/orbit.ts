/* ============================================================
   M7 八大行星绕日公转演示（同向性 · 近圆性 · 共面性）
   - WebGL 可用：Three.js 3D 模型（太阳居中 + 圆形公转轨道）
   - WebGL 不可用：2D SVG 同心圆轨道示意图（同样演示三性）
   - 无 JS：静态占位（见 index.html）
   相机默认取约 70° 俯角，使圆形轨道在视觉上接近正圆（近圆性）；
   八颗行星沿各自轨道同向公转（同向性），轨道面共面（共面性）。
   ============================================================ */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Vector3,
  AmbientLight, PointLight, DirectionalLight,
  Mesh, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial,
  RingGeometry, LineLoop, BufferGeometry, LineBasicMaterial,
  Float32BufferAttribute, Texture, TextureLoader, Clock,
  DoubleSide, Group, SRGBColorSpace
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { $, $$, prefersReducedMotion } from '../utils/dom'
import { lessonData } from '../data/lessonData'
import sunTex from '../assets/textures/sun.jpg'
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

/* 轨道半径 / 行星半径（单位一致，非按比例，仅保证可读性） */
const ORBIT_RADII = [4.5, 6.4, 8.2, 10, 13.8, 17, 20, 22];
const R_MAX = Math.max(...ORBIT_RADII);
const SUN_R = 1.1;
const PLANET_RADII = [0.32, 0.62, 0.66, 0.5, 1.5, 1.28, 0.92, 0.9];
/* 土星 / 天王星光环内、外半径 */
const RING_INNER: Record<string, number> = { saturn: 1.45, uranus: 1.0 };
const RING_OUTER: Record<string, number> = { saturn: 2.3, uranus: 1.55 };
/* 公转角速度（rad/s，示意值；外圈慢、内圈快，方向一致） */
const ORBIT_SPEED = [1.4, 1.1, 0.95, 0.8, 0.55, 0.42, 0.3, 0.24];
/* 自转角速度（rad/s，示意值） */
const SPIN = [0.1, 0.08, 0.3, 0.28, 0.5, 0.45, 0.35, 0.4];
/* 相机俯角（度）：≥70° 时轨道投影接近正圆，直观体现"近圆性" */
const ELEV_DEG = 70;

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

export function initOrbitDemo(): void {
  const vp = document.getElementById('orbit-viewport');
  const info = document.getElementById('orbit-info');
  if (!vp || !info) return;
  if (detectWebGL()) {
    try {
      initOrbit3D(vp, info);
    } catch (e) {
      if (window.console) console.warn('3D 公转演示初始化失败，已降级为 2D 示意图：', e);
      initOrbit2D(vp, info);
    }
  } else {
    initOrbit2D(vp, info);
  }
}

/* 信息区：状态条 */
function buildOrbitInfo(info: HTMLElement, tip: string): HTMLElement {
  info.innerHTML = '';
  const status = document.createElement('p');
  status.className = 'solar-status';
  status.textContent = tip;
  info.appendChild(status);
  return status;
}

/* ---------- M7 · 3D 公转模型（Three.js，npm 引入） ---------- */
function initOrbit3D(vp: HTMLElement, info: HTMLElement): void {
  const planets = lessonData.planets;
  buildOrbitInfo(info, '八大行星绕日公转方向一致（自西向东）、轨道近似圆形、轨道面几乎位于同一平面，分别体现同向性、近圆性与共面性。');

  vp.classList.add('is-3d');
  vp.innerHTML = `
      <div class="orbit3d">
        <span class="orbit3d__note">八大行星绕日公转 · 非按比例</span>
        <div class="orbit3d__labels"></div>
      </div>`;

  const wrap = $('.orbit3d', vp)!;
  const labelsBox = $('.orbit3d__labels', vp)!;

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 2000);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  if (!renderer.getContext()) throw new Error('WebGL 上下文不可用');
  const canvas = renderer.domElement;
  canvas.className = 'orbit3d__canvas';
  canvas.setAttribute('aria-label', '八大行星沿圆形轨道绕日公转的 3D 演示');
  wrap.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  /* 默认相机：70° 俯角俯视轨道平面，轨道投影接近正圆（近圆性）；可拖拽旋转、滚轮缩放 */
  const horiz = R_MAX * 1.25;
  camera.position.set(0, horiz * Math.tan(ELEV_DEG * Math.PI / 180), horiz);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = R_MAX * 0.6;
  controls.maxDistance = R_MAX * 6;
  controls.minPolarAngle = 0.15;        // 最俯视（约 81° 俯角）
  controls.maxPolarAngle = Math.PI / 2; // 允许旋至轨道平面正侧视（θ=90°），轨道投影为一条直线，直观呈现共面性
  controls.target.set(0, 0, 0);

  /* 光照：增强环境光 + 太阳点光源 + 主/辅方向光，保证各行星受光均匀明亮 */
  scene.add(new AmbientLight(0x99aaff, 0.95));
  const sunLight = new PointLight(0xfff2d0, 6, 0, 1); // 太阳暖光：线性衰减，避免外圈行星过暗
  scene.add(sunLight);
  const mainLight = new DirectionalLight(0xfff3e0, 1.5);
  mainLight.position.set(10, 16, 14);
  scene.add(mainLight);
  const rimLight = new DirectionalLight(0x6688ff, 0.45);
  rimLight.position.set(-12, -6, -10);
  scene.add(rimLight);

  /* 太阳 */
  const loader = new TextureLoader();
  /* 纹理由 Vite 静态导入并 base64 内联，避免运行时相对路径漂移与 file:// WebGL 安全拦截；
     three r152+ 默认启用色彩管理：sRGB 贴图必须标记 colorSpace，否则渲染发灰、失真 */
  const tex = (url: string): Texture => {
    const t = loader.load(url);
    t.colorSpace = SRGBColorSpace;
    return t;
  };
  const sun = new Mesh(
    new SphereGeometry(SUN_R, 48, 48),
    new MeshBasicMaterial({ map: tex(sunTex) })
  );
  scene.add(sun);

  /* 圆形公转轨道（XZ 平面，y=0）：LineLoop 绘制正圆 */
  const ORBIT_COLOR = 0x9fb4ff;
  ORBIT_RADII.forEach(r => {
    const pts: number[] = [];
    const N = 128;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(r * Math.cos(a), 0, r * Math.sin(a));
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
    scene.add(new LineLoop(geo, new LineBasicMaterial({
      color: ORBIT_COLOR, transparent: true, opacity: 0.5
    })));
  });

  /* 行星：置于绕 Y 轴旋转的轨道组内，同向公转（自西向东） */
  const TEX: Record<string, Texture> = {
    mercury: tex(mercuryTex), venus: tex(venusTex), earth: tex(earthTex), mars: tex(marsTex),
    jupiter: tex(jupiterTex), saturn: tex(saturnTex), uranus: tex(uranusTex), neptune: tex(neptuneTex),
    saturn_ring: tex(saturnRingTex), uranus_ring: tex(uranusRingTex)
  };
  const planetMeshes: Mesh<SphereGeometry, MeshStandardMaterial>[] = [];
  const orbitGroups: Group[] = [];
  planets.forEach((p, i) => {
    const orbit = new Group();
    orbit.rotation.y = i * 0.6; // 初始相位错开，便于看清轨道与自转
    scene.add(orbit);

    const mesh = new Mesh(
      new SphereGeometry(PLANET_RADII[i], 40, 40),
      new MeshStandardMaterial({ map: TEX[p.id], roughness: 0.92, metalness: 0.05 })
    );
    mesh.position.set(ORBIT_RADII[i], 0, 0);
    orbit.add(mesh);
    planetMeshes.push(mesh);
    orbitGroups.push(orbit);

    /* 土星 / 天王星光环 */
    if (RING_INNER[p.id]) {
      const ring = new Mesh(
        new RingGeometry(RING_INNER[p.id], RING_OUTER[p.id], 64),
        new MeshBasicMaterial({
          map: p.id === 'saturn' ? TEX.saturn_ring : TEX.uranus_ring,
          side: DoubleSide, transparent: true, depthWrite: false, opacity: 0.95
        })
      );
      ring.rotation.x = -Math.PI / 2;
      mesh.add(ring);
    }
  });

  /* 响应式取景：保证最外轨道在任何宽高比下不被裁剪 */
  function fit(): void {
    const w = wrap.clientWidth || vp.clientWidth || 800;
    const h = wrap.clientHeight || 560;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    const camDist = camera.position.length();
    const halfNeed = Math.atan((R_MAX + SUN_R + 1) / camDist);
    camera.fov = aspect >= 1
      ? halfNeed * 2 * 180 / Math.PI
      : Math.atan(Math.tan(halfNeed) / aspect) * 2 * 180 / Math.PI;
    camera.fov = Math.max(camera.fov, 30);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  fit();

  /* 行星名称标签（HTML 覆盖层，随投影每帧更新位置，纯展示不可点击） */
  const labels: HTMLElement[] = [];
  planets.forEach((p) => {
    const el = document.createElement('span');
    el.className = 'orbit3d__label';
    el.textContent = p.name;
    el.dataset.planet = p.id;
    labelsBox.appendChild(el);
    labels.push(el);
  });

  const tmpV = new Vector3();
  const projV = new Vector3();
  function updateLabels(): void {
    const w = wrap.clientWidth || 800;
    const h = wrap.clientHeight || 560;
    for (let i = 0; i < planets.length; i++) {
      planetMeshes[i].getWorldPosition(tmpV);
      projV.copy(tmpV).project(camera);
      const left = (projV.x * 0.5 + 0.5) * w;
      const top = (-projV.y * 0.5 + 0.5) * h;
      labels[i].style.transform =
        `translate(${left.toFixed(1)}px, ${(top - 20).toFixed(1)}px) translate(-50%, -50%)`;
    }
  }

  /* 动画循环：同向公转 + 自转；离开屏幕暂停；prefers-reduced-motion 渲染静态一帧 */
  const clock = new Clock();
  let rafId = 0;
  let inView = true;
  if ('IntersectionObserver' in window) {
    const sec = document.getElementById('planets');
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
      sun.rotation.y += dt * 0.02;
      planets.forEach((_, i) => {
        orbitGroups[i].rotation.y += dt * ORBIT_SPEED[i];
        planetMeshes[i].rotation.y += dt * SPIN[i];
      });
    }
    controls.update();
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
    controls.update();
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

/* ---------- M7 · 2D 同心圆轨道示意图（WebGL 不可用降级） ---------- */
function initOrbit2D(vp: HTMLElement, info: HTMLElement): void {
  const planets = lessonData.planets;
  buildOrbitInfo(info, '八大行星绕日公转方向一致（自西向东）、轨道近似圆形、轨道面几乎位于同一平面，分别体现同向性、近圆性与共面性。');
  /* 正方形画布（与 3D 正方形视窗一致），保证同心圆轨道不被拉伸 */
  const W = 800, H = 800, cx = W / 2, cy = H / 2;
  const R_SCALE = (H / 2 - 90) / R_MAX; // 最外轨道留出边距
  const sunR = 12;

  const orbits = ORBIT_RADII.map(r =>
    `<circle class="orbit2d__path" cx="${cx}" cy="${cy}" r="${(r * R_SCALE).toFixed(1)}"/>`
  ).join('');

  vp.innerHTML = `
      <svg class="orbit2d" viewBox="0 0 ${W} ${H}" role="img" aria-label="八大行星沿圆形轨道绕日公转示意图">
        <text class="solar-note" x="${W - 12}" y="26" text-anchor="end">示意图 · 非按比例</text>
        <circle class="orbit2d__sun" cx="${cx}" cy="${cy}" r="${sunR}"/>
        <text class="orbit2d__sun-name" x="${cx}" y="${cy + sunR + 18}" text-anchor="middle">太阳</text>
        ${orbits}
        ${planets.map((p, i) => `
          <g class="orbit2d__planet" data-planet="${p.id}" data-index="${i}">
            <circle class="orbit2d__dot" r="${(PLANET_RADII[i] * R_SCALE).toFixed(1)}" fill="${p.color}"/>
            <text class="orbit2d__name" y="26" text-anchor="middle">${p.name}</text>
          </g>`).join('')}
      </svg>`;

  const els = $$('.orbit2d__planet', vp) as HTMLElement[];

  /* 动画：行星沿同心圆轨道同向公转 */
  const t0 = performance.now();
  let rafId = 0;
  let inView = true;
  if ('IntersectionObserver' in window) {
    const sec = document.getElementById('planets');
    if (sec) {
      new IntersectionObserver(entries => {
        entries.forEach(en => {
          inView = en.isIntersecting;
          if (inView && !prefersReducedMotion) tick();
        });
      }, { threshold: 0 }).observe(sec);
    }
  }

  function frame(now: number): void {
    const t = (now - t0) / 1000;
    els.forEach((g, i) => {
      const a = i * 0.6 + t * ORBIT_SPEED[i];
      const r = ORBIT_RADII[i] * R_SCALE;
      g.setAttribute('transform',
        `translate(${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)})`);
    });
  }

  function tick(): void {
    rafId = 0;
    if (!inView) return;
    frame(performance.now());
    rafId = requestAnimationFrame(tick);
  }

  if (prefersReducedMotion) {
    frame(0); // 静态一帧
  } else {
    tick();
  }
}
