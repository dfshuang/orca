const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const base = require('./electron-builder.config.cjs')

const appId = 'com.dfshuang.orca.personal'
const productName = 'Orca Personal'

module.exports = {
  ...base,
  appId,
  productName,
  protocols: [{ name: productName, schemes: ['orca-personal'] }],
  extraMetadata: {
    name: 'orca-personal',
    productName,
    version: process.env.ORCA_LOCAL_BUILD_VERSION
  },
  publish: null,
  mac: {
    ...base.mac,
    identity: '-',
    target: [{ target: 'zip', arch: ['arm64'] }]
  },
  afterPack: async (context) => {
    await base.afterPack(context)
    const metadataPath = join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
      'Contents',
      'Resources',
      'orca-local-build.json'
    )
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
    writeFileSync(metadataPath, `${JSON.stringify({ ...metadata, appId }, null, 2)}\n`)
  }
}
