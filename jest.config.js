export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './.babelrc' }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)$': '$1'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(node-fetch|tmi\\.js|@twurple)/)'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    'src/config.js',
    'src/index.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/config.js',
    '!src/index.js',
    '!**/node_modules/**'
  ],
  setupFiles: [
    './jest.setup.js'
  ],
  testTimeout: 10000,
  injectGlobals: true,
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: -10
    }
  },
  moduleFileExtensions: [
    'js',
    'json',
    'jsx',
    'ts',
    'tsx',
    'node'
  ],
  verbose: true,
  bail: 1,
  collectCoverage: true,
  coverageReporters: ['text', 'lcov']
};
