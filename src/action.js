import {dndzone as pointerDndZone} from "./pointerAction";
import {dndzone as keyboardDndZone} from "./keyboardAction";

export function dndzone(node, options) {
    const pointerZone = pointerDndZone(node, options);
    const keyboardZone = keyboardDndZone(node, options);
    return {
        update: newOptions => {
            pointerZone.update(newOptions);
            keyboardZone.update(newOptions);
        },
        destroy: () => {
            pointerZone.destroy();
            keyboardZone.destroy();
        }
    }
}