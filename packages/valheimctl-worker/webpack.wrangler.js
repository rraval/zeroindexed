const path = require("path");

module.exports = {
    context: __dirname,
    mode: "development",
    devtool: false,
    entry: "./index",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "worker.js",
    },
    resolve: {
        extensions: [".js", ".ts"],
    },
    module: {
        rules: [{
            test: /\.ts$/,
            loader: "ts-loader",
            options: {
                transpileOnly: true,
            },
        }],
    },
};
