const AutoRebuild = {
    name: "autoRebuild",
    status: false,
    selectedBuildings: new Map(),
    buildingQueue: [],

    init() {
        game.network.addRpcHandler("LocalBuilding", (buildings) => this.handleLocalBuilding(buildings));
        game.network.addEntityUpdateHandler(() => this.handleEntityUpdate());
    },
    onEnable() {
        Object.values(game.ui.buildings).forEach(building => {
            if (building.type === "GoldStash") return;
            
            const key = `${building.x},${building.y}`;
            this.selectedBuildings.set(key, [building.x, building.y, building.type, building.tier]);
        });
    },
    onDisable() {
        this.selectedBuildings.clear();
        this.buildingQueue = [];
    },
    handleLocalBuilding(buildings) {
        if (!this.status) return;
        
        buildings.forEach(building => {
            if (this.status && building.dead && this.autoRebuildTarget.has(`${building.x},${building.y}`)) {
                if (building.type === "GoldStash") {
                    // lol imagine losing your stash XD
                    this.onDisable();
                    this.status = false;
                    console.warn("Stash died!", new Date().toISOString());
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
    handleEntityUpdate() {
        if (!this.status) return;
        
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
                // hardy hardy har har har 0 tick upgrade
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
};

export default AutoRebuild;