class RitualCreatureLvl {
  constructor(lvl, spellLvl, cost) {
    this.lvl = lvl;
    this.spellLvl = spellLvl;
    this.cost = cost;
  }
};

class RitualCheck {
  constructor(skill, rank, name) {
    this.skill = skill;
    this.name = name;
    this.rank = rank;
  }
};

class Ritual {
  constructor(slug, name, creatureLvl, primaryChecks, secondaryChecks) {
    this.slug = slug;
    this.name = name;
    this.creatureLvl = creatureLvl;
    this.primaryChecks = primaryChecks;
    this.secondaryChecks = secondaryChecks;
  }
};

const animateObject = new Ritual(
    'animate-object',
    'Animate Object'
    [
        new RitualCreatureLvl(-1, 2, 15),
        new RitualCreatureLvl(0, 2, 15),
        new RitualCreatureLvl(0, 2, 15),
        new RitualCreatureLvl(1, 2, 60 ),
        new RitualCreatureLvl(2, 3, 105 ),
        new RitualCreatureLvl(3, 3, 180 ),
        new RitualCreatureLvl(4, 4, 300 ),
        new RitualCreatureLvl(5, 4, 480 ),
        new RitualCreatureLvl(6, 5, 750 ),
        new RitualCreatureLvl(7, 5, 1080 ),
        new RitualCreatureLvl(8, 6, 1500 ),
        new RitualCreatureLvl(9, 6, 2100 ),
        new RitualCreatureLvl(10, 7, 3000 ),
        new RitualCreatureLvl(11, 7, 4200 ),
        new RitualCreatureLvl(12, 8, 6000 ),
        new RitualCreatureLvl(13, 8, 9000 ),
        new RitualCreatureLvl(14, 9, 13500 ),
        new RitualCreatureLvl(15, 9, 19500 ),
        new RitualCreatureLvl(16, 10, 30000 ),
        new RitualCreatureLvl(17, 10, 45000 )
    ],
    [new RitualCheck('arcana', 2, 'Arcana (expert)')],
    [new RitualCheck('crafting', 0, 'Crafting')]
);

const ritualList = [
    animateObject,
];


// ritual: {gold, primaryChecks, secondaryChecks}
// validation -> mainCaster, secondaryCasters, ritual
async function castRitual(actor, targets) {
    console.log(actor);
    console.log(targets);
};

Hooks.once("init", () => {
    game.pf2esummonshelper = mergeObject(game.pf2esummonshelper ?? {}, {
        "castRitual": castRitual,
    });
});