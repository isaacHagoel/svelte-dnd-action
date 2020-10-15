import resolve from '@rollup/plugin-node-resolve';
import babel from 'rollup-plugin-babel'
import pkg from './package.json';

const name = pkg.name
    .replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
    .replace(/^\w/, m => m.toUpperCase())
    .replace(/-\w/g, m => m[1].toUpperCase());

export default {
    input: 'dist/index.js',
    output: [
        { file: pkg.module, 'format': 'es' },
        { file: pkg.main, 'format': 'umd', name }
    ],
    plugins: [
        babel({
            presets: [
                ["@babel/preset-env", {
                    modules: false
                }],
            ]
        }),
        resolve()
    ]
};
