# Release

`release.yml` is the maintainer path for npm distribution artifacts.

## Dry run

```bash
gh workflow run release.yml -f publish=false -f publish_ghcr=false
```

The dry run (`verify` job) runs, in order: `npm run lint`, `npm run release:check` (version metadata across `package.json`, skill files, `.patina.default.yaml`, README, CHANGELOG, plus the retired-concepts scan), `npm test`, `npm run benchmark:report` and `npm run benchmark:compare` with a checked-in `docs/benchmarks` drift check, `npm run dogfood`, `npm run check:no-private-assets`, and `npm pack --dry-run` for both `patina-cli` and the `patina-humanizer` alias package.

## Publish

Publishing the npm packages is intended for `v*.*.*` tags:

```bash
VERSION=v8.2.0
git tag "$VERSION"
git push origin "$VERSION"
```

Required secret:

- `NPM_TOKEN` for npm provenance publishing.

On a tag push the workflow:

- publishes `patina-cli` and the `patina-humanizer` alias to npm (`npm` job);
- creates the GitHub Release from the CHANGELOG entry (`github-release` job).

Docker / GHCR publishing is decoupled from tag pushes: the `ghcr` job runs only
on `workflow_dispatch` with `publish_ghcr=true`. Manual publication must run from
`main` and publishes `latest`; the current workflow does not emit a semver tag
from that branch (see [docker.md](docker.md)):

```bash
gh workflow run release.yml --ref main -f publish=false -f publish_ghcr=true
```
