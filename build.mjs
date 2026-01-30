import * as esbuild from 'esbuild';

console.log('Building mongo-knowledge...');

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: 'dist/index.js',
  external: [
    // MCP SDK - 保持外部化
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/*',
    // 大型可选依赖
    '@xenova/transformers',
    // 原生模块依赖
    'mongodb',
    'chokidar',
  ],
  banner: {
    js: '#!/usr/bin/env node\n',  // 添加换行符
  },
  sourcemap: true,
  minify: false, // 保持可读性便于调试
});

console.log('Build completed: dist/index.js');
