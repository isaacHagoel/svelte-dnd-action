enum INSTRUCTION_IDs {
    DND_ZONE_ACTIVE = 'dnd-zone-active',
    DND_ZONE_DRAG_DISABLED = 'dnd-zone-drag-disabled'
}
const ID_TO_INSTRUCTION: Record<INSTRUCTION_IDs, string> = {
    [INSTRUCTION_IDs.DND_ZONE_ACTIVE]: "Tab to one the items and press space-bar or enter to start dragging it",
    [INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED]: "This is a disabled drag and drop list"
}

/**
 * Initializes the static aria instructions so they can be attached to zones
 */
export function createInstructions(): Record<string, INSTRUCTION_IDs> {
    Object.entries(ID_TO_INSTRUCTION).forEach(([id, txt]) =>  document.body.prepend(instructionToHiddenDiv(id, txt)));
    return {...INSTRUCTION_IDs};
}
function instructionToHiddenDiv(id: string, txt: string): HTMLElement {
    const div = document.createElement('div');
    div.id = id;
    div.innerHTML = `<p>${txt}</p>`;
    div.style.display = 'none';
    div.style.position = 'fixed';
    div.style.zIndex = '-5';
    return div;
}

const ALERT_DIV_ID = 'dnd-action-aria-alert';
const alertsDiv = document.createElement('div');
(function initAlertsDiv() {
    alertsDiv.id = ALERT_DIV_ID;
    // tab index -1 makes the alert be read twice on chrome for some reason
    //alertsDiv.tabIndex = -1;
    alertsDiv.style.position = 'fixed';
    alertsDiv.style.bottom = '0';
    alertsDiv.style.left = '0';
    alertsDiv.style.zIndex = '-5';
    alertsDiv.style.opacity = '0';
    alertsDiv.style.height = '0';
    alertsDiv.style.width = '0';
    alertsDiv.setAttribute("role", "alert");
})();
document.body.prepend(alertsDiv);

/**
 * Will make the screen reader alert the provided text to the user
 */
export function alertToScreenReader(txt: string): void {
    alertsDiv.innerHTML = '';
    const alertText = document.createTextNode(txt);
    alertsDiv.appendChild(alertText);
    // this is needed for Safari
    alertsDiv.style.display = 'none';
    alertsDiv.style.display = 'inline';
}
