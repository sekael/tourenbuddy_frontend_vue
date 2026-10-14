import { chromium } from 'playwright'
const SHOT = n => `/tmp/claude-1001/walk/${n}.png`
const MAIL = 'http://host.docker.internal:54324'
const email = 'anna@tourenbuddy.ch'
const mode = process.argv[2] ?? 'mobile'
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext(mode === 'mobile'
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
const log = []
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(`${m.type()}: ${m.text()}`) })
page.on('response', r => { if (r.status() === 403) log.push('403 ' + r.url()) })
page.on('pageerror', e => log.push(`pageerror: ${e.message}`))
const identifyReqs = []
page.on('request', r => { if (r.url().includes('MapServer/identify') && r.url().includes('skitouren')) identifyReqs.push(r.url()) })

// login
const before = Date.now()
await page.goto('http://localhost:5199/')
await page.fill('#email', email)
await page.click('button[type=submit]')
await page.waitForSelector('#otp-code', { timeout: 20000 })
let code
for (let i = 0; i < 20 && !code; i++) {
  const s = await (await fetch(`${MAIL}/api/v1/search?query=to:${email}`)).json()
  const m = s.messages?.find(x => new Date(x.Created).getTime() > before - 5000)
  if (m) {
    const msg = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()
    code = (msg.Text.match(/\b(\d{6})\b/) || [])[1]
  }
  if (!code) await page.waitForTimeout(500)
}
await page.fill('#otp-code', code)
await page.click('button[type=submit]')
await page.waitForURL(/map|onboarding/, { timeout: 20000 })
if (page.url().includes('onboarding')) await page.click('[data-testid=skip-btn]')
await page.waitForSelector('.map-container canvas', { timeout: 30000 })
await page.waitForTimeout(3000)
// dismiss welcome/tour if present
for (let i = 0; i < 3; i++) {
  if (await page.locator('.welcome-backdrop .dismiss-btn').count()) await page.click('.welcome-backdrop .dismiss-btn')
  await page.waitForTimeout(700)
  const notice = page.locator('[role=dialog] button', { hasText: /OK|Got it|Verstanden|Alles klar/i })
  if (await notice.count()) await notice.first().click()
  await page.waitForTimeout(500)
}
await page.screenshot({ path: SHOT(`${mode}-00-map`) })

const getMap = () => page.evaluate(() => !!document.querySelector('.map-container').__vueParentComponent?.exposed?.map)
console.log('map exposed', await getMap())
const cam = (center, zoom) => page.evaluate(([c, z]) => {
  const m = document.querySelector('.map-container').__vueParentComponent.exposed.map.value ?? document.querySelector('.map-container').__vueParentComponent.exposed.map
  m.jumpTo({ center: c, zoom: z })
}, [center, zoom])
const layerState = () => page.evaluate(() => {
  const ex = document.querySelector('.map-container').__vueParentComponent.exposed.map
  const m = ex.value ?? ex
  const ids = m.getStyle().layers.map(l => l.id)
  const pick = ids.filter(id => /trail-|gpx|tours-circles|tour-detail/.test(id))
  return { order: pick, vis: ['hiking', 'ski'].map(k => m.getLayoutProperty(`trail-overlay-${k}`, 'visibility')), zoom: m.getZoom().toFixed(2), center: m.getCenter().toArray().map(v => v.toFixed(4)) }
})

// open layers panel
async function openPanel() {
  await page.click('[data-tour="open-menu"]')
  await page.waitForTimeout(600)
  await page.click('[data-tour="menu-map-layers"]')
  await page.waitForTimeout(800)
}
await openPanel()
await page.screenshot({ path: SHOT(`${mode}-01-panel`) })
const pressed = page.locator('[aria-pressed]')
await pressed.nth(0).click(); await page.waitForTimeout(300)
await pressed.nth(1).click(); await page.waitForTimeout(300)
console.log('panel open after toggles', await page.locator('[data-tour="map-layers"]').count(), await pressed.evaluateAll(e => e.map(x => x.getAttribute('aria-pressed'))))
await page.screenshot({ path: SHOT(`${mode}-02-panel-toggled`) })
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
console.log('stored', await page.evaluate(() => localStorage.getItem('tb.map.overlays')))

await cam([8.37, 46.81], 13.5)
await page.waitForTimeout(6000)
console.log('layers', JSON.stringify(await layerState()))
await page.screenshot({ path: SHOT(`${mode}-03-overlays-base`) })

// zoomed-out tap
await cam([8.37, 46.81], 9)
await page.waitForTimeout(2500)
const box = await page.locator('.map-container canvas').boundingBox()
const tapAt = async (x, y) => mode === 'mobile' ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
await tapAt(box.width / 2 + 40, box.height / 3)
await page.waitForTimeout(800)
console.log('zoom snackbar', await page.locator('[role="status"]').allInnerTexts(), 'identify reqs', identifyReqs.length)
await page.screenshot({ path: SHOT(`${mode}-04-zoomin`) })

// tap on Alpelenhörnli route vertex
await cam([8.357658, 46.811102], 14)
await page.waitForTimeout(5000)
const pt = await page.evaluate(() => { const ex = document.querySelector('.map-container').__vueParentComponent.exposed.map; const m = ex.value ?? ex; return m.project([8.357658, 46.811102]) })
await tapAt(pt.x + 6, pt.y + 4)
await page.waitForTimeout(4000)
console.log('identify reqs', identifyReqs.length, 'card', await page.locator('.sheet-host').allInnerTexts())
console.log('after tap', JSON.stringify(await layerState()))
await page.screenshot({ path: SHOT(`${mode}-05-route-card`) })

// reload persistence
await page.reload()
await page.waitForSelector('.map-container canvas', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log('after reload', JSON.stringify(await layerState()))

console.log('LOG', log.slice(0, 15).join('\n'))
await browser.close()
