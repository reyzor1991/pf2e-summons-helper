import {extractPack} from "@foundryvtt/foundryvtt-cli";

// Extract a NeDB compendium pack.
let documentType = "Item"
await extractPack("packs/summons-effect.db", "packs/effects/", {nedb: true, documentType: "Item"});
await extractPack("packs/summons-macros.db", "packs/macros/", {nedb: true, documentType: "Macro"});
