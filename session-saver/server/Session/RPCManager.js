import { queueTickTask } from "../js/Utilities/TickUtility.js";

const RPCManager = {
    handleLocalBuilding(response) {
        response.forEach(building => {
            this.buildings[building.uid] = building;

            if (building.type === "GoldStash" && !building.dead) {
                this.goldStash = building;
                return;
            }

            if (this.scripts.autoRebuild.status && building.dead && this.autoRebuildTarget.has(`${building.x},${building.y}`)) {
                if (building.type === "GoldStash") {
                    this.buildingQueue = [];
                    this.autoRebuildTarget.clear();
                    console.log("Stash died!", Date.now());
                    return;
                }

                this.buildingQueue.push({
                    x: building.x,
                    y: building.y,
                    type: building.type,
                    yaw: building.yaw ? building.yaw : 0,
                    originalTier: building.tier
                });
            }
        });
    },

    handlePartyShareKey(response) {
        this.partyShareKey = response.partyShareKey;
    },

    handleDead() {
        console.log("Player died", Date.now());
    },

    handleSetItem(response) {
        this.inventory[response.itemName] = response;
        if (!this.inventory[response.itemName].stacks) {
            delete this.inventory[response.itemName];
        }
        if (response.itemName === "ZombieShield" && response.stacks) {
            this.sendRpc({ name: "EquipItem", itemName: "ZombieShield", tier: response.tier });
        }
    },

    handlePartyInfo(response) {
        this.partyInfo = response;
    },

    handleSetPartyList(response) {
        this.parties = {};
        this.players = 0;
        response.forEach(e => {
            this.parties[e.partyId] = e;
            this.players += e.memberCount;
        });
    },

    handleDayCycle(response) {
        this.dayCycle = response;

        if (this.scripts.playerTrick.status && !response.isDay) {
            this.sendRpc({ name: "JoinPartyByShareKey", partyShareKey: this.pskHardcode });
            queueTickTask(440, () => this.sendRpc({ name: "LeaveParty" }));
        }
    },

    handleLeaderboard(response) {
        this.leaderboard = response;
    },

    handleReceiveChatMessage(response) {
        this.messages.push(response);
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(-50);
        }
    },

    handleCastSpellResponse: function(response) {
        this.castSpellResponse = response;
    },

    handleFailure() {
        // --
    }
}

export default RPCManager