# Monorepo linked deps sync

## Release new version
When was changed `index.js` we need to perform next actions:
1. run `yarn build` - to build new github action artifact 
2. run `yarn release-tag` - to build new tag
3. run `sync-tag` - to sync just created new tag