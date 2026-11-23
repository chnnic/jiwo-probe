import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import sharp from 'sharp'
import { routeBadgeKeyframes, routeBadgeSources } from './route-badge-motion.ts'

const assets = new URL('./assets/return-route/', import.meta.url)
const sheet = JSON.parse(readFileSync(new URL('sprite.json', assets), 'utf8'))

test('每帧停在自己那一格，下一帧开始前的一瞬间才换格', () => {
  const keyframes = routeBadgeKeyframes({ columns: 3, rows: 2, frames: 5, fps: 30 })
  assert.equal(keyframes.length, 10)
  assert.deepEqual(keyframes.filter((_, index) => index % 2 === 0).map((frame) => frame.transform), [
    'translate(0%, 0%)',
    `translate(${-100 / 3}%, 0%)`,
    `translate(${-200 / 3}%, 0%)`,
    'translate(0%, -50%)',
    `translate(${-100 / 3}%, -50%)`,
  ])
  for (let index = 0; index < 5; index++) {
    const [hold, release] = [keyframes[index * 2], keyframes[index * 2 + 1]]
    assert.equal(hold.offset, index / 5)
    assert.equal(release.transform, hold.transform)
    // 停留占满这一帧，换格的间隙远小于一帧
    assert.ok(release.offset > hold.offset && (index + 1) / 5 - release.offset < 1e-5)
  }
  assert.equal(keyframes.at(-1).offset, 1)
})

test('关键帧的时间点不回退，全部落在 0～1', () => {
  const keyframes = routeBadgeKeyframes(sheet)
  assert.equal(keyframes.length, sheet.frames * 2)
  assert.equal(keyframes[0].offset, 0)
  for (let index = 1; index < keyframes.length; index++) assert.ok(keyframes[index].offset >= keyframes[index - 1].offset && keyframes[index].offset <= 1)
})

test('srcset 按每帧像素从小到大列出整张帧图的宽度，sizes 给出窄屏和默认两种显示宽度', () => {
  const files = { '../assets/return-route/common-40.webp': '/c40', '../assets/return-route/premium-40.webp': '/p40', '../assets/return-route/common-20.webp': '/c20', '../assets/return-route/common-60.webp': '/c60' }
  assert.deepEqual(routeBadgeSources(files, 'common', 15, [20, 16], '(max-width: 640px)'), {
    src: '/c40',
    srcSet: '/c20 300w, /c40 600w, /c60 900w',
    sizes: '(max-width: 640px) 240px, 300px',
  })
  assert.equal(routeBadgeSources(files, 'premium', 15, [20, 16], '(max-width: 640px)').srcSet, '/p40 600w')
})

test('仓库里的帧图和 sprite.json 对得上：两种勋章尺寸齐全，行列数容得下全部帧', async () => {
  assert.ok(sheet.columns * sheet.rows >= sheet.frames)
  const files = readdirSync(assets).filter((name) => name.endsWith('.webp')).sort()
  const sides = (name) => files.filter((file) => file.startsWith(`${name}-`)).map((file) => Number(file.match(/-(\d+)\.webp$/)[1])).sort((a, b) => a - b)
  assert.deepEqual(sides('common'), [20, 32, 40, 48, 60])
  assert.deepEqual(sides('premium'), sides('common'))
  for (const file of files) {
    const side = Number(file.match(/-(\d+)\.webp$/)[1])
    const meta = await sharp(new URL(file, assets).pathname).metadata()
    assert.equal(meta.width, sheet.columns * side, file)
    assert.equal(meta.height, sheet.rows * side, file)
    assert.ok(meta.hasAlpha, file)
  }
})
