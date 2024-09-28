import * as Scripts from "./scripts";
import { incrementCounter } from "./TickUtility";

const ginseng = {
    scriptManager: new ScriptManager,

    init() {
        this.scriptManager.registerPlugins([
            Scripts.AutoRebuild,
            Scripts.AutoHeal
        ]);

        game.renderer.addTickCallback(incrementCounter);
    }
};

ginseng.init();