import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appId = process.env.VITE_WECHAT_APP_ID;
const apiBaseUrl = process.env.VITE_API_BASE_URL;
if (!/^wx[a-zA-Z0-9]{16}$/.test(appId ?? '')) {
  throw new Error('VITE_WECHAT_APP_ID must be a valid 18-character WeChat AppID');
}
if (!apiBaseUrl?.startsWith('https://')) {
  throw new Error('Production VITE_API_BASE_URL must use HTTPS');
}

const target = resolve('dist/build/mp-weixin/project.config.json');
const project = JSON.parse(await readFile(target, 'utf8'));
project.appid = appId;
project.projectname = project.projectname || 'fruit-b2b-miniapp';
await writeFile(target, `${JSON.stringify(project, null, 2)}\n`);
console.log(`Configured production miniapp build for ${appId}`);
