# Nuxt Route Diff

Compare two Nuxt pages directories before merging a branch. The report shows added and removed URL patterns, changes to the files behind existing routes, and possible matcher collisions.

## Run

Use Node.js 22 or newer. Run these commands from this directory with paths to an actual pages directory in each checkout.

```sh
node bin/route-diff.mjs scan ../app/app/pages
node bin/route-diff.mjs diff ../before/app/pages ../after/app/pages
node bin/route-diff.mjs diff ../before/app/pages ../after/app/pages --markdown
node bin/route-diff.mjs diff ../before/app/pages ../after/app/pages --json --check
```

Use `--markdown` for a pull request or `--json` for scripts. With `--check`, a change or possible collision in the new tree returns exit code 1. Invalid arguments and filesystem errors return 2.

## Example

```text
Added (1)
  /settings  ←  settings/index.vue

Changed sources (1)
  /about  ←  about.vue  →  (marketing)/about.vue

Possible collisions (1)
  /users/:_  ←  (main)/users/[id].vue, (public)/users/[slug].vue
```

## Scope

The scanner reads filenames. It supports index pages, nested routes, route groups, named-view siblings, and required, optional, and catch-all parameters. It flags equal matcher shapes. Review runtime routing changes such as custom paths, aliases, and module-generated pages with Nuxt itself. [Nuxt pages documentation](https://nuxt.com/docs/4.x/directory-structure/app/pages)

Run `npm test` for fixture-based CLI and routing tests.
