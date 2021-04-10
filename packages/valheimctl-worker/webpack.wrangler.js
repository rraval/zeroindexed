const path = require("path");

module.exports = {
    context: __dirname,
    mode: "development",
    devtool: false,
    entry: "./src",
    output: {
        path: path.resolve(__dirname, "worker"),
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
