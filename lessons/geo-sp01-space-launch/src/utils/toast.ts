/** 轻量 toast 提示（正确/错误/普通三类） */
type ToastType = 'info' | 'ok' | 'err'

export function toast(message: string, type: ToastType = 'info', ms = 2400): void {
  const host = document.getElementById('toastHost')
  if (!host) return
  const node = document.createElement('div')
  node.className = `toast toast--${type}`
  node.textContent = message
  host.appendChild(node)
  window.setTimeout(() => {
    node.style.transition = 'opacity .25s ease'
    node.style.opacity = '0'
    window.setTimeout(() => node.remove(), 260)
  }, ms)
}

export function clearToasts(): void {
  const host = document.getElementById('toastHost')
  if (host) host.innerHTML = ''
}
