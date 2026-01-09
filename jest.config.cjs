const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testPathIgnorePatterns: ['/temp-disabled-api/'],
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs)/)',
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

module.exports = config;