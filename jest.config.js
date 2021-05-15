module.exports = {
    globals: {
        "ts-jest": {
            isolatedModules: true,
        },
    },
    injectGlobals: false,
    setupFiles: ["<rootDir>/jest.setup.js"],
    testPathIgnorePatterns: ["/node_modules/", "<rootDir>/packages/[^/]+/dist"],
    transform: {
        "\\.tsx?$": "ts-jest",
    },
};
