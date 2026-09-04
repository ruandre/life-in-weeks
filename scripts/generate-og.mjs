import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import satori from 'satori'
import sharp from 'sharp'

const width = 1200
const height = 630

// librsvg (sharp) lacks oklch support; renders fills blank
function oklchToHex(css) {
  const [l, c, h] = css.match(/[\d.]+/g).map(Number)
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.2914855480 * b) ** 3,
  ]

  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.7076147010 * lms[2],
  ]

  return `#${linear
    .map((v) => {
      const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
      return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')}`
}

// Sync with src/styles/tokens.css
const color = {
  bg: oklchToHex('oklch(0.02 0 0)'),
  fg: oklchToHex('oklch(0.9702 0 0)'),
  accent: oklchToHex('oklch(0.62 0.22 250)'),
  grey: oklchToHex('oklch(0.6268 0 0)'),
  greyDark: oklchToHex('oklch(0.24 0 0)'),
  border: oklchToHex('oklch(0.22 0 0)'),
}

const regular = await fs.readFile('node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff')
const bold = await fs.readFile('node_modules/@fontsource/open-sans/files/open-sans-latin-700-normal.woff')

const fonts = [
  {
    name: 'Open Sans',
    data: regular,
    weight: 400,
    style: 'normal',
  },
  {
    name: 'Open Sans',
    data: bold,
    weight: 700,
    style: 'normal',
  },
]

const el = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: color.bg,
      color: color.fg,
      padding: '48px 64px',
      justifyContent: 'space-between',
      fontFamily: 'Open Sans',
    },
    children: [
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '0px',
            lineHeight: 1,
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  fontSize: '142px',
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  lineHeight: '0.85',
                },
                children: 'LIFE',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  fontSize: '142px',
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  lineHeight: '0.85',
                },
                children: 'IN',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: '0px',
                  fontSize: '142px',
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  lineHeight: '0.85',
                },
                children: [
                  {
                    type: 'span',
                    props: {
                      style: { display: 'flex' },
                      children: 'WEEKS',
                    },
                  },
                  {
                    type: 'span',
                    props: {
                      style: {
                        display: 'flex',
                        color: color.accent,
                        marginLeft: '4px',
                      },
                      children: '.',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            width: '100%',
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        color: color.grey,
                        fontSize: '18px',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      },
                      children: 'Your whole life, one box per week',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        color: color.greyDark,
                        fontSize: '14px',
                        letterSpacing: '0.04em',
                      },
                      children: 'ruandre.github.io/life-in-weeks',
                    },
                  },
                ],
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  width: '208px',
                  gap: '4px',
                  opacity: 0.9,
                },
                children: Array.from({ length: 32 }).map((_, i) => ({
                  type: 'div',
                  props: {
                    style: {
                      width: '10px',
                      height: '10px',
                      borderRadius: '1px',
                      backgroundColor: i < 14 ? color.accent : i === 14 ? color.fg : 'transparent',
                      border: i > 14 ? '1px solid #222222' : '1px solid transparent',
                    },
                  },
                })),
              },
            },
          ],
        },
      },
    ],
  },
}

console.log('Generating SVG via satori...')
const svg = await satori(el, {
  width,
  height,
  fonts,
})

await fs.mkdir('public', { recursive: true })
await fs.writeFile('public/og-image.svg', svg)
console.log('Wrote public/og-image.svg', svg.length, 'bytes')

console.log('Converting to PNG via sharp...')
const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
await fs.writeFile('public/og-image.png', pngBuffer)
console.log('Wrote public/og-image.png', pngBuffer.length, 'bytes')

await fs.mkdir('dist', { recursive: true }).catch(() => {})
try {
  await fs.writeFile('dist/og-image.png', pngBuffer)
  await fs.writeFile('dist/og-image.svg', svg)
}
catch {}
console.log('Done')
