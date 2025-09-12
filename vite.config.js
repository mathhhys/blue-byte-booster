import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src', // Map @ to the src directory
    },
  },
  server: {
    port: 8080, // Ensure Vite runs on port 8080
    host: '0.0.0.0', // Listen on all network interfaces for ngrok
    allowedHosts: [
      '.ngrok-free.app', // Allow ngrok domains
      'localhost',
      '127.0.0.1',
      '56b095ded4e0.ngrok-free.app' // Corrected ngrok domain without https://
    ],
  },
});