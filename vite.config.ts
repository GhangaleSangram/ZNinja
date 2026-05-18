import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './', // Important for Electron to load relative paths
    build: {
        outDir: 'dist-app',
        emptyOutDir: true,
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        // Normalize backslashes to forward slashes for Windows reliability
                        const nid = id.replace(/\\/g, '/');

                        if (
                            nid.includes('/react/') ||
                            nid.includes('/react-dom/') ||
                            nid.includes('/scheduler/')
                        ) {
                            return 'vendor-react';
                        }
                        if (
                            nid.includes('/react-markdown/') ||
                            nid.includes('/remark-gfm/') ||
                            nid.includes('/remark-math/') ||
                            nid.includes('/rehype-katex/')
                        ) {
                            return 'vendor-markdown';
                        }
                        if (nid.includes('/katex/')) {
                            return 'vendor-katex';
                        }
                        if (nid.includes('/react-syntax-highlighter/')) {
                            return 'vendor-syntax';
                        }
                        return 'vendor-misc';
                    }
                }
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    }
});
