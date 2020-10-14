import resolve from '@rollup/plugin-node-resolve';
import dts from "rollup-plugin-dts";
import babel from 'rollup-plugin-babel'
import pkg from './package.json';

const name = pkg.name
    .replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
    .replace(/^\w/, m => m.toUpperCase())
    .replace(/-\w/g, m => m[1].toUpperCase());

export default [{
    input: 'src/index.js',
    output: [
        { file: pkg.module, 'format': 'es' },
        { file: pkg.main, 'format': 'umd', name }
    ],
    plugins: [
        babel({
            presets: [
                ["@babel/preset-env", {
                    modules: false
                }]
            ]
        }),
        resolve()
    ]
}, {
    input: "./types/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
}];