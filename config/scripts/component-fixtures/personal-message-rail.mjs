import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import { ensureFixtureServer, stopFixtureServer } from './fixture-server-client.mjs'

const output = 'message-rail-proof'
await mkdir(output, { recursive: true })
const server = await ensureFixtureServer()
const browser = await chromium.launch({ headless: true })
const results = []
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const theme of ['dark', 'light']) {
    for (const scenario of ['shortConversation', 'longConversation']) {
      const last = scenario === 'longConversation' ? 9999 : 7
      const id = `native-chat/viewport/rail/NativeChatMessageRail:${scenario}`
      await page.goto(`${server.url}/fixtures.html?id=${encodeURIComponent(id)}&theme=${theme}`)
      await page.waitForFunction(() => document.documentElement.dataset.fixtureState === 'ready')
      const rail = page.locator('[data-native-chat-rail]')
      const row = (index) =>
        rail.getByRole('button', {
          name: `Question ${index}: Find this earlier question in a long conversation.`,
          exact: true
        })
      const expand = page.getByRole('button', { name: 'Expand message list', exact: true })
      await page.screenshot({ path: `${output}/${scenario}-${theme}-compact.png` })
      await expand.click()
      await row(last).waitFor()
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute('data-message-id') === id,
        `question-${last}`
      )

      // The visible header precedes the roving message tab stop in both directions.
      await page.keyboard.press('Shift+Tab')
      assert.equal(
        await page
          .getByRole('button', { name: 'Collapse message list', exact: true })
          .evaluate((el) => el === document.activeElement),
        true
      )
      await page.keyboard.press('Tab')
      assert.equal(await row(last).evaluate((el) => el === document.activeElement), true)
      await page.keyboard.press('Home')
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-message-id') === 'question-0'
      )
      await page.keyboard.press('ArrowDown')
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-message-id') === 'question-1'
      )
      await page.keyboard.press('End')
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute('data-message-id') === id,
        `question-${last}`
      )
      const bounds = await row(last).boundingBox()
      const listBounds = await rail.boundingBox()
      assert.ok(
        bounds.y >= listBounds.y && bounds.y + bounds.height <= listBounds.y + listBounds.height + 1
      )
      await row(last).click()
      await page.waitForFunction(
        (id) => document.querySelector('output').textContent === id,
        `question-${last}`
      )
      assert.equal(
        await page.getByRole('button', { name: 'Collapse message list', exact: true }).count(),
        1
      )
      const mountedRows = await rail.getByRole('button').count()
      if (last === 9999) {
        assert.ok(
          mountedRows < 200,
          `Expected a windowed directory, received ${mountedRows} mounted rows`
        )
        const before = await rail.evaluate((el) => el.scrollTop)
        await rail.hover()
        await page.mouse.wheel(0, -800)
        await page.waitForFunction(
          (top) => document.querySelector('[data-native-chat-rail]').scrollTop < top,
          before
        )
      }
      await page.screenshot({ path: `${output}/${scenario}-${theme}-expanded.png` })
      await row(last).press('Escape')
      assert.equal(await expand.evaluate((el) => el === document.activeElement), true)
      assert.equal(
        await page.getByRole('button', { name: 'Collapse message list', exact: true }).count(),
        0
      )
      results.push({ theme, scenario, indexedMessages: last + 1, mountedRows, result: 'passed' })
    }
  }
  assert.deepEqual(errors, [])
  await writeFile(`${output}/verification.json`, `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
  await stopFixtureServer()
}
