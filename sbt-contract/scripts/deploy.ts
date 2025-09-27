import hre from 'hardhat'

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  if (!deployer) {
    throw new Error('No signer available. Set PRIVATE_KEY in sbt-contract/.env and try again.')
  }
  console.log('Deploying with:', deployer.address)

  const F = await hre.ethers.getContractFactory('VerifiedUserSBT')
  const c = await F.deploy()
  await c.waitForDeployment()

  console.log('VerifiedUserSBT deployed at:', await c.getAddress())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
