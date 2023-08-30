const moduleName = "pf2e-summons-helper";
const minionOwner = "Compendium.pf2e-summons-helper.summons-effect.Item.WZjCOL3vxDHGYPLf";

Hooks.once("init", () => {
    console.log(`${moduleName} was init`)
});

Hooks.on('fs-postSummon', async (data) => {
    const {sourceData} = data;
    if (sourceData) {
        const spell = sourceData?.flags?.item;
        const actor = await fromUuid(`Actor.${sourceData?.summonerTokenDocument?.actorId}`) ;
        if (spell && actor) {
            const creature = {token: data.tokenDoc._id, tokenName: data.tokenDoc.name, img: data.tokenDoc.texture.src};
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
            <li data-token-id="${m.token}" data-owner-id="${combatant.actor.uuid}" class="minion-message-item"><img src="${m.img}">
                <span class="minion-li">
                    <span class="minion-li-text">${m.tokenName}</span>
                </span> &nbsp; &nbsp;
                <div>
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

$(document).on('click', '.minion-message-item', async function (event) {
    const item = $(this);
    const tokenUuid = `${game.scenes.current.uuid}.Token.${item.data().tokenId}`;
    const token = await fromUuid(tokenUuid);
    if (token) {
        game.canvas.pan({ x: token.center.x, y: token.center.y })
        token.object.control({ releaseOthers: !event.shiftKey });
    }
});

$(document).on('click', '.dismiss-minion-item', async function (event) {
    const item = $(this);
    const tokenId = item.parent().parent().data().tokenId;
    const ownerId = item.parent().parent().data().ownerId;
    const tokenUuid = `${game.scenes.current.uuid}.Token.${tokenId}`;
    const token = await fromUuid(tokenUuid);
    if (token) {
        window?.warpgate?.dismiss(tokenId);
        item.parent().parent().remove();

        if (ownerId) {
            const owner = await fromUuid(ownerId);
            if (owner) {
                await owner.itemTypes.action.find(a=>a.slug==='dismiss')?.toMessage()
            }
        }
    }
});

$(document).on('click', '.sustain-minion-item', async function (event) {
    const item = $(this);
    const tokenId = item.parent().parent().data().tokenId;
    const ownerId = item.parent().parent().data().ownerId;
    const tokenUuid = `${game.scenes.current.uuid}.Token.${tokenId}`;
    const token = await fromUuid(tokenUuid);
    if (token) {
        item.parent().parent().append(' was sustained');
        item.parent().parent().find('.dismiss-minion-item').remove();
        item.parent().parent().find('.sustain-minion-item').remove();

        if (ownerId) {
            const owner = await fromUuid(ownerId);
            if (owner) {
                await owner.itemTypes.action.find(a=>a.slug==='sustain-a-spell')?.toMessage()
            }
        }
    }
});

$(document).on('mouseenter', '.minion-message-item', async function () {
    const item = $(this);
    const tokenUuid = `${game.scenes.current.uuid}.Token.${item.data().tokenId}`;
    const token = await fromUuid(tokenUuid);
    if (token) {
        token.object._onHoverIn({}, {});
    }
});

$(document).on('mouseleave', '.minion-message-item', async function () {
    const item = $(this);
    const tokenUuid = `${game.scenes.current.uuid}.Token.${item.data().tokenId}`;
    const token = await fromUuid(tokenUuid);
    if (token) {
        token.object._onHoverOut({}, {});
    }
});