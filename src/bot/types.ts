// Market and Trading Types
export interface Market {
  id: string;
  question: string;
  description?: string;
  outcomes: string[];
  outcomePrices: string[];
  tokens: Token[];
  active: boolean;
  closed: boolean;
  endDate?: string;
  volume?: string;
}

export interface Token {
  token_id: string;
  outcome: string;
  price: string;
  winner: boolean;
}

export interface Order {
  orderId?: string;
  marketId: string;
  tokenId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
  status: 'PENDING' | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'FAILED';
  sizeFilled?: number;
  sizeRemaining?: number;
  hash?: string;
  error?: string;
  lastChecked?: number;
}

export interface TradeLog {
  timestamp: number;
  marketId: string;
  question: string;
  outcome: string;
  price: number;
  size: number;
  action: string;
  success: boolean;
  error?: string;
}

export interface PendingOrder {
  id: string;
  timestamp: number;
  marketId: string;
  question: string;
  tokenId: string;
  outcome: string;
  price: number;
  size: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// Configuration Types
export interface BotConfig {
  privateKey: string;
  proxyAddress?: string;
  signatureType?: number;
  clobApiUrl: string;
  gammaApiUrl: string;
  chainId: number;
  tradeSize: number;
  probabilityThreshold: number;
  pollingInterval: number;
  autoTradingEnabled: boolean;
  // Market filtering options
  eventSlug?: string; // Specific event slug to monitor
  marketKeywords?: string[]; // Keywords to filter markets
}

// Gamma API Response Types
export interface GammaMarket {
  id: string;
  question: string;
  description?: string;
  end_date_iso?: string;
  active: boolean;
  closed: boolean;
  markets: GammaSubMarket[];
  volume?: string;
  enable_order_book?: boolean;
}

export interface GammaSubMarket {
  id: string;
  question: string;
  clob_token_ids: string[];
  tokens: GammaToken[];
  outcomes: string[];
  outcome_prices?: string[];
}

export interface GammaToken {
  token_id: string;
  outcome: string;
  price?: string;
  winner: boolean;
}

export interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  markets: GammaMarket[];
  active: boolean;
  closed: boolean;
}
