"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const compression_1 = __importDefault(require("compression"));
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const database_1 = require("./config/database");
const index_1 = __importStar(require("./config/index"));
const logger_1 = __importDefault(require("./utils/logger"));
const auth_1 = require("./middleware/auth");
const validate_1 = require("./middleware/validate");
const mime_1 = require("./middleware/mime");
const metrics_1 = require("./services/metrics");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = index_1.default.port;
// Rate limiters
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
const aiProxyLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Invoice submission rate limit exceeded. Max 50/hour.' }
});
const shutdownHandlers = [];
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('SIGTERM', async () => {
    logger_1.default.info('SIGTERM received, starting graceful shutdown');
    for (const handler of shutdownHandlers) {
        try {
            await handler();
        }
        catch (e) {
            logger_1.default.error('Error during shutdown:', e);
        }
    }
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.default.info('SIGINT received, starting graceful shutdown');
    for (const handler of shutdownHandlers) {
        try {
            await handler();
        }
        catch (e) {
            logger_1.default.error('Error during shutdown:', e);
        }
    }
    process.exit(0);
});
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)(index_1.default.cors));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', apiLimiter);
// Request logging middleware
app.use((req, res, next) => {
    logger_1.default.info(`${req.method} ${req.originalUrl}`);
    metrics_1.activeConnections.inc();
    const end = metrics_1.httpRequestDuration.startTimer({ method: req.method, route: req.path });
    res.on('finish', () => {
        end({ status_code: res.statusCode });
        metrics_1.activeConnections.dec();
    });
    next();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'TILV Backend API'
    });
});
// Metrics endpoint (Prometheus scrape)
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(await (0, metrics_1.getMetrics)());
});
// Root endpoint
app.get('/', (req, res) => {
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
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: index_1.default.upload.maxFileSize },
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
        if (index_1.default.upload.allowedExtensions.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error(`File type .${ext} not allowed`));
        }
    }
});
// API v1 Router
const apiV1Router = express_1.default.Router();
apiV1Router.get('/', (req, res) => {
    res.json({
        message: 'TILV API v1',
        version: '1.0.0'
    });
});
apiV1Router.post('/process-invoice', aiProxyLimiter, auth_1.verifyWalletSignature, upload.single('file'), mime_1.verifyMimeType, (0, validate_1.validate)(validate_1.processInvoiceSchema), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file provided' });
            return;
        }
        const form = new form_data_1.default();
        form.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });
        if (req.body.amount)
            form.append('amount', req.body.amount);
        if (req.body.dueDays)
            form.append('dueDays', req.body.dueDays);
        const headers = {
            ...form.getHeaders(),
        };
        // Forward wallet auth headers
        const walletHeaders = ['x-wallet-address', 'x-wallet-signature', 'x-signed-message'];
        for (const h of walletHeaders) {
            const val = req.headers[h];
            if (val)
                headers[h] = Array.isArray(val) ? val[0] : val;
        }
        // Add internal shared secret for backend→AI auth
        if (index_1.default.ai.sharedSecret) {
            headers['x-api-key'] = index_1.default.ai.sharedSecret;
        }
        const { data } = await axios_1.default.post(`${index_1.default.ai.serviceUrl}/process-invoice`, form, { headers, timeout: index_1.default.ai.timeout });
        res.json(data);
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err) && err.response) {
            res.status(err.response.status).json(err.response.data);
        }
        else {
            logger_1.default.error('process-invoice proxy error:', err);
            res.status(502).json({ error: 'AI service unavailable' });
        }
    }
});
// Auth routes (minimal for hackathon — generates JWT from wallet signature)
apiV1Router.post('/auth/wallet', async (req, res) => {
    try {
        const { address, signature, message } = req.body;
        if (!address || !signature || !message) {
            res.status(400).json({ error: 'address, signature, and message required' });
            return;
        }
        const ethers = await Promise.resolve().then(() => __importStar(require('ethers')));
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== address.toLowerCase()) {
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }
        const { default: jwt } = await Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const token = jwt.sign({ wallet: address.toLowerCase() }, index_1.default.jwt.secret, { expiresIn: index_1.default.jwt.expiresIn });
        res.json({ token, wallet: address.toLowerCase() });
    }
    catch (err) {
        logger_1.default.error('Auth error:', err);
        res.status(500).json({ error: 'Authentication failed' });
    }
});
// Invoice history for authenticated user
apiV1Router.get('/invoices', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { Invoice } = await Promise.resolve().then(() => __importStar(require('./models/Invoice')));
        const invoices = await Invoice.find({ ownerAddress: req.user.wallet })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ success: true, data: invoices });
    }
    catch (err) {
        logger_1.default.error('Failed to fetch invoices:', err);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});
app.use('/api/v1', apiV1Router);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `The requested endpoint ${req.originalUrl} does not exist`
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    logger_1.default.error('Unhandled error:', err);
    if (err instanceof multer_1.default.MulterError) {
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
        (0, index_1.validateConfig)();
        await (0, database_1.connectMongoDB)();
        await (0, database_1.connectRedis)();
        const server = app.listen(PORT, () => {
            logger_1.default.info(`Server running on port ${PORT}`);
            logger_1.default.info(`Environment: ${index_1.default.nodeEnv}`);
            logger_1.default.info(`CORS origin: ${index_1.default.cors.origin}`);
            logger_1.default.info(`Mantle RPC: ${index_1.default.mantle.rpcUrl}`);
        });
        shutdownHandlers.push(async () => {
            return new Promise((resolve) => {
                server.close(() => {
                    logger_1.default.info('HTTP server closed');
                    resolve();
                });
            });
        });
        shutdownHandlers.push(async () => {
            await Promise.resolve().then(() => __importStar(require('mongoose'))).then(async (mongoose) => {
                await mongoose.default.connection.close();
                logger_1.default.info('MongoDB connection closed');
            });
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', error);
        process.exit(1);
    }
};
if (require.main === module) {
    startServer();
}
exports.default = app;
//# sourceMappingURL=index.js.map