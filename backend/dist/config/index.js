"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.default = {
    // Server configuration
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    // Mantle Network configuration
    mantle: {
        rpcUrl: process.env.MANTLE_RPC_URL || 'https://rpc.testnet.mantle.xyz',
        chainId: parseInt(process.env.MANTLE_CHAIN_ID || '5001', 10),
        privateKey: process.env.PRIVATE_KEY || '',
        contracts: {
            invoiceNFT: process.env.INVOICE_NFT_ADDRESS || '',
            vaultManager: process.env.VAULT_MANAGER_ADDRESS || '',
            riskEngine: process.env.RISK_ENGINE_ADDRESS || '',
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
        expiresIn: process.env.JWT_EXPIRY || '7d'
    },
    // AI Service configuration
    ai: {
        serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:5000',
        timeout: 60000 // 60 seconds
    },
    // CORS configuration
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true
    },
    // File upload configuration
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
        allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg'],
        uploadPath: process.env.UPLOAD_PATH || './uploads'
    }
};
//# sourceMappingURL=index.js.map