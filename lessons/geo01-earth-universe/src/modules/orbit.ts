/* ============================================================
   M7 八大行星绕日公转演示（同向性 · 近圆性 · 共面性）
   - WebGL 可用：Three.js 3D 模型（太阳居中 + 圆形公转轨道）
   - WebGL 不可用：2D SVG 同心圆轨道示意图（同样演示三性）
   - 无 JS：静态占位（见 index.html）
   相机默认取约 70° 俯角，使圆形轨道在视觉上接近正圆（近圆性）；
   八颗行星沿各自轨道同向公转（同向性），轨道面共面（共面性）。

   渲染方案（本轮替换）：
   1) 太阳用 Basic 材质 + 关闭色调映射，并叠加两层程序化光晕，边缘柔和扩散；
   2) 光照只用「环境光 + 位于太阳的点光源」，点光源 decay = 0 不随距离衰减 ——
      最外圈的海王星与最近的水星一样明亮，且明暗分界始终朝向太阳（与真实成因一致）；
      不启用阴影贴图，避免行星互相投影干扰观察；
   3) 每颗行星按真实自转轴倾角倾斜，土星环 / 天王星"躺着转"的姿态因此正确；
   4) 场景保持透明（alpha），星点由页面背景层提供，视窗内不重复绘制星场。
   视窗内不设操作按钮：公转/自转自动进行，拖拽旋转与滚轮缩放由 OrbitControls 提供。
   视窗上方三个特征按钮（同向性 / 近圆性 / 共面性，见 planets.ts）通过自定义事件驱动本模块：
   - 同向性：相机平滑切至俯视 → 冻结公转 → 加速公转一整圈 → 短暂停顿 → 再加速一整圈 → 恢复常态；
   - 近圆性：相机平滑切至俯视 → 八条轨道由冰蓝渐变为恒星金（#F5C84C）并脉冲闪烁（2 次，约 2.4s）；
   - 共面性：相机平滑切至水平侧视（仰角 0°，相机落在轨道平面内），八个同心轨道压缩重合成
     同一条线，直观呈现"轨道面共面"。
   ============================================================ */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Vector3,
  AmbientLight, PointLight,
  Mesh, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial,
  RingGeometry, LineLoop, BufferGeometry, LineBasicMaterial,
  Sprite, SpriteMaterial, CanvasTexture,
  Float32BufferAttribute, Texture, TextureLoader, Clock,
  AdditiveBlending, DoubleSide, Group, SRGBColorSpace, Color,
  ACESFilmicToneMapping
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { $, $$, prefersReducedMotion } from '../utils/dom'
import { lessonData } from '../data/lessonData'
import { M7_FEATURE_EVENT } from './planets'
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
/* 自转轴相对轨道面法线的倾角（弧度，真实值）：决定土星环与天王星"躺着转"的姿态。
   公转轨道的共面性由轨道面本身决定，与自转轴倾角无关，两者互不干扰 */
const AXIAL_TILT: Record<string, number> = {
  mercury: 0.0006, venus: 0.05, earth: 0.409, mars: 0.44,
  jupiter: 0.055, saturn: 0.466, uranus: 1.706, neptune: 0.494
};
/* 太阳自转角速度（rad/s，示意值）与光晕呼吸幅度 */
const SUN_SPIN = 0.02;
const GLOW_BREATH = 0.012;
/* 相机俯角（度）：≥70° 时轨道投影接近正圆，直观体现"近圆性" */
const ELEV_DEG = 70;

/* ---------- M7 · 运动特征交互参数 ---------- */
/* 相机机位（极角，rad）：俯视取 OrbitControls 最小极角（约 81° 俯角，轨道投影接近正圆）；
   侧视取 π/2（仰角 0°，相机完全落在轨道平面内），八个同心轨道压缩重合成同一条线，
   直观呈现"轨道面共面" */
const TOP_POLAR = 0.15;
const FLAT_POLAR = Math.PI / 2;
const CAM_MOVE = 900;          // 机位切换时长（ms，强 ease-in-out）
/* 同向性时间轴：单圈加速公转时长 + 两圈之间的短暂停顿（ms） */
const SYNC_REV = 1500;
const SYNC_HOLD = 700;
/* 近圆性：轨道闪烁总时长（ms）与脉冲周期数 */
const CIRCLE_FLICKER = 2400;
const CIRCLE_PULSES = 2;
/* 轨道常态透明度与闪烁增量（峰值 ≈ 0.95：清晰可见但不刺眼） */
const ORBIT_BASE_OPACITY = 0.5;
const ORBIT_FLICK_AMP = 0.45;
/* 轨道颜色：常态冰蓝；近圆性演示期间渐变为「近圆性」概念色恒星金
   （与卡片 --feat: #F5C84C 一致），结束后复位 */
const ORBIT_COLOR = 0x9fb4ff;
const ORBIT_BASE_COLOR = new Color(ORBIT_COLOR);
const ORBIT_FLICK_COLOR = new Color(0xf5c84c);
/* 颜色渐变占闪烁总时长的比例（进入 / 退出各一段，中段保持金色） */
const FLICK_COLOR_RAMP = 0.12;

/** 强 ease-in-out（与 CSS 的 cubic-bezier(0.77, 0, 0.175, 1) 同族）：屏上位移用 */
function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** 同向性时间轴：加速转满一圈 → 短暂停顿 → 再加速转满一圈。
    返回累计圈数（0~2）与是否结束；减弱动效时只转一圈（更克制）。 */
function syncRevolutions(elapsed: number, reduced: boolean): { rev: number; done: boolean } {
  if (reduced) {
    const p = elapsed / SYNC_REV;
    return p >= 1 ? { rev: 1, done: true } : { rev: easeInOut(p), done: false };
  }
  const T = SYNC_REV, H = SYNC_HOLD;
  if (elapsed <= T) return { rev: easeInOut(elapsed / T), done: false };
  if (elapsed <= T + H) return { rev: 1, done: false };   // 停顿：保持在第 1 圈结束位置
  const p = (elapsed - T - H) / T;
  return p >= 1 ? { rev: 2, done: true } : { rev: 1 + easeInOut(p), done: false };
}

/** 闪烁脉冲 0~1（0.5-0.5cos）：首尾为 0，整数个周期结束时精确归位、不突变 */
function flickerWave(p: number, pulses: number): number {
  return 0.5 - 0.5 * Math.cos(p * Math.PI * 2 * pulses);
}

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
  if (!vp) return;
  if (detectWebGL()) {
    try {
      initOrbit3D(vp);
    } catch (e) {
      if (window.console) console.warn('3D 公转演示初始化失败，已降级为 2D 示意图：', e);
      initOrbit2D(vp);
    }
  } else {
    initOrbit2D(vp);
  }
}

/* ---------- M7 · 3D 公转模型（Three.js，npm 引入） ---------- */
function initOrbit3D(vp: HTMLElement): void {
  const planets = lessonData.planets;

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
  /* 与模块 06 一致的色调映射：贴图明暗过渡更柔和，太阳因关闭映射仍保持通透 */
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
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

  /* 光照：柔和环境光 + 位于太阳的点光源。
     点光源 decay = 0（不随距离衰减）：最外圈的海王星与最近的水星受光强度一致，
     避免真实光照的平方反比衰减把外行星压暗；明暗分界始终朝向太阳，与真实成因一致。
     不使用方向光（固定方向的补光会让"向阳面"与太阳位置脱节）；不启用阴影贴图。 */
  scene.add(new AmbientLight(0xffffff, 0.32));
  scene.add(new PointLight(0xfff2dc, 3, 0, 0));

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
    /* Basic 材质（自发光感）并关闭色调映射：否则 ACES 会把太阳压暗压灰 */
    new MeshBasicMaterial({ map: tex(sunTex), toneMapped: false })
  );
  scene.add(sun);

  /* 太阳光晕：程序化径向渐变贴图 + 加性混合（不引入额外资源）。
     两层级联让边缘由内向外柔和扩散，太阳不再是生硬的一颗球；
     关闭色调映射以保证光晕的暖色不被压灰 */
  function glowTexture(inner: string, outer: string): Texture {
    const size = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(255, 150, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new CanvasTexture(cv);
    t.colorSpace = SRGBColorSpace;
    return t;
  }
  const GLOW_SCALES = [SUN_R * 2.7, SUN_R * 5.2];
  const glowLayers = [
    { tex: glowTexture('rgba(255, 246, 220, 0.95)', 'rgba(255, 176, 70, 0.42)'), opacity: 0.9 },
    { tex: glowTexture('rgba(255, 210, 130, 0.5)', 'rgba(255, 130, 40, 0.2)'), opacity: 0.5 }
  ].map(({ tex: glowTex, opacity }, i) => {
    const sprite = new Sprite(new SpriteMaterial({
      map: glowTex, blending: AdditiveBlending, transparent: true,
      depthWrite: false, depthTest: true, opacity, toneMapped: false
    }));
    sprite.scale.setScalar(GLOW_SCALES[i]);
    scene.add(sprite);
    return sprite;
  });

  /* 圆形公转轨道（XZ 平面，y=0）：LineLoop 绘制正圆。
     材质引用收集起来，供"近圆性"演示逐帧调节颜色与透明度做闪烁 */
  const orbitMaterials: LineBasicMaterial[] = [];
  ORBIT_RADII.forEach(r => {
    const pts: number[] = [];
    const N = 128;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(r * Math.cos(a), 0, r * Math.sin(a));
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
    const mat = new LineBasicMaterial({
      color: ORBIT_COLOR, transparent: true, opacity: ORBIT_BASE_OPACITY
    });
    orbitMaterials.push(mat);
    scene.add(new LineLoop(geo, mat));
  });

  /* 行星：置于绕 Y 轴旋转的轨道组内，同向公转（自西向东） */
  const TEX: Record<string, Texture> = {
    mercury: tex(mercuryTex), venus: tex(venusTex), earth: tex(earthTex), mars: tex(marsTex),
    jupiter: tex(jupiterTex), saturn: tex(saturnTex), uranus: tex(uranusTex), neptune: tex(neptuneTex),
    saturn_ring: tex(saturnRingTex), uranus_ring: tex(uranusRingTex)
  };
  const planetMeshes: Mesh<SphereGeometry, MeshStandardMaterial>[] = [];
  /* 每颗行星两层：
     holder    —— 只承载轨道位置（在 XZ 平面上按角度移动），自身不旋转；
     tiltGroup —— 承载自转轴倾角，只绕 Z 轴倾斜一次。
     公转位置与自转轴指向因此相互独立：轴倾角在世界坐标下固定、不随公转打转，
     土星环 / 天王星"躺着转"的姿态始终正确 */
  const holders: Group[] = [];
  const angles: number[] = planets.map((_, i) => i * 0.6); // 初始相位错开，便于看清轨道与自转
  planets.forEach((p, i) => {
    const holder = new Group();
    holder.position.set(ORBIT_RADII[i], 0, 0);
    scene.add(holder);

    const tiltGroup = new Group();
    tiltGroup.rotation.z = AXIAL_TILT[p.id] ?? 0;
    holder.add(tiltGroup);

    const mesh = new Mesh(
      new SphereGeometry(PLANET_RADII[i], 40, 40),
      new MeshStandardMaterial({ map: TEX[p.id], roughness: 0.92, metalness: 0.05 })
    );
    tiltGroup.add(mesh);
    planetMeshes.push(mesh);
    holders.push(holder);

    /* 土星 / 天王星光环：挂在 tiltGroup 上（随自转轴倾斜，但不跟着球体自转） */
    if (RING_INNER[p.id]) {
      const ring = new Mesh(
        new RingGeometry(RING_INNER[p.id], RING_OUTER[p.id], 64),
        new MeshBasicMaterial({
          map: p.id === 'saturn' ? TEX.saturn_ring : TEX.uranus_ring,
          side: DoubleSide, transparent: true, depthWrite: false, opacity: 0.95
        })
      );
      ring.rotation.x = -Math.PI / 2;
      tiltGroup.add(ring);
    }
  });

  /* 响应式取景：保证最外轨道在任何宽高比下不被裁剪 */
  function fit(): void {
    const w = wrap.clientWidth || vp.clientWidth || 800;
    const h = wrap.clientHeight || 560;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    const camDist = camera.position.length();
    const halfNeed = Math.atan((R_MAX + 1.4) / camDist);
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

  /* ---------- 运动特征交互控制器 ----------
     由视窗上方三个特征按钮派发的事件驱动（见 planets.ts）：
     相机机位补间 / 同向性加速公转 / 近圆性轨道闪烁。 */
  let camTween: { from: Vector3; to: Vector3; t: number; dur: number } | null = null;
  let sync: { elapsed: number; base: number[] } | null = null;   // 同向性：加速公转
  let flicker: { elapsed: number } | null = null;                // 近圆性：轨道闪烁

  /** 按当前角度把八颗行星摆到各自轨道上（holder 不旋转，只改位置） */
  function applyPositions(): void {
    for (let i = 0; i < planets.length; i++) {
      holders[i].position.set(
        Math.cos(angles[i]) * ORBIT_RADII[i], 0, Math.sin(angles[i]) * ORBIT_RADII[i]
      );
    }
  }

  /** 平滑切换相机机位：保持当前方位角与距离，只改极角（俯视 / 侧视）。
      减弱动效时直接落位，不做位移补间。 */
  function flyCamera(toPolar: number): void {
    const cur = camera.position;
    const dist = cur.length() || R_MAX * 1.6;
    const theta = Math.atan2(cur.x, cur.z);
    const sinP = Math.sin(toPolar);
    const to = new Vector3(
      dist * sinP * Math.sin(theta),
      dist * Math.cos(toPolar),
      dist * sinP * Math.cos(theta)
    );
    if (prefersReducedMotion) {
      cur.copy(to);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
      return;
    }
    camTween = { from: cur.clone(), to, t: 0, dur: CAM_MOVE };
  }

  function updateCamera(dtMs: number): void {
    if (!camTween) return;
    camTween.t += dtMs;
    const p = Math.min(1, camTween.t / camTween.dur);
    camera.position.lerpVectors(camTween.from, camTween.to, easeInOut(p));
    camera.lookAt(0, 0, 0);
    if (p >= 1) camTween = null;
  }

  /** 近圆性闪烁复位：颜色与透明度都回到常态 */
  function stopFlicker(): void {
    if (!flicker) return;
    flicker = null;
    orbitMaterials.forEach(m => {
      m.opacity = ORBIT_BASE_OPACITY;
      m.color.copy(ORBIT_BASE_COLOR);
    });
  }

  const busy = (): boolean => !!camTween || !!sync || !!flicker;

  /** 特征按钮 → 演示：切换机位并播放对应动画 */
  function runFeature(name: string): void {
    if (name === '同向性') {
      flyCamera(TOP_POLAR);
      stopFlicker();
      /* 立即冻结公转：以当前角度为基准，随后由时间轴驱动加速公转两圈 */
      sync = { elapsed: 0, base: angles.slice() };
    } else if (name === '近圆性') {
      flyCamera(TOP_POLAR);
      sync = null;               // 结束加速公转，从当前角度平滑接回常态
      flicker = { elapsed: 0 };
    } else if (name === '共面性') {
      sync = null;               // 结束加速公转（保持当前角度）
      stopFlicker();
      /* 切至贴近轨道平面的水平视角：八个同心轨道压缩重合，呈现"轨道面共面" */
      flyCamera(FLAT_POLAR);
    }
    ensureAnimating();
  }

  document.addEventListener(M7_FEATURE_EVENT, e => {
    const name = (e as CustomEvent<{ name?: string }>).detail?.name;
    if (name) runFeature(name);
  });

  /* 动画循环：同向公转 + 自转；离开屏幕暂停；prefers-reduced-motion 渲染静态一帧。
     特征演示进行中时，即使减弱动效也临时驱动循环，演示结束即停 */
  const clock = new Clock();
  let rafId = 0;
  let inView = true;

  function ensureAnimating(): void {
    if (rafId === 0 && inView) tick();
  }

  if ('IntersectionObserver' in window) {
    const sec = document.getElementById('planets');
    if (sec) {
      new IntersectionObserver(entries => {
        entries.forEach(en => {
          inView = en.isIntersecting;
          if (inView) ensureAnimating();
        });
      }, { threshold: 0 }).observe(sec);
    }
  }

  function frame(now: number): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    const dtMs = dt * 1000;

    updateCamera(dtMs);

    /* 同向性：加速公转演示接管行星角度（自转同时冻结） */
    let driving = false;
    if (sync) {
      sync.elapsed += dtMs;
      const { rev, done } = syncRevolutions(sync.elapsed, prefersReducedMotion);
      for (let i = 0; i < planets.length; i++) angles[i] = sync.base[i] + rev * Math.PI * 2;
      if (done) sync = null;
      driving = true;
    }

    if (!prefersReducedMotion) {
      sun.rotation.y += dt * SUN_SPIN;
      if (!driving) {
        for (let i = 0; i < planets.length; i++) {
          /* 同向公转：所有行星角度同向递增（同向性）；外圈角速度更小（外慢内快）。
             位置由角度直接算出，holder 自身不旋转 —— 保证自转轴倾角不被公转带偏 */
          angles[i] += dt * ORBIT_SPEED[i];
          planetMeshes[i].rotation.y += dt * SPIN[i];
        }
      }
      /* 光晕轻微呼吸，增加生命感（减弱动效时保持静止） */
      const breathe = 1 + Math.sin(now * 0.0011) * GLOW_BREATH;
      glowLayers.forEach((s, i) => s.scale.setScalar(GLOW_SCALES[i] * breathe));
    }
    if (driving || !prefersReducedMotion) applyPositions();

    /* 近圆性：轨道由冰蓝渐变为恒星金，并以透明度脉冲闪烁
       （脉冲首尾归零、颜色中段保持金色，结束后一并复位） */
    if (flicker) {
      flicker.elapsed += dtMs;
      const p = Math.min(1, flicker.elapsed / CIRCLE_FLICKER);
      const wave = flickerWave(p, prefersReducedMotion ? 1 : CIRCLE_PULSES);
      const mix = easeInOut(Math.min(1, p / FLICK_COLOR_RAMP, (1 - p) / FLICK_COLOR_RAMP));
      orbitMaterials.forEach(m => {
        m.opacity = ORBIT_BASE_OPACITY + wave * ORBIT_FLICK_AMP;
        m.color.copy(ORBIT_BASE_COLOR).lerp(ORBIT_FLICK_COLOR, mix);
      });
      if (p >= 1) stopFlicker();
    }

    /* 演示期间锁定拖拽，避免与机位补间 / 时间轴打架 */
    controls.enabled = !busy();
    if (!camTween) controls.update();

    updateLabels();
    renderer.render(scene, camera);
  }

  function tick(): void {
    rafId = 0;
    if (!inView) return;
    frame(performance.now());
    if (!prefersReducedMotion || busy()) rafId = requestAnimationFrame(tick);
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
    applyPositions();               // 静态帧：按初始相位摆放行星后重绘一次
    renderer.render(scene, camera); // resize 时由 onResize 重绘
  } else {
    tick();
  }
}

/* ---------- M7 · 2D 同心圆轨道示意图（WebGL 不可用降级） ---------- */
function initOrbit2D(vp: HTMLElement): void {
  const planets = lessonData.planets;
  /* 正方形画布（与 3D 正方形视窗一致），保证同心圆轨道不被拉伸 */
  const W = 800, H = 800, cx = W / 2, cy = H / 2;
  const R_SCALE = (H / 2 - 90) / R_MAX; // 最外轨道留出边距
  const sunR = 12;

  const orbits = ORBIT_RADII.map(r =>
    `<circle class="orbit2d__path" cx="${cx}" cy="${cy}" r="${(r * R_SCALE).toFixed(1)}"/>`
  ).join('');

  vp.innerHTML = `
      <svg class="orbit2d" viewBox="0 0 ${W} ${H}" role="img" aria-label="八大行星沿圆形轨道绕日公转示意图">
        <text class="solar-note" x="${W - 12}" y="${H - 14}" text-anchor="end">示意图 · 非按比例</text>
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
  const paths = $$('.orbit2d__path', vp) as SVGElement[];

  /* 动画：行星沿同心圆轨道同向公转；并响应特征按钮的同向性加速公转 / 近圆性轨道闪烁。
     2D 为俯视平面投影，无法切换机位，"共面性"以同心圆本身表达（无需额外动画） */
  const angles = planets.map((_, i) => i * 0.6);
  const clock = new Clock();
  let sync: { elapsed: number; base: number[] } | null = null;
  let flicker: { elapsed: number } | null = null;
  let rafId = 0;
  let inView = true;

  function applyPositions(): void {
    els.forEach((g, i) => {
      const r = ORBIT_RADII[i] * R_SCALE;
      g.setAttribute('transform',
        `translate(${(cx + r * Math.cos(angles[i])).toFixed(1)} ${(cy + r * Math.sin(angles[i])).toFixed(1)})`);
    });
  }

  function stopFlicker(): void {
    if (!flicker) return;
    flicker = null;
    paths.forEach(el => { el.style.opacity = ''; el.style.stroke = ''; });
  }

  const busy = (): boolean => !!sync || !!flicker;

  function runFeature(name: string): void {
    if (name === '同向性') {
      stopFlicker();
      sync = { elapsed: 0, base: angles.slice() };   // 冻结当前角度，时间轴驱动加速公转
    } else if (name === '近圆性') {
      sync = null;
      flicker = { elapsed: 0 };
      paths.forEach(el => { el.style.stroke = '#F5C84C'; });   // 轨道转为恒星金后闪烁
    } else {
      return;   // 共面性：俯视投影下同心圆本身即"共面"，无需动画
    }
    ensureAnimating();
  }

  document.addEventListener(M7_FEATURE_EVENT, e => {
    const name = (e as CustomEvent<{ name?: string }>).detail?.name;
    if (name) runFeature(name);
  });

  if ('IntersectionObserver' in window) {
    const sec = document.getElementById('planets');
    if (sec) {
      new IntersectionObserver(entries => {
        entries.forEach(en => {
          inView = en.isIntersecting;
          if (inView) ensureAnimating();
        });
      }, { threshold: 0 }).observe(sec);
    }
  }

  function ensureAnimating(): void {
    if (rafId === 0 && inView) tick();
  }

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    const dtMs = dt * 1000;

    let driving = false;
    if (sync) {
      sync.elapsed += dtMs;
      const { rev, done } = syncRevolutions(sync.elapsed, prefersReducedMotion);
      for (let i = 0; i < planets.length; i++) angles[i] = sync.base[i] + rev * Math.PI * 2;
      if (done) sync = null;
      driving = true;
    }
    if (!prefersReducedMotion && !driving) {
      for (let i = 0; i < planets.length; i++) angles[i] += dt * ORBIT_SPEED[i];
    }
    if (driving || !prefersReducedMotion) applyPositions();

    /* 近圆性：金色轨道透明度脉冲（变暗再变亮，循环 2 次；首尾回到常态不突变） */
    if (flicker) {
      flicker.elapsed += dtMs;
      const p = Math.min(1, flicker.elapsed / CIRCLE_FLICKER);
      const wave = flickerWave(p, prefersReducedMotion ? 1 : CIRCLE_PULSES);
      paths.forEach(el => { el.style.opacity = (1 - wave * 0.65).toFixed(3); });
      if (p >= 1) stopFlicker();
    }
  }

  function tick(): void {
    rafId = 0;
    if (!inView) return;
    frame();
    if (!prefersReducedMotion || busy()) rafId = requestAnimationFrame(tick);
  }

  if (prefersReducedMotion) {
    applyPositions(); // 静态一帧
  } else {
    tick();
  }
}
