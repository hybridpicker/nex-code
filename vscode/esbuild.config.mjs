import * as esbuild from "esbuild";
import { argv } from "process";

const watch = argv.includes("--watch");

// Extension host bundle (CommonJS, Node.js)
const extCtx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  format: "cjs",
  platform: "node",
  target: "node18",
  external: ["vscode"],
  sourcemap: true,
  minify: false,
});

// Webview bundle (ESM, browser)
const webCtx = await esbuild.context({
  entryPoints: ["webview/main.ts"],
  bundle: true,
  outfile: "out/webview.js",
  format: "esm",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  minify: false,
});

if (watch) {
  await extCtx.watch();
  await webCtx.watch();
  console.log("Watching...");
} else {
  await extCtx.rebuild();
  await extCtx.dispose();
  await webCtx.rebuild();
  await webCtx.dispose();
  console.log("Build complete.");
}
