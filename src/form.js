const FOLDER_NAME = 'PF2e Summoned creatures';

class BestiaryForm extends FormApplication {

    indexedData = []

    indexedFields = ["img", "system.traits.value", "system.details.level.value"];

    selectedTraits = [];

    owner;
    spell;
    maxLvl = -1;
    lvl = -1;

    constructor(options = {}) {
        super(options);
        this.owner = options.owner;
        this.spell = options.spell;
        this.maxLvl = options.maxLvl;
        this.lvl = options.maxLvl;
        this.selectedTraits = options.selectedTraits || [];

        let packsNames = options.packsNames || ['pathfinder-monster-core', 'pathfinder-bestiary', 'pathfinder-bestiary-2', 'pathfinder-bestiary-3'];

        this.indexedData = game.packs
            .filter(a => packsNames.includes(a.metadata.name))
            .map(p => p.getIndex({fields: this.indexedFields}))
    }

    async getData() {
        let creatures = (await Promise.all(this.indexedData)).map(c => c.contents).flat()
            .filter(a => a.system.details.level.value <= this.maxLvl && a.system.details.level.value >= this.lvl);
        if (this.selectedTraits.length > 0) {
            creatures = creatures.filter(c => this.selectedTraits.some(t => c.system.traits.value.includes(t)))
        }

        creatures = creatures.sort((a, b) => {
            if (a.system.details.level.value > b.system.details.level.value) return 1;
            if (a.system.details.level.value < b.system.details.level.value) return -1;

            if (a.name > b.name) return 1;
            if (a.name < b.name) return -1;
            return 0;
        })

        creatures = creatures.map(c => {
            if (game?.pf2e?.system?.moduleArt?.map) {
                let img = game?.pf2e?.system?.moduleArt?.map.get(c.uuid)?.img
                if (img) {
                    c.img = img;
                }
            }
            return c;
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
            lvl: this.lvl
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

        $($html).on("input propertychange paste change", "#filter-name", function (e) {
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

        $($html).on("click", ".c-row", function (e) {
            $(this).closest('form').find(".c-row").removeClass('selected')

            $(this).addClass('selected')
        });
    }

    async _updateObject(_event, data) {
        let folder = game.folders.find(f => f.name === FOLDER_NAME)?.id
        if (!folder) {
            folder = (await game.folders.documentClass.create({type: 'Actor', name: FOLDER_NAME}))?.id
        }

        let app = $(_event.target).closest('.pf2e-summons-helper')
        app.hide();
        let uuid = $(_event.target).find('.selected').data('uuid')
        const importedActor = (await fromUuid(uuid));

        let a = new Portal()
            .addCreature(importedActor, {count: 1, updateData: {actor: {ownership: {[game.userId]: 3}}}})
            .spawn();

        let tokDoc = await a;
        if (!tokDoc) {
            return
        }
        await tokDoc[0].update({ delta: importedActor.toObject() });

        if (!tokDoc[0].actor.folder) {
            let mainActor = await  fromUuid(`Actor.${tokDoc[0].actor.id}`)
            await mainActor.update({ folder })
        }

        app.show();

        Hooks.callAll('fs-postSummon', {
            sourceData: {
                flags: {item: this.spell.toObject()},
                summonerTokenDocument: {
                    actorId: this.owner.actor.id,
                    texture: {
                        src: this.owner.texture.src
                    },
                    name: this.owner.name
                },
            },
            tokenDoc: tokDoc[0]
        });
    }
};

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
    'summon-plant-or-fungus': ['fey', 'fungus'],
    'summon-animal': ['animal'],
}

Hooks.on("createChatMessage", async (message, options, userId) => {
    if (game.userId != userId) {
        return
    }
    if (!message.item?.isOfType('spell')) {
        return
    }
    if (!message.item.traits.has('summon')) {
        return
    }

    new BestiaryForm({
        owner: message.token,
        spell: message.item,
        maxLvl: MAX_LEVEL_SUMMON[message.item.level],
        selectedTraits: TRAITS_SUMMON[message.item.slug] || [],
    }).render(true)
});
