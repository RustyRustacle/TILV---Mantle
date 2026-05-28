declare const config: {
    port: number;
    nodeEnv: string;
    mantle: {
        rpcUrl: string;
        chainId: number;
        readonly privateKey: string;
        contracts: {
            invoiceNFT: string;
            vaultManager: string;
            riskEngine: string;
            agentController: string;
            usdt: string;
        };
    };
    database: {
        mongoUri: string;
        redisUrl: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    ai: {
        serviceUrl: string;
        timeout: number;
    };
    cors: {
        origin: string;
    };
    upload: {
        maxFileSize: number;
        allowedExtensions: string[];
        uploadPath: string;
    };
};
export declare const validateConfig: () => void;
export default config;
//# sourceMappingURL=index.d.ts.map