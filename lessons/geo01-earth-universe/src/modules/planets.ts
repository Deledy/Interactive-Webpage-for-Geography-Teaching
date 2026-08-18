/* ============================================================
   M7 行星的运动特征：同向性、近圆性、共面性
   ============================================================ */
import { lessonData } from '../data/lessonData'

export function initMotionFeatures(): void {
  const feats = document.getElementById('motion-features');
  if (!feats || !lessonData.motionFeatures) return;

  feats.innerHTML = lessonData.motionFeatures.map(f => `
      <div class="motion-feature card" tabindex="0">
        <h4 class="motion-feature__name">${f.name}</h4>
        <p class="motion-feature__desc">${f.desc}</p>
      </div>`).join('');
}
