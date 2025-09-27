// Launch ngrok and start Next.js dev with the public URL injected.
import { connect } from '@ngrok/ngrok'
import { spawn } from 'node:child_process'

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000

  // If NGROK_URL is provided, skip creating a tunnel and use it directly.
  // Otherwise, start an ngrok tunnel. If NGROK_DOMAIN is set, request that domain.
  const fixedUrl = process.env.NGROK_URL
  const listener = fixedUrl
    ? null
    : await connect({
        addr: port,
        authtoken_from_env: true,
        // If you have a reserved domain, set NGROK_DOMAIN to use it
        domain: process.env.NGROK_DOMAIN,
      })
  const publicUrl = fixedUrl || listener.url()

  const endpoint = `${publicUrl}/api/verify`

  // Inherit parent env, override the public vars for Next.js
  const env = {
    ...process.env,
    NEXT_PUBLIC_BASE_URL: publicUrl,
    NEXT_PUBLIC_SELF_ENDPOINT: endpoint,
  }

  console.log('[ngrok] Public URL:', publicUrl)
  console.log('[ngrok] NEXT_PUBLIC_SELF_ENDPOINT:', env.NEXT_PUBLIC_SELF_ENDPOINT)
  console.log('[ngrok] Starting Next.js dev on port', port)

  // Use pnpm workspace filter to run the app in ./src
  const child = spawn('pnpm', ['--filter', './src', 'dev'], {
    stdio: 'inherit',
    env,
  })

  child.on('exit', (code) => {
    console.log(`[dev] exited with code ${code}`)
    // Close the ngrok listener when dev exits
    try { listener?.close() } catch {}
    process.exit(code ?? 0)
  })
}

main().catch((err) => {
  console.error('[ngrok] Failed to start tunnel:', err?.message || err)
  process.exit(1)
})
