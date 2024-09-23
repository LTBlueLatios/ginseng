import { queueTickTask } from "../TickUtility";

const AutoHeal = {
    name: "autoHeal",
    status: true,
    canHeal: {
        player: true,
        pet: true
    },
    config: {
        healPet: true,
        healPlayer: true,
        playerThreshold: 15,
        petThreshold: 20
    },

    init() {
        game.network.addEntityHandler(() => this.handleEntityUpdate());
    },
    onEnable() {},
    onDisable() {},
    handleEntityUpdate() {
        if (!this.status) return;

        const playerTick = game.ui.getPlayerTick();
        if (this.config.healPlayer) {
            healEntity(playerTick, "HealthPotion", this.config.playerThreshold, 'player');
        }
        
        const petTick = game.ui.getPlayerPetTick();
        if (this.config.healPet) {
            healEntity(petTick, "PetHealthPotion", this.config.petThreshold, 'pet');
        }
    },
    healEntity(entityTick, itemName, threshold, canHealKey) {
        if (!entityTick) return;
        const { dead, health, maxHealth } = entityTick;
    
        if (!dead && calculateHealthPercentage(health, maxHealth) <= threshold) {
            game.network.sendRpc({ name: "BuyItem", itemName, tier: 1 });
            game.network.sendRpc({ name: "EquipItem", itemName, tier: 1 });
    
            this.canHeal[canHealKey] = false;
            queueTickTask(200, () => { this.canHeal[canHealKey] = true });
        }
    },
    calculateHealthPercentage(health, maxHealth) {
        return (health / maxHealth) * 100;
    }
};

export default AutoHeal;