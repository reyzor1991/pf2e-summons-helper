import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";

let files_for_copy = ['CHANGELOG.md', 'README.md', 'LICENSE', 'module.json', 'pf2e-summons-helper.css']

for (let f of files_for_copy) {
    fs.copyFileSync(f, `dist/${f}`);
}

copyDir('./static', './dist');


async function copyDir(srcDir: string, destDir: string) {
    try {
        await fsp.mkdir(destDir, { recursive: true });

        // Read all files and directories in source
        const entries = await fsp.readdir(srcDir, {withFileTypes: true});
        console.log(entries);

        for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            if (entry.isDirectory()) {
                // Recursively copy subdirectory
                await copyDir(srcPath, destPath);
            } else {
                // Copy file
                await fsp.copyFile(srcPath, destPath);
            }
        }

        console.log(`Copied ${srcDir} → ${destDir}`);
    } catch (err) {
        console.error(`Error copying directory: ${err.message}`);
    }
}