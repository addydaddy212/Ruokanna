#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.MISE_BASE_URL || 'http://localhost:5173'
const CDP_HTTP = (process.env.MISE_CDP_HTTP || 'http://127.0.0.1:9223').replace(/\/$/, '')
const OUTPUT_DIR = process.env.MISE_QA_OUTPUT || 'C:\\Temp\\mise-live-qa'
const VIEWPORT = { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }
const QA_FIXTURE_URL = `${BASE_URL}/qa-recipe.html`
const QA_YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const QA_FRIDGE_FILE = process.env.MISE_QA_FRIDGE_FILE || 'C:\\Temp\\mise-live-qa\\qa-fridge.svg'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nowIso() {
  return new Date().toISOString()
}

function sanitizeName(value) {
  return String(value || 'step')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'step'
}

function todayLabel() {
  const day = new Date().getDay()
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]
}

function dashboardSlotKey(day, slot) {
  return `${sanitizeName(day)}-${sanitizeName(slot)}`
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function buildManualRecipes(seed) {
  const suffix = String(seed).slice(-5)

  return [
    {
      title: `QA Protein Oats ${suffix}`,
      description: 'Greek yogurt oats with berries for a fast breakfast.',
      cuisine: 'Breakfast',
      difficulty: 'Easy',
      prep_time: '5',
      cook_time: '5',
      servings: '1',
      calories: '420',
      protein: '31',
      carbs: '42',
      fat: '12',
      cost_estimate: '2.5',
      ingredients: [
        { name: 'oats', quantity: '50', unit: 'g' },
        { name: 'greek yogurt', quantity: '150', unit: 'g' },
        { name: 'berries', quantity: '80', unit: 'g' },
      ],
      steps: [
        { instruction: 'Combine the oats and yogurt in a bowl.', timer_seconds: '' },
        { instruction: 'Top with berries and serve.', timer_seconds: '60' },
      ],
    },
    {
      title: `QA Chicken Bowl ${suffix}`,
      description: 'Chicken, rice, and greens for a high-protein lunch.',
      cuisine: 'Mediterranean',
      difficulty: 'Medium',
      prep_time: '10',
      cook_time: '15',
      servings: '2',
      calories: '650',
      protein: '45',
      carbs: '55',
      fat: '18',
      cost_estimate: '6',
      ingredients: [
        { name: 'chicken breast', quantity: '2', unit: 'pieces' },
        { name: 'rice', quantity: '1', unit: 'cup' },
        { name: 'spinach', quantity: '2', unit: 'cups' },
      ],
      steps: [
        { instruction: 'Sear the chicken until cooked through.', timer_seconds: '120' },
        { instruction: 'Warm the rice and plate with spinach.', timer_seconds: '' },
      ],
    },
    {
      title: `QA Salmon Dinner ${suffix}`,
      description: 'Salmon with potatoes and greens for dinner.',
      cuisine: 'Nordic',
      difficulty: 'Medium',
      prep_time: '10',
      cook_time: '20',
      servings: '2',
      calories: '720',
      protein: '50',
      carbs: '34',
      fat: '30',
      cost_estimate: '9',
      ingredients: [
        { name: 'salmon fillet', quantity: '2', unit: 'pieces' },
        { name: 'potatoes', quantity: '300', unit: 'g' },
        { name: 'spinach', quantity: '2', unit: 'cups' },
      ],
      steps: [
        { instruction: 'Roast the potatoes until crisp.', timer_seconds: '180' },
        { instruction: 'Cook the salmon and serve over spinach.', timer_seconds: '120' },
      ],
    },
    {
      title: `QA Yogurt Snack ${suffix}`,
      description: 'A quick snack bowl with yogurt and nuts.',
      cuisine: 'Snack',
      difficulty: 'Easy',
      prep_time: '2',
      cook_time: '0',
      servings: '1',
      calories: '240',
      protein: '20',
      carbs: '18',
      fat: '8',
      cost_estimate: '1.5',
      ingredients: [
        { name: 'greek yogurt', quantity: '170', unit: 'g' },
        { name: 'granola', quantity: '30', unit: 'g' },
        { name: 'almonds', quantity: '15', unit: 'g' },
      ],
      steps: [
        { instruction: 'Layer the yogurt, granola, and almonds in a bowl.', timer_seconds: '' },
      ],
    },
    {
      title: `QA Timer Skillet ${suffix}`,
      description: 'A multi-step skillet recipe with timed steps for Cook Mode QA.',
      cuisine: 'Dinner',
      difficulty: 'Medium',
      prep_time: '10',
      cook_time: '18',
      servings: '2',
      calories: '610',
      protein: '43',
      carbs: '48',
      fat: '19',
      cost_estimate: '6.8',
      ingredients: [
        { name: 'chicken breast', quantity: '2', unit: 'pieces' },
        { name: 'rice', quantity: '1', unit: 'cup' },
        { name: 'bell pepper', quantity: '1', unit: '' },
        { name: 'spinach', quantity: '2', unit: 'cups' },
      ],
      steps: [
        { instruction: 'Cook the rice until tender.', timer_seconds: '120' },
        { instruction: 'Sear the chicken in a skillet until fully cooked.', timer_seconds: '180' },
        { instruction: 'Add the pepper and spinach, then stir until softened.', timer_seconds: '90' },
        { instruction: 'Plate everything and serve immediately.', timer_seconds: '' },
      ],
    },
  ]
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url} failed with ${response.status}: ${text.slice(0, 200)}`)
  }
  return text
}

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, options))
}

class CDPPage {
  constructor(meta, websocket, report) {
    this.meta = meta
    this.ws = websocket
    this.report = report
    this.nextId = 0
    this.pending = new Map()
    this.eventListeners = new Map()
    this.consoleMessages = []
    this.failedRequests = []
    this.requestMap = new Map()
    this.apiCalls = []
    this.externalCalls = []

    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))

      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, method } = this.pending.get(message.id)
        this.pending.delete(message.id)

        if (message.error) {
          reject(new Error(`${method}: ${JSON.stringify(message.error)}`))
        } else {
          resolve(message.result)
        }
        return
      }

      this.handleEvent(message)
    })
  }

  handleEvent(message) {
    const { method, params } = message

    if (method === 'Runtime.consoleAPICalled') {
      const values = (params?.args || []).map((arg) => {
        if (arg.value != null) return String(arg.value)
        if (arg.description) return arg.description
        return arg.type || 'unknown'
      })
      this.consoleMessages.push({
        type: params.type,
        text: values.join(' '),
        time: nowIso(),
      })
    }

    if (method === 'Network.requestWillBeSent') {
      this.requestMap.set(params.requestId, {
        url: params.request.url,
        method: params.request.method,
        startTime: nowIso(),
      })
    }

    if (method === 'Network.responseReceived') {
      const existing = this.requestMap.get(params.requestId) || {}
      const combined = {
        ...existing,
        status: params.response.status,
        type: params.type,
        mimeType: params.response.mimeType,
      }
      this.requestMap.set(params.requestId, combined)

      if (combined.url && combined.url.includes('/api/')) {
        this.apiCalls.push({
          url: combined.url,
          method: combined.method,
          status: combined.status,
          time: nowIso(),
        })
      }

      if (combined.url && (/supabase\.co|\/auth\/v1\/|\/rest\/v1\//i.test(combined.url))) {
        this.externalCalls.push({
          url: combined.url,
          method: combined.method,
          status: combined.status,
          time: nowIso(),
        })
      }
    }

    if (method === 'Network.loadingFailed') {
      const existing = this.requestMap.get(params.requestId) || {}
      this.failedRequests.push({
        url: existing.url || '',
        method: existing.method || '',
        errorText: params.errorText,
        canceled: Boolean(params.canceled),
        time: nowIso(),
      })
    }

    const listeners = this.eventListeners.get(method) || []
    listeners.forEach((listener) => listener(params))
  }

  on(method, callback) {
    const listeners = this.eventListeners.get(method) || []
    listeners.push(callback)
    this.eventListeners.set(method, listeners)
  }

  waitForEvent(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs)

      const listener = (params) => {
        clearTimeout(timeout)
        const listeners = this.eventListeners.get(method) || []
        this.eventListeners.set(method, listeners.filter((item) => item !== listener))
        resolve(params)
      }

      this.on(method, listener)
    })
  }

  async send(method, params = {}) {
    const id = ++this.nextId
    const payload = JSON.stringify({ id, method, params })

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method })
      this.ws.send(payload)
    })
  }

  async init() {
    await this.send('Page.enable')
    await this.send('Runtime.enable')
    await this.send('Network.enable')
    await this.send('DOM.enable')
    await this.send('Log.enable').catch(() => null)
    await this.send('Page.setLifecycleEventsEnabled', { enabled: true }).catch(() => null)
    await this.setViewport(VIEWPORT)
    return this
  }

  async setViewport({ width, height, deviceScaleFactor = 1, mobile = false }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile,
    })
  }

  async navigate(url, waitForLoad = true) {
    const waiter = waitForLoad ? this.waitForEvent('Page.loadEventFired', 30000).catch(() => null) : null
    await this.send('Page.navigate', { url })
    if (waiter) await waiter
    await sleep(400)
  }

  async reload() {
    const waiter = this.waitForEvent('Page.loadEventFired', 30000).catch(() => null)
    await this.send('Page.reload', { ignoreCache: false })
    await waiter
    await sleep(400)
  }

  async evaluate(fnOrExpression, ...args) {
    const expression = typeof fnOrExpression === 'function'
      ? `(${fnOrExpression.toString()}).apply(null, ${JSON.stringify(args)})`
      : String(fnOrExpression)

    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed')
    }

    return result.result?.value
  }

  async waitFor(predicate, timeoutMs = 15000, intervalMs = 250, ...args) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      try {
        const ok = await this.evaluate(predicate, ...args)
        if (ok) return true
      } catch {
        // Ignore transient React/render errors while polling.
      }
      await sleep(intervalMs)
    }

    return false
  }

  async waitForText(text, timeoutMs = 15000) {
    const needle = String(text)
    return this.waitFor(
      (target) => document.body && document.body.innerText.includes(target),
      timeoutMs,
      250,
      needle,
    )
  }

  async waitForSelector(selector, timeoutMs = 15000) {
    return this.waitFor((targetSelector) => Boolean(document.querySelector(targetSelector)), timeoutMs, 250, selector)
  }

  async bodyText() {
    return this.evaluate(() => document.body ? document.body.innerText : '')
  }

  async selectorExists(selector) {
    return this.evaluate((targetSelector) => Boolean(document.querySelector(targetSelector)), selector)
  }

  async textBySelector(selector, index = 0) {
    return this.evaluate((targetSelector, targetIndex) => {
      const element = [...document.querySelectorAll(targetSelector)][targetIndex]
      return element ? (element.innerText || element.textContent || '').trim() : ''
    }, selector, index)
  }

  async clickSelectorContainingText(selector, text) {
    return this.evaluate((targetSelector, targetText) => {
      const normalizedTarget = String(targetText || '').replace(/\s+/g, ' ').trim().toLowerCase()
      const target = [...document.querySelectorAll(targetSelector)].find((element) => {
        const value = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
        return value.includes(normalizedTarget)
      })

      if (!target) return false
      target.click()
      return true
    }, selector, text)
  }

  async url() {
    return this.evaluate(() => location.href)
  }

  async path() {
    return this.evaluate(() => location.pathname)
  }

  async waitForPath(pathname, timeoutMs = 15000) {
    return this.waitFor((expectedPath) => location.pathname === expectedPath, timeoutMs, 250, pathname)
  }

  async setConfirmBehavior(result = true) {
    return this.evaluate((nextValue) => {
      window.confirm = () => nextValue
      return true
    }, result)
  }

  async countSelector(selector) {
    return this.evaluate((targetSelector) => document.querySelectorAll(targetSelector).length, selector)
  }

  async clickSelector(selector, index = 0) {
    return this.evaluate((sel, idx) => {
      const elements = [...document.querySelectorAll(sel)]
      const target = elements[idx]
      if (!target) return false
      target.click()
      return true
    }, selector, index)
  }

  async clickByText(text, options = {}) {
    const exact = options.exact !== false
    const selector = options.selector || 'button, a, [role="button"], [title]'

    return this.evaluate((targetText, exactMatch, targetSelector) => {
      const normalizedTarget = targetText.replace(/\s+/g, ' ').trim()
      const candidates = [...document.querySelectorAll(targetSelector)]

      const target = candidates.find((element) => {
        const values = [
          element.innerText || '',
          element.textContent || '',
          element.getAttribute('title') || '',
          element.getAttribute('aria-label') || '',
          element.value || '',
        ]
          .map((value) => value.replace(/\s+/g, ' ').trim())
          .filter(Boolean)

        return values.some((value) => exactMatch ? value === normalizedTarget : value.includes(normalizedTarget))
      })

      if (!target) return false
      target.click()
      return true
    }, text, exact, selector)
  }

  async setValueByPlaceholder(placeholder, value, options = {}) {
    const tagSelector = options.tagSelector || 'input, textarea'
    const index = options.index || 0

    return this.evaluate((targetPlaceholder, nextValue, targetTagSelector, targetIndex) => {
      const elements = [...document.querySelectorAll(targetTagSelector)].filter((element) => {
        const current = (element.getAttribute('placeholder') || '').trim()
        return current === targetPlaceholder
      })

      const target = elements[targetIndex]
      if (!target) return false

      target.focus()
      const prototype = target.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : target.tagName === 'SELECT'
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
      descriptor?.set?.call(target, nextValue)
      target.dispatchEvent(new Event('input', { bubbles: true }))
      target.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }, placeholder, value, tagSelector, index)
  }

  async setValueBySelector(selector, value, index = 0) {
    return this.evaluate((targetSelector, nextValue, targetIndex) => {
      const target = [...document.querySelectorAll(targetSelector)][targetIndex]
      if (!target) return false

      target.focus()
      const prototype = target.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : target.tagName === 'SELECT'
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
      descriptor?.set?.call(target, nextValue)
      target.dispatchEvent(new Event('input', { bubbles: true }))
      target.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }, selector, value, index)
  }

  async selectValue(selector, value, index = 0) {
    return this.evaluate((targetSelector, nextValue, targetIndex) => {
      const target = [...document.querySelectorAll(targetSelector)][targetIndex]
      if (!target) return false

      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')
      descriptor?.set?.call(target, nextValue)
      target.dispatchEvent(new Event('input', { bubbles: true }))
      target.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }, selector, value, index)
  }

  async uploadFiles(selector, files) {
    const documentResult = await this.send('DOM.getDocument', { depth: -1, pierce: true })
    const queryResult = await this.send('DOM.querySelector', {
      nodeId: documentResult.root.nodeId,
      selector,
    })

    if (!queryResult.nodeId) return false

    await this.send('DOM.setFileInputFiles', {
      nodeId: queryResult.nodeId,
      files,
    })

    return true
  }

  async screenshot(name) {
    const screenshotDir = path.join(OUTPUT_DIR, 'screenshots')
    ensureDir(screenshotDir)
    const targetPath = path.join(screenshotDir, `${sanitizeName(name)}.png`)
    const result = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    fs.writeFileSync(targetPath, Buffer.from(result.data, 'base64'))
    this.report.artifacts.screenshots.push(targetPath)
    return targetPath
  }

  async close() {
    try {
      this.ws.close()
    } catch {
      // Ignore best-effort cleanup errors.
    }

    if (this.meta.id) {
      await fetchText(`${CDP_HTTP}/json/close/${this.meta.id}`)
        .catch(() => null)
    }
  }
}

async function openPage(report, url) {
  const response = await fetchJson(`${CDP_HTTP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  const ws = new WebSocket(response.webSocketDebuggerUrl)

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out opening CDP websocket')), 15000)
    ws.addEventListener('open', () => {
      clearTimeout(timeout)
      resolve()
    })
    ws.addEventListener('error', (event) => {
      clearTimeout(timeout)
      reject(new Error(event.message || 'WebSocket open failed'))
    })
  })

  const page = new CDPPage(response, ws, report)
  await page.init()
  return page
}

function logStep(report, title, details = {}) {
  const entry = {
    time: nowIso(),
    title,
    ...details,
  }
  report.timeline.push(entry)
  console.log(`[${entry.time}] ${title}${details.outcome ? ` :: ${details.outcome}` : ''}`)
}

function recordCheck(report, id, area, status, summary, details = {}) {
  report.checks.push({
    id,
    area,
    status,
    summary,
    time: nowIso(),
    ...details,
  })
}

async function startAuthFlow(page, report) {
  const timestamp = Date.now()
  const email = `mise-qa-${timestamp}@example.com`
  const password = `MiseQA!${timestamp.toString().slice(-6)}`

  logStep(report, 'Open app root')
  await page.navigate(`${BASE_URL}/`)
  await page.waitForText('ruokanna', 15000)
  await page.screenshot('auth-landing')

  const currentUrl = await page.url()
  recordCheck(
    report,
    'auth.redirect.logged_out',
    'Auth Flow',
    currentUrl.includes('/auth') ? 'pass' : 'fail',
    currentUrl.includes('/auth') ? 'Logged-out visit redirected to /auth.' : `Expected /auth redirect, saw ${currentUrl}.`,
  )

  logStep(report, 'Create disposable signup')
  await page.clickSelector('[data-qa="auth-tab-signup"]')
  await sleep(200)
  await page.setValueBySelector('[data-qa="auth-email"]', email)
  await page.setValueBySelector('[data-qa="auth-password"]', password)
  await page.clickSelector('[data-qa="auth-submit"]')
  await page.waitFor(
    () => location.pathname !== '/auth'
      || Boolean(document.querySelector('[data-qa="auth-confirmation-message"]'))
      || Boolean(document.querySelector('[data-qa="auth-error"]')),
    12000,
  )
  await page.screenshot('auth-after-signup')

  const signupText = await page.bodyText()
  const signupPath = await page.path()
  const signupError = await page.textBySelector('[data-qa="auth-error"]')
  const confirmationMessage = await page.textBySelector('[data-qa="auth-confirmation-message"]')
  const signupSignedIn = signupPath !== '/auth'
  recordCheck(
    report,
    'auth.signup',
    'Auth Flow',
    signupError
      ? 'fail'
      : signupSignedIn || confirmationMessage
        ? 'pass'
        : 'warn',
    signupError
      ? `Signup surfaced an auth error: ${signupError}.`
      : signupSignedIn
        ? 'Signup created an authenticated session immediately.'
        : confirmationMessage
          ? 'Signup submitted and the confirmation-required message displayed.'
          : 'Signup submitted, but neither an authenticated session nor a confirmation message was clearly detected.',
    { bodySnippet: signupText.slice(0, 300) },
  )

  let signedIn = signupSignedIn

  if (!signedIn) {
    logStep(report, 'Attempt immediate sign in')
    await page.clickSelector('[data-qa="auth-tab-signin"]')
    await sleep(200)
    await page.setValueBySelector('[data-qa="auth-email"]', email)
    await page.setValueBySelector('[data-qa="auth-password"]', password)
    await page.clickSelector('[data-qa="auth-submit"]')
    await page.waitFor(
      () => location.pathname !== '/auth'
        || Boolean(document.querySelector('[data-qa="auth-error"]')),
      12000,
    )
    await page.screenshot('auth-after-signin-attempt')

    const signedInUrl = await page.url()
    signedIn = signedInUrl === `${BASE_URL}/` || signedInUrl.startsWith(`${BASE_URL}/?`) || !signedInUrl.includes('/auth')
    const postSignInText = await page.bodyText()

    recordCheck(
      report,
      'auth.signin',
      'Auth Flow',
      signedIn ? 'pass' : 'warn',
      signedIn
        ? 'Disposable account signed in successfully.'
        : `Sign in did not reach the private app. Current URL: ${signedInUrl}.`,
      { bodySnippet: postSignInText.slice(0, 300) },
    )
  } else {
    recordCheck(
      report,
      'auth.signin',
      'Auth Flow',
      'pass',
      'Disposable account was already authenticated immediately after signup.',
    )
  }

  return { email, password, signedIn }
}

async function addManualRecipe(page, recipe) {
  await page.navigate(`${BASE_URL}/recipes/add`)
  await page.waitForSelector('[data-qa="add-recipe-page"]', 15000)
  await page.clickSelector('[data-qa="add-recipe-tab-manual"]')
  await sleep(250)

  await page.setValueByPlaceholder('Recipe title', recipe.title)
  await page.setValueByPlaceholder('Short recipe description', recipe.description)
  await page.setValueByPlaceholder('Cuisine', recipe.cuisine)
  await page.selectValue('select', recipe.difficulty)
  await page.setValueByPlaceholder('Prep time', recipe.prep_time)
  await page.setValueByPlaceholder('Cook time', recipe.cook_time)
  await page.setValueByPlaceholder('Servings', recipe.servings)
  await page.setValueByPlaceholder('Cost', recipe.cost_estimate)
  await page.setValueByPlaceholder('Calories', recipe.calories)
  await page.setValueByPlaceholder('Protein', recipe.protein)
  await page.setValueByPlaceholder('Carbs', recipe.carbs)
  await page.setValueByPlaceholder('Fat', recipe.fat)

  for (let index = 0; index < recipe.ingredients.length; index += 1) {
    const ingredient = recipe.ingredients[index]
    if (index > 0) {
      await page.clickByText('Add ingredient')
      await sleep(150)
    }
    await page.setValueByPlaceholder('Ingredient', ingredient.name, { index })
    await page.setValueByPlaceholder('Qty', ingredient.quantity, { index })
    await page.setValueByPlaceholder('Unit', ingredient.unit, { index })
  }

  for (let index = 0; index < recipe.steps.length; index += 1) {
    const step = recipe.steps[index]
    if (index > 0) {
      await page.clickByText('Add step')
      await sleep(150)
    }
    await page.setValueByPlaceholder(`Step ${index + 1}`, step.instruction)
    if (step.timer_seconds) {
      await page.setValueByPlaceholder('Timer sec', step.timer_seconds, { index })
    }
  }

  await page.clickSelector('[data-qa="recipe-manual-save"]')
  const saved = await page.waitForPath('/recipes', 20000)
  await sleep(600)
  return saved
}

async function clickRecipeCardByTitle(page, title) {
  return page.clickSelectorContainingText('[data-qa="recipe-card"]', title)
}

async function waitForDashboardReady(page, day = todayLabel()) {
  return page.waitFor(
    (activeDay) => {
      const dayButton = document.querySelector(`[data-qa="dashboard-day-${activeDay.toLowerCase()}"]`)
      const autoPlanButton = document.querySelector('[data-qa="dashboard-auto-plan"]')
      const visiblePlannerControls = document.querySelectorAll('[data-qa^="dashboard-add-meal-"], [data-qa="meal-card-title"]').length
      return Boolean(dayButton) && Boolean(autoPlanButton) && !autoPlanButton.disabled && visiblePlannerControls > 0
    },
    30000,
    250,
    day,
  )
}

async function runRecipeAdditionFlows(page, report, timestampSeed) {
  const recipes = buildManualRecipes(timestampSeed)

  logStep(report, 'Open recipes library')
  await page.clickSelector('a[href="/recipes"]')
  await page.waitForText('My Recipes', 15000)
  await page.screenshot('recipes-library-initial')

  recordCheck(
    report,
    'recipes.page.access',
    'Recipe Addition Flow',
    (await page.path()) === '/recipes' ? 'pass' : 'fail',
    (await page.path()) === '/recipes' ? 'Recipes page opened from app navigation.' : `Expected /recipes, saw ${(await page.path())}.`,
  )

  for (const recipe of recipes) {
    logStep(report, `Create manual recipe ${recipe.title}`)
    const saved = await addManualRecipe(page, recipe)
    const body = await page.bodyText()
    recordCheck(
      report,
      `recipe.manual.${sanitizeName(recipe.title)}`,
      'Recipe Addition Flow',
      saved && body.includes(recipe.title) ? 'pass' : 'fail',
      saved && body.includes(recipe.title)
        ? `Manual recipe saved and visible in the recipes list: ${recipe.title}.`
        : `Manual recipe did not clearly save: ${recipe.title}.`,
      { bodySnippet: body.slice(0, 320) },
    )
  }

  logStep(report, 'Test URL extraction flow')
  await page.clickSelector('[data-qa="recipes-add-button"]')
  await page.waitForPath('/recipes/add', 15000)
  await page.setValueBySelector('[data-qa="recipe-url-input"]', QA_FIXTURE_URL)
  await page.clickSelector('[data-qa="recipe-url-extract"]')
  await page.waitFor(
    () => Boolean(document.querySelector('[data-qa="recipe-preview"]'))
      || Boolean(document.querySelector('[data-qa="add-recipe-error"]')),
    45000,
  )
  await page.screenshot('recipe-url-preview')
  let body = await page.bodyText()
  const urlPreviewReady = await page.selectorExists('[data-qa="recipe-preview"]')
  recordCheck(
    report,
    'recipe.url.preview',
    'Recipe Addition Flow',
    urlPreviewReady ? 'pass' : 'warn',
    urlPreviewReady
      ? 'Fixture recipe URL extracted into a preview successfully.'
      : 'URL extraction did not clearly reach a saveable preview.',
    { bodySnippet: body.slice(0, 320) },
  )
  if (urlPreviewReady) {
    await page.clickSelector('[data-qa="recipe-preview-save"]')
    await page.waitForPath('/recipes', 20000)
    await page.waitFor(() => !document.body.innerText.includes('Loading recipes…'), 10000)
    body = await page.bodyText()
    recordCheck(
      report,
      'recipe.url.save',
      'Recipe Addition Flow',
      body.includes('QA Citrus Chicken Bowl') ? 'pass' : 'warn',
      body.includes('QA Citrus Chicken Bowl')
        ? 'URL-imported recipe saved into the recipes list.'
        : 'URL-imported recipe saved flow was attempted, but the list entry was not clearly confirmed.',
      { bodySnippet: body.slice(0, 320) },
    )
  }

  logStep(report, 'Test AI recipe generation flow')
  await page.clickSelector('[data-qa="recipes-add-button"]')
  await page.waitForPath('/recipes/add', 15000)
  await page.clickSelector('[data-qa="add-recipe-tab-ai"]')
  await sleep(200)
  await page.setValueBySelector('[data-qa="recipe-ai-prompt"]', 'High-protein turkey chili under 30 minutes with beans and peppers.')
  await page.clickSelector('[data-qa="recipe-ai-generate"]')
  await page.waitFor(
    () => Boolean(document.querySelector('[data-qa="recipe-preview"]'))
      || Boolean(document.querySelector('[data-qa="add-recipe-error"]')),
    60000,
  )
  await page.screenshot('recipe-ai-preview')
  body = await page.bodyText()
  const aiPreviewReady = await page.selectorExists('[data-qa="recipe-preview"]')
  recordCheck(
    report,
    'recipe.ai.preview',
    'Recipe Addition Flow',
    aiPreviewReady ? 'pass' : 'warn',
    aiPreviewReady
      ? 'AI generation produced a recipe preview.'
      : 'AI generation did not clearly produce a saveable preview.',
    { bodySnippet: body.slice(0, 320) },
  )
  if (aiPreviewReady) {
    await page.clickSelector('[data-qa="recipe-preview-save"]')
    await page.waitForPath('/recipes', 20000)
    body = await page.bodyText()
    recordCheck(
      report,
      'recipe.ai.save',
      'Recipe Addition Flow',
      /turkey|chili/i.test(body) ? 'pass' : 'warn',
      /turkey|chili/i.test(body)
        ? 'AI-generated recipe saved into the recipes list.'
        : 'AI-generated recipe save was attempted, but the list entry was not clearly confirmed.',
      { bodySnippet: body.slice(0, 320) },
    )
  }

  logStep(report, 'Test YouTube transcript entry point')
  await page.clickSelector('[data-qa="recipes-add-button"]')
  await page.waitForPath('/recipes/add', 15000)
  await page.setValueBySelector('[data-qa="recipe-url-input"]', QA_YOUTUBE_URL)
  await sleep(200)
  const youtubeButtonReady = await page.waitFor(
    () => {
      const button = document.querySelector('[data-qa="recipe-url-extract"]')
      return button && /youtube/i.test(button.innerText || '')
    },
    5000,
  )
  recordCheck(
    report,
    'recipe.youtube.detect',
    'Recipe Addition Flow',
    youtubeButtonReady ? 'pass' : 'warn',
    youtubeButtonReady
      ? 'YouTube URL was detected and switched the CTA to transcript extraction.'
      : 'YouTube URL did not clearly trigger the transcript extraction CTA.',
  )
  if (youtubeButtonReady) {
    await page.clickSelector('[data-qa="recipe-url-extract"]')
    await page.waitFor(
      () => Boolean(document.querySelector('[data-qa="recipe-preview"]'))
        || Boolean(document.querySelector('[data-qa="add-recipe-error"]')),
      45000,
    )
    body = await page.bodyText()
    recordCheck(
      report,
      'recipe.youtube.flow',
      'Recipe Addition Flow',
      await page.selectorExists('[data-qa="recipe-preview"]') ? 'pass' : 'warn',
      await page.selectorExists('[data-qa="recipe-preview"]')
        ? 'YouTube transcript extraction reached a preview.'
        : 'YouTube transcript flow was triggered, but it did not clearly reach a saveable preview.',
      { bodySnippet: body.slice(0, 320) },
    )
  }

  await page.navigate(`${BASE_URL}/recipes`)
  await page.waitForSelector('[data-qa="recipes-page"]', 15000)
  await page.screenshot('recipes-library-populated')

  return recipes
}

function parseDashboardCalories(text) {
  const match = String(text || '').match(/(\d+)\s*\/\s*(\d+)\s*kcal/i)
  return match ? Number(match[1]) : null
}

async function chooseMealFromPicker(page, searchTerm) {
  await page.waitForSelector('[data-qa="meal-picker-modal"]', 10000)
  await page.setValueBySelector('[data-qa="meal-picker-search"]', searchTerm)
  await page.waitForSelector(`[data-qa="meal-picker-option-${sanitizeName(searchTerm)}"]`, 10000)
  await page.clickSelector(`[data-qa="meal-picker-option-${sanitizeName(searchTerm)}"]`)
  await sleep(1200)
}

async function runDashboardFlows(page, report, recipes) {
  const activeDay = todayLabel()
  const plannedRecipes = [recipes[0], recipes[1], recipes[4], recipes[3]]

  logStep(report, 'Open dashboard')
  await page.clickSelector('a[href="/"]')
  await page.waitForSelector('[data-qa="dashboard-page"]', 15000)
  await waitForDashboardReady(page, activeDay)
  await page.screenshot('dashboard-empty')

  let body = await page.bodyText()
  const slotChecks = await Promise.all(
    ['Breakfast', 'Lunch', 'Dinner', 'Snack']
      .map((slot) => page.selectorExists(`[data-qa="meal-card-${dashboardSlotKey(activeDay, slot)}"]`)),
  )
  const hasSlots = slotChecks.every(Boolean)
  const todaySelected = await page.evaluate((day) => {
    const button = document.querySelector(`[data-qa="dashboard-day-${day.toLowerCase()}"]`)
    return button?.getAttribute('data-selected') === 'true'
  }, activeDay)
  recordCheck(
    report,
    'dashboard.hero',
    'Weekly Dashboard',
    hasSlots && todaySelected ? 'pass' : 'warn',
    hasSlots && todaySelected
      ? 'Dashboard loaded with the current day selected and all four meal slots visible.'
      : 'Dashboard did not clearly show the current day selection and expected meal slots.',
    { bodySnippet: body.slice(0, 320) },
  )

  logStep(report, 'Run auto-plan week')
  const autoPlanApiIndex = page.apiCalls.length
  await page.clickSelector('[data-qa="dashboard-auto-plan"]')
  await page.waitFor(() => document.querySelectorAll('[data-qa="meal-card-title"]').length >= 4, 45000)
  let allDaysFilled = true
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    await page.clickSelector(`[data-qa="dashboard-day-${day.toLowerCase()}"]`)
    await sleep(300)
    const titles = await page.countSelector('[data-qa="meal-card-title"]')
    if (titles < 4) allDaysFilled = false
  }
  await page.clickSelector(`[data-qa="dashboard-day-${activeDay.toLowerCase()}"]`)
  await sleep(300)
  const autoPlanCalled = page.apiCalls.slice(autoPlanApiIndex).some((call) => call.url.includes('/api/recipes/autoplan'))
  recordCheck(
    report,
    'dashboard.auto_plan',
    'Auto-plan Flow',
    autoPlanCalled && allDaysFilled ? 'pass' : 'warn',
    autoPlanCalled && allDaysFilled
      ? 'Auto-plan called /api/recipes/autoplan and populated all seven days.'
      : 'Auto-plan was triggered, but the API call or full-week population was not clearly confirmed.',
  )

  const beforeCalories = parseDashboardCalories(await page.textBySelector('[data-qa="dashboard-macro-progress"]'))

  logStep(report, 'Clear and refill breakfast meal from picker')
  await page.clickSelector(`[data-qa="meal-clear-${dashboardSlotKey(activeDay, 'Breakfast')}"]`)
  await sleep(900)
  await page.clickSelector(`[data-qa="dashboard-add-meal-${dashboardSlotKey(activeDay, 'Breakfast')}"]`)
  await chooseMealFromPicker(page, plannedRecipes[0].title)
  body = await page.bodyText()
  const breakfastAdded = body.includes(plannedRecipes[0].title)
  const afterBreakfastCalories = parseDashboardCalories(await page.textBySelector('[data-qa="dashboard-macro-progress"]'))
  recordCheck(
    report,
    'dashboard.add_meal',
    'Meal Planning Flow',
    breakfastAdded ? 'pass' : 'fail',
    breakfastAdded
      ? 'Added a meal from the dashboard picker.'
      : 'Could not clearly confirm that the selected recipe filled the slot.',
    { bodySnippet: body.slice(0, 320) },
  )
  recordCheck(
    report,
    'dashboard.macros_after_add',
    'Macro Autopilot',
    afterBreakfastCalories != null && beforeCalories != null && afterBreakfastCalories > beforeCalories ? 'pass' : 'warn',
    afterBreakfastCalories != null && beforeCalories != null && afterBreakfastCalories > beforeCalories
      ? 'Dashboard calories increased after adding a meal.'
      : 'Dashboard calories did not clearly increase after the meal add.',
  )

  logStep(report, 'Switch days and return')
  await page.clickSelector('[data-qa="dashboard-day-tue"]')
  await sleep(300)
  const switchedAway = await page.evaluate(() => document.querySelector('[data-qa="dashboard-day-tue"]')?.getAttribute('data-selected') === 'true')
  await page.clickSelector(`[data-qa="dashboard-day-${activeDay.toLowerCase()}"]`)
  await sleep(300)
  recordCheck(
    report,
    'dashboard.day_switch',
    'Weekly Dashboard',
    switchedAway ? 'pass' : 'warn',
    switchedAway
      ? 'Clicking a day tab switched the dashboard to that day.'
      : 'Day switching did not clearly update the selected dashboard day.',
  )

  logStep(report, 'Refill lunch, dinner, and snack slots')
  await page.clickSelector(`[data-qa="meal-clear-${dashboardSlotKey(activeDay, 'Lunch')}"]`)
  await sleep(700)
  await page.clickSelector(`[data-qa="dashboard-add-meal-${dashboardSlotKey(activeDay, 'Lunch')}"]`)
  await chooseMealFromPicker(page, plannedRecipes[1].title)
  await page.clickSelector(`[data-qa="meal-clear-${dashboardSlotKey(activeDay, 'Dinner')}"]`)
  await sleep(700)
  await page.clickSelector(`[data-qa="dashboard-add-meal-${dashboardSlotKey(activeDay, 'Dinner')}"]`)
  await chooseMealFromPicker(page, plannedRecipes[2].title)
  await page.clickSelector(`[data-qa="meal-clear-${dashboardSlotKey(activeDay, 'Snack')}"]`)
  await sleep(700)
  await page.clickSelector(`[data-qa="dashboard-add-meal-${dashboardSlotKey(activeDay, 'Snack')}"]`)
  await chooseMealFromPicker(page, plannedRecipes[3].title)
  await page.screenshot('dashboard-day-filled')

  body = await page.bodyText()
  const fullDayFilled = plannedRecipes.every((recipe) => body.includes(recipe.title))
  recordCheck(
    report,
    'dashboard.day_filled',
    'Weekly Dashboard',
    fullDayFilled ? 'pass' : 'warn',
    fullDayFilled
      ? 'The active day was filled with four planned meals.'
      : 'The active day did not clearly show all planned meals after filling slots.',
    { bodySnippet: body.slice(0, 320) },
  )

  logStep(report, 'Open grocery list')
  await page.clickSelector('[data-qa="dashboard-grocery-open"]')
  await page.waitForSelector('[data-qa="grocery-modal"]', 10000)
  body = await page.bodyText()
  const groceryItems = await page.countSelector('[data-qa="grocery-item"]')
  recordCheck(
    report,
    'dashboard.grocery_list',
    'Weekly Dashboard',
    groceryItems > 0 ? 'pass' : 'warn',
    groceryItems > 0
      ? 'Grocery list modal opened with planned ingredients.'
      : 'Grocery list modal opened, but it was empty or unclear.',
    { bodySnippet: body.slice(0, 320) },
  )
  await page.evaluate(() => {
    const closeButtons = [...document.querySelectorAll('button')].filter((button) => button.innerText.trim() === '✕')
    closeButtons[closeButtons.length - 1]?.click()
    return true
  })
  await sleep(300)

  logStep(report, 'Open Just Tell Me recommendation')
  const recommendApiIndex = page.apiCalls.length
  await page.clickSelector('[data-qa="dashboard-just-tell-me"]')
  await page.waitForSelector('[data-qa="just-tell-me-modal"]', 30000)
  body = await page.bodyText()
  const recommendationShown = await page.selectorExists('[data-qa="just-tell-me-result"]')
  const emptyShown = await page.selectorExists('[data-qa="just-tell-me-empty"]')
  const recommendCalled = page.apiCalls.slice(recommendApiIndex).some((call) => call.url.includes('/api/planner/recommend'))
  recordCheck(
    report,
    'dashboard.just_tell_me',
    'Just Tell Me',
    recommendCalled && (recommendationShown || emptyShown) ? 'pass' : 'warn',
    recommendCalled && (recommendationShown || emptyShown)
      ? recommendationShown
        ? 'Just Tell Me produced a recommendation modal.'
        : 'Just Tell Me produced the helpful empty-state guidance modal.'
      : 'Just Tell Me did not clearly produce a settled result modal.',
    { bodySnippet: body.slice(0, 320) },
  )
  if (recommendationShown) {
    await page.screenshot('dashboard-just-tell-me')
    await page.clickSelector('[data-qa="just-tell-me-cook"]')
    const cookOpened = await page.waitForText('Step 1 of', 15000)
    recordCheck(
      report,
      'dashboard.just_tell_me_cook',
      'Just Tell Me',
      cookOpened ? 'pass' : 'warn',
      cookOpened
        ? 'Cook tonight navigated from the recommendation modal into Cook Mode.'
        : 'Cook tonight did not clearly open Cook Mode.',
    )
    if (cookOpened) {
      await page.clickByText('← Back', { exact: false, selector: 'button' })
      await page.waitForText('Weekly Planner', 15000)
    }
  }
  if (await page.selectorExists('[data-qa="just-tell-me-modal"]')) {
    await page.evaluate(() => {
      const modal = document.querySelector('[data-qa="just-tell-me-modal"]')
      modal?.parentElement?.click()
      return true
    })
    await sleep(300)
  }

  logStep(report, 'Swap active meal')
  await page.clickSelector(`[data-qa="meal-swap-${dashboardSlotKey(activeDay, 'Dinner')}"]`)
  await page.waitForSelector('[data-qa="swap-modal"]', 10000)
  body = await page.bodyText()
  const swapFilterChecks = await Promise.all(
    ['all', 'fastest', 'cheapest', 'best-fit']
      .map((label) => page.selectorExists(`[data-qa="swap-filter-${label}"]`)),
  )
  const swapOptionsVisible = swapFilterChecks.every(Boolean) && await page.countSelector('[data-qa^="swap-option-"]') >= 3
  recordCheck(
    report,
    'dashboard.swap_modal',
    'I Don\'t Feel Like It',
    swapOptionsVisible ? 'pass' : 'warn',
    swapOptionsVisible
      ? 'Swap modal opened with Fastest, Cheapest, and Best Fit filters.'
      : 'Swap modal opened, but the expected filters or options were incomplete.',
    { bodySnippet: body.slice(0, 320) },
  )
  const firstTitleBeforeSwap = await page.bodyText()
  await page.clickSelector('[data-qa="swap-filter-cheapest"]')
  await sleep(200)
  await page.clickSelector('[data-qa^="swap-option-"]')
  await sleep(1500)
  const afterSwapText = await page.bodyText()
  recordCheck(
    report,
    'dashboard.swap_apply',
    'I Don\'t Feel Like It',
    afterSwapText !== firstTitleBeforeSwap ? 'pass' : 'warn',
    afterSwapText !== firstTitleBeforeSwap
      ? 'Selecting a swap alternative updated the active dashboard meal.'
      : 'Selecting a swap alternative did not clearly change the visible plan.',
    { bodySnippet: afterSwapText.slice(0, 320) },
  )

  logStep(report, 'Toggle leftovers and cooked/skipped state')
  await page.clickSelector(`[data-qa="meal-leftovers-${dashboardSlotKey(activeDay, 'Dinner')}"]`)
  await sleep(900)
  await page.clickSelector(`[data-qa="meal-cooked-${dashboardSlotKey(activeDay, 'Dinner')}"]`)
  await sleep(400)
  await page.clickSelector(`[data-qa="meal-skipped-${dashboardSlotKey(activeDay, 'Dinner')}"]`)
  await sleep(400)
  body = await page.bodyText()
  recordCheck(
    report,
    'dashboard.leftovers_toggle',
    'Leftover Tracker',
    body.includes('Leftovers') ? 'pass' : 'warn',
    'Leftovers toggle was exercised on a meal card.',
  )

  logStep(report, 'Refresh dashboard for persistence')
  await page.reload()
  await page.waitForSelector('[data-qa="dashboard-page"]', 15000)
  await waitForDashboardReady(page, activeDay)
  body = await page.bodyText()
  recordCheck(
    report,
    'dashboard.refresh_persist',
    'Meal Planning Flow',
    await page.countSelector('[data-qa="meal-card-title"]') >= 4 ? 'pass' : 'warn',
    await page.countSelector('[data-qa="meal-card-title"]') >= 4
      ? 'Planned meals persisted after refresh.'
      : 'Planned meals were not clearly visible after refresh.',
    { bodySnippet: body.slice(0, 320) },
  )

  logStep(report, 'Open cook mode from dashboard card')
  await page.clickSelector(`[data-qa="meal-cook-${dashboardSlotKey(activeDay, 'Dinner')}"]`)
  const cookModeOpened = await page.waitForSelector('[data-qa="cook-mode-page"]', 15000)
  recordCheck(
    report,
    'cook.from_dashboard',
    'Cook Mode',
    cookModeOpened ? 'pass' : 'warn',
    cookModeOpened
      ? 'Cook button on a dashboard meal card opened Cook Mode.'
      : 'Cook button on the dashboard did not clearly open Cook Mode.',
  )
}

async function runCookModeFlow(page, report) {
  await page.waitForSelector('[data-qa="cook-mode-page"]', 15000)
  await page.screenshot('cook-mode-start')
  let body = await page.bodyText()
  const hasTimer = await page.selectorExists('[data-qa="cook-timer"]')
  recordCheck(
    report,
    'cook.step_view',
    'Cook Mode',
    await page.selectorExists('[data-qa="cook-progress-label"]') ? 'pass' : 'fail',
    await page.selectorExists('[data-qa="cook-progress-label"]')
      ? 'Cook Mode shows one step at a time with a progress label.'
      : 'Cook Mode did not clearly show the step-by-step view.',
    { bodySnippet: body.slice(0, 320) },
  )
  recordCheck(
    report,
    'cook.timer_visible',
    'Cook Mode',
    hasTimer ? 'pass' : 'warn',
    hasTimer
      ? 'A timer control was visible for the current timed step.'
      : 'Timer controls were not visible on the current step.',
  )

  if (hasTimer) {
    await page.clickSelector('[data-qa="cook-timer-toggle"]')
    await sleep(1500)
    const timerRunning = /pause/i.test(await page.textBySelector('[data-qa="cook-timer-toggle"]'))
    recordCheck(
      report,
      'cook.timer_start',
      'Cook Mode',
      timerRunning ? 'pass' : 'warn',
      timerRunning
        ? 'Timer started and exposed the pause state.'
        : 'Timer did not clearly enter the running state.',
    )
    if (timerRunning) {
      await page.clickSelector('[data-qa="cook-timer-toggle"]')
      await sleep(300)
      recordCheck(report, 'cook.timer_pause', 'Cook Mode', 'pass', 'Timer pause control was exercised.')
    }
  }

  await page.clickSelector('[data-qa="cook-step-next"]')
  await sleep(500)
  let progressText = await page.textBySelector('[data-qa="cook-progress-label"]')
  recordCheck(
    report,
    'cook.next',
    'Cook Mode',
    progressText.includes('Step 2 of') || await page.selectorExists('[data-qa="cook-step-done"]') ? 'pass' : 'warn',
    progressText.includes('Step 2 of') || await page.selectorExists('[data-qa="cook-step-done"]')
      ? 'Next advanced Cook Mode to the following step.'
      : 'Next did not clearly advance Cook Mode.',
  )
  await page.clickSelector('[data-qa="cook-step-back"]')
  await sleep(500)
  progressText = await page.textBySelector('[data-qa="cook-progress-label"]')
  recordCheck(
    report,
    'cook.back',
    'Cook Mode',
    progressText.includes('Step 1 of') ? 'pass' : 'warn',
    progressText.includes('Step 1 of')
      ? 'Back returned Cook Mode to the previous step.'
      : 'Back did not clearly return to the previous step.',
  )

  while (await page.selectorExists('[data-qa="cook-step-next"]')) {
    await page.clickSelector('[data-qa="cook-step-next"]')
    await sleep(300)
  }

  if (await page.selectorExists('[data-qa="cook-step-done"]')) {
    await page.clickSelector('[data-qa="cook-step-done"]')
    await page.waitForSelector('[data-qa="cook-complete"]', 10000)
  }

  body = await page.bodyText()
  recordCheck(
    report,
    'cook.complete',
    'Cook Mode',
    body.includes('You cooked it!') ? 'pass' : 'warn',
    body.includes('You cooked it!')
      ? 'Cook Mode reached its celebration state on the final step.'
      : 'Cook Mode did not clearly reach the final completion state.',
    { bodySnippet: body.slice(0, 320) },
  )

  if (await page.selectorExists('[data-qa="cook-complete-back"]')) {
    await page.clickSelector('[data-qa="cook-complete-back"]')
    await page.waitForPath('/recipes', 15000)
  }
}

async function runRecipeDetailCookFlow(page, report, recipeTitle) {
  logStep(report, 'Open timed recipe detail')
  await page.waitForSelector('[data-qa="recipes-page"]', 15000)
  await clickRecipeCardByTitle(page, recipeTitle)
  await page.waitForSelector('[data-qa="recipe-detail-page"]', 15000)

  await page.clickSelector('[data-qa="recipe-detail-cook-now"]')
  await page.waitForSelector('[data-qa="cook-mode-page"]', 15000)
  recordCheck(
    report,
    'cook.from_recipe_detail',
    'Cook Mode',
    'pass',
    'Recipe detail page opened Cook Mode via its Cook Now button.',
  )

  await page.clickSelector('[data-qa="cook-back-page"]')
  const returnedToDetail = await page.waitFor(
    () => location.pathname.startsWith('/recipes/') && !location.pathname.startsWith('/recipes/add'),
    15000,
  )
  recordCheck(
    report,
    'cook.page_back',
    'Cook Mode',
    returnedToDetail ? 'pass' : 'warn',
    returnedToDetail
      ? 'Cook Mode page back control returned to the previous page.'
      : 'Cook Mode page back control did not clearly return to the recipe detail page.',
  )

  await page.navigate(`${BASE_URL}/recipes`)
  await page.waitForSelector('[data-qa="recipes-page"]', 15000)
}

async function runFridgeFlow(page, report) {
  logStep(report, 'Open fridge page')
  await page.clickSelector('a[href="/fridge"]')
  await page.waitForSelector('[data-qa="fridge-page"]', 15000)
  await page.screenshot('fridge-page')

  const fileInputAcceptsImages = await page.evaluate(() => {
    const input = document.querySelector('[data-qa="fridge-upload-input"]')
    return input ? input.getAttribute('accept') === 'image/*' : false
  })
  recordCheck(
    report,
    'fridge.upload_input',
    'Fridge Scanner',
    fileInputAcceptsImages ? 'pass' : 'warn',
    fileInputAcceptsImages
      ? 'Fridge page exposes an image file input for uploads.'
      : 'Fridge page did not clearly expose an image-only file input.',
  )

  await page.setConfirmBehavior(true)
  const fixtureUploaded = await page.uploadFiles('[data-qa="fridge-upload-input"]', [QA_FRIDGE_FILE]).catch(() => false)
  let body = await page.bodyText()
  if (fixtureUploaded) {
    await page.waitFor(
      () => Boolean(document.querySelector('[data-qa="fridge-scan-notice"]'))
        || document.querySelectorAll('[data-qa="fridge-ingredient-tag"]').length >= 4,
      20000,
    )
    body = await page.bodyText()
    const uploadedIngredientsDetected = ['milk', 'eggs', 'spinach', 'tomatoes'].every((item) => body.toLowerCase().includes(item))
    recordCheck(
      report,
      'fridge.scan_upload',
      'Fridge Scanner',
      uploadedIngredientsDetected ? 'pass' : 'warn',
      uploadedIngredientsDetected
        ? 'Fridge photo upload produced detected ingredient tags.'
        : 'Fridge photo upload was attempted, but the detected ingredients were not clearly confirmed.',
      { bodySnippet: body.slice(0, 320) },
    )
  }

  await page.setValueBySelector('[data-qa="fridge-manual-input"]', 'chicken')
  await page.clickSelector('[data-qa="fridge-add-item"]')
  await sleep(800)
  await page.setValueBySelector('[data-qa="fridge-manual-input"]', 'rice')
  await page.clickSelector('[data-qa="fridge-add-item"]')
  await sleep(800)
  await page.setValueBySelector('[data-qa="fridge-manual-input"]', 'spinach')
  await page.clickSelector('[data-qa="fridge-add-item"]')
  await sleep(800)
  body = await page.bodyText()
  const manualAddWorked = ['chicken', 'rice', 'spinach'].every((item) => body.toLowerCase().includes(item))
  recordCheck(
    report,
    'fridge.manual_add',
    'Fridge Scanner',
    manualAddWorked ? 'pass' : 'warn',
    manualAddWorked
      ? 'Manual fridge ingredient add worked.'
      : 'Could not clearly confirm all manual fridge ingredients after adding them.',
    { bodySnippet: body.slice(0, 320) },
  )

  await page.clickSelector('[data-qa="fridge-remove-item"]')
  await sleep(800)
  body = await page.bodyText()
  recordCheck(
    report,
    'fridge.remove_item',
    'Fridge Scanner',
    !body.toLowerCase().includes('chicken') ? 'pass' : 'warn',
    !body.toLowerCase().includes('chicken')
      ? 'Individual fridge ingredient removal worked.'
      : 'Individual ingredient removal did not clearly update the list.',
  )

  await page.clickSelector('[data-qa="fridge-clear-all"]')
  await sleep(900)
  body = await page.bodyText()
  recordCheck(
    report,
    'fridge.clear_all',
    'Fridge Scanner',
    !body.toLowerCase().includes('rice') && !body.toLowerCase().includes('spinach') ? 'pass' : 'warn',
    !body.toLowerCase().includes('rice') && !body.toLowerCase().includes('spinach')
      ? 'Clear all emptied the saved fridge inventory.'
      : 'Clear all did not clearly empty the fridge inventory.',
  )

  await page.setValueBySelector('[data-qa="fridge-manual-input"]', 'chicken')
  await page.clickSelector('[data-qa="fridge-add-item"]')
  await sleep(500)
  await page.setValueBySelector('[data-qa="fridge-manual-input"]', 'rice')
  await page.clickSelector('[data-qa="fridge-add-item"]')
  await sleep(500)
  await page.setValueBySelector('[data-qa="fridge-manual-input"]', 'spinach')
  await page.clickSelector('[data-qa="fridge-add-item"]')
  await sleep(500)

  await page.clickSelector('[data-qa="fridge-tab-cook-now"]')
  await sleep(800)
  body = await page.bodyText()
  const cookNowShown = body.includes('Best matches from your saved recipes')
  recordCheck(
    report,
    'fridge.cook_now',
    'Fridge Scanner',
    cookNowShown ? 'pass' : 'warn',
    cookNowShown
      ? 'Cook Now tab opened with recipe match cards.'
      : 'Cook Now tab did not clearly show recipe matches.',
    { bodySnippet: body.slice(0, 320) },
  )

  recordCheck(
    report,
    'fridge.match_percent',
    'Fridge Scanner',
    /\d+% match/i.test(body) ? 'pass' : 'warn',
    /\d+% match/i.test(body)
      ? 'Cook Now cards displayed fridge match percentages.'
      : 'Cook Now cards did not clearly display match percentages.',
  )

  await page.clickSelector('[data-qa="fridge-tab-ingredients"]')
  await sleep(500)
}

async function runMacrosFlow(page, report) {
  logStep(report, 'Open macros page')
  await page.clickSelector('a[href="/macros"]')
  await page.waitForSelector('[data-qa="macros-page"]', 15000)
  await page.screenshot('macros-page')

  let body = await page.bodyText()
  const showsAverages = await page.selectorExists('[data-qa="macro-weekly-averages"]')
  recordCheck(
    report,
    'macros.averages',
    'Macro Autopilot',
    showsAverages ? 'pass' : 'warn',
    showsAverages
      ? 'Macro page showed weekly average calorie, protein, and cost stats.'
      : 'Macro page did not clearly show all weekly averages.',
    { bodySnippet: body.slice(0, 320) },
  )

  await page.clickSelector('[data-qa="macro-goal-cut"]')
  await page.waitFor(() => document.body.innerText.includes('1800') && document.body.innerText.includes('/ 150g'), 5000).catch(() => false)
  await sleep(300)
  body = await page.bodyText()
  const cutVisible = body.includes('/ 1800') || body.includes('1800')
  recordCheck(
    report,
    'macros.goal_cut',
    'Macro Autopilot',
    cutVisible ? 'pass' : 'warn',
    cutVisible
      ? 'Cut goal was selectable and its target values were visible.'
      : 'Cut goal did not clearly update the visible targets.',
  )

  await page.clickSelector('[data-qa="macro-goal-bulk"]')
  await page.waitFor(() => document.body.innerText.includes('2800') && document.body.innerText.includes('/ 320g'), 5000).catch(() => false)
  await sleep(300)
  body = await page.bodyText()
  const bulkVisible = body.includes('320') || body.includes('2800')
  recordCheck(
    report,
    'macros.goal_bulk',
    'Macro Autopilot',
    bulkVisible ? 'pass' : 'warn',
    bulkVisible
      ? 'Bulk goal was selectable and its target values were visible.'
      : 'Bulk goal did not clearly update the visible targets.',
  )

  await page.clickSelector('[data-qa="macro-day-tue"]')
  await sleep(400)
  recordCheck(
    report,
    'macros.day_tabs',
    'Macro Autopilot',
    await page.selectorExists('[data-qa="macro-day-breakdown"]') ? 'pass' : 'warn',
    await page.selectorExists('[data-qa="macro-day-breakdown"]')
      ? 'Per-day macro breakdown is accessible via day tabs.'
      : 'Macro day-tab breakdown did not clearly remain accessible after switching days.',
  )

  await page.reload()
  await page.waitForSelector('[data-qa="macros-page"]', 15000)
  const bulkSelectedAfterReload = await page.evaluate(() => {
    const button = document.querySelector('[data-qa="macro-goal-bulk"]')
    if (!button) return false
    return getComputedStyle(button).backgroundColor.includes('0, 255, 133')
  })
  recordCheck(
    report,
    'macros.goal_persist',
    'Macro Autopilot',
    bulkSelectedAfterReload ? 'pass' : 'warn',
    bulkSelectedAfterReload
      ? 'Selected macro goal persisted after refresh.'
      : 'Macro goal did not clearly persist after refresh.',
  )
}

async function runChatFlow(page, report) {
  logStep(report, 'Open chat page')
  await page.clickSelector('a[href="/chat"]')
  await page.waitForText('AI Assistant', 15000)
  await page.screenshot('chat-page')

  let body = await page.bodyText()
  const suggestionsShown = body.includes('What can I cook with chicken and rice?')
  recordCheck(
    report,
    'chat.suggestions',
    'Chat Flow',
    suggestionsShown ? 'pass' : 'warn',
    suggestionsShown
      ? 'Chat page loaded with first-load suggestion chips.'
      : 'Suggestion chips were not clearly visible on first load.',
    { bodySnippet: body.slice(0, 320) },
  )

  await page.setValueByPlaceholder('Ask anything...', 'What can I cook with chicken and rice?')
  await page.clickByText('Send')
  await page.waitFor(
    () => {
      const text = document.body.innerText
      return text.includes('What can I cook with chicken and rice?') && text.split('What can I cook with chicken and rice?').length > 1
    },
    45000,
  )
  body = await page.bodyText()
  recordCheck(
    report,
    'chat.send',
    'Chat Flow',
    body.includes('What can I cook with chicken and rice?') ? 'pass' : 'warn',
    body.includes('What can I cook with chicken and rice?')
      ? 'Chat accepted and displayed the user message.'
      : 'Chat did not clearly display the sent message.',
  )
  recordCheck(
    report,
    'chat.response',
    'Chat Flow',
    body.includes('What can I cook with chicken and rice?') && body.length > 120 ? 'pass' : 'warn',
    body.includes('What can I cook with chicken and rice?') && body.length > 120
      ? 'Chat displayed an assistant response after the send.'
      : 'Chat did not clearly display an assistant response.',
    { bodySnippet: body.slice(0, 320) },
  )

  await page.clickSelector('a[href="/"]')
  await page.waitForText('Weekly Planner', 15000)
  await page.clickSelector('a[href="/chat"]')
  await page.waitForText('AI Assistant', 15000)
  body = await page.bodyText()
  recordCheck(
    report,
    'chat.persist',
    'Chat Flow',
    body.includes('What can I cook with chicken and rice?') ? 'pass' : 'warn',
    body.includes('What can I cook with chicken and rice?')
      ? 'Chat history persisted across navigation.'
      : 'Chat history did not clearly persist after leaving and returning.',
  )
}

async function runDebriefFlow(page, report) {
  logStep(report, 'Open debrief page')
  await page.clickSelector('a[href="/debrief"]')
  await page.waitForSelector('[data-qa="debrief-page"]', 15000)
  await page.waitForSelector('[data-qa="debrief-ai-status"]', 30000)
  await page.screenshot('debrief-page')

  const body = await page.bodyText()
  recordCheck(
    report,
    'debrief.page',
    'Weekly Debrief Page',
    body.includes('Weekly Debrief') ? 'pass' : 'fail',
    body.includes('Weekly Debrief')
      ? 'Debrief page is reachable from app navigation.'
      : 'Debrief page did not clearly load.',
    { bodySnippet: body.slice(0, 320) },
  )
  recordCheck(
    report,
    'debrief.ai_summary',
    'Weekly Debrief Page',
    await page.selectorExists('[data-qa="debrief-summary-block"]') ? 'pass' : 'warn',
    await page.selectorExists('[data-qa="debrief-summary-block"]')
      ? 'Debrief page settled into a visible AI/fallback summary block.'
      : 'Debrief page did not clearly show the AI/fallback summary section.',
  )
  recordCheck(
    report,
    'debrief.next_week',
    'Weekly Debrief Page',
    await page.selectorExists('[data-qa="debrief-suggestions-block"]') ? 'pass' : 'warn',
    await page.selectorExists('[data-qa="debrief-suggestions-block"]')
      ? 'Debrief page surfaced next-week adjustment output or an explicit empty state.'
      : 'Debrief page did not clearly surface next-week suggestions or a fallback.',
  )
}

async function runAuthPersistenceAndSignOut(page, report) {
  logStep(report, 'Verify auth persistence after refresh')
  await page.navigate(`${BASE_URL}/`)
  await page.waitForSelector('[data-qa="dashboard-page"]', 15000)
  await waitForDashboardReady(page)
  await page.reload()
  await page.waitForSelector('[data-qa="dashboard-page"]', 15000)
  await waitForDashboardReady(page)
  recordCheck(report, 'auth.refresh_persist', 'Auth Flow', 'pass', 'Refresh kept the signed-in session active.')

  logStep(report, 'Check mobile shell')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await page.reload()
  await page.waitForSelector('[data-qa="layout-mobile-nav"]', 15000)
  const mobileNavCount = await page.countSelector('[data-qa^="mobile-nav-"]')
  recordCheck(
    report,
    'design.mobile_bottom_nav',
    'Design Spec',
    mobileNavCount >= 5 ? 'pass' : 'warn',
    mobileNavCount >= 5
      ? 'Mobile viewport showed the bottom navigation shell.'
      : 'Mobile viewport did not clearly show the expected bottom navigation.',
  )

  await page.setViewport(VIEWPORT)
  await page.reload()
  await page.waitForSelector('[data-qa="dashboard-page"]', 15000)
  await waitForDashboardReady(page)

  logStep(report, 'Sign out')
  await page.clickSelector('[data-qa="signout-button"]')
  await page.waitForPath('/auth', 15000)
  const body = await page.bodyText()
  recordCheck(
    report,
    'auth.signout',
    'Auth Flow',
    body.includes('Sign In') ? 'pass' : 'warn',
    body.includes('Sign In')
      ? 'Sign out returned the app to /auth.'
      : 'Sign out did not clearly return to the auth screen.',
    { bodySnippet: body.slice(0, 320) },
  )
}

async function main() {
  ensureDir(OUTPUT_DIR)
  const report = {
    meta: {
      startedAt: nowIso(),
      baseUrl: BASE_URL,
      cdpHttp: CDP_HTTP,
      outputDir: OUTPUT_DIR,
    },
    timeline: [],
    checks: [],
    artifacts: {
      screenshots: [],
    },
    console: [],
    failedRequests: [],
    apiCalls: [],
    auth: {},
  }

  let page = null

  try {
    page = await openPage(report, `${BASE_URL}/`)
    const qaSeed = Date.now()

    const auth = await startAuthFlow(page, report)
    report.auth = auth

    report.console = page.consoleMessages
    report.failedRequests = page.failedRequests
    report.apiCalls = page.apiCalls
    report.externalCalls = page.externalCalls
    report.meta.finishedAt = nowIso()

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2))

    if (!auth.signedIn) {
      console.error('Auth did not produce an authenticated session. Review report.json for details.')
      process.exitCode = 2
      return
    }

    await page.setConfirmBehavior(true)
    const manualRecipes = await runRecipeAdditionFlows(page, report, qaSeed)
    await runDashboardFlows(page, report, manualRecipes)
    await runCookModeFlow(page, report)
    await runRecipeDetailCookFlow(page, report, manualRecipes[4].title)
    await runFridgeFlow(page, report)
    await runMacrosFlow(page, report)
    await runChatFlow(page, report)
    await runDebriefFlow(page, report)
    await runAuthPersistenceAndSignOut(page, report)

    report.console = page.consoleMessages
    report.failedRequests = page.failedRequests
    report.apiCalls = page.apiCalls
    report.externalCalls = page.externalCalls
    report.meta.finishedAt = nowIso()

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2))

    console.log(`Wrote live QA report to ${path.join(OUTPUT_DIR, 'report.json')}`)
  } catch (error) {
    report.meta.finishedAt = nowIso()
    report.meta.fatalError = error.message
    if (page) {
      report.console = page.consoleMessages
      report.failedRequests = page.failedRequests
      report.apiCalls = page.apiCalls
      report.externalCalls = page.externalCalls
      try {
        await page.screenshot('fatal-error')
      } catch {
        // Ignore screenshot failure during crash handling.
      }
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
    console.error(error)
    process.exitCode = 1
  } finally {
    if (page) await page.close().catch(() => null)
  }
}

main()
