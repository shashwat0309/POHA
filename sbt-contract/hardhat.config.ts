import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'

dotenv.config()

const RPC_URL = (process.env.RPC_URL || '').trim()
const PRIVATE_KEY = (process.env.PRIVATE_KEY || '').trim()

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    // Configure your preferred EVM testnet here
    testnet: {
      // Set via .env; example: https://sepolia.infura.io/v3/KEY or Celo Alfajores RPC
      url: RPC_URL || 'http://127.0.0.1:8545',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    mainnet: {
      // Set via .env; example: https://sepolia.infura.io/v3/KEY or Celo Alfajores RPC
      url: RPC_URL || 'http://127.0.0.1:8545',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    }
  },
}

export default config
