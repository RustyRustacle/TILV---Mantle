describe('validateConfig', () => {
  const loadConfig = () => {
    jest.resetModules();
    return require('../config/index') as typeof import('../config/index');
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test-jwt-secret-for-ci-1234567890abcdef';
    delete process.env.PRIVATE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows development startup without a private key', () => {
    process.env.NODE_ENV = 'development';
    const { validateConfig } = loadConfig();

    expect(() => validateConfig()).not.toThrow();
  });

  it('requires a private key in production', () => {
    process.env.NODE_ENV = 'production';
    const { validateConfig } = loadConfig();

    expect(() => validateConfig()).toThrow('Missing required environment variables: PRIVATE_KEY');
  });
});
