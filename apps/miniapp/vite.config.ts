import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import uniPlugin from '@dcloudio/vite-plugin-uni';

type UniPluginFactory = () => ReturnType<typeof uniPlugin>;

const uni =
  (
    uniPlugin as unknown as {
      default?: UniPluginFactory;
    }
  ).default ?? (uniPlugin as unknown as UniPluginFactory);

const appRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appRoot, '');

  return {
    envDir: appRoot,
    plugins: [uni()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        env.VITE_API_BASE_URL,
      ),
    },
  };
});
