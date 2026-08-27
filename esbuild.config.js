const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const entryPoints = ["src/content.ts", "src/background.ts", "src/popup.ts"];

const options = {
  entryPoints,
  bundle: true,
  outdir: "dist",
  target: "chrome110",
  format: "iife",
  sourcemap: true,
  logLevel: "info",
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(options);
  }
}

run().catch(() => process.exit(1));
