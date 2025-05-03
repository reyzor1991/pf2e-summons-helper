import esbuild from "esbuild";

esbuild.build({
    entryPoints: ["src/main.js"],
    outfile: "dist/pf2e-summons-helper.mjs",
    bundle: true,
    format: "esm", // Output as ES module
    platform: "node",
    target: "es2022",
    sourcemap: false,
    minify: true
}).catch(() => process.exit(1));