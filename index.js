const core = require('@actions/core')
const glob = require('glob')
const fs = require('fs')

/**
 * @typedef PackageDependency
 * @type {Object.<string, string>}
 */

/**
 * @typedef PackageJson
 * @type {{name: string, version: string, dependencies: PackageDependency[], devDependencies: PackageDependency[] }}
 */

/**
 * @typedef PackageJsonInfo
 * @type {{path: string, json: PackageJson}}
 */

/**
 * @typedef InconsistentPackageJson
 * @type {PackageJsonInfo & {reasons: {name: string, oldVersion: string, newVersion: string}[]}}
 */

try {
  const startTime = Date.now()
  const packagesPath = core.getInput('packages-path')
  glob([packagesPath, '!node_modules'], {}, function (er, files) {
    if (er) {
      core.setFailed(
        `Can not find files using provided glob ${packagesPath}: ${er.message}`
      )
    }
    const packages = getPackageInfos(files)
    const inconsistentPackages = findInconsistencies(packages)
    fixInconsistencies(inconsistentPackages)
  })
  console.log(`Finished in ${Date.now() - startTime}ms`)
} catch (error) {
  core.setFailed(error.message)
}

/**
 * @param {string[]} packagePaths
 * @return {PackageJsonInfo[]}
 */
function getPackageInfos(packagePaths) {
  /**
   * @type { PackageJsonInfo[] }
   */
  const packages = []
  for (const packagePath of packagePaths) {
    /**
     * @type {PackageJson}
     */
    let packageJson
    try {
      packageJson = JSON.stringify(
        fs.readFileSync(packagePath, { encoding: 'utf-8' })
      )
    } catch (error) {
      core.setFailed(`Can not read/parse ${packagePath}: ${error.message}`)
    }
    packages.push({
      json: packageJson,
      path: packagePath
    })
  }

  return packages
}

/**
 * @param {PackageJsonInfo[]} packages
 * @return {InconsistentPackageJson[]}
 */
function findInconsistencies(packages) {
  /**
   * @type {InconsistentPackageJson[]}
   */
  const inconsistentPackages = []
  for (let i = 0; i < packages.length; i++) {
    const masterPackage = packages[i]
    for (let j = i + 1; j < packages.length; j++) {
      const linkedPackage = packages[j]
      for (const depType of ['dependencies', 'devDependencies']) {
        const foundVersionInconsistency = Object.entries(
          linkedPackage[depType]
        ).find(
          ({ name, version }) =>
            name === masterPackage.name && version !== masterPackage.version
        )
        if (foundVersionInconsistency) {
          console.log(
            `Found inconsistency in ${linkedPackage.path}: ${masterPackage.name} ${masterPackage.version} -> ${foundVersionInconsistency[1]}`
          )
          inconsistentPackages.push({
            ...linkedPackage,
            reasons: [
              {
                name: masterPackage.name,
                newVersion: masterPackage.version,
                oldVersion: foundVersionInconsistency[1]
              }
            ]
          })
          break
        }
      }
    }
  }

  return inconsistentPackages
}

/**
 * @param {InconsistentPackageJson[]} inconsistentPackages
 */
function fixInconsistencies(inconsistentPackages) {
  for (const inconsistentPackage of inconsistentPackages) {
    let content = inconsistentPackage.json
    for (const reason of inconsistentPackage.reasons) {
      content = content.replace(
        new RegExp(
          `("${inconsistentPackage.name}"\\s*:\\s*)"${reason.oldVersion}"`
        ),
        `"$1"${reason.newVersion}"`
      )
    }
    try {
      fs.writeSync(inconsistentPackage.path, content, 'utf8')
    } catch (error) {
      core.setFailed(
        `Can not write synced versions into ${inconsistentPackage.path}: ${error.message}`
      )
    }
  }
}
