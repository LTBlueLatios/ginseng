/**
 * An object for encoding and decoding building data in a compact and efficient manner.
 * This codec utilizes delta encoding, type grouping, and LZString compression to minimize the size of the encoded string.
 */
const BuildingCodec = {
    typeArray: [
        'Wall',
        'Door',
        'SlowTrap',
        'ArrowTower',
        'CannonTower',
        'MeleeTower',
        'BombTower',
        'MagicTower',
        'GoldMine',
        'Harvester',
        'GoldStash'
    ],

    /**
     * Gets the index of a type or the type from an index.
     * @param {string|number} key - The building type as a string or the type index as a number.
     * @returns {number|string} - Returns the index if a type is provided, or the type if an index is provided.
     */
    getType(key) {
        if (typeof key === 'string') {
            const index = this.typeArray.indexOf(key);
            if (index === -1) throw new Error('Invalid type');
            return index;
        } else if (typeof key === 'number') {
            if (key < 0 || key >= this.typeArray.length) throw new Error('Invalid index');
            return this.typeArray[key];
        }
        
        throw new Error('Invalid input type');
    },

    /**     
     * Gets the yaw of an entity.
     * @param {Object} entity - The entity to find the yaw of.
     * @returns {number} - Returns the entity's yaw value.
     */
    getYaw(entity) {
        return game.world.entities[entity.uid]?.targetTick?.yaw || 0;
    },

    /**
     * Encodes an array of building objects into a compact string representation.
     * @param {Array.<Object>} buildings - The array of building objects to encode.
     * @returns {string} - The encoded string representation of the buildings.
     */
    encode(buildings) {
        if (buildings[0].type !== "GoldStash") throw new Error("wtf are you doing ???");

        const stash = buildings[0],
            groupedBuildings = Object.groupBy(buildings.slice(1), building => building.type);
        let prevX = 0,
            prevY = 0;

        // Sort by building type so we can discard building.type from being encoded
        const encoded = Object.entries(groupedBuildings).map(([type, buildings]) => {
            // Sort to improve delta compression
            buildings.sort((a, b) => a.x - b.x || a.y - b.y);

            const typeIndex = this.getType(type);
            const buildingData = buildings.reduce((acc, building) => {
                const dx = building.x - stash.x - prevX;
                const dy = building.y - stash.y - prevY;
                prevX += dx;
                prevY += dy;
                acc.push(dx, dy, this.getYaw(building));
                return acc;
            }, []);
            return [typeIndex, ...buildingData].join(',');
        }).join('|');

        return LZString.compressToEncodedURIComponent(encoded);
    },

    /**
     * Decodes a compact string representation of building data back into an array of building objects.
     * @param {string} encodedString - The encoded string representation of the buildings.
     * @returns {Array.<Object>} - The decoded array of building objects.
     */
    decode(encodedString) {
        const decoded = LZString.decompressFromEncodedURIComponent(encodedString).split('|');
        const buildings = [];
        let prevX = 0;
        let prevY = 0;
        for (const group of decoded) {
            const data = group.split(',').map(Number);
            const type = this.getType(data[0]);
            for (let i = 1; i < data.length; i += 3) {
                const x = data[i] + prevX;
                const y = data[i + 1] + prevY;
                prevX += data[i];
                prevY += data[i + 1];
                buildings.push({
                    x: x,
                    y: y,
                    yaw: data[i + 2],
                    type: type
                });
            }
        }
        return buildings;
    }
};

export default BuildingCodec;