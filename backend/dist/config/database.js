"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.redisClient = exports.connectMongoDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("redis");
const index_1 = __importDefault(require("./index"));
const logger_1 = __importDefault(require("../utils/logger"));
// MongoDB connection
const connectMongoDB = async () => {
    await mongoose_1.default.connect(index_1.default.database.mongoUri);
    logger_1.default.info('✅ MongoDB connected successfully');
};
exports.connectMongoDB = connectMongoDB;
// Redis connection
exports.redisClient = null;
const connectRedis = async () => {
    const client = (0, redis_1.createClient)({
        url: index_1.default.database.redisUrl
    });
    client.on('error', (err) => logger_1.default.error('Redis Client Error', err));
    await client.connect();
    logger_1.default.info('✅ Redis connected successfully');
    exports.redisClient = client;
    return client;
};
exports.connectRedis = connectRedis;
//# sourceMappingURL=database.js.map