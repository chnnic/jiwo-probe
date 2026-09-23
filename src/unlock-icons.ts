import {
  siApple, siClaude, siDazn, siGoogle, siGooglegemini, siGoogleplay,
  siNetflix, siReddit, siSpotify, siSteam, siWikipedia, siYoutube,
} from 'simple-icons'

// 只提供本站资源或打包内的 SVG，禁止拼接服务名称请求第三方图标接口。
// 原始图标出处见 public/unlock-icons/README.md。
type BrandIcon = { path: string } | { src: string; mask?: boolean }
const icons: Record<string, BrandIcon> = {
  netflix: siNetflix,
  disneyplus: { src: '/unlock-icons/disneyplus.png' },
  youtube_premium: siYoutube,
  prime_video: { src: '/unlock-icons/prime-video.svg', mask: true },
  tvb_anywhere: { src: '/unlock-icons/tvb.png' },
  iqiyi: { src: '/unlock-icons/iqiyi.png' },
  dazn: siDazn,
  youtube_cdn: siYoutube,
  netflix_cdn: siNetflix,
  spotify: siSpotify,
  openai: { src: '/unlock-icons/openai.webp' },
  gemini: siGooglegemini,
  claude: siClaude,
  bing: { src: '/unlock-icons/bing.png' },
  apple: siApple,
  wikipedia: siWikipedia,
  google_play: siGoogleplay,
  google_search: siGoogle,
  steam: siSteam,
  reddit: siReddit,
  onetrust: { src: '/unlock-icons/onetrust.ico' },
  sdggge: { src: '/unlock-icons/sdggge.png' },
}

export function unlockBrandIcon(key: string): BrandIcon | undefined {
  return Object.hasOwn(icons, key) ? icons[key] : undefined
}
