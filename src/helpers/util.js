/**
 * @param {Object} object
 * @return {string}
 */
export function toString(object) {
    return JSON.stringify(object, null, 2);
}