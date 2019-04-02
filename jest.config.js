module.exports = {
  globals: {
    'ts-jest': {
      tsConfig: './src/tsconfig.server.json'
    }
  },
  moduleFileExtensions: [
    'ts',
    'js'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testMatch: [
    '**/api/**/*.test.(ts|js)'
  ],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended', './jest.setup.js'],
};