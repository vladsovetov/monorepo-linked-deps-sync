# Monorepo linked deps sync

This action linking internal dependencies inside monorepo npm project.

## Inputs

## `packages-path`

Glob path to `package.json` in each of your package. Default `"packages/**/package.json"`.

## `sync-commit-message`

Git commit message after all the versions were synced. Default `"chore: synced versions for linked packages"`.

## `sync-commit-email`

Author's email for git commit message after all the versions were synced. Default `"bot@monorepo-linked-deps-sync.io"`.

## `sync-commit-name`

Author's name for git commit message after all the versions were synced. Default `"Bot Monorepo Linked Deps Sync"`.

## Example usage

uses: actions/monorepo-linked-deps-sync@v1.0