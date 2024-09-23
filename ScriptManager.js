import AltoMare from "./Sora/AltoMare";

class ScriptManager {
    scriptPlugins = new Map();

    registerPlugins(plugins) {
        if (!Array.isArray(plugins)) plugins = [plugins];

        plugins.forEach(plugin => {
            AltoMare.checkObjectShape(plugin, {
                name: "string",
                status: "boolean",
                init: "function",
                onEnable: "function",
                onDisable: "function",
            });

            /**
             * [Developer Note]
             * Only reason hwy I'm doing this is because you can't remove listeners with zombs' architecture.
             * Otherwise event binding would be done in the toggle methods.
             */
            plugin.init();
            this.scriptPlugins.set(plugin.name, plugin);
        });
    } 

    toggleScript(scriptName) {
        if (this.scriptPlugins.has(scriptName)) {
            const script = this.scriptPlugins.get(scriptName);
            const status = script.status;
            script.status = !status;

            status ? script.onEnable : script.onDisable;
        }
    }
}

export default ScriptManager;