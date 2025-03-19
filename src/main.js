const moduleName = "pf2e-summons-helper";
const minionOwner = "Compendium.pf2e-summons-helper.summons-effect.Item.WZjCOL3vxDHGYPLf";
let socketlibSocket = undefined;

const unlimited = {"expiry": "turn-end", "sustained": false, "unit": "unlimited", "value": -1}

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
    }
    return !!globalThis.socketlib
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