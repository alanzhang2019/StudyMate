// Empty module used as a replacement for `node:*` imports in the
// client-side webpack bundle.
//
// `pptxgenjs` (and other transitive client deps) internally do things
// like `import fs from 'node:fs'` for their Node-only code paths.
// webpack 5 doesn't know how to resolve the `node:` URI scheme and
// throws `UnhandledSchemeError: Reading from 'node:fs' is not handled
// by plugins`.
//
// The `NodeSchemeShimPlugin` in `next.config.ts` hooks
// `normalModuleFactory.beforeResolve` and rewrites every `node:*`
// request to this file. This is a noop CommonJS module — every property
// is `undefined`, so calls like `fs.readFile(...)` simply throw at
// runtime if they ever execute. In practice, the browser code path of
// these libraries never reaches those calls, so this is safe.
module.exports = {};
