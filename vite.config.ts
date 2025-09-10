import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy, options) => {
          // Fallback to mock when API server is not available
          proxy.on('error', (err, req, res) => {
            console.log('API proxy error, using development fallback');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (req.url?.includes('/api/stripe/create-customer-portal-session')) {
              res.end(JSON.stringify({
                url: 'https://billing.stripe.com/p/login/test_mock_session'
              }));
            } else {
              res.end(JSON.stringify({ error: 'API not available in development' }));
            }
          });
        }
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
