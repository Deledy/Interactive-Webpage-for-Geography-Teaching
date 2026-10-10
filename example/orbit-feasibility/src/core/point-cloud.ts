/* ============================================================
   core/point-cloud.ts
   移植自 ORBIT 项目 src/core/point-cloud.js（Apache-2.0）。
   已修改：改写为 TypeScript、补类型标注与返回值类型。
   原始项目：https://github.com/ryh842487118-bot/orbit

   说明：该点云着色器显式引入 three 的 logdepthbuf / tonemapping / colorspace
   片元与顶点代码块 —— 这是"对数深度缓冲 + 泛光后处理"体系能同时成立的关键，
   也是本 Demo 要验证的移植要点之一。
   ============================================================ */
import * as THREE from 'three'

const pointVertex = `
 attribute float aSize;attribute vec3 aColor;varying vec3 vColor;uniform float uRatio;uniform float uPerspective;uniform bool uFixedProjection;uniform mat4 uProjection;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vColor=aColor;vec4 mv=viewMatrix*modelMatrix*vec4(position,1.0);gl_Position=(uFixedProjection?uProjection:projectionMatrix)*mv;gl_PointSize=clamp(aSize*uRatio*(uPerspective>0.0?uPerspective/max(1.0,-mv.z):1.0),.6,18.0);
 #include <logdepthbuf_vertex>
 }`

const pointFragment = `
 varying vec3 vColor;uniform float uOpacity;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){float d=length(gl_PointCoord-.5)*2.0;if(d>1.0)discard;float a=pow(1.0-d,2.0);gl_FragColor=vec4(vColor,uOpacity*a);
 #include <logdepthbuf_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`

/** 构建一个圆形柔和点云（星空 / 银河旋臂 / 星点），默认加色混合 */
export function pointCloud(
  positions: ArrayLike<number>,
  colors: ArrayLike<number>,
  sizes: ArrayLike<number>,
  perspective: number,
  opacity: number,
  pixels: number
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uFixedProjection: { value: false },
      uProjection: { value: new THREE.Matrix4() },
      uRatio: { value: pixels },
      uPerspective: { value: perspective },
      uOpacity: { value: opacity }
    },
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  return new THREE.Points(geo, mat)
}
