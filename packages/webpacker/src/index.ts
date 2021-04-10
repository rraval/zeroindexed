import fs from "fs";
import path from "path";

import webpack from "webpack";

function webpackRun(configuration: webpack.Configuration): Promise<webpack.Stats> {
    const compiler = webpack(configuration);
    return new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
            if (err != null) {
                return reject(err);
            }

            if (stats == null) {
                return reject(new Error("stats is undefined"));
            }

            if (stats.hasErrors()) {
                return reject(
                    new Error(JSON.stringify(stats.toJson().errors, null, "  ")),
                );
            }

            resolve(stats);
        });
    });
}

export async function webpacker({
    module,
    webpackConfigName,
}: {
    module: string;
    webpackConfigName: string;
}): Promise<string> {
    const modulePath = require.resolve(module);
    const moduleDir = path.dirname(modulePath);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const webpackConfig = require(path.join(moduleDir, webpackConfigName));

    await webpackRun(webpackConfig);

    const contents = await fs.promises.readFile(
        path.join(webpackConfig.output.path, webpackConfig.output.filename),
        {encoding: "utf8"},
    );

    return contents;
}
