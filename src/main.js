const FOLDER_NAME = 'PF2e Summoned creatures';
const moduleName = "pf2e-summons-helper";
const minionOwner = "Compendium.pf2e-summons-helper.summons-effect.Item.WZjCOL3vxDHGYPLf";
let socketlibSocket = undefined;
const unlimited = {"expiry": "turn-end", "sustained": false, "unit": "unlimited", "value": -1}


const MAX_LEVEL_SUMMON = {
    1: -1,
    2: 1,
    3: 2,
    4: 3,
    5: 5,
    6: 7,
    7: 9,
    8: 11,
    9: 13,
    10: 15,
}

const TRAITS_SUMMON = {
    'summon-undead': ['undead'],
    'summon-construct': ['construct'],
    'summon-fey': ['fey'],
    'summon-elemental': ['elemental'],
    'summon-dragon': ['dragon'],
    'summon-entity': ['aberration'],
    'summon-monitor': ['monitor'],
    'summon-fiend': ['fiend'],
    'summon-giant': ['giant'],
    'summon-celestial': ['celestial'],
    'summon-anarch': ['celestial', 'monitor', 'fiend'],
    'summon-axiom': ['celestial', 'monitor', 'fiend'],
    'summon-lesser-servitor': ['celestial', 'monitor', 'fiend'],
    'summon-plant-or-fungus': ['plant', 'fungus'],
    'summon-animal': ['animal'],
}

const SKIP = [
    "Compendium.pf2e.spells-srd.Item.xqmHD8JIjak15lRk",
    "Compendium.pf2e-playtest-data.impossible-playtest-spells.Item.77lglowVpcnRRh3g"//thrall
]


class SettingForm extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
) {
    constructor() {
        super({});
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: `${moduleName}-setting-form`,
        classes: [moduleName],
        window: {resizable: true},
        position: {width: 500, height: 400},
        actions: {},
        form: {
            handler: this.updateData,
            submitOnChange: false,
            closeOnSubmit: false
        },
    };

    static PARTS = {
        hbs: {
            template: `modules/${moduleName}/templates/setting.hbs`
        }
    };

    async _prepareContext(_options) {
        let context = await super._prepareContext(_options);

        let selectedPacks = game.settings.get(moduleName, "selectedPacks") || [];
        selectedPacks = selectedPacks.reduce((obj, item) => {
            obj[item.id] = item.isActive;
            return obj;
        }, {})

        let packs = game.packs.contents
            .filter(p => p.index.some(a => a.type === 'npc'))
            .map(p => {
                return {isActive: selectedPacks[p.metadata.id], id: p.metadata.id, name: p.metadata.label}
            })


        return {
            ...context,
            packs
        };
    }

    static async updateData(event, form, formData) {
        let keys = Object.keys(formData.object)

        let data = keys.map(k => {
            return {
                id: k,
                isActive: formData.object[k],
            }
        })

        await game.settings.set(moduleName, "selectedPacks", data)

        ui.notifications.info("Packs for summoning were updated");
    }
}

class BestiaryForm extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: `${moduleName}-creatures`,
        classes: [moduleName],
        window: {resizable: true, title: "Creatures"},
        position: {width: 500, height: 440},
        actions: {},
        form: {
            handler: this.updateData,
            submitOnChange: false,
            closeOnSubmit: false
        },
    };

    static PARTS = {
        hbs: {
            template: `modules/${moduleName}/templates/form.hbs`
        },
        footer: {
            template: `modules/${moduleName}/templates/summon-btn.hbs`,
            scrollable: [''],
        },
    };

    indexedData = []

    indexedFields = ["img", "system.traits.value", "system.traits.rarity", "system.details.level.value"];

    selectedTraits = [];

    owner;
    spell;
    maxLvl = -1;
    lvl = -1;
    onlyImage = false;

    constructor(options = {}) {
        super(options);
        this.owner = options.owner;
        this.spell = options.spell;
        this.maxLvl = options.maxLvl;
        this.lvl = options.maxLvl;
        this.selectedTraits = options.selectedTraits || [];

        this.indexedData = game.packs
            .filter(a => options.selectedPacks.includes(a.metadata.id))
            .map(p => p.getIndex({fields: this.indexedFields}))
    }

    async _prepareContext(_options) {
        let context = await super._prepareContext(_options);

        let indexedRow = (await Promise.all(this.indexedData)).map(c => c.contents).flat()
            .map(c => {
                const art = game.compendiumArt.get(c.uuid)?.actor ?? game.pf2e.system.moduleArt.map.get(c.uuid)?.img;
                c.img = art ?? c.img;
                return c;
            });

        let creatures = indexedRow
            .filter(c => c.type === 'npc')
            .filter(c => c.system.traits.rarity === 'common')
            .filter(a => a.system.details.level.value <= this.maxLvl && a.system.details.level.value >= this.lvl);

        if (this.selectedTraits.length > 0) {
            creatures = creatures.filter(c => this.selectedTraits.some(t => c.system.traits.value.includes(t)))
        }

        if (this.onlyImage) {
            creatures = creatures.filter(c => !c.img?.includes("systems/pf2e/icons/default-icons/npc.svg"));
        }

        creatures = creatures.sort((a, b) => {
            if (a.system.details.level.value > b.system.details.level.value) return 1;
            if (a.system.details.level.value < b.system.details.level.value) return -1;

            if (a.name > b.name) return 1;
            if (a.name < b.name) return -1;
            return 0;
        })

        return {
            ...context,
            traits: Object.entries(CONFIG.PF2E.creatureTraits).sort((a, b) => {
                if (a[0] > b[0]) return 1;
                if (a[0] < b[0]) return -1;
                return 0;
            }).map(t => {
                return {key: t[0], label: t[1]}
            }),
            creatures,
            selectedTraits: this.selectedTraits,
            maxLvl: this.maxLvl,
            lvl: this.lvl,
            onlyImage: this.onlyImage
        };
    }

    _attachPartListeners(partId, htmlElement, options) {
        const parentForm = this;
        let $html = $(htmlElement)

        $($html).on("input propertychange paste change", "#filter-name", function (_e) {
            const value = $(this).val().toLowerCase();
            const $ul = $($html).find(".data");
            const $li = $ul.find(".c-row");
            $li.hide();

            $li
                .filter(function () {
                    const text = $(this).text().toLowerCase();
                    return text.indexOf(value) >= 0;
                })
                .show();
        });

        $html.find('#filter-image').on('change', async function () {
            parentForm.onlyImage = !parentForm.onlyImage;
            await parentForm.render();
        });

        $html.find('#traits').on('change', async function () {
            parentForm.selectedTraits = $(this).closest('form').find("#traits").val();
            await parentForm.render();
        });

        $html.find('#max-level').on('change', async function () {
            parentForm.maxLvl = Number($(this).closest('form').find("#max-level").val());
            await parentForm.render();
        });

        $html.find('#level').on('change', async function () {
            parentForm.lvl = Number($(this).closest('form').find("#level").val());
            await parentForm.render();
        });

        $($html).on("click", ".c-row", function (_e) {
            $(this).closest('form').find(".c-row").removeClass('selected')

            $(this).addClass('selected')
        });

        $($html).on("dblclick", ".c-row", async function (e) {
            e.preventDefault();

            let uuid = $(this).data().uuid;
            let actor = (await fromUuid(uuid));
            actor.sheet.render(true)
        });
    }

    static async updateData(_event, form, formData) {
        let app = $(_event.currentTarget).closest('.pf2e-summons-helper')
        let uuid = $(_event.currentTarget).find('.selected').data('uuid')
        if (!uuid) {
            app.show();
            ui.notifications.info("Need to select minion");
            return;
        } else {
            app.hide();
        }
        await spawnMinion(uuid, this.spell, this.owner)
        this.close();
    }
}

let createChatMessage_1 = async (message, options, userId) => {
    if (!message.item?.isOfType('spell') || !message.item.traits.has('thrall')) {
        return
    }

    let folder = game.folders.find(f => f.name === FOLDER_NAME)?.id
    if (game.user.isGM) {
        if (!folder) {
            (await game.folders.documentClass.create({type: 'Actor', name: FOLDER_NAME}))?.id
        }
    }
    if (game.userId !== userId) {
        return
    }

    await createThrall(message)
};

let createChatMessage_2 = async (message, options, userId) => {
    if (!message.item?.isOfType('spell') || !message.item.traits.has('summon')) {
        return
    }
    let folder = game.folders.find(f => f.name === FOLDER_NAME)?.id
    if (game.user.isGM) {
        if (!folder) {
            (await game.folders.documentClass.create({type: 'Actor', name: FOLDER_NAME}))?.id
        }
    }
    if (game.userId !== userId) {
        return
    }
    if (SKIP.includes(message.item.sourceId)) {
        await phantasmalMinion(message)
        return
    }

    let selectedPacks = game.settings.get(moduleName, "selectedPacks")?.filter(i => i.isActive)?.map(i => i.id);
    if (!selectedPacks || selectedPacks.length === 0) {
        selectedPacks = game.packs.contents
            .filter(p => p.index.some(a => a.type === 'npc'))
            .map(p => p.metadata.id)
    }

    new BestiaryForm({
        owner: message.token,
        spell: message.item,
        maxLvl: MAX_LEVEL_SUMMON[message.item.level],
        selectedTraits: TRAITS_SUMMON[message.item.slug] || [],
        selectedPacks
    }).render(true)
};

//Mirror's Reflection
let preCreateChatMessage = async (message) => {
    if (!message.actor) {
        return
    }
    await mirrorsReflection(message);
    await manifestEidolon(message);
    await protectorTree(message);
    await timberSentinel(message);
};
const tree_id = `Compendium.pf2e-summons-helper.summons-actors.Actor.QqE1NLXmtnGBKv6H`;

async function timberSentinel(message) {
    if (message.item?.sourceId !== 'Compendium.pf2e.feats-srd.Item.aHlcMMNQ85VLK7QT') {
        return
    }

    let trees = message.token.scene.tokens
        .filter(t => t.actor?.flags?.[moduleName]?.owner === message.actor.uuid);

    for (let tree of trees) {
        await deleteToken(tree.scene.id, tree.id);
    }

    let spellLevel = Math.round(message.actor.level / 2);

    createProtectorTree(message, spellLevel);
}

function protectorTree(message) {
    if (message.item?.sourceId !== 'Compendium.pf2e.spells-srd.Item.K9gI08enGtmih5X1') {
        return
    }
    let spellLevel = message.item.level;
    createProtectorTree(message, spellLevel);
}

async function createProtectorTree(message, spellLevel) {
    let portal = new Portal()
        .addCreature(tree_id, {count: 1})
        .origin(message.token.object)
        .range(30);

    await portal.pick();

    let tokDoc = await portal.spawn();
    if (!tokDoc || !tokDoc[0]) {
        return
    }
    await socketlibSocket.executeAsGM("addOwnership", tokDoc[0].actor.uuid, message?.user?.id || game.userId);
    await tokDoc[0].actor.update({
        [`flags.${moduleName}.owner`]: message.actor.uuid,
        "system.details.alliance": message.actor.alliance,
        "system.attributes.hp.max": spellLevel * 10
    });
    await tokDoc[0].actor.update({"system.attributes.hp.value": spellLevel * 10});
}

async function mirrorsReflection(message) {
    if (message.item?.sourceId !== 'Compendium.pf2e.actionspf2e.Item.Mh4Vdg6gu8g8RAjh') {
        return
    }
    ui.notifications.info("Place token into another unoccupied space within 15 feet that you can see");

    let tokDoc = await (new Portal()
        .addCreature(message.actor, {count: 1})
        .range(15)
        .spawn());

    if (!tokDoc) {
        return
    }

    ui.notifications.info("Mirror's Reflection was summoned");
}

async function manifestEidolon(message) {
    if (message.item?.sourceId !== 'Compendium.pf2e.actionspf2e.Item.n5vwBnLSlIXL9ptp') {
        return
    }
    let eidolon = message.actor.flags['pf2e-eidolon-helper']?.eidolon
        ? game.actors.get(message.actor.flags['pf2e-eidolon-helper']?.eidolon)
        : undefined;
    if (!eidolon) {
        eidolon = await fromUuid(foundry.utils.getProperty(message.actor, `modules.pf2e-toolbelt.share.slaves`)?.[0]);
    }
    if (!eidolon) {
        let party = message.actor.parties.first();
        if (party) {
            eidolon = party.members.find(a => a.isOwner && a.class.slug === 'eidolon')
        }
    }

    if (!eidolon) {
        ui.notifications.info("Not found linked eidolon");
        return
    }
    ui.notifications.info("Place token into open space adjacent to you");

    let a = new Portal()
        .addCreature(eidolon, {count: 1})
        .spawn();

    let tokDoc = await a;
    if (!tokDoc) {
        return
    }

    ui.notifications.info("Eidolon was summoned");
}

async function phantasmalMinion(message) {
    if (message?.item?.sourceId !== "Compendium.pf2e.spells-srd.Item.xqmHD8JIjak15lRk") {
        return;
    }
    let uuid = "Compendium.pf2e.pathfinder-bestiary.Actor.j7NNPfZwD19BwSEZ";
    await spawnMinion(uuid, message.item, message.token)
}

async function createThrall(message) {
    if (
        message?.flags?.pf2e?.context?.type === 'spell-cast'
        || (message?.flags?.pf2e?.origin?.type === 'spell' && message?.flags?.pf2e?.context?.type === undefined)
    ) {
        if (message?.item?.sourceId === "Compendium.pf2e-playtest-data.impossible-playtest-spells.Item.77lglowVpcnRRh3g") {
            let uuid = "Compendium.pf2e-playtest-data.impossible-playtest-thralls.Actor.ISmLeI8zNc6YWysQ";
            await spawnMinion(uuid, message.item, message.token)
        } else if (message?.item?.sourceId === "Compendium.pf2e-playtest-data.impossible-playtest-spells.Item.kFkhtDYsR9fE0pAr") {
            let uuid = "Compendium.pf2e-playtest-data.impossible-playtest-thralls.Actor.SX5QACMD5SvH9oeZ";
            await spawnMinion(uuid, message.item, message.token)
        } else if (message?.item?.sourceId === "Compendium.pf2e-playtest-data.impossible-playtest-spells.Item.SK8vQklaSQGd5DXw") {
            let uuid = "Compendium.pf2e-playtest-data.impossible-playtest-thralls.Actor.CN6TMEeEd0Wmvkct";
            await spawnMinion(uuid, message.item, message.token)
        }
    }
}

async function spawnMinion(actorUuid, spell, owner) {
    if (!actorUuid) {
        return
    }
    let folder = game.folders.find(f => f.name === FOLDER_NAME)
    let existed = folder.contents.find(a => a.sourceId === actorUuid)
    if (!existed) {
        existed = await socketlibSocket.executeAsGM("addToFolder", actorUuid);
        existed = game.actors.get(existed._id)
    }

    let portal = new Portal();
    portal.addCreature(existed.uuid);

    let tokDoc = await portal.spawn();
    if (!tokDoc) {
        return
    }
    await socketlibSocket.executeAsGM("addOwnership", tokDoc[0].actor.uuid, game.userId);
    // await tokDoc[0].update({delta: existed.toObject()});
    await tokDoc[0].actor.update({"system.traits.value": [...tokDoc[0].actor.system.traits.value, "summoned"]})

    let dur = undefined
    if (spell.system.duration) {
        let newDur = foundry.utils.deepClone(unlimited)
        newDur.sustained = spell.system.duration.sustained || false;


        const regex = /([0-9]{1,}) ([a-z]{1,})/g;
        const array = [...spell.system.duration.value.matchAll(regex)];
        if (array?.length === 1) {
            newDur.unit = array[0][2].slice(-1) === 's' ? array[0][2] : array[0][2] + 's'
            newDur.value = parseInt(array[0][1])

            dur = newDur
        }
    }

    await addEffectToMinion(tokDoc[0].actor, minionOwner, owner, dur || foundry.utils.deepClone(unlimited));
}

let renderSettings = async (_app, html) => {
    let btn = foundry.utils.parseHTML(`
        <button data-action="pf2e-summons-helper">
            <i class="fa-solid fa-spaghetti-monster-flying"></i> Summon Helper Menu
        </button>
    `);
    btn.addEventListener('click', (_e) => {
        new SettingForm().render(true)
    })

    html
        .querySelector('#settings .documentation')
        ?.append(btn)
};

Hooks.once("init", () => {
    game.settings.register(moduleName, "selectedPacks", {
        name: "Selected packs",
        scope: "world",
        default: [],
        type: Array,
        config: false,
    });

    console.log(`${moduleName} was init`)
});

const setupSocket = () => {
    if (globalThis.socketlib) {
        socketlibSocket = globalThis.socketlib.registerModule(moduleName);
        socketlibSocket.register("updateMessage", updateMessage);
        socketlibSocket.register("deleteToken", deleteToken);
        socketlibSocket.register("addToFolder", addToFolder);
        socketlibSocket.register("addOwnership", addOwnership);
    }
    return !!globalThis.socketlib
}

async function addOwnership(actorUuid, userId) {
    let actor = await fromUuid(actorUuid);
    await actor.update({[`ownership.${userId}`]: 3})
}

async function addToFolder(uuid) {
    if (!uuid) {
        return;
    }
    let npc = await fromUuid(uuid)
    let obj = npc.toObject()
    obj.folder = game.folders.find(f => f.name === FOLDER_NAME).id
    obj.prototypeToken.randomImg = false

    return (await Actor.createDocuments([obj]))[0]
}

Hooks.once('setup', function () {
    if (!setupSocket()) console.error('Error: Unable to set up socket lib for PF2e Summons Helper')
});

async function deleteToken(scene, id) {
    if (!game.user.isGM) {
        socketlibSocket._sendRequest("deleteToken", [scene, id], 0)
        return
    }

    await game.scenes.get(scene)?.tokens?.get(id)?.delete()
}

async function updateMessage(id, content) {
    if (!game.user.isGM) {
        socketlibSocket._sendRequest("updateMessage", [id, content], 0)
        return
    }

    await game.messages.get(id)?.update({content})
}

Hooks.on("preDeleteItem", (ef) => {
    if (ef.sourceId !== minionOwner) {
        return
    }
    let t = ef.actor?.getActiveTokens(true, true)[0]
    if (t) {
        deleteToken(t.scene.id, t.id)
    }
})

Hooks.on('pf2e.startTurn', async (combatant) => {
    let allMinions = combatant.token.scene.tokens
        .filter(t => t?.actor?.itemTypes?.effect?.find(e => e.sourceId === 'Compendium.pf2e-summons-helper.summons-effect.Item.WZjCOL3vxDHGYPLf' && e?.system?.context?.origin?.actor === combatant.actor.uuid))

    let sustainedMinions = allMinions
        .filter(t => t?.actor?.itemTypes?.effect?.find(e => e.sourceId === 'Compendium.pf2e-summons-helper.summons-effect.Item.WZjCOL3vxDHGYPLf' && e?.system?.context?.origin?.actor === combatant.actor.uuid && e.system.duration.sustained))
        .map(tokDoc => {
            return {
                token: tokDoc.uuid,
                tokenName: tokDoc.name,
                img: tokDoc.texture.src
            }
        })

    if (sustainedMinions.length > 0) {
        createSustainMessage(combatant, sustainedMinions)
    }

    let minions = allMinions
        .filter(t => t?.actor?.itemTypes?.effect?.find(e => e.sourceId === 'Compendium.pf2e-summons-helper.summons-effect.Item.WZjCOL3vxDHGYPLf' && e?.system?.context?.origin?.actor === combatant.actor.uuid && !e.system.duration.sustained))
        .map(tokDoc => {
            return {
                token: tokDoc.uuid,
                tokenName: tokDoc.name,
                img: tokDoc.texture.src
            }
        })

    if (minions.length > 0) {
        ChatMessage.create({
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            content: `${combatant.name} has minions.<hr\> ${minions.map(a => a.tokenName).join(', ')}`
        });
    }
});

function createSustainMessage(combatant, minions) {
    const minionList = minions.map((m) => {
        return `
            <li data-token-id="${m.token}" data-owner-id="${combatant.actor.uuid}" class="minion-message-item"><img src="${m.img}" alt="">
                <span class="minion-li">
                    <span class="minion-li-text">${m.tokenName}</span>
                </span> &nbsp; &nbsp;
                <div class="btns">
                    <a class="dismiss-minion-item" title="Dismiss"><i class="fas fa-user-slash"></i>Dismiss</a>
                    <a class="sustain-minion-item" title="Dismiss"><i class="fas fa-user"></i>Sustain</a>
                </div>
            </li>`;
    });

    const content = `
        <div class="minion-message">
            <p>Sustain them or dismiss</p>
            <ul>${minionList.join("")}</ul>
        </div>
    `;

    ChatMessage.create({
        user: game.user.id,
        speaker: {alias: `${combatant.name} has sustained minions`},
        content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    });
}

async function addEffectToMinion(minion, uuid, owner, duration) {
    const aEffect = (await fromUuid(uuid)).toObject();
    aEffect.img = owner.texture.src;
    aEffect.name += owner.name;

    aEffect.system.context = {
        origin: {
            actor: owner?.actor?.uuid,
        }
    }
    aEffect.system.duration = duration;

    await minion.createEmbeddedDocuments("Item", [aEffect]);
}

$(document).on('click', '.minion-message-item', async function (event) {
    const item = $(this);
    const token = await fromUuid(item.data().tokenId);
    if (token) {
        game.canvas.pan({x: token.center.x, y: token.center.y})
        token.object.control({releaseOthers: !event.shiftKey});
    }
});

Hooks.on("renderChatMessage", async (message, html) => {
    html.find('.dismiss-minion-item').click(async (event) => {
        const item = $(event.target);
        const tokenUuid = item.parent().parent().data().tokenId;
        const ownerId = item.parent().parent().data().ownerId;
        const token = await fromUuid(tokenUuid);
        if (token) {
            if (!window?.warpgate) {
                await deleteToken(token.scene.id, token.id);
            } else {
                window?.warpgate?.dismiss(token.id);
            }
            item.closest('li').append(' was dismissed');
            item.closest('li').find('.btns').remove();

            if (ownerId) {
                const owner = await fromUuid(ownerId);
                if (owner) {
                    await owner.itemTypes.action.find(a => a.slug === 'dismiss')?.toMessage()
                }
            }
            await updateMessage(message.id, html.find('.minion-message')[0].outerHTML)
        }
    });
    html.find('.sustain-minion-item').click(async (event) => {
        const item = $(event.target);
        const tokenUuid = item.parent().parent().data().tokenId;
        const ownerId = item.parent().parent().data().ownerId;
        const token = await fromUuid(tokenUuid);
        if (token) {
            item.closest('li').append(' was sustained');
            item.closest('li').find('.btns').remove();

            if (ownerId) {
                const owner = await fromUuid(ownerId);
                if (owner) {
                    await owner.itemTypes.action.find(a => a.slug === 'sustain-a-spell')?.toMessage()
                }
            }

            await updateMessage(message.id, html.find('.minion-message')[0].outerHTML)
        }
    });
});

$(document).on('mouseenter', '.minion-message-item', async function () {
    const item = $(this);
    const token = await fromUuid(item.data().tokenId);
    if (token) {
        token.object._onHoverIn({}, {});
    }
});

$(document).on('mouseleave', '.minion-message-item', async function () {
    const item = $(this);
    const token = await fromUuid(item.data().tokenId);
    if (token) {
        token.object._onHoverOut({}, {});
    }
});

Hooks.once("init", () => {
    game.pf2esummonshelper = foundry.utils.mergeObject(game.pf2esummonshelper ?? {}, {
        "castRitual": castRitual,
    });
});

Hooks.on("renderSettings", renderSettings);
Hooks.on("preCreateChatMessage", preCreateChatMessage);
Hooks.on("createChatMessage", createChatMessage_1);
Hooks.on("createChatMessage", createChatMessage_2);


class RitualCreatureLvl {
    constructor(lvl, spellLvl, cost) {
        this.lvl = lvl;
        this.spellLvl = spellLvl;
        this.cost = cost;
    }
}

class RitualCheck {
    constructor(skill, rank, name) {
        this.skill = skill;
        this.name = name;
        this.rank = rank;
    }
}

class Ritual {
    constructor(slug, name, creatureLvl, primaryChecks, secondaryChecks) {
        this.slug = slug;
        this.name = name;
        this.creatureLvl = creatureLvl;
        this.primaryChecks = primaryChecks;
        this.secondaryChecks = secondaryChecks;
    }
}

const animateObject = new Ritual(
    'animate-object',
    'Animate Object',
    [
        new RitualCreatureLvl(-1, 2, 15),
        new RitualCreatureLvl(0, 2, 15),
        new RitualCreatureLvl(0, 2, 15),
        new RitualCreatureLvl(1, 2, 60),
        new RitualCreatureLvl(2, 3, 105),
        new RitualCreatureLvl(3, 3, 180),
        new RitualCreatureLvl(4, 4, 300),
        new RitualCreatureLvl(5, 4, 480),
        new RitualCreatureLvl(6, 5, 750),
        new RitualCreatureLvl(7, 5, 1080),
        new RitualCreatureLvl(8, 6, 1500),
        new RitualCreatureLvl(9, 6, 2100),
        new RitualCreatureLvl(10, 7, 3000),
        new RitualCreatureLvl(11, 7, 4200),
        new RitualCreatureLvl(12, 8, 6000),
        new RitualCreatureLvl(13, 8, 9000),
        new RitualCreatureLvl(14, 9, 13500),
        new RitualCreatureLvl(15, 9, 19500),
        new RitualCreatureLvl(16, 10, 30000),
        new RitualCreatureLvl(17, 10, 45000)
    ],
    [new RitualCheck('arcana', 2, 'Arcana (expert)')],
    [new RitualCheck('crafting', 0, 'Crafting')]
);

const ritualList = [
    animateObject,
];

// ritual: {gold, primaryChecks, secondaryChecks}
// validation -> mainCaster, secondaryCasters, ritual
async function castRitual(token, targets) {
    console.log(token);
    console.log(targets);
    ui.notifications.info("Feature under dev yet");

}