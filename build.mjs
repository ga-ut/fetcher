//@ts-check
import pkg from "./package.json" with { type: "json" };

const external = [...Object.keys(pkg.devDependencies ?? {})];

await Promise.all([
	Bun.build({
		entrypoints: ["src/index.ts"],
		outdir: "dist",
		naming: "index.mjs",
		target: "browser",
		format: "esm",
		external,
	}),
	Bun.build({
		entrypoints: ["src/index.ts"],
		outdir: "dist",
		target: "browser",
		format: "cjs",
		external,
	}),
]);

Bun.spawnSync({
	cmd: [
		"bunx",
		"tsc",
		"--emitDeclarationOnly",
		"--project",
		"tsconfig.build.json",
	],
});

await Bun.write("dist/index.d.mts", "dist/index.d.ts");
