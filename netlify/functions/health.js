import { corsResponse, optionsResponse } from './auth-middleware.js'

// ── /api/health — system status check ────────────────────────
// Admin-only endpoint that checks all critical services and env vars

async function checkAnthropic(apiKey) {
  if (!apiKey) return { status: 'missing', model: null }
  try {
    const res  = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    })
    if (!res.ok) return { status: 'error', code: res.status, model: null }
    const { data: models } = await res.json()
    const best = (models || [])
      .map(m => m.id)
      .filter(id => id.includes('sonnet'))
      .sort((a, b) => b.localeCompare(a))[0] || null
    return { status: 'ok', model: best, count: models?.length }
  } catch (err) {
    return { status: 'error', error: err.message, model: null }
  }
}

async function checkGemini(apiKey) {
  if (!apiKey) return { status: 'missing', model: null }
  try {
    const res  = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    )
    if (!res.ok) return { status: 'error', code: res.status, model: null }
    const data = await res.json()
    const imageModels = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && m.name.includes('gemini'))
      .map(m => m.name.split('/').pop())
    return { status: 'ok', models: imageModels.slice(0, 3) }
  } catch (err) {
    return { status: 'error', error: err.message, model: null }
  }
}

async function checkPrintful(apiKey) {
  if (!apiKey) return { status: 'missing' }
  try {
    const res = await fetch('https://api.printful.com/store', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) return { status: 'error', code: res.status }
    const data = await res.json()
    return { status: 'ok', store: data.result?.name || 'Connected' }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

async function checkStripe(apiKey) {
  if (!apiKey) return { status: 'missing' }
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}` },
    })
    if (!res.ok) return { status: 'error', code: res.status }
    const data = await res.json()
    const available = data.available?.[0]
    return {
      status: 'ok',
      balance: available ? `$${(available.amount / 100).toFixed(2)} ${available.currency.toUpperCase()}` : 'Connected',
    }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

function checkEnvVar(name) {
  const val = process.env[name]
  if (!val) return { status: 'missing' }
  return { status: 'ok', preview: val.slice(0, 8) + '...' }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const start = Date.now()

  // Check all env vars
  const envVars = {
    ANTHROPIC_API_KEY:         checkEnvVar('ANTHROPIC_API_KEY'),
    GEMINI_API_KEY:            checkEnvVar('GEMINI_API_KEY'),
    PRINTFUL_API_KEY:          checkEnvVar('PRINTFUL_API_KEY'),
    STRIPE_SECRET_KEY:         checkEnvVar('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET:     checkEnvVar('STRIPE_WEBHOOK_SECRET'),
    VITE_SUPABASE_URL:         checkEnvVar('VITE_SUPABASE_URL'),
    VITE_SUPABASE_ANON_KEY:    checkEnvVar('VITE_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: checkEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  }

  // Check live services in parallel
  const [anthropic, gemini, printful, stripe] = await Promise.all([
    checkAnthropic(process.env.ANTHROPIC_API_KEY),
    checkGemini(process.env.GEMINI_API_KEY),
    checkPrintful(process.env.PRINTFUL_API_KEY),
    checkStripe(process.env.STRIPE_SECRET_KEY),
  ])

  // Generation speed is only affected by AI services — Printful/Stripe are commerce services
  // and their outages should not show "Slow" on image generation
  const genOk = anthropic.status === 'ok' && gemini.status === 'ok'
  const allOk = genOk
    && printful.status === 'ok'
    && stripe.status === 'ok'
    && Object.values(envVars).every(v => v.status === 'ok')

  // Granular status: ok | degraded (gen slow) | commerce_degraded (printful/stripe issue only)
  const status = genOk
    ? (allOk ? 'ok' : 'commerce_degraded')
    : 'degraded'

  return corsResponse({
    status,
    timestamp: new Date().toISOString(),
    responseMs: Date.now() - start,
    services: { anthropic, gemini, printful, stripe },
    envVars,
  })
}

export const config = { path: '/api/health' }
