import { PolymarketClient } from './PolymarketClient';
import { BotConfig, Market, Order, TradeLog, PendingOrder } from './types';

export class TradingEngine {
  private client: PolymarketClient;
  private config: BotConfig;
  private tradeLogs: TradeLog[] = [];
  private pendingOrders: PendingOrder[] = [];
  private processedTokens: Set<string> = new Set();
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private activeOrders: Map<string, Order> = new Map();
  private trackingInterval?: NodeJS.Timeout;
  // Market scanning pause control
  private marketScanningPaused: boolean = false;
  private currentMarketEndTime?: Date;
  private currentMarketSlug?: string;

  constructor(config: BotConfig) {
    this.config = config;
    this.client = new PolymarketClient(config);
  }

  /**
   * Initialize the trading engine
   */
  async initialize(): Promise<void> {
    await this.client.initialize();
    console.log('🤖 交易引擎已初始化');
    console.log(`   - 自动交易: ${this.config.autoTradingEnabled ? '已启用 ⚠️' : '已禁用（安全模式）'}`);
    console.log(`   - 概率阈值: ${this.config.probabilityThreshold * 100}%`);
    console.log(`   - 交易数量: ${this.config.tradeSize} shares`);
    console.log(`   - 轮询间隔: ${this.config.pollingInterval / 1000}秒`);
    
    if (this.config.eventSlug) {
      console.log(`   - 监控事件: ${this.config.eventSlug}`);
    }
    if (this.config.marketKeywords && this.config.marketKeywords.length > 0) {
      console.log(`   - 关键词过滤: ${this.config.marketKeywords.join(', ')}`);
    }
    if (!this.config.eventSlug && (!this.config.marketKeywords || this.config.marketKeywords.length === 0)) {
      console.log(`   - 监控范围: 所有活跃市场`);
    }
  }

  /**
   * Start monitoring markets
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 交易引擎已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('🚀 开始监控市场...');

    // Run immediately on start
    await this.scanMarkets();

    // Then run at intervals
    this.intervalId = setInterval(async () => {
      await this.scanMarkets();
    }, this.config.pollingInterval);

    // Start order status tracking (every 10 seconds)
    this.trackingInterval = setInterval(async () => {
      await this.checkOrderStatuses();
    }, this.config.pollingInterval);
  }

  /**
   * Stop monitoring markets
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = undefined;
    }
    this.isRunning = false;
    console.log('🛑 市场监控已停止');
  }

  /**
   * Scan all markets for trading opportunities
   */
  private async scanMarkets(): Promise<void> {
    // 如果市场扫描被暂停（有活跃订单），跳过扫描
    if (this.marketScanningPaused) {
      console.log('\n⏸️ 市场扫描已暂停（正在追踪活跃订单）');
      if (this.currentMarketEndTime) {
        const now = new Date();
        const timeLeft = this.currentMarketEndTime.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
        console.log(`   ⏰ 当前市场将在 ${minutesLeft}分${secondsLeft}秒 后结束`);
        console.log(`   📍 当前市场: ${this.currentMarketSlug || 'Unknown'}`);
      }
      return;
    }

    try {
      console.log('\n🔍 扫描市场中...');
      const markets = await this.client.fetchActiveMarkets();

      let opportunitiesFound = 0;

      for (const market of markets) {
        const opportunities = this.checkMarket(market);
        opportunitiesFound += opportunities;
      }

      if (opportunitiesFound === 0) {
        console.log('📊 未发现交易机会（无选项 > 95%）');
      }
    } catch (error) {
      console.error('❌ 扫描市场时出错:', error);
    }
  }

  /**
   * Check a market for trading opportunities
   */
  private checkMarket(market: Market): number {
    let opportunities = 0;

    for (const token of market.tokens) {
      const price = parseFloat(token.price);
      
      // Check if price is in the valid range: >= threshold but < 1.0 (100%)
      // Skip 100% as market has likely resolved
      if (price >= this.config.probabilityThreshold && price <= 1.0) {
        // Check if we've already processed this token
        const tokenKey = `${market.id}_${token.token_id}`;
        if (this.processedTokens.has(tokenKey)) {
          console.log(`\n✓ 选项已处理，跳过重复下单:`);
          console.log(`   市场: ${market.question}`);
          console.log(`   选项: ${token.outcome}`);
          console.log(`   当前价格: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)`);
          continue; // Skip already processed tokens
        }

        opportunities++;
        console.log(`\n🎯 发现交易机会！`);
        console.log(`   市场: ${market.question}`);
        console.log(`   选项: ${token.outcome}`);
        console.log(`   价格: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)`);

        // 创建待确认订单
        const pendingOrder: PendingOrder = {
          id: `${market.id}_${token.token_id}_${Date.now()}`,
          timestamp: Date.now(),
          marketId: market.id,
          question: market.question,
          tokenId: token.token_id,
          outcome: token.outcome,
          price,
          size: this.config.tradeSize,
          status: 'PENDING',
        };
        
        this.pendingOrders.push(pendingOrder);
        console.log(`   ⏳ 已添加到待确认队列（ID: ${pendingOrder.id.substring(0, 16)}...）`);
        console.log(`   📋 待确认订单总数: ${this.getPendingOrders().length}`);

        // Mark as processed to prevent duplicate orders
        this.processedTokens.add(tokenKey);
        console.log(`   🔒 已标记为已处理，不会重复下单`);
      } else if (price >= 1.0) {
        // Log when we skip 100% options
        console.log(`\n⚠️ 跳过 100% 选项（市场已确定）:`);
        console.log(`   市场: ${market.question}`);
        console.log(`   选项: ${token.outcome}`);
        console.log(`   价格: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)`);
      }
    }

    return opportunities;
  }

  /**
   * Execute a trade
   */
  private async executeTrade(market: Market, token: { token_id: string; outcome: string; price: string }): Promise<void> {
    const price = parseFloat(token.price);
    
    try {
      console.log(`   💰 下单: 以 $${price.toFixed(4)} 价格购买 ${this.config.tradeSize} shares`);
      
      const order = await this.client.createBuyOrder(
        token.token_id,
        price,
        this.config.tradeSize
      );

      const success = order.status === 'FILLED';
      
      this.logTrade({
        timestamp: Date.now(),
        marketId: market.id,
        question: market.question,
        outcome: token.outcome,
        price,
        size: this.config.tradeSize,
        action: success ? `订单成交（ID: ${order.orderId}）` : `订单失败: ${order.error}`,
        success,
        error: order.error,
      });

      if (success) {
        console.log(`   ✅ 交易执行成功！`);
      } else {
        console.log(`   ❌ 交易失败: ${order.error}`);
      }
    } catch (error: any) {
      console.error(`   ❌ 交易执行错误:`, error);
      this.logTrade({
        timestamp: Date.now(),
        marketId: market.id,
        question: market.question,
        outcome: token.outcome,
        price,
        size: this.config.tradeSize,
        action: '执行交易时出错',
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Check status of all active orders
   */
  private async checkOrderStatuses(): Promise<void> {
    // 如果没有活跃订单，检查是否需要恢复市场扫描
    if (this.activeOrders.size === 0) {
      if (this.marketScanningPaused && this.currentMarketEndTime) {
        const now = new Date();
        if (now >= this.currentMarketEndTime) {
          console.log('\n🔄 当前市场已结束，恢复市场扫描以监控下一个市场');
          this.marketScanningPaused = false;
          this.currentMarketEndTime = undefined;
          this.currentMarketSlug = undefined;
          // 立即触发一次市场扫描
          await this.scanMarkets();
        }
      }
      return;
    }

    console.log(`\n🔍 检查 ${this.activeOrders.size} 个活跃订单的状态...`);

    for (const [orderId, order] of this.activeOrders) {
      try {
        const status = await this.client.getOrderStatus(orderId);
        
        if (status.status === 'MATCHED') {
          // Order fully filled
          order.status = 'FILLED';
          order.sizeFilled = status.sizeFilled || order.size;
          order.sizeRemaining = 0;
          
          console.log(`\n✅ 订单完全成交！`);
          console.log(`   订单号: ${orderId.substring(0, 16)}...`);
          console.log(`   市场: ${order.marketId}`);
          console.log(`   成交数量: ${order.sizeFilled} shares`);
          console.log(`   成交价格: $${order.price.toFixed(4)}`);
          
          this.activeOrders.delete(orderId);
          
          // Log to trade history
          this.logTrade({
            timestamp: Date.now(),
            marketId: order.marketId,
            question: `Order ${orderId.substring(0, 10)}`,
            outcome: order.outcome,
            price: order.price,
            size: order.size,
            action: `订单完全成交`,
            success: true,
          });
        } else if (status.sizeFilled > 0 && status.sizeFilled < order.size) {
          // Partial fill
          order.status = 'PARTIALLY_FILLED';
          order.sizeFilled = status.sizeFilled;
          order.sizeRemaining = status.sizeRemaining;
          
          console.log(`\n⚡ 订单部分成交`);
          console.log(`   订单号: ${orderId.substring(0, 16)}...`);
          console.log(`   已成交: ${status.sizeFilled}/${order.size} shares`);
          console.log(`   剩余: ${status.sizeRemaining} shares`);
        } else if (status.status === 'CANCELLED') {
          // Order cancelled
          order.status = 'CANCELLED';
          console.log(`\n❌ 订单已取消: ${orderId.substring(0, 16)}...`);
          this.activeOrders.delete(orderId);
        }
        
        order.lastChecked = Date.now();
      } catch (error: any) {
        console.error(`   ❌ 检查订单 ${orderId.substring(0, 16)} 状态失败:`, error.message);
      }
    }
    
    // 检查订单处理完成后，是否需要恢复市场扫描
    if (this.activeOrders.size === 0 && this.marketScanningPaused && this.currentMarketEndTime) {
      const now = new Date();
      if (now >= this.currentMarketEndTime) {
        console.log('\n🔄 所有订单已处理且市场已结束，恢复市场扫描');
        this.marketScanningPaused = false;
        this.currentMarketEndTime = undefined;
        this.currentMarketSlug = undefined;
        // 立即触发一次市场扫描
        await this.scanMarkets();
      } else {
        const timeLeft = this.currentMarketEndTime.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
        console.log(`\n⏳ 订单已全部处理，等待当前市场结束（剩余 ${minutesLeft}分${secondsLeft}秒）`);
      }
    }
  }

  /**
   * Log a trade event
   */
  private logTrade(log: TradeLog): void {
    this.tradeLogs.push(log);
    // Keep only last 100 logs
    if (this.tradeLogs.length > 100) {
      this.tradeLogs = this.tradeLogs.slice(-100);
    }
  }

  /**
   * Get trade logs
   */
  getTradeLogs(): TradeLog[] {
    return [...this.tradeLogs].reverse(); // Most recent first
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      autoTradingEnabled: this.config.autoTradingEnabled,
      totalTrades: this.tradeLogs.length,
      successfulTrades: this.tradeLogs.filter(log => log.success).length,
      walletAddress: this.client.getWalletAddress(),
    };
  }

  /**
   * Get current markets
   */
  async getCurrentMarkets(): Promise<Market[]> {
    return await this.client.fetchActiveMarkets();
  }

  /**
   * Get pending orders
   */
  getPendingOrders(): PendingOrder[] {
    return this.pendingOrders.filter(order => order.status === 'PENDING');
  }

  /**
   * Get all orders (including approved/rejected)
   */
  getAllPendingOrders(): PendingOrder[] {
    return [...this.pendingOrders].reverse(); // Most recent first
  }

  /**
   * Get active orders being tracked
   */
  getActiveOrders(): Order[] {
    return Array.from(this.activeOrders.values());
  }


  /**
   * Approve an order and execute the trade
   */
  async approveOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    const order = this.pendingOrders.find(o => o.id === orderId && o.status === 'PENDING');
    
    if (!order) {
      return { success: false, message: '订单不存在或已处理' };
    }

    try {
      console.log(`\n✅ 用户确认订单: ${orderId.substring(0, 16)}...`);
      console.log(`   市场: ${order.question}`);
      console.log(`   选项: ${order.outcome}`);
      console.log(`   💰 执行下单...`);
      // console.log(`🔍 DEBUG approveOrder: order.tokenId = ${order.tokenId}, type = ${typeof order.tokenId}`);
      // console.log(`🔍 DEBUG approveOrder: order.price = ${order.price}, order.size = ${order.size}`);

      // Validate order has required fields
      if (!order.tokenId) {
        throw new Error('订单缺少 tokenId');
      }

      const result = await this.client.createBuyOrder(
        order.tokenId,
        order.price,
        order.size
      );

      order.status = 'APPROVED';
      
      const success = result.status === 'SUBMITTED' || result.status === 'FILLED';
      
      // Add to tracking queue if order was submitted successfully
      // 注意：即使 orderId 是 'CREATED'（fallback值），也可能订单已成功提交
      // 我们仍然要暂停市场扫描并追踪，避免重复下单
      if (success && result.orderId) {
        // 只有当 orderId 不是 'CREATED' 时才加入追踪队列
        if (result.orderId !== 'CREATED') {
          this.activeOrders.set(result.orderId, result);
          console.log(`   🔍 订单已加入追踪队列，订单号: ${result.orderId}`);
        } else {
          console.log(`   ⚠️ 订单已提交但无法获取订单号（可能是API响应问题）`);
          console.log(`   ℹ️  无法追踪订单状态，但将暂停市场扫描避免重复下单`);
        }
        
        // 无论是否获取到真实订单号，都暂停市场扫描
        // 这样可以避免在同一个市场重复下单
        this.marketScanningPaused = true;
        
        // 获取市场结束时间
        try {
          const markets = await this.client.fetchActiveMarkets();
          const market = markets.find(m => m.id === order.marketId);
          if (market && market.endDate) {
            this.currentMarketEndTime = new Date(market.endDate);
            this.currentMarketSlug = this.config.eventSlug;
            console.log(`   ⏸️ 已暂停市场扫描，专注追踪订单`);
            console.log(`   ⏰ 当前市场结束时间: ${this.currentMarketEndTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
          } else {
            // 如果无法获取结束时间，基于15分钟周期计算
            const now = new Date();
            const minutes = now.getUTCMinutes();
            const roundedMinutes = Math.floor(minutes / 15) * 15;
            const nextInterval = new Date(now);
            nextInterval.setUTCMinutes(roundedMinutes + 15);
            nextInterval.setUTCSeconds(0);
            nextInterval.setUTCMilliseconds(0);
            this.currentMarketEndTime = nextInterval;
            this.currentMarketSlug = this.config.eventSlug;
            console.log(`   ⏸️ 已暂停市场扫描，专注追踪订单`);
            console.log(`   ⏰ 预计市场结束时间: ${this.currentMarketEndTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
          }
        } catch (error: any) {
          console.error(`   ⚠️ 无法获取市场结束时间，使用默认15分钟周期: ${error.message}`);
          // Fallback: 基于15分钟周期计算
          const now = new Date();
          const minutes = now.getUTCMinutes();
          const roundedMinutes = Math.floor(minutes / 15) * 15;
          const nextInterval = new Date(now);
          nextInterval.setUTCMinutes(roundedMinutes + 15);
          nextInterval.setUTCSeconds(0);
          nextInterval.setUTCMilliseconds(0);
          this.currentMarketEndTime = nextInterval;
          this.currentMarketSlug = this.config.eventSlug;
          console.log(`   ⏸️ 已暂停市场扫描，专注追踪订单`);
          console.log(`   ⏰ 预计市场结束时间: ${this.currentMarketEndTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
        }
      }
      
      this.logTrade({
        timestamp: Date.now(),
        marketId: order.marketId,
        question: order.question,
        outcome: order.outcome,
        price: order.price,
        size: order.size,
        action: success ? `手动确认订单已提交（ID: ${result.orderId}）` : `订单失败: ${result.error}`,
        success,
        error: result.error,
      });

      if (success) {
        console.log(`   ✅ 订单执行成功！订单号: ${result.orderId}`);
        return { success: true, message: `订单执行成功！订单号: ${result.orderId}` };
      } else {
        console.log(`   ❌ 订单执行失败: ${result.error}`);
        return { success: false, message: `订单执行失败: ${result.error}` };
      }
    } catch (error: any) {
      console.error(`   ❌ 执行订单时出错:`, error);
      order.status = 'PENDING'; // Reset to pending on error
      return { success: false, message: `执行订单时出错: ${error.message}` };
    }
  }

  /**
   * Reject an order
   */
  rejectOrder(orderId: string): { success: boolean; message: string } {
    const order = this.pendingOrders.find(o => o.id === orderId && o.status === 'PENDING');
    
    if (!order) {
      return { success: false, message: '订单不存在或已处理' };
    }

    order.status = 'REJECTED';
    console.log(`❌ 用户拒绝订单: ${orderId.substring(0, 16)}... - ${order.question}`);
    
    this.logTrade({
      timestamp: Date.now(),
      marketId: order.marketId,
      question: order.question,
      outcome: order.outcome,
      price: order.price,
      size: order.size,
      action: '用户拒绝订单',
      success: false,
    });

    return { success: true, message: '订单已拒绝' };
  }
}
