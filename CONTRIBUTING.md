# Monorepo linked deps sync

## Update
To update the action we should modify `index.js`. Before commiting the change we also should bump version in `package.json`.
And then commit following [commit convention](https://www.conventionalcommits.org/en/v1.0.0/)

## Release new version
When we have some commits and want to release a new version we should to perform next actions:
1. run `yarn build` - to build new github action artifact
2. commit the change following [commit convention](https://www.conventionalcommits.org/en/v1.0.0/)
3. run `yarn release-tag` - to build new tag
4. run `sync-tag` - to sync just created new tag