import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { connectMongoDB, connectRedis } from './config/database';
import config, { validateConfig } from './config/index';
import logger from './utils/logger';
import { verifyWalletSignature, authenticateJWT, AuthRequest } from './middleware/auth';
import { validate, processInvoiceSchema } from './middleware/validate';
import { verifyMimeType } from './middleware/mime';
import { getMetrics, httpRequestDuration, activeConnections } from './services/metrics';

dotenv.config();

const app: Express = express();
const PORT = config.port;

// Rate limiters
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

const aiProxyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Invoice submission rate limit exceeded. Max 50/hour.' }
});

const shutdownHandlers: (() => Promise<void>)[] = [];

process.on('unhandledRejection', (reason: Error, promise: Promise<unknown>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, starting graceful shutdown');
    for (const handler of shutdownHandlers) {
        try {
            await handler();
        } catch (e) {
            logger.error('Error during shutdown:', e);
        }
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, starting graceful shutdown');
    for (const handler of shutdownHandlers) {
        try {
            await handler();
        } catch (e) {
            logger.error('Error during shutdown:', e);
        }
    }
    process.exit(0);
});

// Middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', apiLimiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    activeConnections.inc();
    const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
    res.on('finish', () => {
        end({ status_code: res.statusCode });
        activeConnections.dec();
    });
    next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'TILV Backend API'
    });
});

// Metrics endpoint (Prometheus scrape)
app.get('/metrics', async (req: Request, res: Response) => {
    res.set('Content-Type', 'text/plain');
    res.send(await getMetrics());
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'TILV Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            api: '/api/v1/'
        }
    });
});

// Multer config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
        if (config.upload.allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type .${ext} not allowed`));
        }
    }
});

// API v1 Router
const apiV1Router = express.Router();

apiV1Router.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'TILV API v1',
        version: '1.0.0'
    });
});

apiV1Router.post('/process-invoice',
    aiProxyLimiter,
    verifyWalletSignature,
    upload.single('file'),
    verifyMimeType,
    validate(processInvoiceSchema),
    async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file provided' });
                return;
            }
            const form = new FormData();
            form.append('file', req.file.buffer, {
                filename: req.file.originalname,
                contentType: req.file.mimetype,
            });
            if (req.body.amount) form.append('amount', req.body.amount);
            if (req.body.dueDays) form.append('dueDays', req.body.dueDays);

            const headers: Record<string, string> = {
                ...form.getHeaders(),
            };

            // Forward wallet auth headers
            const walletHeaders = ['x-wallet-address', 'x-wallet-signature', 'x-signed-message'] as const;
            for (const h of walletHeaders) {
                const val = req.headers[h];
                if (val) headers[h] = Array.isArray(val) ? val[0] : val;
            }

            // Add internal shared secret for backend→AI auth
            if (config.ai.sharedSecret) {
                headers['x-api-key'] = config.ai.sharedSecret;
            }

            const { data } = await axios.post(
                `${config.ai.serviceUrl}/process-invoice`,
                form,
                { headers, timeout: config.ai.timeout }
            );
            res.json(data);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response) {
                res.status(err.response.status).json(err.response.data);
            } else {
                logger.error('process-invoice proxy error:', err);
                res.status(502).json({ error: 'AI service unavailable' });
            }
        }
    }
);

// Auth routes (minimal for hackathon — generates JWT from wallet signature)
apiV1Router.post('/auth/wallet', async (req: Request, res: Response) => {
    try {
        const { address, signature, message } = req.body;
        if (!address || !signature || !message) {
            res.status(400).json({ error: 'address, signature, and message required' });
            return;
        }

        const ethers = await import('ethers');
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== address.toLowerCase()) {
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }

        const { default: jwt } = await import('jsonwebtoken');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const token = jwt.sign(
            { wallet: address.toLowerCase() },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn } as any
        );

        res.json({ token, wallet: address.toLowerCase() });
    } catch (err) {
        logger.error('Auth error:', err);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Invoice history for authenticated user
apiV1Router.get('/invoices',
    authenticateJWT,
    async (req: AuthRequest, res: Response) => {
        try {
            const { Invoice } = await import('./models/Invoice');
            const invoices = await Invoice.find({ ownerAddress: req.user!.wallet })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
            res.json({ success: true, data: invoices });
        } catch (err) {
            logger.error('Failed to fetch invoices:', err);
            res.status(500).json({ error: 'Failed to fetch invoices' });
        }
    }
);

app.use('/api/v1', apiV1Router);

// 404 handler
app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `The requested endpoint ${req.originalUrl} does not exist`
    });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ error: 'File too large' });
            return;
        }
        res.status(400).json({ error: err.message });
        return;
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
    try {
        validateConfig();
        await connectMongoDB();
        await connectRedis();

        const server = app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${config.nodeEnv}`);
            logger.info(`CORS origin: ${config.cors.origin}`);
            logger.info(`Mantle RPC: ${config.mantle.rpcUrl}`);
        });

        shutdownHandlers.push(async () => {
            return new Promise<void>((resolve) => {
                server.close(() => {
                    logger.info('HTTP server closed');
                    resolve();
                });
            });
        });

        shutdownHandlers.push(async () => {
            await import('mongoose').then(async (mongoose) => {
                await mongoose.default.connection.close();
                logger.info('MongoDB connection closed');
            });
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

export default app;
