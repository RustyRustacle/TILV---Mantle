"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = void 0;
const path_1 = __importDefault(require("path"));
const safeParseInt = (value, defaultValue) => {
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};
let privateKeyCache;
const config = {
    // Server configuration
    port: safeParseInt(process.env.PORT, 3001),
    nodeEnv: process.env.NODE_ENV || 'development',
    // Mantle Network configuration
    mantle: {
        rpcUrl: process.env.MANTLE_RPC_URL || 'https://rpc.testnet.mantle.xyz',
        chainId: safeParseInt(process.env.MANTLE_CHAIN_ID, 5001),
        get privateKey() {
            if (privateKeyCache === undefined) {
                privateKeyCache = process.env.PRIVATE_KEY || '';
            }
            return privateKeyCache;
        },
        contracts: {
            invoiceNFT: process.env.INVOICE_NFT_ADDRESS || '',
            vaultManager: process.env.VAULT_MANAGER_ADDRESS || '',
            riskEngine: process.env.RISK_ENGINE_ADDRESS || '',
            agentController: process.env.AGENT_CONTROLLER_ADDRESS || '',
            usdt: process.env.USDT_ADDRESS || '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE'
        }
    },
    // Database configuration
    database: {
        mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tilv',
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    // JWT configuration
    jwt: {
        secret: (() => {
            const secret = process.env.JWT_SECRET;
            if (!secret || secret === 'tilv-secret-change-in-production') {
                throw new Error('JWT_SECRET environment variable is required. Generate one with: openssl rand -hex 32');
            }
            return secret;
        })(),
        expiresIn: process.env.JWT_EXPIRY || '1h'
    },
    // AI Service configuration
    ai: {
        serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:5000',
        timeout: safeParseInt(process.env.AI_TIMEOUT, 60000)
    },
    // CORS configuration
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
    },
    // File upload configuration
    upload: {
        maxFileSize: safeParseInt(process.env.MAX_FILE_SIZE, 10485760),
        allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg'],
        uploadPath: path_1.default.resolve(process.env.UPLOAD_PATH || './uploads')
    }
};
const validateConfig = () => {
    const requiredEnvVars = [
        { key: 'PRIVATE_KEY', value: config.mantle.privateKey },
        { key: 'JWT_SECRET', value: process.env.JWT_SECRET }
    ];
    const missing = [];
    requiredEnvVars.forEach(({ key, value }) => {
        if (!value)
            missing.push(key);
    });
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};
exports.validateConfig = validateConfig;
exports.default = config;
//# sourceMappingURL=index.js.map