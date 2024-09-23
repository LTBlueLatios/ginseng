// v0.0.1 Index ~ Not recommended to use in production!
// Inherits the Sora library license

const AltoMare = {
    checkParams(params, types) {
        for (let i = 0; i < params.length; i++) {
            this.checkType(params[i], types[i]);
        }
    },

    checkType(value, type) {
        if (value === undefined || value === null || typeof value !== type) {
            throw new TypeError(`Expected ${type} but got ${typeof value} for ${value}`);
        }
    },

    // ![Developer Note] Temporary, replace with schematics!
    checkObjectShape(obj, shape) {
        for (const key in shape) {
            if (!obj.hasOwnProperty(key)) {
                throw new Error(`Missing property: ${key}`);
            }

            const expectedType = shape[key];
            if (typeof obj[key] !== expectedType) {
                throw new TypeError(`Expected ${key} to be of type ${expectedType}, but got ${typeof obj[key]}`);
            }
        }
    }
};

export default AltoMare;