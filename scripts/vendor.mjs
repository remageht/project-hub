import { cp, mkdir } from 'node:fs/promises';

const destination = new URL('../web/vendor/', import.meta.url);
const source = new URL('../node_modules/three/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const filename of ['three.module.js', 'three.core.js']) {
  await cp(new URL(`build/${filename}`, source), new URL(filename, destination));
}
await cp(new URL('LICENSE', source), new URL('THREE-LICENSE.txt', destination));
