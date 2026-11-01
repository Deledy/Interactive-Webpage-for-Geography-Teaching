/* ============================================================
   universe/moon-textures.ts
   卫星观测贴图注册表。

   合规约束（对应开发文档《有卫星行星系统》贴图分级）：
   - 贴图只允许来自 assets/textures/moons/ 下已核验来源的观测底图；
   - 目录中没有对应文件时**不得**用程序化纹理顶替，调用方必须退化为
     "实测反照率纯色材质"（C 级策略）；
   - 因此这里用 import.meta.glob 自动收集资产：把真实贴图放进去即生效，
     没放进去也不会构建失败。
   ============================================================ */
import * as THREE from 'three'

const FILES = import.meta.glob('../../assets/textures/moons/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const URLS = new Map<string, string>()
for (const [path, url] of Object.entries(FILES)) {
  const key = path.slice(path.lastIndexOf('/') + 1).replace(/\.(jpe?g|png|webp)$/i, '')
  URLS.set(key, url)
}

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

/** 是否已有该天体的观测贴图（决定渲染 A/B 级贴图还是 C 级纯色） */
export function hasObservedTexture(key: string | null): boolean {
  return !!key && URLS.has(key)
}

/** 取观测贴图；不存在时返回 null，绝不回退到程序化纹理 */
export function observedTexture(key: string): THREE.Texture | null {
  const url = URLS.get(key)
  if (!url) return null
  const cached = cache.get(key)
  if (cached) return cached
  const texture = loader.load(url)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

/** 当前已就位的观测贴图 key 列表（用于自检与"数据覆盖"提示） */
export function availableTextureKeys(): string[] {
  return Array.from(URLS.keys())
}
