import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import axios from 'axios';
import { Market, BotConfig, Order, GammaEvent, GammaMarket } from './types';
import { getCurrentBtc15MinSlug } from './slugGenerator';

export class PolymarketClient {
  private clobClient: ClobClient;
  private config: BotConfig;
  private wallet: Wallet;

  constructor(config: BotConfig) {
    this.config = config;
    this.wallet = new Wallet(config.privateKey);
    
    // Build CLOB client configuration
    const clobConfig: any = {
      chainId: config.chainId,
    };
    
    // Add signature type and funder for Email/Magic or Browser Wallet users
    if (config.signatureType && config.proxyAddress) {
      clobConfig.signatureType = config.signatureType;
      clobConfig.funder = config.proxyAddress;
      console.log(`🔐 使用签名类型: ${config.signatureType === 1 ? 'Email/Magic' : 'Browser Wallet'}`);
      console.log(`📍 代理地址: ${config.proxyAddress}`);
    }
    
    // Initialize CLOB client with proper configuration
    this.clobClient = new ClobClient(
      config.clobApiUrl,
      config.chainId,
      new Wallet(config.privateKey),
      clobConfig
    ) as any;

    console.log(`✅ Polymarket 客户端已初始化，钱包地址: ${this.wallet.address}`);
  }

  /**
   * Initialize the client - derive API credentials
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔑 正在派生 API 凭证...');
      
      // Create a temporary client to derive credentials
      const tempClient = new ClobClient(
        this.config.clobApiUrl,
        this.config.chainId,
        this.wallet
      );
      
      // Derive or create API credentials
      const creds = await tempClient.createOrDeriveApiKey();
      console.log('✅ API 凭证已派生');
      console.log(`   API Key: ${creds.key.substring(0, 10)}...`);
      
      // Reinitialize the actual client with credentials
      this.clobClient = new ClobClient(
        this.config.clobApiUrl,
        this.config.chainId,
        this.wallet,
        creds,
        this.config.signatureType,
        this.config.proxyAddress
      ) as any;
      
      console.log('✅ Polymarket 客户端初始化成功');
      console.log('💡 API 凭证已配置，可以创建订单');
    } catch (error: any) {
      console.error('❌ 初始化失败:', error.message || error);
      throw error;
    }
  }


  /**
   * Fetch all active markets from Gamma API and enrich with CLOB real-time prices
   */
  async fetchActiveMarkets(): Promise<Market[]> {
    try {
      let markets: Market[] = [];

      // If event slug is specified, fetch that specific event
      if (this.config.eventSlug) {
        // Check if it's a BTC 15-minute market pattern and regenerate slug
        let currentSlug = this.config.eventSlug;
        if (currentSlug === 'btc-updown-15m' || currentSlug.startsWith('btc-updown-15m')) {
          currentSlug = getCurrentBtc15MinSlug();
          // Update config for next iteration
          this.config.eventSlug = currentSlug;
        }
        
        console.log(`🔍 根据 slug 获取特定事件: ${currentSlug}`);
        const eventMarkets = await this.fetchEventBySlug(currentSlug);
        markets = eventMarkets;
      } else {
        // Otherwise fetch all active events
        const response = await axios.get<GammaEvent[]>(`${this.config.gammaApiUrl}/events`, {
          params: {
            active: true,
            closed: false,
            limit: 100,
          },
        });

        for (const event of response.data) {
          if (!event.markets || !Array.isArray(event.markets)) continue;

          for (const gammaMarket of event.markets) {
            if (!gammaMarket.active || gammaMarket.closed) continue;

            // Handle both single and multi-outcome markets
            if (gammaMarket.markets && gammaMarket.markets.length > 0) {
              // Multi-outcome market
              for (const subMarket of gammaMarket.markets) {
                const market = this.convertGammaMarket(gammaMarket, subMarket);
                if (market) markets.push(market);
              }
            } else {
              // Single outcome market
              const market = this.convertGammaMarket(gammaMarket);
              if (market) markets.push(market);
            }
          }
        }
      }

      // Filter markets first to reduce CLOB API load
      if (this.config.marketKeywords && this.config.marketKeywords.length > 0) {
        const keywords = this.config.marketKeywords.map(k => k.toLowerCase());
        markets = markets.filter(market => {
          const question = market.question.toLowerCase();
          return keywords.some(keyword => question.includes(keyword));
        });
        console.log(`📊 根据关键词过滤后得到 ${markets.length} 个市场`);
      } else {
        console.log(`📊 已获取 ${markets.length} 个活跃市场`);
      }

      // Fetch real-time prices for all tokens in the filtered markets
      console.log(`🔍 DEBUG: markets.length = ${markets.length}`);
      if (markets.length > 0) {
        const allTokenIds = markets.flatMap(m => m.tokens.map(t => t.token_id));
        console.log(`🔍 DEBUG: allTokenIds.length = ${allTokenIds.length}`);
        console.log(`🔍 DEBUG: allTokenIds = ${JSON.stringify(allTokenIds)}`);
        if (allTokenIds.length > 0) {
          console.log(`🔄 正在获取 ${allTokenIds.length} 个 Token 的实时价格...`);
          const realtimePrices = await this.fetchBulkPrices(allTokenIds);
          console.log(`🔍 DEBUG: realtimePrices.size = ${realtimePrices.size}`);
          
          for (const market of markets) {
            console.log(`🔍 DEBUG: 更新市场价格: ${market.question}`);
            this.updateMarketPrices(market, realtimePrices);
          }
          console.log(`✅ 已更新实时价格`);
        }
      }

      return markets;
    } catch (error) {
      console.error('❌ 获取市场失败:', error);
      return [];
    }
  }

  /**
   * Fetch real-time prices from CLOB API using midpoint endpoint
   */
  private async fetchBulkPrices(tokenIds: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    try {
      // Fetch prices concurrently
      const pricePromises = tokenIds.map(async (tokenId) => {
        try {
          const response = await axios.get(`${this.config.clobApiUrl}/midpoint`, {
            params: { token_id: tokenId },
            timeout: 5000,
          });
          
          if (response.data && response.data.mid) {
            const price = parseFloat(response.data.mid);
            prices.set(tokenId, price);
            return { tokenId, price, success: true };
          }
          return { tokenId, price: null, success: false };
        } catch (error) {
          return { tokenId, price: null, success: false, error };
        }
      });
      
      const results = await Promise.all(pricePromises);
      const successCount = results.filter(r => r.success).length;
      console.log(`   ✓ 成功获取 ${successCount}/${tokenIds.length} 个 Token 的价格`);
      
    } catch (error: any) {
      console.error('❌ 批量获取价格失败:', error.message);
    }
    
    return prices;
  }

  /**
   * Fetch a specific event by slug
   */
  private async fetchEventBySlug(slug: string): Promise<Market[]> {
    try {
      // Add cache-busting and fresh data headers
      const response = await axios.get<GammaEvent>(`${this.config.gammaApiUrl}/events/slug/${slug}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        params: {
          _t: Date.now(), // Cache buster
        },
      });
      
      const event = response.data;
      const markets: Market[] = [];

      if (!event.markets || !Array.isArray(event.markets)) {
        console.log('⚠️ 事件没有市场数据');
        return markets;
      }

      console.log(`\n📊 BTC Market 详情:`);
      console.log(`   标题: ${event.title || event.slug}`);
      const beijingTime = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      console.log(`   ⏰ 查询时间: ${beijingTime} (UTC+8)`);

      for (const gammaMarket of event.markets) {
        console.log(`\n🔍 检查市场: ${gammaMarket.question || 'Unknown'}`);
        console.log(`   Active: ${gammaMarket.active}, Closed: ${gammaMarket.closed}`);
        
        if (!gammaMarket.active) {
          console.log(`   ⚠️ 跳过：市场未激活`);
          continue;
        }
        if (gammaMarket.closed) {
          console.log(`   ⚠️ 跳过：市场已关闭`);
          continue;
        }

        // Get token IDs to fetch real-time prices
        const marketData = gammaMarket as any;
        let tokenIds: string[] = [];
        
        // Try to extract token IDs from various fields
        if (marketData.clobTokenIds) {
          try {
            tokenIds = JSON.parse(marketData.clobTokenIds);
          } catch (e) {
            console.log(`   ⚠️ 无法解析 clobTokenIds`);
          }
        } else if (marketData.tokens && Array.isArray(marketData.tokens)) {
          tokenIds = marketData.tokens.map((t: any) => t.token_id).filter(Boolean);
        }

        console.log(`   Token IDs 数量: ${tokenIds.length}`);

        // Fetch and display real-time prices
        if (tokenIds.length > 0) {
          console.log(`\n🔄 正在获取实时价格...`);
          const realtimePrices = await this.fetchBulkPrices(tokenIds);

          // Parse outcomes
          let outcomes: string[] = [];
          if (marketData.outcomes) {
            try {
              outcomes = JSON.parse(marketData.outcomes);
            } catch (e) {
              outcomes = marketData.outcomes;
            }
          }

          // Display prices
          const priceTime = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
          console.log(`\n💹 实时价格 (${priceTime} UTC+8):`);
          for (let i = 0; i < outcomes.length && i < tokenIds.length; i++) {
            const outcome = outcomes[i];
            const tokenId = tokenIds[i];
            const price = realtimePrices.get(tokenId);
            
            if (price !== undefined) {
              const emoji = outcome.toLowerCase().includes('up') ? '📈' : '📉';
              const label = outcome.toUpperCase();
              console.log(`   ${emoji} ${label.padEnd(5)}: ${(price * 100).toFixed(2)}% ($${price.toFixed(4)})`);
            } else {
              console.log(`   ⚠️ ${outcome}: 无法获取价格`);
            }
          }

          // Convert markets and manually build tokens array
          if (gammaMarket.markets && gammaMarket.markets.length > 0) {
            for (const subMarket of gammaMarket.markets) {
              const market = this.convertGammaMarket(gammaMarket, subMarket);
              if (market) {
                // Manually build tokens array since Gamma API doesn't provide it
                market.tokens = tokenIds.map((tokenId, index) => ({
                  token_id: tokenId,
                  outcome: outcomes[index] || `Outcome ${index + 1}`,
                  price: (realtimePrices.get(tokenId) || 0).toString(),
                  winner: false,
                }));
                markets.push(market);
              } else {
                console.log(`   ⚠️ convertGammaMarket 返回 null (子市场)`);
              }
            }
          } else {
            const market = this.convertGammaMarket(gammaMarket);
            if (market) {
              // Manually build tokens array since Gamma API doesn't provide it
              market.tokens = tokenIds.map((tokenId, index) => ({
                token_id: tokenId,
                outcome: outcomes[index] || `Outcome ${index + 1}`,
                price: (realtimePrices.get(tokenId) || 0).toString(),
                winner: false,
              }));
              markets.push(market);
            } else {
              console.log(`   ⚠️ convertGammaMarket 返回 null`);
            }
          }
        } else {
          // No token IDs, still try to convert the market
          if (gammaMarket.markets && gammaMarket.markets.length > 0) {
            for (const subMarket of gammaMarket.markets) {
              const market = this.convertGammaMarket(gammaMarket, subMarket);
              if (market) {
                markets.push(market);
              } else {
                console.log(`   ⚠️ convertGammaMarket 返回 null (子市场)`);
              }
            }
          } else {
            const market = this.convertGammaMarket(gammaMarket);
            if (market) {
              markets.push(market);
            } else {
              console.log(`   ⚠️ convertGammaMarket 返回 null`);
            }
          }
        }
      }

      return markets;
    } catch (error) {
      console.error(`❌ 获取事件 ${slug} 失败:`, error);
      return [];
    }
  }

  /**
   * Update market token prices with real-time data
   */
  private updateMarketPrices(market: Market, realtimePrices: Map<string, number>): void {
    for (const token of market.tokens) {
      if (realtimePrices.has(token.token_id)) {
        token.price = realtimePrices.get(token.token_id)!.toString();
      }
    }
  }

  /**
   * Convert Gamma API market to our Market type
   */
  private convertGammaMarket(gammaMarket: GammaMarket, subMarket?: any): Market | null {
    try {
      const marketData = subMarket || gammaMarket;
      
      // Try to get token IDs from multiple possible fields
      let tokenIds: string[] = [];
      if (marketData.clob_token_ids && marketData.clob_token_ids.length > 0) {
        tokenIds = marketData.clob_token_ids;
      } else if (marketData.clobTokenIds) {
        try {
          tokenIds = JSON.parse(marketData.clobTokenIds);
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Also try to extract from tokens array
      const tokens = marketData.tokens || [];
      console.log(`🔍 DEBUG convertGammaMarket: tokens.length = ${tokens.length}`);
      if (tokens.length > 0) {
        console.log(`🔍 DEBUG convertGammaMarket: tokens[0] =`, JSON.stringify(tokens[0]));
      }
      
      if (tokenIds.length === 0 && tokens.length > 0) {
        tokenIds = tokens.map((t: any) => t.token_id).filter(Boolean);
      }
      
      if (tokenIds.length === 0) {
        console.log(`   ⚠️ 市场 "${marketData.question || gammaMarket.question}" 缺少 token IDs`);
        return null;
      }

      const marketTokens = tokens.map((token: any) => ({
        token_id: token.token_id,
        outcome: token.outcome,
        price: token.price || '0',
        winner: token.winner || false,
      }));
      
      console.log(`🔍 DEBUG convertGammaMarket: marketTokens.length = ${marketTokens.length}`);
      if (marketTokens.length > 0) {
        console.log(`🔍 DEBUG convertGammaMarket: marketTokens[0] =`, JSON.stringify(marketTokens[0]));
      }

      return {
        id: marketData.id || gammaMarket.id,
        question: marketData.question || gammaMarket.question,
        description: gammaMarket.description,
        outcomes: marketData.outcomes || [],
        outcomePrices: marketData.outcome_prices || [],
        tokens: marketTokens,
        active: gammaMarket.active,
        closed: gammaMarket.closed,
        endDate: gammaMarket.end_date_iso,
        volume: gammaMarket.volume,
      };
    } catch (error) {
      console.error('转换市场数据失败:', error);
      return null;
    }
  }

  /**
   * Create and submit a buy order
   */
  async createBuyOrder(tokenId: string, price: number, size: number): Promise<Order> {
    // Validate tokenId before proceeding
    if (!tokenId || typeof tokenId !== 'string') {
      const error = `❌ 无效的 tokenId: ${tokenId} (类型: ${typeof tokenId})`;
      console.error(error);
      throw new Error(error);
    }

    const order: Order = {
      marketId: tokenId,
      tokenId,
      outcome: '',
      side: 'BUY',
      price,
      size,
      timestamp: Date.now(),
      status: 'PENDING',
    };

    try {
      console.log(`📝 创建订单: 以 $${price.toFixed(4)} 价格购买 ${size} shares，代币 ${tokenId.substring(0, 10)}...`);
      console.log(`🔍 DEBUG: tokenId = ${tokenId}, price = ${price}, size = ${size}`);
      
      // Prepare order parameters - using hardcoded price 99 as requested
      const orderParams = {
        tokenID: tokenId,
        price: 0.98,  // Hardcoded to 99 per user request
        side: 'BUY' as const,
        size: size,
      };
      
      console.log(`🔍 DEBUG: orderParams =`, JSON.stringify(orderParams, null, 2));

      // Create and post the order using the client
      const response = await (this.clobClient as any).createAndPostOrder(
        orderParams,
        {
          tickSize: '0.01',
          negRisk: false,
        },
        'GTC'
      );
      
      console.log(`🔍 DEBUG: 订单响应 =`, JSON.stringify(response, null, 2));
      
      // Try to extract order ID from various possible fields
      order.orderId = response.orderID || response.id || response.orderId || 
                      response.order_id || response.messageHash || 'CREATED';
      order.status = 'SUBMITTED';  // Changed from FILLED - order is submitted, not yet matched
      order.hash = response.transactionHash || response.hash || response.txHash;

      console.log(`✅ 订单提交成功！订单号: ${order.orderId}`);
      return order;
    } catch (error: any) {
      console.error('❌ 创建订单失败:', error);
      console.error('❌ 错误消息:', error.message);
      console.error('❌ 错误代码:', error.code);
      if (error.stack) {
        console.error('❌ 错误堆栈:', error.stack);
      }
      order.status = 'FAILED';
      order.error = error.message || 'Unknown error';
      return order;
    }
  }

  /**
   * Get order status from CLOB API
   */
  async getOrderStatus(orderId: string): Promise<{
    status: 'LIVE' | 'MATCHED' | 'CANCELLED' | 'UNKNOWN';
    sizeFilled: number;
    sizeRemaining: number;
  }> {
    try {
      const response = await axios.get(
        `${this.config.clobApiUrl}/order/${orderId}`,
        { timeout: 5000 }
      );
      
      const data = response.data;
      return {
        status: data.status || 'UNKNOWN',
        sizeFilled: parseFloat(data.size_matched || data.sizeFilled || '0'),
        sizeRemaining: parseFloat(data.size_remaining || data.sizeRemaining || '0')
      };
    } catch (error: any) {
      console.error(`❌ 查询订单状态失败 (${orderId}):`, error.message);
      return { status: 'UNKNOWN', sizeFilled: 0, sizeRemaining: 0 };
    }
  }


  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get CLOB client (for advanced usage)
   */
  getClobClient(): ClobClient {
    return this.clobClient;
  }
}
