import * as esbuild from 'esbuild'
import {copyToAppPlugin, copyManifestPlugin, commonConfig} from "./build.helpers.mjs"
import parseArgs from "minimist"

const outDir = `dist/FavoriteDocs`
const appDir = "C:\\Mendix\\ExtTest"
const extensionDirectoryName = "extensions"

const entryPoints = [
    { in: 'src/main/index.ts', out: 'main' },
    { in: 'src/ui/pane.tsx', out: 'pane' },
]

const args = parseArgs(process.argv.slice(2))
const buildContext = await esbuild.context({
    ...commonConfig,
    outdir: outDir,
    external: [
        ...commonConfig.external,
        "node:child_process",
    ],
    plugins: [copyManifestPlugin(outDir), copyToAppPlugin(appDir, outDir, extensionDirectoryName)],
    entryPoints,
})

if ('watch' in args) {
    await buildContext.watch();
} else {
    await buildContext.rebuild();
    await buildContext.dispose();
}
