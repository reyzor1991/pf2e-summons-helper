const moduleName = "pf2e-summons-helper";
const minionOwner = "Compendium.pf2e-summons-helper.summons-effect.Item.WZjCOL3vxDHGYPLf";

Hooks.once("init", () => {
    console.log(`${moduleName} was init`)
});

Hooks.on('fs-postSummon', async (data) => {
    const {sourceData} = data;
    if (sourceData) {
        const spell = sourceData?.flags?.item;
        const actor = sourceData?.summonerTokenDocument?.actor;
        if (spell && actor) {
            const creature = {token: data.tokenDoc._id, tokenName: data.tokenDoc.name, actor: data.tokenDoc.actor.uuid, img: data.tokenDoc.texture.src};
            if (spell.system.duration?.value.includes("sustained")) {
                const sustainedMinions = actor.getFlag(moduleName, "sustainedMinions") ?? [];
                sustainedMinions.push(creature);
                actor.setFlag(moduleName, "sustainedMinions", sustainedMinions);
            } else {
                const minions = actor.getFlag(moduleName, "minions") ?? [];
                minions.push(creature);
                actor.setFlag(moduleName, "minions", minions);
            }
            data.tokenDoc.setFlag(moduleName, "master", actor.uuid);

            addEffectToMinion(data.tokenDoc.actor, minionOwner, data.sourceData.summonerTokenDocument)
        }
    }
});

Hooks.on('deleteToken', async (token) => {
    let master = token.getFlag(moduleName, "master");
    if (master) {
        master = await fromUuid(master);
        const cursMins = master.getFlag(moduleName, "sustainedMinions") ?? [];
        master.setFlag(moduleName, "sustainedMinions", cursMins.filter(a=>a.token!=token.id));

        const curMins = master.getFlag(moduleName, "minions") ?? [];
        master.setFlag(moduleName, "minions", curMins.filter(a=>a.token!=token.id));
    }
});

Hooks.on('pf2e.startTurn', async (combatant, encounter, user_id) => {
    const sustainedMinions = combatant.actor.getFlag(moduleName, "sustainedMinions") ?? [];
    if (sustainedMinions.length > 0) {
        createSustainMessage(combatant, sustainedMinions)
    }

    const minions = combatant.actor.getFlag(moduleName, "minions") ?? [];
    if (minions.length > 0) {
        ChatMessage.create({
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            content: `${combatant.name} has minions.<hr\> ${minions.map(a=>a.tokenName).join(', ')}`
        });
    }
});

function createSustainMessage(combatant, minions) {
    const minionList = minions.map((m) => {
        return `
            <li data-token-id="${m.token}" class="minion-message-item"><img src="${m.img}">
                <span class="minion-li">
                    <span class="minion-li-text">${m.tokenName}</span>
                </span>
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
        speaker: { alias: `${combatant.name} has sustained minions` },
        content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    });
};

async function addEffectToMinion(minion, uuid, owner) {
    const aEffect = (await fromUuid(uuid)).toObject();
    aEffect.img = owner.texture.src;
    aEffect.name += owner.name;

    await minion.createEmbeddedDocuments("Item", [aEffect]);
}

$(document).on('click', '.minion-message-item', async function () {
    const item = $(this);
    const tokenUuid = `${game.scenes.current.uuid}.Token.${item.data().tokenId}`;
    const token = await fromUuid(tokenUuid);
    if (token) {
        game.canvas.pan({ x: token.x+50, y: token.y+50 })
    }
});