// API Base URL
const API_BASE = '';

// Refresh intervals
let statusInterval;
let tradesInterval;
let marketsInterval;
let pendingOrdersInterval;
let activeOrdersInterval;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Polymarket Trading Bot Dashboard initialized');
  
  // Load initial data
  loadStatus();
  loadConfig();
  loadMarkets();
  loadTrades();
  loadPendingOrders();
  loadActiveOrders();
  
  // Set up auto-refresh
  statusInterval = setInterval(loadStatus, 5000); // Every 5 seconds
  tradesInterval = setInterval(loadTrades, 10000); // Every 10 seconds
  marketsInterval = setInterval(loadMarkets, 30000); // Every 30 seconds
  pendingOrdersInterval = setInterval(loadPendingOrders, 3000); // Every 3 seconds
  activeOrdersInterval = setInterval(loadActiveOrders, 5000); // Every 5 seconds
});

// Clean up intervals on page unload
window.addEventListener('beforeunload', () => {
  clearInterval(statusInterval);
  clearInterval(tradesInterval);
  clearInterval(marketsInterval);
  clearInterval(pendingOrdersInterval);
  clearInterval(activeOrdersInterval);
});

/**
 * Load bot status
 */
async function loadStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const result = await response.json();
    
    if (result.success) {
      const { isRunning, autoTradingEnabled, totalTrades, successfulTrades, walletAddress } = result.data;
      
      // Update status indicator
      const statusIndicator = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');
      
      if (isRunning) {
        statusIndicator.className = 'status-indicator active';
        statusText.textContent = 'Running';
      } else {
        statusIndicator.className = 'status-indicator inactive';
        statusText.textContent = 'Stopped';
      }
      
      // Update stats
      document.getElementById('totalTrades').textContent = totalTrades;
      document.getElementById('successfulTrades').textContent = successfulTrades;
      
      const successRate = totalTrades > 0 ? ((successfulTrades / totalTrades) * 100).toFixed(1) : '0';
      document.getElementById('successRate').textContent = `${successRate}%`;
      
      // Update auto trading status
      const autoTradingStatus = document.getElementById('autoTradingStatus');
      const autoTradingText = document.getElementById('autoTradingText');
      
      if (autoTradingEnabled) {
        autoTradingStatus.innerHTML = '<span style="font-size: 1.5rem">✅</span>';
        autoTradingText.textContent = 'Enabled';
        autoTradingText.style.color = 'var(--success)';
      } else {
        autoTradingStatus.innerHTML = '<span style="font-size: 1.5rem">⚠️</span>';
        autoTradingText.textContent = 'Disabled';
        autoTradingText.style.color = 'var(--warning)';
      }
      
      // Update wallet address
      if (walletAddress) {
        document.getElementById('walletAddress').textContent = 
          `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`;
      }
    }
  } catch (error) {
    console.error('Failed to load status:', error);
  }
}

/**
 * Load bot configuration
 */
async function loadConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/config`);
    const result = await response.json();
    
    if (result.success) {
      const { tradeSize, probabilityThreshold, pollingInterval, chainId } = result.data;
      
      document.getElementById('tradeSize').textContent = `${tradeSize} shares`;
      document.getElementById('probabilityThreshold').textContent = `${(probabilityThreshold * 100).toFixed(0)}%`;
      document.getElementById('pollingInterval').textContent = `${pollingInterval / 1000}s`;
      document.getElementById('chainId').textContent = chainId === 137 ? 'Polygon' : `Chain ${chainId}`;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

/**
 * Load active markets
 */
async function loadMarkets() {
  try {
    const response = await fetch(`${API_BASE}/api/markets`);
    const result = await response.json();
    
    if (result.success) {
      displayMarkets(result.data);
    }
  } catch (error) {
    console.error('Failed to load markets:', error);
    document.getElementById('marketsContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <p>Failed to load markets</p>
      </div>
    `;
  }
}

/**
 * Display markets in table
 */
function displayMarkets(markets) {
  const container = document.getElementById('marketsContainer');
  
  // Filter for high probability markets (>90%)
  const highProbMarkets = markets.filter(market => 
    market.tokens.some(token => parseFloat(token.price) >= 0.90)
  );
  
  if (highProbMarkets.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No high-probability markets found (>90%)</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <table class="markets-table">
      <thead>
        <tr>
          <th>Question</th>
          <th>Outcome</th>
          <th>Probability</th>
          <th>Volume</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (const market of highProbMarkets) {
    for (const token of market.tokens) {
      const probability = parseFloat(token.price);
      if (probability < 0.90) continue;
      
      const isVeryHigh = probability >= 0.95;
      const priceClass = isVeryHigh ? 'price-badge high' : 'price-badge';
      
      html += `
        <tr>
          <td class="market-question" title="${market.question}">${market.question}</td>
          <td><span class="outcome-badge">${token.outcome}</span></td>
          <td><span class="${priceClass}">${(probability * 100).toFixed(2)}%</span></td>
          <td>${market.volume ? '$' + formatVolume(market.volume) : '-'}</td>
        </tr>
      `;
    }
  }
  
  html += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = html;
}

/**
 * Load trade history
 */
async function loadTrades() {
  try {
    const response = await fetch(`${API_BASE}/api/trades`);
    const result = await response.json();
    
    if (result.success) {
      displayTrades(result.data);
    }
  } catch (error) {
    console.error('Failed to load trades:', error);
  }
}

/**
 * Display trade history
 */
function displayTrades(trades) {
  const container = document.getElementById('tradeLogContainer');
  
  if (trades.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>No trades yet</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  for (const trade of trades) {
    const date = new Date(trade.timestamp);
    const statusClass = trade.success ? 'success' : 'failed';
    const statusText = trade.success ? 'Success' : 'Failed';
    
    html += `
      <div class="trade-item">
        <div class="trade-header">
          <div class="trade-question">${trade.question}</div>
          <span class="trade-status ${statusClass}">${statusText}</span>
        </div>
        <div class="trade-details">
          <strong>${trade.outcome}</strong> - ${trade.size} shares @ $${trade.price.toFixed(4)}
        </div>
        <div class="trade-meta">
          <span>📅 ${date.toLocaleString()}</span>
          <span>💬 ${trade.action}</span>
        </div>
        ${trade.error ? `<div style="color: var(--error); font-size: 0.875rem; margin-top: 0.5rem;">❌ ${trade.error}</div>` : ''}
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * Refresh markets manually
 */
async function refreshMarkets() {
  const button = event.target;
  button.textContent = '⏳ Loading...';
  await loadMarkets();
  button.textContent = '🔄 Refresh';
}

/**
 * Refresh trades manually
 */
async function refreshTrades() {
  const button = event.target;
  button.textContent = '⏳ Loading...';
  await loadTrades();
  button.textContent = '🔄 Refresh';
}

/**
 * Format volume for display
 */
function formatVolume(volume) {
  const num = parseFloat(volume);
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}

/**
 * Load pending orders
 */
async function loadPendingOrders() {
  try {
    const response = await fetch(`${API_BASE}/api/pending-orders`);
    const result = await response.json();
    
    if (result.success) {
      displayPendingOrders(result.data);
    }
  } catch (error) {
    console.error('Failed to load pending orders:', error);
  }
}

/**
 * Display pending orders
 */
function displayPendingOrders(orders) {
  const card = document.getElementById('pendingOrdersCard');
  const container = document.getElementById('pendingOrdersContainer');
  
  if (orders.length === 0) {
    card.style.display = 'none';
    return;
  }
  
  card.style.display = 'block';
  
  let html = '';
  
  for (const order of orders) {
    const date = new Date(order.timestamp);
    const probability = (order.price * 100).toFixed(2);
    
    html += `
      <div class="pending-order-item">
        <div class="pending-order-header">
          <div class="pending-order-question">${order.question}</div>
          <div class="pending-order-time">${date.toLocaleString()}</div>
        </div>
        <div class="pending-order-details">
          <div class="pending-order-info">
            <div><strong>选项:</strong> <span class="outcome-badge">${order.outcome}</span></div>
            <div><strong>概率:</strong> <span class="price-badge high">${probability}%</span></div>
            <div><strong>数量:</strong> ${order.size} shares</div>
            <div><strong>价格:</strong> $${order.price.toFixed(4)}</div>
          </div>
        </div>
        <div class="pending-order-actions">
          <button class="btn btn-primary" onclick="approveOrder('${order.id}')">
            ✅ 确认下单
          </button>
          <button class="btn btn-secondary" onclick="rejectOrder('${order.id}')">
            ❌ 拒绝
          </button>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * Approve a pending order
 */
async function approveOrder(orderId) {
  if (!confirm('确认要执行此订单吗？')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/pending-orders/${orderId}/approve`, {
      method: 'POST',
    });
    const result = await response.json();
    
    if (result.success) {
      alert(`✅ ${result.message}`);
      await loadPendingOrders();
      await loadTrades();
      await loadStatus();
    } else {
      alert(`❌ ${result.error || '订单执行失败'}`);
    }
  } catch (error) {
    console.error('Failed to approve order:', error);
    alert('❌ 网络错误，请重试');
  }
}

/**
 * Reject a pending order
 */
async function rejectOrder(orderId) {
  try {
    const response = await fetch(`${API_BASE}/api/pending-orders/${orderId}/reject`, {
      method: 'POST',
    });
    const result = await response.json();
    
    if (result.success) {
      await loadPendingOrders();
      await loadTrades();
    } else {
      alert(`❌ ${result.error || '操作失败'}`);
    }
  } catch (error) {
    console.error('Failed to reject order:', error);
    alert('❌ 网络错误，请重试');
  }
}

/**
 * Refresh pending orders manually
 */
async function refreshPendingOrders() {
  const button = event.target;
  button.textContent = '⏳ 加载中...';
  await loadPendingOrders();
  button.textContent = '🔄 刷新';
}

/**
 * Load active orders (being tracked)
 */
async function loadActiveOrders() {
  try {
    const response = await fetch(`${API_BASE}/api/active-orders`);
    const result = await response.json();
    
    if (result.success) {
      displayActiveOrders(result.data);
    }
  } catch (error) {
    console.error('Failed to load active orders:', error);
  }
}

/**
 * Display active orders
 */
function displayActiveOrders(orders) {
  const card = document.getElementById('activeOrdersCard');
  const container = document.getElementById('activeOrdersContainer');
  
  if (orders.length === 0) {
    card.style.display = 'none';
    return;
  }
  
  card.style.display = 'block';
  
  let html = '';
  
  for (const order of orders) {
    const fillPercent = order.sizeFilled && order.size ? (order.sizeFilled / order.size * 100).toFixed(1) : 0;
    const statusColor = order.status === 'FILLED' ? 'var(--success)' : 
                       order.status === 'PARTIALLY_FILLED' ? 'var(--warning)' :
                       order.status === 'CANCELLED' ? 'var(--error)' : 'var(--primary)';
    const statusText = order.status === 'SUBMITTED' ? '等待成交' :
                      order.status === 'PARTIALLY_FILLED' ? '部分成交' :
                      order.status === 'FILLED' ? '完全成交' :
                      order.status === 'CANCELLED' ? '已取消' : order.status;
    
    const orderId = order.orderId || 'N/A';
    const displayId = orderId.length > 16 ? `${orderId.substring(0, 16)}...` : orderId;
    
    html += `
      <div class="pending-order-item" style="border-left: 4px solid ${statusColor}">
        <div class="pending-order-header">
          <div class="pending-order-question">订单 ${displayId}</div>
          <span style="color: ${statusColor}; font-weight: 600">${statusText}</span>
        </div>
        <div class="pending-order-details">
          <div class="pending-order-info">
            <div><strong>代币ID:</strong> ${order.tokenId.substring(0, 12)}...</div>
            <div><strong>价格:</strong> $${order.price.toFixed(4)}</div>
            <div><strong>数量:</strong> ${order.size} shares</div>
            ${order.sizeFilled ? `<div><strong>已成交:</strong> ${order.sizeFilled} shares (${fillPercent}%)</div>` : ''}
          </div>
        </div>
        ${order.sizeFilled && order.size ? `
          <div style="margin-top: 0.75rem;">
            <div style="background: var(--surface); border-radius: 8px; overflow: hidden; height: 8px;">
              <div style="background: ${statusColor}; height: 100%; width: ${fillPercent}%; transition: width 0.3s ease;"></div>
            </div>
            <div style="font-size: 0.75rem; margin-top: 0.25rem; color: var(--text-secondary);">
              成交进度: ${fillPercent}%
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * Refresh active orders manually
 */
async function refreshActiveOrders() {
  const button = event.target;
  button.textContent = '⏳ 加载中...';
  await loadActiveOrders();
  button.textContent = '🔄 刷新';
}
