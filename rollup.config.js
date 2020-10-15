import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import babel from 'rollup-plugin-babel'
import pkg from './package.json';

const name = pkg.name
    .replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
    .replace(/^\w/, m => m.toUpperCase())
    .replace(/-\w/g, m => m[1].toUpperCase());

const extensions = ['.js', '.jsx', '.es6', '.es', '.mjs', '.ts', '.tsx'];

export default {
    input: 'src/index.ts',
    /* output: [
        { file: pkg.module, 'format': 'es' },
        { file: pkg.main, 'format': 'umd', name }
    ],*/
    output: { dir: './built'},
    plugins: [
        typescript({"emitDeclarationOnly": true}),
        babel({
            extensions,
            presets: [
                "@babel/preset-typescript",
                "@babel/preset-env",
            ]
        }),
        resolve()
    ]
};
