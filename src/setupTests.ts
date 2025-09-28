import '@testing-library/jest-dom';
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock import.meta.env for Vite
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        DEV: true,
        VITE_API_URL: 'http://localhost:3000/api',
        // Add other envs if needed
      },
    },
  },
  writable: true,
});