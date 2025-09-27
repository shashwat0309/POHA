SBT (VerifiedUserSBT) – Quick Start
===================================

This folder contains a minimal Hardhat setup to deploy the non-transferable SBT used after Self verification.

Prerequisites
- Node 18+
- pnpm or npm

Install
```
cd sbt-contract
npm i
```

Configure .env
```
RPC_URL=<<testnet rpc>>         # e.g. https://sepolia.infura.io/v3/KEY or Celo Alfajores RPC
PRIVATE_KEY=<<deployer_private_key>>
```

Deploy
```
npx hardhat compile
npx hardhat run scripts/deploy.ts --network testnet
```

After deploy, set these in your Next.js app env and (optionally) enable minting in API route:
```
MINT_SBT=true
RPC_URL=<<same as above>>
PRIVATE_KEY=<<same as above>>
SBT_CONTRACT=<<deployed address>>
```

