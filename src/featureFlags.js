/**
 * @type {{USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT: string}}
 */
export const FEATURE_FLAG_NAMES = Object.freeze({
    // This flag exists as a workaround for issue 454 (basically a browser bug) - seems like these rect values take time to update when in grid layout. Setting it to true can cause strange behaviour in the REPL for non-grid zones, see issue 470
    USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT: "USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT"
});

const featureFlagsMap = {
    [FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT]: false
};

/**
 * @param {FEATURE_FLAG_NAMES} flagName
 * @param {boolean} flagValue
 */
export function setFeatureFlag(flagName, flagValue) {
    if (!FEATURE_FLAG_NAMES[flagName])
        throw new Error(`Can't set non existing feature flag ${flagName}! Supported flags: ${Object.keys(FEATURE_FLAG_NAMES)}`);
    featureFlagsMap[flagName] = !!flagValue;
}

/**
 *
 * @param {FEATURE_FLAG_NAMES} flagName
 * @return {boolean}
 */
export function getFeatureFlag(flagName) {
    if (!FEATURE_FLAG_NAMES[flagName])
        throw new Error(`Can't get non existing feature flag ${flagName}! Supported flags: ${Object.keys(FEATURE_FLAG_NAMES)}`);
    return featureFlagsMap[flagName];
}
