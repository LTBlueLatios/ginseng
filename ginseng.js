import * as Scripts from "./scripts";

const ginseng = {
    scriptManager: new ScriptManager,

    init() {
        this.scriptManager.registerPlugins([
            Scripts.AutoRebuild,
        ]);
    }
};

ginseng.init();