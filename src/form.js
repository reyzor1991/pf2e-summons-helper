const FOLDER_NAME = 'PF2e Summoned creatures';

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

class BestiaryForm extends FormApplication {

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

    async getData() {
        let creatures = (await Promise.all(this.indexedData)).map(c => c.contents).flat()
            .filter(c => c.type === 'npc')
            .filter(c => c.system.traits.rarity === 'common')
            .filter(a => a.system.details.level.value <= this.maxLvl && a.system.details.level.value >= this.lvl);
        if (this.selectedTraits.length > 0) {
            creatures = creatures.filter(c => this.selectedTraits.some(t => c.system.traits.value.includes(t)))
        }

        creatures = creatures.map(c => {
            const actorArt = game.compendiumArt.get(c.uuid)?.actor ?? game.pf2e.system.moduleArt.map.get(c.uuid)?.img;
            if (actorArt) {
                c.img = actorArt;
            }
            return c;
        });

        if (this.onlyImage) {
            creatures = creatures.filter(c => c.img !== 'systems/pf2e/icons/default-icons/npc.svg');
        }

        creatures = creatures.sort((a, b) => {
            if (a.system.details.level.value > b.system.details.level.value) return 1;
            if (a.system.details.level.value < b.system.details.level.value) return -1;

            if (a.name > b.name) return 1;
            if (a.name < b.name) return -1;
            return 0;
        })

        return foundry.utils.mergeObject(super.getData(), {
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
        });
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "Creatures",
            id: `${moduleName}-creatures`,
            classes: [moduleName],
            template: `modules/${moduleName}/templates/form.hbs`,
            width: 500,
            height: 440,
            closeOnSubmit: true,
            submitOnChange: false,
            resizable: true,
            dragDrop: [],
        });
    }

    activateListeners($html) {
        super.activateListeners($html);
        const parentForm = this;

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

    async _updateObject(_event) {
        let app = $(_event.target).closest('.pf2e-summons-helper')
        app.hide();
        let uuid = $(_event.target).find('.selected').data('uuid')

        await spawnMinion(uuid, this.spell, this.owner)

        app.show();
    }
}

async function addToFolder(uuid) {
    let npc = await fromUuid(uuid)
    let obj = npc.toObject()
    obj.folder = game.folders.find(f => f.name === FOLDER_NAME).id
    obj.prototypeToken.randomImg = false

    return (await Actor.createDocuments([obj]))[0]
}

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

Hooks.on("createChatMessage", async (message, options, userId) => {
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
});

Hooks.on("createChatMessage", async (message, options, userId) => {
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
});

//Mirror's Reflection
Hooks.on("preCreateChatMessage", async (message) => {
    if (!message.actor) {
        return
    }
    await mirrorsReflection(message);
    await manifestEidolon(message);
});

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
    if (message?.item?.sourceId !== "Compendium.pf2e-playtest-data.impossible-playtest-spells.Item.77lglowVpcnRRh3g") {
        return;
    }
    let uuid = "Compendium.pf2e-playtest-data.impossible-playtest-thralls.Actor.ISmLeI8zNc6YWysQ";
    await spawnMinion(uuid, message.item, message.token)
}

async function spawnMinion(actorUuid, spell, owner) {
    let folder = game.folders.find(f => f.name === FOLDER_NAME)
    let existed = folder.contents.find(a => a.sourceId === actorUuid)
    if (!existed) {
        existed = await socketlibSocket.executeAsGM("addToFolder", actorUuid);
        existed = game.actors.get(existed._id)
    }

    let portal = new Portal();
    portal.addCreature(existed.uuid, {
        count: 1,
        updateData: {
            actor: {
                ownership: {[game.userId]: 3},
            }
        }
    });

    let tokDoc = await portal.spawn();
    if (!tokDoc) {
        return
    }
    await tokDoc[0].update({delta: existed.toObject()});
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

Hooks.on("renderSettings", async (_app, html) => {
    let btn = $(`
        <button data-action="pf2e-summons-helper">
            <i class="fa-solid fa-spaghetti-monster-flying"></i> Summon Helper Menu
        </button>
    `);
    btn.on('click', (_e) => {
        new SettingForm().render(true)
    })

    html
        .find('#settings-documentation')
        .append(btn)
});