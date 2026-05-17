// Compiles one or more images into a MindAR .mind target file.
// Usage: node scripts/compile-marker.mjs <output.mind> <input-image> [<input-image> ...]
// Target index in the .mind file matches input order on the command line.
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js'
import { loadImage } from 'canvas'
import { writeFileSync } from 'node:fs'

const [, , output, ...inputs] = process.argv
if (!output || inputs.length === 0) {
  console.error(
    'Usage: node scripts/compile-marker.mjs <output.mind> <input-image> [<input-image> ...]',
  )
  process.exit(1)
}

const images = await Promise.all(inputs.map((p) => loadImage(p)))
console.log(`Compiling ${images.length} target(s) into ${output}...`)
const compiler = new OfflineCompiler()
await compiler.compileImageTargets(images, (p) => process.stdout.write(`\r${p.toFixed(1)}%`))
writeFileSync(output, Buffer.from(compiler.exportData()))
console.log(`\nWrote ${output}`)
inputs.forEach((p, i) => console.log(`  [${i}] ${p}`))
