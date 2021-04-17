module.exports = {
    globals: {
        "ts-jest": {
            isolatedModules: true,
        },
    },
    injectGlobals: false,
    testPathIgnorePatterns: ["/node_modules/", "<rootDir>/packages/[^/]+/dist"],
    transform: {
        "\\.tsx?$": "ts-jest",
    },
};
