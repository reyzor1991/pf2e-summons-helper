const moduleName = "pf2e-summons-helper";

Hooks.once("init", () => {
    console.log(`${moduleName} was init`)
});

Hooks.on('fs-postSummon', async (data) => {
    const {sourceData} = data;
    if (sourceData) {
        const spell = sourceData?.flags?.item;
        const actor = sourceData?.summonerTokenDocument?.actor;
        if (spell && actor) {
            const creature = {token: data.tokenDoc._id, tokenName: data.tokenDoc.name, actor: data.tokenDoc.actor.uuid};
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
        ChatMessage.create({
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            content: `${combatant.name} has sustained minions.<hr\> ${sustainedMinions.map(a=>a.tokenName).join(', ')}.<hr\> Sustain them or dismiss`
        });
    }

    const minions = combatant.actor.getFlag(moduleName, "minions") ?? [];
    if (minions.length > 0) {
        ChatMessage.create({
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            content: `${combatant.name} has minions.<hr\> ${minions.map(a=>a.tokenName).join(', ')}`
        });
    }
});
