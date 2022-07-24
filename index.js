const core = require('@actions/core')
const glob = require('glob')
const fs = require('fs')
const { exec } = require('child_process')

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
 * @type {{path: string, json: PackageJson, text: string}}
 */

/**
 * @typedef InconsistentPackageJson
 * @type {PackageJsonInfo & {reasons: {name: string, oldVersion: string, newVersion: string}[]}}
 */

try {
  const startTime = Date.now()
  const packagesPath = core.getInput('packages-path')
  const syncCommitMessage = core.getInput('sync-commit-message')
  const syncCommitEmail = core.getInput('sync-commit-email')
  const syncCommitName = core.getInput('sync-commit-name')
  const commitArguments = core.getInput('commit-arguments')
  glob(
    packagesPath,
    {
      ignore: '**/node_modules/**'
    },
    function (er, files) {
      console.log(
        `Found package.json files: ${JSON.stringify(files, null, '  ')}`
      )
      if (er) {
        core.setFailed(
          `Can not find files using provided glob ${packagesPath}: ${er.message}`
        )
      }
      const packages = getPackageInfos(files)
      const inconsistentPackages = findInconsistencies(packages)
      console.log(
        `Found inconsistencies: ${JSON.stringify(
          inconsistentPackages.map(({ path, reasons }) => ({ path, reasons })),
          null,
          '  '
        )}`
      )
      if (inconsistentPackages.length) {
        fixInconsistencies(inconsistentPackages)
        exec(
          `
          git config user.email "${syncCommitEmail}" &&
          git config user.name "${syncCommitName}" &&
          git commit -am "${syncCommitMessage}" ${commitArguments} &&
          git push
          `,
          (err, stdout, stderr) => {
            if (err) {
              core.setFailed(err.message)
            }
            console.log(`stdout: ${stdout}`)
            console.log(`stderr: ${stderr}`)
          }
        )
      } else {
        console.log(`No inconsistencies`)
      }
    }
  )
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
      packageJson = fs.readFileSync(packagePath, { encoding: 'utf-8' })
    } catch (error) {
      core.setFailed(`Can not read/parse ${packagePath}: ${error.message}`)
    }
    packages.push({
      json: JSON.parse(packageJson),
      text: packageJson,
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
  for (const masterPackage of packages) {
    for (const linkedPackage of packages) {
      if (masterPackage.path === linkedPackage.path) continue

      for (const depType of ['dependencies', 'devDependencies']) {
        if (!linkedPackage.json[depType]) continue

        const foundVersionInconsistency = Object.entries(
          linkedPackage.json[depType]
        ).find(([name, version]) => {
          if (typeof version !== 'string') return false

          return (
            name === masterPackage.json.name &&
            !version.includes(masterPackage.json.version)
          )
        })
        if (foundVersionInconsistency) {
          const newVersion = foundVersionInconsistency[1].replace(
            /[\d.]+/,
            masterPackage.json.version
          )
          console.log(
            `Found inconsistency in ${linkedPackage.path}: ${masterPackage.json.name} ${foundVersionInconsistency[1]} -> ${newVersion}`
          )
          inconsistentPackages.push({
            ...linkedPackage,
            reasons: [
              {
                name: masterPackage.json.name,
                oldVersion: foundVersionInconsistency[1],
                newVersion
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
    let content = inconsistentPackage.text
    for (const reason of inconsistentPackage.reasons) {
      content = content.replace(
        new RegExp(
          `("${reason.name}"\\s*:\\s*)"${maskVersionRegExp(reason.oldVersion)}"`
        ),
        `$1"${reason.newVersion}"`
      )
    }
    try {
      fs.writeFileSync(inconsistentPackage.path, content, 'utf8')
    } catch (error) {
      core.setFailed(
        `Can not write synced versions into ${inconsistentPackage.path}: ${error.message}`
      )
    }
  }
}

/**
 *
 * @param {string} version
 * @returns {string}
 */
function maskVersionRegExp(version) {
  return version.replace('^', '\\^')
}
