import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Lazy load to avoid edge/SSR bundling issues when deps not installed
async function getVerifier() {
  // @ts-ignore
  const core = await import('@selfxyz/core').catch(() => null as any)
  if (!core) throw new Error('Missing @selfxyz/core. Run: npm i @selfxyz/core')
  const { SelfBackendVerifier, DefaultConfigStore, AllIds } = core as any

  const scope = process.env.NEXT_PUBLIC_SELF_SCOPE || 'poha-swap'
  const publicEndpoint = process.env.NEXT_PUBLIC_SELF_ENDPOINT || ''
  const isMainnet = process.env.SELF_MAINNET === 'true'

  const config = new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: ['IRN', 'PRK', 'RUS', 'SYR'],
    ofac: true,
  })

  const verifier = new SelfBackendVerifier(scope, publicEndpoint, isMainnet, AllIds, config, 'hex')
  return verifier
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { attestationId, proof, publicSignals, userContextData } = body || {}
    if (!attestationId || !proof || !publicSignals || !userContextData) {
      return NextResponse.json({ status: 'error', result: false, reason: 'Missing required fields' })
    }

    const verifier = await getVerifier()
    const result = await verifier.verify(attestationId, proof, publicSignals, userContextData)

    const { isValid, isMinimumAgeValid, isOfacValid } = result?.isValidDetails || {}
    if (!isValid || !isMinimumAgeValid || !isOfacValid) {
      let reason = 'Verification failed'
      if (!isMinimumAgeValid) reason = 'Minimum age not met'
      if (!isOfacValid) reason = 'OFAC check failed'
      return NextResponse.json({ status: 'error', result: false, reason })
    }

    // Optional: Mint SBT after success (requires env vars and ethers)
    const shouldMint = process.env.MINT_SBT === 'true'
    // Mainnet defaults: Celo Forno endpoint. Contract address must be provided via env.
    const DEFAULT_RPC_URL = 'https://forno.celo.org'
    const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL
    const sbtAddress = process.env.SBT_CONTRACT || ''
    if (shouldMint && rpcUrl && process.env.PRIVATE_KEY && sbtAddress) {
      try {
        const { ethers } = await import('ethers')
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
        const abi = [
          'function mint(address to) external',
        ]
        const contract = new ethers.Contract(sbtAddress, abi, wallet)
        const user = (result as any)?.userData?.userIdentifier
        if (user) {
          const tx = await contract.mint(user)
          await tx.wait()
        }
      } catch (e) {
        console.warn('Mint SBT failed:', e)
      }
    } else if (shouldMint && !sbtAddress) {
      console.warn('SBT minting enabled but SBT_CONTRACT is not set. Skipping mint.')
    }

    return NextResponse.json({ status: 'success', result: true })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', result: false, reason: e?.message || 'Unknown error' })
  }
}
