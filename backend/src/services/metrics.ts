import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register, prefix: 'tilv_' });

export const httpRequestDuration = new client.Histogram({
  name: 'tilv_http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

export const activeConnections = new client.Gauge({
  name: 'tilv_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

export const contractCallsTotal = new client.Counter({
  name: 'tilv_contract_calls_total',
  help: 'Total number of contract calls',
  labelNames: ['contract', 'method'],
  registers: [register],
});

export async function getMetrics(): Promise<string> {
  return register.metrics();
}
