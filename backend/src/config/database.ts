import mongoose from 'mongoose';
import { createClient } from 'redis';
import config from './index';
import logger from '../utils/logger';

// MongoDB connection
export const connectMongoDB = async (): Promise<void> => {
    await mongoose.connect(config.database.mongoUri);
    logger.info('✅ MongoDB connected successfully');
};

// Redis connection
export let redisClient: ReturnType<typeof createClient> | null = null;

export const connectRedis = async () => {
    const client = createClient({
        url: config.database.redisUrl
    });

    client.on('error', (err: Error) => logger.error('Redis Client Error', err));
    await client.connect();

    logger.info('✅ Redis connected successfully');
    redisClient = client;
    return client;
};
