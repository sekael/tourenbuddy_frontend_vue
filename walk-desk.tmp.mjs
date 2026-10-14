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


async function openPanel() {
  await page.click('[data-tour="open-menu"]')
  await page.waitForTimeout(600)
  await page.click('[data-tour="menu-map-layers"]')
  await page.waitForTimeout(800)
}
const tapAt = async (x, y) => mode === 'mobile' ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
const project = c => page.evaluate((c) => { const ex = document.querySelector('.map-container').__vueParentComponent.exposed.map; const m = ex.value ?? ex; return m.project(c) }, c)
const highlight = () => page.evaluate(() => { const ex = document.querySelector('.map-container').__vueParentComponent.exposed.map; const m = ex.value ?? ex; return m.querySelectorAll ? null : m.getSource('trail-highlight')?._data?.features?.map(f => f.properties.selected) ?? m.getSource('trail-highlight')?.serialize?.().data?.features?.map(f => f.properties.selected) })

await page.evaluate(() => localStorage.setItem('tb.map.overlays', '["ski"]'))
await page.reload(); await page.waitForSelector('.map-container canvas'); await page.waitForTimeout(3000)
for (let i = 0; i < 3; i++) { if (await page.locator('.welcome-backdrop .dismiss-btn').count()) await page.click('.welcome-backdrop .dismiss-btn'); await page.waitForTimeout(500) }
console.log('reload with ski only', JSON.stringify(await layerState()))

const SHARED = [8.4579, 46.7976]
await cam(SHARED, 13.5); await page.waitForTimeout(5000)
let p = await project(SHARED); await tapAt(p.x, p.y); await page.waitForTimeout(4000)
console.log('list', await page.locator('.side-drawer, .sheet-host').first().innerText().catch(() => '?'))
console.log('highlight', JSON.stringify(await highlight()), 'cam', JSON.stringify(await layerState()))
await page.screenshot({ path: SHOT(`${mode}-10-list`) })

const rows = page.locator('.sheet-host button.row, button.row')
console.log('rows', await rows.count())
await rows.nth(1).click(); await page.waitForTimeout(2500)
console.log('detail highlight', JSON.stringify(await highlight()))
await page.screenshot({ path: SHOT(`${mode}-11-detail`) })

// base switch with highlight on
await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('map').setStyleIndex(1))
await page.waitForTimeout(6000)
console.log('after switch', JSON.stringify(await layerState()), 'highlight', JSON.stringify(await highlight()), 'card still', await page.locator('button.row, a.sac, .no-info').count())
await page.screenshot({ path: SHOT(`${mode}-12-classic`) })

// back to list
const back = page.locator('button[aria-label*="Zurück"], button[aria-label*="Back"]').first()
await back.click(); await page.waitForTimeout(1000)
console.log('back -> rows', await rows.count())

// miss closes card
p = await project([8.30, 46.70]).catch(() => ({ x: 200, y: 200 }))
await cam([8.30, 46.70], 13); await page.waitForTimeout(3000)
await tapAt(400, 300); await page.waitForTimeout(3500)
console.log('after miss rows', await rows.count(), 'highlight', JSON.stringify(await highlight()))

// offline panel
await ctx.setOffline(true); await page.waitForTimeout(800)
await openPanel()
console.log('offline radios disabled', await page.locator('[role="radio"]').evaluateAll(e => e.map(x => x.disabled)), 'toggles', await page.locator('[aria-pressed]').evaluateAll(e => e.map(x => x.disabled)), 'hint', await page.locator('[data-tour="map-layers"]').innerText())
await page.screenshot({ path: SHOT(`${mode}-13-offline-panel`) })
await page.locator('[aria-pressed]').nth(0).click(); await page.waitForTimeout(500)
console.log('offline toggle ->', await page.evaluate(() => localStorage.getItem('tb.map.overlays')))
await ctx.setOffline(false)
console.log('LOG', log.filter(l => !l.includes('GL Driver')).slice(0, 10).join('\n'))
await browser.close()
