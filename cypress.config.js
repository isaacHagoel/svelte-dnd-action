const {defineConfig} = require("cypress");

module.exports = defineConfig({
    allowCypressEnv: false,
    e2e: {
        specPattern: "cypress/integration/**/*.spec.js",
        supportFile: "cypress/support/index.js"
    }
});
