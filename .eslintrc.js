// A dndzone can live in another window than the one that loaded the library (a same-origin iframe, a popup or an
// Electron window). Work for a zone uses the zone's own window and document, from getWindowOf in src/helpers/util.js or
// from an element's ownerDocument, rather than the loading window's globals.
const LOADING_WINDOW_GLOBALS = [
    "window",
    "document",
    "self",
    "globalThis",
    "top",
    "parent",
    "frames",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "getComputedStyle",
    "matchMedia",
    "innerWidth",
    "innerHeight",
    "scrollX",
    "scrollY",
    "pageXOffset",
    "pageYOffset",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "FocusEvent",
    "TouchEvent"
];

module.exports = {
    env: {
        browser: true,
        es2021: true
    },
    extends: "eslint:recommended",
    parserOptions: {
        ecmaVersion: 12,
        sourceType: "module"
    },
    rules: {},
    overrides: [
        {
            files: ["src/**/*.js"],
            rules: {
                "no-restricted-globals": [
                    "error",
                    ...LOADING_WINDOW_GLOBALS.map(name => ({
                        name,
                        message: "This is the loading window's. Use the window or document of the element the work is for."
                    }))
                ]
            }
        }
    ]
};
