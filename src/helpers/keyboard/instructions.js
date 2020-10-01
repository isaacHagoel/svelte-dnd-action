const INSTRUCTION_IDs = {
    // TODO - add all
    DND_ZONE_ACTIVE: 'dnd-zone-active',
    DND_ZONE_DRAG_DISABLED: 'dnd-zone-drag-disabled'
}
const ID_TO_INSTRUCTION = {
    [INSTRUCTION_IDs.DND_ZONE_ACTIVE]: "Tab to one the items and press space-bar or enter to start dragging it",
    [INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED]: "This is a disabled drag and drop list"
}
export function createInstructions() {
    Object.entries(ID_TO_INSTRUCTION).forEach(([id, txt]) =>  document.body.prepend(instructionToHiddenDiv(id, txt)));
    return {...INSTRUCTION_IDs};
}
function instructionToHiddenDiv(id, txt) {
    const div = document.createElement('div');
    div.id = id;
    div.innerHTML = `<p>${txt}</p>`;
    // TODO - maybe reuse the func in styler
    div.style.display = 'none';
    div.style.position = 'fixed';
    div.style.zIndex = '-5';
    return div;
}

const ALERT_DIV_ID = 'svelte-dnd-action-aria-alert';
const alertsDiv = instructionToHiddenDiv(ALERT_DIV_ID, '');
alertsDiv.style.opacity = '0';
alertsDiv.style.display = '';
alertsDiv.style.height = '0';
alertsDiv.style.width = '1px'

document.body.prepend(alertsDiv);
export function tellUser(txt) {
    alertsDiv.innerHTML = `<p>${txt}</p>`;
    alertsDiv.setAttribute("role", "alert");
}