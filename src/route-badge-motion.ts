// 回程勋章动画：所有帧按行排在一张帧图里（scripts/route-badges/render.mjs 由 Lottie 源文件生成），
// 外层只露出一格，用位移动画逐格切换。位移动画由合成线程播放，不重绘也不占主线程；
// 以前用 lottie 逐帧改 SVG，每一步都要整页重新分层。

export type RouteBadgeSheet = { columns: number; rows: number; frames: number; fps: number }

// 换格用的时间占整圈的比例：5 秒一圈时约 5 微秒，远小于一帧
const JUMP = 1e-6

/**
 * 每帧两个关键帧：停在这一格，直到下一帧开始前的一瞬间才跳过去。
 * 不用 steps / step-end：Safari 遇到阶梯缓动会退回主线程逐帧算，线性插值的关键帧各浏览器都能交给合成线程。
 * 位移用百分比，和显示尺寸无关。
 */
export function routeBadgeKeyframes({ columns, rows, frames }: RouteBadgeSheet): Keyframe[] {
  const keyframes: Keyframe[] = []
  for (let index = 0; index < frames; index++) {
    const transform = `translate(${(-(index % columns) * 100) / columns}%, ${(-Math.floor(index / columns) * 100) / rows}%)`
    keyframes.push({ offset: index / frames, transform })
    keyframes.push({ offset: index === frames - 1 ? 1 : (index + 1) / frames - JUMP, transform })
  }
  return keyframes
}

/**
 * 帧图的 srcset 和 sizes。files 是「文件路径 → 地址」，文件名形如 common-40.webp，数字是每帧的像素边长；
 * boxes 是勋章的显示边长（px）：[默认, 窄屏]，narrow 是窄屏的媒体查询。浏览器按屏幕倍数挑每帧正好对上设备像素的那张。
 */
export function routeBadgeSources(files: Record<string, string>, name: string, columns: number, boxes: [number, number], narrow: string) {
  const list = Object.entries(files)
    .flatMap(([file, url]) => {
      const match = file.match(/([a-z]+)-(\d+)\.webp$/)
      return match && match[1] === name ? [{ url, side: Number(match[2]) }] : []
    })
    .sort((a, b) => a.side - b.side)
  return {
    // 不认 srcset 的环境用两倍那张
    src: (list.find((item) => item.side === boxes[0] * 2) ?? list[list.length - 1])?.url,
    srcSet: list.map((item) => `${item.url} ${item.side * columns}w`).join(', '),
    sizes: `${narrow} ${boxes[1] * columns}px, ${boxes[0] * columns}px`,
  }
}

let keyframes: Keyframe[] | undefined
let observer: IntersectionObserver | undefined
const badges = new WeakMap<Element, { image: HTMLElement; sheet: RouteBadgeSheet }>()
const playing = new WeakMap<Element, Animation>()

function play(box: Element) {
  const badge = badges.get(box)
  if (!badge || playing.has(box)) return
  keyframes ??= routeBadgeKeyframes(badge.sheet)
  const animation = badge.image.animate(keyframes, { duration: (badge.sheet.frames / badge.sheet.fps) * 1000, iterations: Infinity })
  // 全部对齐到页面时间轴的零点：所有勋章在同一帧里换格，合成器每秒只需要出 fps 帧
  animation.startTime = 0
  playing.set(box, animation)
}

function stop(box: Element) {
  playing.get(box)?.cancel()
  playing.delete(box)
}

/**
 * 勋章进入视口时播放，离开时停在第一帧：播放期间帧图单独占一个图层（两倍屏约 1 MB 显存），屏幕外不保留。
 * 返回取消函数。
 */
export function watchRouteBadge(box: HTMLElement, image: HTMLElement, sheet: RouteBadgeSheet): () => void {
  if (typeof image.animate !== 'function' || typeof IntersectionObserver !== 'function') return () => {}
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) play(entry.target)
      else stop(entry.target)
    }
  })
  badges.set(box, { image, sheet })
  observer.observe(box)
  return () => {
    observer?.unobserve(box)
    stop(box)
    badges.delete(box)
  }
}
