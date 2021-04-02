module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "prettier",
    ],
    rules: {
        eqeqeq: ["error", "always", {null: "ignore"}],
        "import/first": "warn",
        "import/no-duplicates": "warn",
        "import/order": [
            "warn",
            {
                groups: [
                    "builtin",
                    "external",
                    "internal",
                    "parent",
                    "sibling",
                    "index",
                ],
                pathGroups: [
                    {
                        pattern: "@2r1b/**",
                        group: "parent",
                    },
                ],
                pathGroupsExcludedImportTypes: ["builtin"],
                "newlines-between": "always",
                alphabetize: {order: "asc"},
            },
        ],
        "import/newline-after-import": "warn",
        "@typescript-eslint/explicit-function-return-type": [
            "error",
            {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
            },
        ],
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                varsIgnorePattern: "^_",
                argsIgnorePattern: "^_",
            },
        ],
    },
};
