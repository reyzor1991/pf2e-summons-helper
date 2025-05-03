import { compilePack } from "@foundryvtt/foundryvtt-cli";

// Compile a LevelDB compendium pack.
await compilePack("packs/effects", "dist/packs/effects");
await compilePack("packs/macros", "dist/packs/macros");
