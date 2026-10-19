import 'dotenv/config';

const bool = (value, fallback = false) =>
  value === undefined ? fallback : String(value).toLowerCase() === 'true';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  MONGODB_URI:
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevandoot',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS) || 10,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  MAX_UPLOAD_SIZE_MB: Number(process.env.MAX_UPLOAD_SIZE_MB) || 5,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  AI_PROVIDER: process.env.AI_PROVIDER || 'local',
  AI_PROVIDER_URL: process.env.AI_PROVIDER_URL || '',
  AI_PROVIDER_API_KEY: process.env.AI_PROVIDER_API_KEY || '',
  AI_PROVIDER_MODEL: process.env.AI_PROVIDER_MODEL || '',
  AI_PROVIDER_TIMEOUT_MS: Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 8000,
  AI_PROVIDER_TYPE: process.env.AI_PROVIDER_TYPE || 'openai-compatible',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEV: process.env.NODE_ENV !== 'production',
  IS_MOCK: bool(process.env.ENABLE_MOCK_AUTH, false),
};

export default env;
