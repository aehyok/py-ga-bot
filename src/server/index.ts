import '../utils/logger'; // Must be first to capture all logs
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { TradingEngine } from '../bot/TradingEngine';
import { BotConfig } from '../bot/types';
import { getCurrentBtc15MinSlug } from '../bot/slugGenerator';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['PRIVATE_KEY', 'CLOB_API_URL', 'GAMMA_API_URL', 'CHAIN_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ 缺少必需的环境变量: ${envVar}`);
    process.exit(1);
  }
}

// Check if EVENT_SLUG is set to BTC 15-minute pattern
let eventSlug = process.env.EVENT_SLUG || undefined;
if (eventSlug === 'btc-updown-15m' || eventSlug?.startsWith('btc-updown-15m')) {
  // Generate dynamic slug based on current time
  eventSlug = getCurrentBtc15MinSlug();
  console.log(`🎯 检测到 BTC 15分钟模式，动态生成 Slug: ${eventSlug}`);
}

// Create bot configuration
const config: BotConfig = {
  privateKey: process.env.PRIVATE_KEY!,
  proxyAddress: process.env.POLYMARKET_PROXY_ADDRESS,
  signatureType: process.env.SIGNATURE_TYPE ? parseInt(process.env.SIGNATURE_TYPE) : undefined,
  clobApiUrl: process.env.CLOB_API_URL || 'https://clob.polymarket.com',
  gammaApiUrl: process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com',
  chainId: parseInt(process.env.CHAIN_ID || '137'),
  tradeSize: parseFloat(process.env.TRADE_SIZE || '5'),
  probabilityThreshold: parseFloat(process.env.PROBABILITY_THRESHOLD || '0.95'),
  pollingInterval: parseInt(process.env.POLLING_INTERVAL || '30000'),
  autoTradingEnabled: process.env.AUTO_TRADING_ENABLED === 'true',
  // Market filtering
  eventSlug: eventSlug,
  marketKeywords: process.env.MARKET_KEYWORDS 
    ? process.env.MARKET_KEYWORDS.split(',').map(k => k.trim()).filter(k => k.length > 0)
    : undefined,
};

// Initialize trading engine
const tradingEngine = new TradingEngine(config);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// API Routes

/**
 * Get bot status
 */
app.get('/api/status', (req: Request, res: Response) => {
  const status = tradingEngine.getStatus();
  res.json({
    success: true,
    data: status,
  });
});

/**
 * Get trade logs
 */
app.get('/api/trades', (req: Request, res: Response) => {
  const logs = tradingEngine.getTradeLogs();
  res.json({
    success: true,
    data: logs,
  });
});

/**
 * Get current markets
 */
app.get('/api/markets', async (req: Request, res: Response) => {
  try {
    const markets = await tradingEngine.getCurrentMarkets();
    res.json({
      success: true,
      data: markets,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get bot configuration (sanitized)
 */
app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      tradeSize: config.tradeSize,
      probabilityThreshold: config.probabilityThreshold,
      pollingInterval: config.pollingInterval,
      autoTradingEnabled: config.autoTradingEnabled,
      chainId: config.chainId,
    },
  });
});

/**
 * Get pending orders
 */
app.get('/api/pending-orders', (req: Request, res: Response) => {
  const orders = tradingEngine.getPendingOrders();
  res.json({
    success: true,
    data: orders,
  });
});

/**
 * Approve a pending order
 */
app.post('/api/pending-orders/:orderId/approve', async (req: Request, res: Response) => {
  const { orderId } = req.params;
  
  try {
    const result = await tradingEngine.approveOrder(orderId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get active orders (being tracked)
 */
app.get('/api/active-orders', (req: Request, res: Response) => {
  const orders = tradingEngine.getActiveOrders();
  res.json({
    success: true,
    data: orders,
  });
});

/**
 * Reject a pending order
 */
app.post('/api/pending-orders/:orderId/reject', (req: Request, res: Response) => {
  const { orderId } = req.params;
  
  const result = tradingEngine.rejectOrder(orderId);
  
  if (result.success) {
    res.json({
      success: true,
      message: result.message,
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.message,
    });
  }
});

/**
 * Start/stop bot
 */
app.post('/api/control', async (req: Request, res: Response) => {
  const { action } = req.body;

  try {
    if (action === 'start') {
      await tradingEngine.start();
      res.json({
        success: true,
        message: 'Trading bot started',
      });
    } else if (action === 'stop') {
      tradingEngine.stop();
      res.json({
        success: true,
        message: 'Trading bot stopped',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use "start" or "stop"',
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Polymarket 自动交易机器人');
    console.log('='.repeat(50));
    
    // Initialize trading engine
    await tradingEngine.initialize();
    
    // Start the bot automatically
    await tradingEngine.start();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`✅ 服务器运行中: http://localhost:${PORT}`);
      console.log(`📊 仪表板: http://localhost:${PORT}`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('❌ 启动服务器失败:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 正在优雅关闭...');
  tradingEngine.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在优雅关闭...');
  tradingEngine.stop();
  process.exit(0);
});

// Start the application
startServer();
