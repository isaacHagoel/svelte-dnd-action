import {dndzone} from "../../../src/action";

// Helpers for zones that live in another document than the one that loaded the library: a same-origin
// iframe (its own Window and Document in the same tab) or a popup opened with window.open (its own tab).

/**
 * @param {{parent?: Document, style?: Object}} [options]
 */
export function createFrame({parent = document, style = {}} = {}) {
    const frame = parent.createElement("iframe");
    Object.assign(frame.style, {display: "block", border: "0", width: "300px", height: "200px"}, style);
    parent.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.write("<!DOCTYPE html><body style='margin:0'></body>");
    doc.close();
    return {frame, win: frame.contentWindow, doc};
}

/**
 * Electron, the default Cypress browser, blocks window.open, so this skips the test there. Run the
 * popup tests with a Chromium browser, e.g. `yarn test --browser chrome`, where a blocked popup fails.
 * @param {Mocha.Context} test - the test's `this`
 */
export function openPopup(test) {
    const win = window.open("", "", "width=400,height=300");
    if (!win) {
        if (Cypress.browser.name === "electron") test.skip();
        throw new Error("window.open did not open a popup");
    }
    win.document.write("<!DOCTYPE html><body style='margin:0'></body>");
    win.document.close();
    return {win, doc: win.document};
}

/**
 * A list that renders one element per item and re-renders on every consider and finalize, as a keyed
 * framework list would: an element is reused while its item stays in the list and recreated otherwise.
 */
export function createList(doc, {label, names, style = {}, ...options}) {
    const zone = doc.createElement("div");
    zone.setAttribute("aria-label", label);
    Object.assign(zone.style, {width: "100px", minHeight: "30px"}, style);
    doc.body.appendChild(zone);
    let items = names.map(name => ({id: name, name}));
    let elements = new Map();
    function render() {
        const nextElements = new Map();
        for (const item of items) {
            let el = elements.get(item.id);
            if (!el) {
                el = doc.createElement("div");
                el.textContent = item.name;
                el.setAttribute("aria-label", item.name);
                el.style.height = "30px";
            }
            nextElements.set(item.id, el);
        }
        elements = nextElements;
        zone.replaceChildren(...nextElements.values());
    }
    render();
    const getOptions = () => ({items, flipDurationMs: 0, ...options});
    const action = dndzone(zone, getOptions());
    const triggers = [];
    const events = [];
    function onChange(e) {
        triggers.push(e.detail.info.trigger);
        events.push(e);
        items = e.detail.items;
        render();
        action.update(getOptions());
    }
    zone.addEventListener("consider", onChange);
    zone.addEventListener("finalize", onChange);
    return {
        zone,
        action,
        doc,
        win: doc.defaultView,
        triggers,
        events,
        names: () => items.map(item => item.name),
        element: name => elements.get(name)
    };
}

export function key(target, k) {
    const {KeyboardEvent} = target.ownerDocument ? target.ownerDocument.defaultView : target;
    target.dispatchEvent(new KeyboardEvent("keydown", {key: k, bubbles: true, cancelable: true}));
}

export function mouse(win, type, x, y = x) {
    return new win.MouseEvent(type, {button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true});
}

export function alertText(doc) {
    return doc.getElementById("dnd-action-aria-alert")?.textContent ?? null;
}

export function sleepIn(win, ms) {
    return new Promise(resolve => win.setTimeout(resolve, ms));
}

/**
 * Records the listeners of the given types that are currently attached to a window.
 * @return {{active: function(): string[], restore: function(): void}}
 */
export function trackListeners(win, types) {
    const {addEventListener, removeEventListener} = win;
    const attached = new Map(types.map(type => [type, new Set()]));
    win.addEventListener = function (type, listener, options) {
        attached.get(type)?.add(listener);
        return addEventListener.call(this, type, listener, options);
    };
    win.removeEventListener = function (type, listener, options) {
        attached.get(type)?.delete(listener);
        return removeEventListener.call(this, type, listener, options);
    };
    return {
        active: () => types.filter(type => attached.get(type).size > 0),
        restore: () => {
            win.addEventListener = addEventListener;
            win.removeEventListener = removeEventListener;
        }
    };
}

/**
 * Fails a test on an error thrown by an event listener. Cypress can let a test pass, and skip its queued commands, when a
 * listener throws during the test's synchronous part, and the library runs in listeners.
 */
export function failOnListenerErrors() {
    let errors;
    const onError = e => errors.push(e.message);
    beforeEach(() => {
        errors = [];
        window.addEventListener("error", onError);
    });
    afterEach(() => {
        window.removeEventListener("error", onError);
        expect(errors, "errors thrown by listeners").to.deep.equal([]);
    });
}
