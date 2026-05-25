/**
 * Smoke tests post-deploy.
 *
 * Validan la cadena crítica end-to-end contra producción (o staging):
 *   1. Login real con usuario e2e (NO service-role — debe pasar por auth+RLS reales)
 *   2. Dashboard renderiza
 *   3. /abal-plus carga al menos un cliente
 *
 * Variables requeridas:
 *   BASE_URL                       — URL de Vercel (p.ej. https://crm-abal.vercel.app)
 *   SUPABASE_E2E_USER_EMAIL        — usuario dedicado de pruebas (rol gerente)
 *   SUPABASE_E2E_USER_PASSWORD     — password del usuario
 *
 * Anti-pattern: NUNCA usar SUPABASE_SERVICE_ROLE_KEY en estos tests. Bypassaría
 * RLS y nos daría false positives. El objetivo es validar el flujo real.
 */
import { test, expect } from '@playwright/test'

const EMAIL = process.env.SUPABASE_E2E_USER_EMAIL ?? ''
const PASSWORD = process.env.SUPABASE_E2E_USER_PASSWORD ?? ''

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Faltan SUPABASE_E2E_USER_EMAIL y/o SUPABASE_E2E_USER_PASSWORD. ' +
        'Configurar como secrets de GitHub Actions.',
    )
  }
})

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('input#email').fill(EMAIL)
  await page.locator('input#password').fill(PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

test('@smoke login + dashboard renderiza', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('@smoke /abal-plus carga ranking de tiers', async ({ page }) => {
  await login(page)
  await page.goto('/abal-plus')
  await expect(page.getByRole('heading', { name: /ABAL\+ Tiers/i })).toBeVisible({
    timeout: 10_000,
  })
})

test('@smoke /kpis renderiza', async ({ page }) => {
  await login(page)
  await page.goto('/kpis')
  // KPIs page existe (src/pages/kpis/KpisPage.tsx) — basta con confirmar que no rompe la app
  await expect(page).toHaveURL(/\/kpis$/)
  await expect(page.locator('body')).not.toContainText(/Error|404/i, { timeout: 5_000 })
})
