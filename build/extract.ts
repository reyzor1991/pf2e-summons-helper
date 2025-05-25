import {extractPack} from "@foundryvtt/foundryvtt-cli";

// Extract a NeDB compendium pack.
await extractPack("packs/summons-effect.db", "packs/effects/", {nedb: true, documentType: "Item"});
await extractPack("packs/summons-macros.db", "packs/macros/", {nedb: true, documentType: "Macro"});
await extractPack("packs/summons-actors.db", "packs/actors/", {nedb: true, documentType: "Actor"});
