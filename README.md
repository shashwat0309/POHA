<h1 align="center">POHA Agent</h1>

POHA Agent is an on‑chain assistant that plans and executes actions for users: connect wallet, optionally verify identity (SELF), perform token swaps, bridge assets across chains, and route configurable fees to a treasury. Users express intents via voice or text (e.g., “bridge 20 USDC to Optimism and notify me when done”), and the agent handles routing, approvals, transactions, and monitoring.

Data sources
- We collect quotes, routes, prices, and status updates from DEX aggregators and bridge providers. The app selects robust providers and falls back on errors to deliver reliable execution.

Project guide
- See `docs/README.md` for end-to-end agent flows, diagrams, prompts, and prize-track alignment (ENS, SELF, PayPal).

Quick start
- Copy `.env.example` to `.env` and fill required values (`OPENAI_API_KEY`, `RPC_URL`, `PRIVATE_KEY`, `SBT_CONTRACT`, `NEXT_PUBLIC_TREASURY_ADDRESS`).
- Install dependencies and run the app:

```bash
pnpm install
pnpm dev
```

Contracts (SBT)
- Minimal Hardhat project is in `sbt-contract/`. Configure `RPC_URL` and `PRIVATE_KEY` in root `.env`, then deploy with:

```bash
cd sbt-contract
npx hardhat compile
npx hardhat run scripts/deploy.ts --network testnet
```

License
- See `LICENSE`.
