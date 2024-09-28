import WebSocket from "ws";
import WasmModule from "../js/WasmModule.js";
import Codec from "../js/Codec.js";
import { ServerList } from "../js/ServerList.js";
import { incrementCounter } from "../js/Utilities/TickUtility.js"
import RPCManager from "./RPCManager.js";

class Session {
    constructor(sessionName = "Session", options = {}) {
        this.sessionName = sessionName;
        this.serverId = options.serverId;
        this.name = options.name;
        this.partyShareKey = options.psk;
        this.pskHardcode = this.partyShareKey;
        this.id = options.sessionId;
        this.rootServer = options.rootServer;

        this.scripts = {
            autoPetHeal: {
                status: false,
                thresholdPercent: 15
            },
            autoPetRevive: {
                status: true
            },
            playerTrick: {
                status: false
            },
            ahrc: {
                status: false
            },
            autoRebuild: {
                status: false
            },
        }

        this.socket = new WebSocket(`wss://${ServerList[this.serverId].hostname}:443/`, {
            headers: {
                "Origin": "",
                "User-Agent": ""
            }
        });
        this.socket.binaryType = "arraybuffer";
        this.bindListeners();

        this.connectedClients = [];

        this.sessionData = {
            BuildingShopPrices: [],
            ItemShopPrices: [],
            Spells: [],
            enterWorldData: {},
            myPlayer: {},
        };

        this.entities = new Map();
        this.buildings = {};
        this.inventory = {};
        this.partyInfo = [];
        this.dayCycle = {
            cycleStartTick: 100,
            nightEndTick: 0,
            dayEndTick: 1300,
            isDay: 1
        };
        this.leaderboard = [];
        this.messages = [];
        this.parties = {};
        this.castSpellResponse = {};
        this.uid = 0;
        this.tick = 100;
        this.players = false;

        this.harvesterTicks = [
            { tick: 0, resetTick: 31, deposit: 0.4, tier: 1 },
            { tick: 0, resetTick: 29, deposit: 0.6, tier: 2 },
            { tick: 0, resetTick: 27, deposit: 0.7, tier: 3 },
            { tick: 0, resetTick: 24, deposit: 1, tier: 4 },
            { tick: 0, resetTick: 22, deposit: 1.2, tier: 5 },
            { tick: 0, resetTick: 20, deposit: 1.4, tier: 6 },
            { tick: 0, resetTick: 18, deposit: 2.4, tier: 7 },
            { tick: 0, resetTick: 16, deposit: 3, tier: 8 }
        ];
        this.harvesters = new Map();
        this.buildingQueue = [];
        this.autoRebuildTarget = new Map();
        this.goldStash = null;
    }

    bindListeners() {
        this.socket.onopen = () => this.handleOpen();
        this.socket.onmessage = (msg) => this.handleMessage(msg);
        this.socket.onclose = () => this.onClose();
        this.socket.onerror = () => console.log;
        this.codec = new Codec();
        this.Module = WasmModule();
    }

    handleOpen() {
        console.log("Connected to server");
    }

    encode(e) {
        return new Uint8Array(this.codec.encode(9, {
            name: "message",
            msg: e
        }));
    }

    decode(e) {
        return this.codec.decode(new Uint8Array(e)).response.msg;
    }

    sendPacket(event, data) {
        this.socket.readyState == 1 && this.socket.send(new Uint8Array(this.codec.encode(event, data)));
    }

    sendRpc(data) {
        // Fix with schem
        try {
            this.sendPacket(9, data)
        } catch (e) {
            console.log("RPCError", e);
        }
    }

    sendInput(obj) {
        // Fix with schem
        try {
            this.sendPacket(3, obj);
        } catch (e) {
            console.log(e);
        }
    }

    broadCast(type, data) {
        for (const client of this.connectedClients) {
            const packet = {
                type: type,
                data: data,
            };
            client.send(JSON.stringify(packet));
        }
    }

    broadCastEntityPacket(data) {
        data.entities = this.entitiesPatch();
        const packet = {
            type: "EntityUpdate",
            data
        };

        for (const client of this.connectedClients) {
            client.send(JSON.stringify(packet));
        }
    }

    entitiesPatch() {
        const entities = {};
        this.entities.forEach(e => {
            entities[e.uid] = e.targetTick;
        });

        return entities;
    }

    handleMessage(msg) {
        const opcode = new Uint8Array(msg.data)[0];
        const m = new Uint8Array(msg.data);
        
        if (opcode == 5) {
            this.Module.onDecodeOpcode5(m, ServerList[this.serverId].ipAddress, decodedopcode5 => {
                this.sendPacket(4, {
                    displayName: this.name,
                    extra: decodedopcode5[5]
                });
                this.enterworld2 = decodedopcode5[6];
            });
            return;
        }
        if (opcode == 10) {
            this.socket.send(this.Module.finalizeOpcode10(m));
            return;
        }

        const data = this.codec.decode(msg.data);
        switch (opcode) {
            case 0:
                this.onEntities(data);
                this.broadCastEntityPacket(data);
                incrementCounter();
                break;
            case 4:
                this.onEnterWorldHandler(data);
                break;
            case 9:
                this.onRPC(data);
                this.broadCast("RPCUpdate", data);
                break;
        }
    }

    // eslint-disable-next-line complexity
    onEntities(data) {
        this.tick = data.tick;

        const updatedEntityUids = new Set();

        data.entities.forEach((entity, uid) => {
            updatedEntityUids.add(uid);
            const existingEntity = this.entities.get(uid);

            if (existingEntity) {
                Object.assign(existingEntity.targetTick, entity);
            } else {
                this.entities.set(uid, { uid, targetTick: entity, model: entity.model });
            }
        });

        this.entities.forEach((entity, uid) => {
            if (!updatedEntityUids.has(uid)) {
                this.entities.delete(uid);
            }

            if (uid == this.uid) {
                this.sessionData.myPlayer = entity;
            }
        });

        this.myPlayer = this.entities.get(this.uid) && this.entities.get(this.uid).targetTick;
        this.myPet = this.myPlayer && this.entities.get(this.myPlayer.petUid) && this.entities.get(this.myPlayer.petUid).targetTick;
        this.myPet && !this.petActivated && (this.petActivated = true);

        if (this.scripts.autoPetHeal.status && (this.myPet.health / this.myPet.maxHealth) * 100 <= this.scripts.autoPetHeal.thresholdPercent && this.myPet.health > 0) {
            this.sendRpc({ name: "BuyItem", itemName: "PetHealthPotion", tier: 1 });
            this.sendRpc({ name: "EquipItem", itemName: "PetHealthPotion", tier: 1 });
        }

        if (this.scripts.autoPetRevive.status && this.petActivated) {
            this.sendPacket(9, { name: "BuyItem", itemName: "PetRevive", tier: 1 });
            this.sendPacket(9, { name: "EquipItem", itemName: "PetRevive", tier: 1 });
        }

        this.scripts.ahrc.status && this.harvesterTicks.forEach(e => {
            e.tick += 1;
            if (e.tick >= e.resetTick) {
                e.tick = 0;
                this.depositAhrc(e);
            }
            if (e.tick == 1) {
                this.collectAhrc(e);
            }
        });

        this.buildingQueue.forEach(queuedBuilding => {
            const placedBuilding = Object.values(this.buildings).some(building =>
                building.x === queuedBuilding.x &&
                building.y === queuedBuilding.y &&
                building.type === queuedBuilding.type &&
                !building.dead
            );

            if (!placedBuilding) {
                this.sendRpc({
                    name: "MakeBuilding",
                    x: queuedBuilding.x,
                    y: queuedBuilding.y,
                    type: queuedBuilding.type,
                    yaw: queuedBuilding.yaw
                });
            } else {
                const currentTier = this.buildings[queuedBuilding.uid].tier;
                const targetTier = queuedBuilding.originalTier;

                for (let tier = currentTier + 1; tier <= targetTier; tier += 1) {
                    this.sendRpc({
                        name: "UpgradeBuilding",
                        uid: queuedBuilding.uid
                    });
                }
            }
            this.buildingQueue = this.buildingQueue.filter(b => b.uid !== queuedBuilding.uid);
        });
    }

    onEnterWorldHandler(data) {
        if (!data.allowed) return;
        this.sessionData.enterWorldData = data;
        this.uid = data.uid;
        this.enterworld2 && this.socket.send(this.enterworld2);

        // [1] up: 1
        // [2] ping
        // [3] metrics packet
        for (let i = 0; i < 26; i += 1) this.socket.send(new Uint8Array([3, 17, 123, 34, 117, 112, 34, 58, 49, 44, 34, 100, 111, 119, 110, 34, 58, 48, 125]));
        this.socket.send(new Uint8Array([7, 0]));
        this.socket.send(new Uint8Array([9, 6, 0, 0, 0, 126, 8, 0, 0, 108, 27, 0, 0, 146, 23, 0, 0, 82, 23, 0, 0, 8, 91, 11, 0, 8, 91, 11, 0, 0, 0, 0, 0, 32, 78, 0, 0, 76, 79, 0, 0, 172, 38, 0, 0, 120, 155, 0, 0, 166, 39, 0, 0, 140, 35, 0, 0, 36, 44, 0, 0, 213, 37, 0, 0, 100, 0, 0, 0, 120, 55, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 134, 6, 0, 0]));

        this.sessionData.codecData = {
            attributeMaps: this.codec.attributeMaps,
            entityTypeNames: this.codec.entityTypeNames,
            rpcMaps: this.codec.rpcMaps,
            rpcMapsByName: this.codec.rpcMapsByName,
        };

        this.sendRpc({ itemName: "HatHorns", name: "BuyItem", tier: 1 });
        this.sendRpc({ itemName: "PetCARL", name: "BuyItem", tier: 1 });
        this.sendRpc({ itemName: "PetMiner", name: "BuyItem", tier: 1 });
        this.sendRpc({ name: "JoinPartyByShareKey", partyShareKey: this.partyShareKey });
        this.rootServer.sendSessionList();
    }

    onRPC(data) {
        if (this.handleSchematicData(data)) return;

        const handlers = {
            "LocalBuilding": RPCManager.handleLocalBuilding,
            "PartyShareKey": RPCManager.handlePartyShareKey,
            "Dead": RPCManager.handleDead,
            "SetItem": RPCManager.handleSetItem,
            "PartyInfo": RPCManager.handlePartyInfo,
            "SetPartyList": RPCManager.handleSetPartyList,
            "DayCycle": RPCManager.handleDayCycle,
            "Leaderboard": RPCManager.handleLeaderboard,
            "ReceiveChatMessage": RPCManager.handleReceiveChatMessage,
            "CastSpellResponse": RPCManager.handleCastSpellResponse,
            "Failure": RPCManager.handleFailure
        };

        const handler = handlers[data.name];
        if (handler) {
            handler.call(this, data.response);
        } else {
            console.warn(`Unknown RPC name: ${data.name}`);
        }
    }

    handleSchematicData(data) {
        const sessionDataNames = ["BuildingShopPrices", "ItemShopPrices", "Spells"];
        if (sessionDataNames.includes(data.name)) {
            this.sessionData[data.name] = data.response;
            return true
        }

        return false;
    }

    sendWorldSyncData() {
        const rpcSync = [];
        rpcSync.push({ name: "PartyInfo", response: this.partyInfo, opcode: 9 });
        rpcSync.push({ name: "PartyShareKey", response: { partyShareKey: this.partyShareKey }, opcode: 9 });
        rpcSync.push({ name: "DayCycle", response: this.dayCycle, opcode: 9 });
        rpcSync.push({ name: "Leaderboard", response: this.leaderboard, opcode: 9 });
        rpcSync.push({ name: "SetPartyList", response: Object.values(this.parties), opcode: 9 });

        const localBuildings = Object.values(this.buildings);

        return {
            sessionData: this.sessionData,
            codecData: this.sessionData.codecData,
            tick: this.tick,
            entities: this.entitiesPatch(),
            byteSize: 654,
            opcode: 0,
            rpcSync: rpcSync,
            localBuildings: localBuildings,
            inventory: this.inventory,
            messages: this.messages,
            serverId: this.serverId,
            useRequiredEquipment: true,
            petActivated: this.petActivated,
            castSpellResponse: this.castSpellResponse,
            isPaused: this.sessionData.myPlayer ? this.sessionData.myPlayer.isPaused : 0,
            sortedUidsByType: this.codec.sortedUidsByType,
            removedEntities: this.codec.removedEntities,
            absentEntitiesFlags: this.codec.absentEntitiesFlags,
            updatedEntityFlags: this.codec.updatedEntityFlags
        };
    }

    onClose() {
        delete this.rootServer.sessions[this.id];
        this.rootServer.sendSessionList();
    }

    toggleScript(scriptName) {
        if (this.scripts[scriptName]) {
            this.scripts[scriptName].status = !this.scripts[scriptName].status;

            if (scriptName === "autoRebuild" && this.scripts[scriptName].status) {
                Object.values(this.buildings).forEach(building => {
                    const key = `${building.x},${building.y}`;
                    this.autoRebuildTarget.set(key, [building.x, building.y, building.type, building.tier]);
                });
            }
            if (scriptName === "autoRebuild" && !this.scripts[scriptName].status) {
                this.autoRebuildTarget.clear();
                this.buildingQueue = [];
            }
        }

        console.log("Script toggled", scriptName, this.scripts[scriptName].status);
    }

    depositAhrc(tick) {
        this.harvesters.forEach(e => {
            if (e.tier == tick.tier) {
                this.sendPacket(9, { name: "AddDepositToHarvester", uid: e.uid, deposit: tick.deposit });
            }
        })
    }

    collectAhrc(tick) {
        this.harvesters.forEach(e => {
            if (e.tier == tick.tier) {
                this.sendPacket(9, { name: "CollectHarvester", uid: e.uid });
            }
        })
    }
}

export default Session;