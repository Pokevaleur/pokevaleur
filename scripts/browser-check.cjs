// Visitor-only checks. Never signs in or modifies production data.
const fs = require('node:fs/promises')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = 'http://127.0.0.1:3100'
const routes = ['/', '/coffre', '/login', '/catalogue', '/progression', '/collection', '/opportunites', '/admin-partenaires']
async function main() {
  await fs.mkdir('browser-report', { recursive: true })
  const browser = await chromium.launch()
  const report = []
  try {
    for (const [name, width, height] of [['mobile-small', 360, 800], ['mobile', 390, 844], ['desktop', 1440, 900]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: 'fr-FR', timezoneId: 'Europe/Paris', isMobile: width < 600, hasTouch: width < 600 })
      try {
        const page = await context.newPage()
        for (const route of routes) {
          const errors = []
          const listener = error => errors.push(error.message)
          page.on('pageerror', listener)
          const row = { name, route, errors, passed: false }
          try {
            const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 })
            assert(response && response.ok(), 'Page HTTP error')
            await page.locator('main').waitFor()
            await page.waitForTimeout(800)
            row.finalPath = new URL(page.url()).pathname
            const protectedRoute = ['/collection', '/opportunites', '/admin-partenaires'].includes(route)
            if (protectedRoute) {
              assert.equal(row.finalPath, '/login', 'Visitor must be redirected to login')
              assert.equal(new URL(page.url()).searchParams.get('next'), route, 'Return destination must be preserved')
              await page.locator('input[type="email"]').waitFor()
            }
            assert(await page.locator('main').innerText(), 'Empty main content')
            assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0, 'Framework error overlay')
            row.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
            assert.equal(row.overflow, false, 'Horizontal overflow')
            row.brokenImages = await page.evaluate(() => [...document.images].filter(i => i.getClientRects().length && i.complete && !i.naturalWidth).map(i => i.getAttribute('src')))
            assert.equal(row.brokenImages.length, 0, 'Visible image failed to load')
            if (route === '/') {
              await page.getByRole('link', { name: 'Rejoins PokéValeur', exact: true }).waitFor()
              assert.equal(await page.locator('header nav, header details').count(), 0, 'Guest home has no navigation menus')
              assert.equal(await page.getByRole('searchbox').count(), 0, 'No homepage search')
              assert.equal(await page.getByRole('link', { name: 'Explorer le catalogue' }).count(), 0)
              assert((await page.locator('main').innerText()).includes('Scellés, cartes gradées et master sets'))
              assert((await page.locator('main').innerText()).includes('Le coffre de Lukulu'))
              assert.equal(await page.locator('main [role="img"][aria-label^="Avatar original"]').count(), 16)
              for (const asset of ['collection-treasures', 'avatars-originals', 'approved-desktop']) {
                const image = await page.request.get(base + '/accueil/' + asset + '.webp')
                assert(image.ok(), 'Home illustration must be available: ' + asset)
              }
            }
            if (route === '/coffre') {
              const chest = page.getByRole('button', { name: 'Ouvrir le coffre de Lukulu', exact: true })
              await chest.waitFor()
              await page.screenshot({ path: `browser-report/${name}-coffre-closed.png`, fullPage: true })
              await chest.click()
              await page.locator('.dailyReveal.revealed').waitFor()
              await page.waitForFunction(() => {
                const card = document.querySelector('.dailyReveal .surpriseCard')
                const chest = document.querySelector('.crystalChest.open img')
                return card && chest && Number(getComputedStyle(card).opacity) > 0.99 && Number(getComputedStyle(chest).opacity) > 0.99
              })
              assert.equal(await page.locator('.chestXpSummary').count(), 0, 'Visitor must not earn XP')
            }
            if (route === '/progression') assert.equal(await page.locator('.memberStats').count(), 0, 'Visitor must not see member counters')
            assert.deepEqual(errors, [], 'Unhandled browser errors')
            row.passed = true
          } catch (error) { row.failure = error.message }
          finally {
            await page.screenshot({ path: `browser-report/${name}-${route === '/' ? 'home' : route.slice(1)}.png`, fullPage: true }).catch(error => { row.screenshotError = error.message })
            page.off('pageerror', listener)
            report.push(row)
            console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name} ${route}${row.failure ? ': ' + row.failure : ''}`)
          }
        }
      } finally { await context.close() }
    }
  } finally {
    await browser.close()
    await fs.writeFile('browser-report/results.json', JSON.stringify(report, null, 2))
    const summary = `## Visitor browser checks\n\n${report.filter(r => r.passed).length}/${report.length} checks passed.\n\n` + report.map(r => `- ${r.passed ? '✅' : '❌'} ${r.name} ${r.route}${r.failure ? ' — ' + r.failure : ''}`).join('\n') + '\n\nScreenshots are in the visitor-browser-report artifact. Authenticated collection and duplicate validation are not covered.\n'
    await fs.writeFile('browser-report/summary.md', summary)
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  }
  assert(report.length === 24 && report.every(r => r.passed), 'Browser checks failed; see report')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
