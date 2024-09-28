const AutoRebuild = {
    name: "autoRebuild",
    status: false,
    selectedBuildings: new Map(),
    buildingQueue: [],

    init() {
        game.network.addRpcHandler("LocalBuilding", (buildings) => this.handleLocalBuilding(buildings));
        game.network.addTickCallback(() => this.handleTick());
    },

    onEnable() {
        Object.values(game.ui.buildings).forEach(building => {
            if (building.type === "GoldStash") return;
            const key = `${building.x},${building.y}`;
            const buildingYaw = game.world.entities[building.uid].targetTick.yaw;
            this.selectedBuildings.set(key, [building.x, building.y, building.type, buildingYaw, building.tier]);
        });
    },
    
    onDisable() {
        this.selectedBuildings.clear();
        this.buildingQueue = [];
    },

    handleLocalBuilding(buildings) {
        if (!this.status) return;

        buildings.forEach(building => {
            const key = `${building.x},${building.y}`;
            if (this.status && building.dead && this.selectedBuildings.has(key)) {
                if (building.type === "GoldStash") {
                    this.onDisable();
                    this.status = false;
                    console.warn("Stash died!", new Date().toISOString());
                    return;
                }

                const selectedData = this.selectedBuildings.get(key);
                if (selectedData) {
                    const [x, y, type, yaw, originalTier] = selectedData;
                    this.buildingQueue.push({
                        x,
                        y,
                        type,
                        yaw,
                        originalTier,
                    });
                }
            }
        });
    },
    handleTick() {
        if (!this.status) return;

        this.buildingQueue.forEach(queuedBuilding => {
            const placedBuilding = Object.values(game.ui.buildings).find(building =>
                building.x === queuedBuilding.x &&
                building.y === queuedBuilding.y &&
                building.type === queuedBuilding.type &&
                building.yaw === queuedBuilding.yaw &&
                !building.dead
            );

            if (!placedBuilding) {
                game.network.sendRpc({
                    name: "MakeBuilding",
                    x: queuedBuilding.x,
                    y: queuedBuilding.y,
                    type: queuedBuilding.type,
                    yaw: queuedBuilding.yaw,
                });
            } else {
                // hardy hardy har har har 0 tick upgrade
                const currentTier = placedBuilding.tier;
                const targetTier = queuedBuilding.originalTier;

                for (let tier = currentTier + 1; tier <= targetTier; tier += 1) {
                    game.network.sendRpc({
                        name: "UpgradeBuilding",
                        uid: placedBuilding.uid,
                    });
                }

                this.buildingQueue.splice(this.buildingQueue.indexOf(queuedBuilding), 1);
            }
        });
    }
};

export default AutoRebuild;