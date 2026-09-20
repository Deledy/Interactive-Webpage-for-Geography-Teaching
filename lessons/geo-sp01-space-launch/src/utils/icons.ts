/** 内联 SVG 图标集（零外部资源）：只保留本课用到的图标，2px 线性风格 */
const ICONS: Record<string, string> = {
  'icon-climate':
    '<path d="M7 17h9a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.2 9.2A3.9 3.9 0 0 0 7 17Z"/><path d="M15.5 4v2M19.5 6l-1.4 1.4M21 10h-2"/>',
  'icon-sea':
    '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  'icon-ship':
    '<path d="M3.5 12.6h17l-2.6 5.6a2 2 0 0 1-1.8 1.1H7.9a2 2 0 0 1-1.8-1.1Z"/><path d="M6.8 12.6V8h10.4v4.6"/><path d="M12 8V4.6"/>',
  'icon-shield': '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z"/><path d="M9.5 12l1.8 1.8L15 10"/>',
  'icon-terrain': '<path d="M3 19l6-10 4 6 2-3 6 7Z"/><path d="M8.2 10.6l1.2 1.8"/>',
  'icon-forest': '<path d="M12 3.6l3.6 5H8.4Z"/><path d="M12 7.4l4.6 6.2H7.4Z"/><path d="M12 13.6v6.8"/>',
  'icon-globe': '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17"/><path d="M12 3c3 3.6 3 14.4 0 18-3-3.6-3-14.4 0-18Z"/>',
  'icon-truck':
    '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  'icon-users':
    '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16.5 6.2A3 3 0 0 1 16.5 12"/><path d="M17 14.4c2 .6 3.5 2.3 3.5 4.6"/>',
  'icon-water': '<path d="M12 3.5S6.5 10 6.5 14a5.5 5.5 0 0 0 11 0c0-4-5.5-10.5-5.5-10.5Z"/>',
  'icon-geology':
    '<path d="M3 8.6L12 4l9 4.6-9 4.6Z"/><path d="M3 13.4l9 4.6 9-4.6"/>',
  'icon-pin':
    '<path fill="currentColor" stroke="none" d="M12 22s-7.5-6.9-7.5-12a7.5 7.5 0 1 1 15 0C19.5 15.1 12 22 12 22Z"/>',
  /* 实景选址定位针：取自 assets/icons/icon-location.svg（1024 网格） */
  'icon-location':
    '<path fill="currentColor" stroke="none" d="M513.024 1024h-1.024c-17.92 0-34.816-7.168-47.104-20.48-9.728-10.24-97.28-102.912-184.832-219.648C162.304 625.664 102.4 499.2 102.4 409.088 102.4 183.296 286.208 0 512 0s409.6 183.296 409.6 409.088c0 54.784-20.992 121.856-62.976 199.68-39.936 74.752-100.352 161.792-179.712 258.048l-0.512 0.512-117.76 134.144c-11.776 14.336-29.184 22.528-47.616 22.528z m-1.024-423.936c105.984 0 191.488-86.016 191.488-191.488S617.984 217.6 512 217.6 320 303.104 320 409.088s86.016 190.976 192 190.976z"/>',
  'icon-info': '<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.2"/><path d="M12 7.6h.01"/>',
  'icon-eye':
    '<path d="M2.4 12S6.2 5.6 12 5.6 21.6 12 21.6 12 17.8 18.4 12 18.4 2.4 12 2.4 12Z"/><circle cx="12" cy="12" r="3.4"/>',
  'icon-check': '<path d="M4.5 12.5l5 5 10-11"/>',
  'icon-close': '<path d="M6 6l12 12M18 6L6 18"/>',
  'icon-play': '<path d="M8 5.5v13l11-6.5Z"/>',
  'icon-stop': '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  'icon-expand': '<path d="M4 9V4h5"/><path d="M15 4h5v5"/><path d="M20 15v5h-5"/><path d="M4 15v5h5"/>',
  'icon-compress': '<path d="M9 4v5H4"/><path d="M20 9h-5V4"/><path d="M15 20v-5h5"/><path d="M4 15h5v5"/>',
  'icon-clock': '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 1.9"/>',
  'icon-bulb': '<path d="M9.5 18h5"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 1 3.6 10.8c-.7.55-1.1 1.35-1.1 2.2h-5c0-.85-.4-1.65-1.1-2.2A6 6 0 0 1 12 3Z"/>',
  'icon-rocket':
    '<path d="M12 3c4 2 6 6 6 10l-3 2-3-1-1-3 1-3 3-1Z" /><path d="M12 3c-4 2-6 6-6 10l3 2"/><path d="M9 15l-2 5 4-2M15 15l2 5-4-2"/>',
  'icon-list':
    '<rect x="4" y="3.6" width="16" height="16.8" rx="2.4"/><path d="M8 8.4h8M8 12h8M8 15.6h5"/>',
  'icon-book':
    '<path d="M12 6.4C10.4 5 8.2 4.4 5.6 4.4H4v13h1.6c2.6 0 4.8.6 6.4 2 1.6-1.4 3.8-2 6.4-2H20v-13h-1.6c-2.6 0-4.8.6-6.4 2Z"/><path d="M12 6.4v13"/>',
  'icon-spark': '<path d="M12 3.2l1.9 5.4 5.4 1.9-5.4 1.9L12 17.8l-1.9-5.4L4.7 10.5l5.4-1.9Z"/>',
  /* 词云胶囊图标：飞行器（火箭飞行） */
  'icon-plane': '<path d="M21 3 14.6 21l-4-8.6L2 8.4Z"/><path d="M21 3 10.6 13.4"/>',
  /* 词云胶囊图标：城镇建筑（人口和城镇分布） */
  'icon-city':
    '<path d="M4 20V9.4l5-2.5V20"/><path d="M9 20V6.6l6.2 2.6V20"/><path d="M15.2 20v-6.6l4.8 2V20"/><path d="M2.6 20h18.8"/><path d="M6.5 12.2h.01M6.5 15.6h.01M11.8 12h.01M11.8 15.6h.01M17.6 16.6h.01"/>',
  /* 词云胶囊图标：云与雨（全年高温多雨） */
  'icon-rain':
    '<path d="M7.6 14.6h8.8a3.8 3.8 0 0 0 .6-7.56A5.3 5.3 0 0 0 6.9 7.1 3.7 3.7 0 0 0 7.6 14.6Z"/><path d="M9.2 17.4l-.8 2.2M12.6 17.4l-.8 2.2M16 17.4l-.8 2.2"/>',
  /* 词云胶囊图标：雷雨（云与闪电） */
  'icon-storm':
    '<path d="M7.4 13.6h8.8a3.7 3.7 0 0 0 .6-7.36A5.2 5.2 0 0 0 6.7 6.2 3.6 3.6 0 0 0 7.4 13.6Z"/><path d="M13 15.4l-2.8 3.8h3.2l-2.2 3.4"/>',
  'icon-refresh': '<path d="M19.6 12a7.6 7.6 0 1 1-2.2-5.4"/><path d="M19.8 4.4v4.2h-4.2"/>',
  'icon-arrow-right': '<path d="M4.5 12h14"/><path d="M13 6.5l5.5 5.5-5.5 5.5"/>'
}

/** 个别图标（如定位针）自带坐标系，需覆盖默认的 24 网格 */
const ICON_VIEWBOX: Record<string, string> = {
  'icon-location': '0 0 1024 1024'
}

export function injectIcons(): void {
  if (document.getElementById('icon-sprite')) return
  const symbols = Object.entries(ICONS)
    .map(
      ([name, paths]) =>
        `<symbol id="${name}" viewBox="${ICON_VIEWBOX[name] ?? '0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</symbol>`
    )
    .join('')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('id', 'icon-sprite')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
  svg.innerHTML = symbols
  document.body.appendChild(svg)
}

/** 生成一枚图标（size 为像素） */
export function icon(name: string, size = 24): string {
  return `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="#${name}"></use></svg>`
}
