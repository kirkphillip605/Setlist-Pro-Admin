import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  const allowedHostsEnv = env.ALLOWED_HOSTS;
  // Vite expects `true` (for all) or `string[]`. It does not accept `false`.
  let allowedHosts: true | string[] | undefined;

  if (allowedHostsEnv === '*') {
    allowedHosts = true;
  } else if (allowedHostsEnv) {
    allowedHosts = allowedHostsEnv.split(',').map(host => host.trim());
  }

  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: allowedHosts,
    },
    plugins: [dyadComponentTagger(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});