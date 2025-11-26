# Polymarket Trading Bot 🤖

全功能的 Polymarket 自动交易机器人，支持实时市场监控、智能订单管理、数据分析和可视化查询。

## ✨ 核心功能

### 🎯 智能交易系统

- **自动市场监控**: 实时扫描 BTC 15 分钟预测市场
- **时间窗口控制**: 可配置的订单放置时间窗口（MIN_TRADE_MINUTE）
- **动态定价策略**: 根据市场价格智能调整订单价格
  - 市场价 95%-98% → 下单价 0.98
  - 市场价 >98% → 下单价 0.99
- **自动订单追踪**: 实时监控订单成交状态
- **智能订单取消**: 市场结束时自动取消未成交订单

### 📊 数据管理

- **SQLite 数据库**: 完整的订单历史记录（UTC+8 时间）
- **事件日志**: 记录订单完整生命周期
  - ORDER_CREATED - 订单创建
  - ORDER_SUBMITTED - 订单提交
  - ORDER_UPDATED - 状态更新
  - ORDER_FILLED - 订单成交
  - ORDER_CANCELLED - 订单取消
  - ORDER_FAILED - 订单失败
- **市场结果记录**: 自动查询并记录市场最终结果

### 🎨 Web 界面

- **主仪表板**: 实时展示交易统计和活跃订单
- **订单查询页**: 高级查询和统计分析
  - 时间范围筛选
  - 事件类型筛选
  - 可视化图表（饼图、折线图）
  - 市场结果对比
- **响应式设计**: 支持桌面和移动设备

## 📋 系统要求

- Node.js 16+
- npm 或 yarn
- Polymarket 账户和钱包
- USDC 余额

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd polymarket-trading-bot
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 到 `.env`:

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# ========== 钱包配置 ==========
PRIVATE_KEY=your_private_key_here
POLYMARKET_PROXY_ADDRESS=your_proxy_address_here
SIGNATURE_TYPE=1  # 1=Email/Magic, 2=浏览器钱包, 留空=直接EOA

# ========== 交易配置 ==========
TRADE_SIZE=5
PROBABILITY_THRESHOLD=0.95
POLLING_INTERVAL=2000
AUTO_TRADING_ENABLED=true

# ========== 时间窗口配置 ==========
MIN_TRADE_MINUTE=5  # 在15分钟窗口的第5分钟后才下单

# ========== 市场配置 ==========
EVENT_SLUG=btc-15min  # 自动生成BTC 15分钟市场
CHAIN_ID=137  # Polygon主网
```

### 4. 运行机器人

**开发模式**:

```bash
npm run dev
```

**生产模式**:

```bash
npm run build
npm start
```

### 5. 访问界面

- **主仪表板**: http://localhost:3000
- **订单查询**: http://localhost:3000/orders.html

## 🎛️ 配置说明

| 配置项                  | 说明                 | 默认值 | 示例        |
| ----------------------- | -------------------- | ------ | ----------- |
| `TRADE_SIZE`            | 每次交易 shares 数量 | 5      | `10`        |
| `PROBABILITY_THRESHOLD` | 概率阈值             | 0.95   | `0.98`      |
| `POLLING_INTERVAL`      | 扫描间隔（毫秒）     | 2000   | `5000`      |
| `AUTO_TRADING_ENABLED`  | 自动交易开关         | false  | `true`      |
| `MIN_TRADE_MINUTE`      | 最小下单时间（分钟） | 0      | `5`         |
| `EVENT_SLUG`            | 市场类型             | -      | `btc-15min` |

## 📁 项目结构

```
polymarket-trading-bot/
├── src/
│   ├── bot/
│   │   ├── types.ts                # TypeScript类型定义
│   │   ├── PolymarketClient.ts     # API客户端
│   │   ├── TradingEngine.ts        # 交易引擎核心
│   │   ├── slugGenerator.ts        # 市场slug生成器
│   │   └── reanalyze.ts           # 市场分析工具
│   ├── server/
│   │   └── index.ts                # Express服务器
│   ├── utils/
│   │   ├── logger.ts               # 日志工具
│   │   └── orderLogger.ts          # 订单日志（SQLite）
│   └── scripts/
│       └── migrateTimestamps.ts    # 数据库迁移脚本
├── public/
│   ├── index.html                  # 主仪表板
│   ├── orders.html                 # 订单查询页
│   ├── styles.css                  # 统一样式
│   └── app.js                      # 前端逻辑
├── data/
│   └── orders.db                   # SQLite数据库
├── logs/
│   ├── bot_*.log                   # 系统日志
│   └── orders_*.log                # 订单日志（已废弃）
└── .env                            # 环境配置
```

## 🔌 API 端点

### 系统状态

- `GET /api/status` - 获取机器人状态
- `GET /api/config` - 获取配置信息
- `GET /api/wallet` - 获取钱包地址

### 交易管理

- `GET /api/trades` - 获取交易历史
- `GET /api/markets` - 获取活跃市场
- `GET /api/pending-orders` - 获取待确认订单
- `GET /api/active-orders` - 获取活跃订单
- `POST /api/approve-order` - 批准订单

### 订单查询（新增）

- `GET /api/orders` - 查询订单列表
  - 参数: `startDate`, `endDate`, `eventType`, `limit`, `offset`
- `GET /api/orders/stats` - 获取统计数据
  - 参数: `startDate`, `endDate`

## 💡 工作原理

### 订单生命周期

```
1. 市场扫描 → 2. 发现机会 → 3. 时间检查 → 4. 下单创建
         ↓
5. 订单提交 → 6. 状态追踪 → 7. 订单成交 → 8. 记录结果
         ↓                      ↓
    订单取消 ←──── 市场结束 ────┘
```

### 市场结果记录

```
订单成交 → hasFilledOrders = true
    ↓
市场结束 → 查询获胜结果
    ↓
更新数据库 → market_result字段
```

### 时间窗口控制

```
每15分钟周期:
0-4分钟: 仅监测，不下单
5-14分钟: 可以下单
```

## 📊 数据库 Schema

```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,              -- 事件时间（UTC+8）
  event_type TEXT,             -- 事件类型
  order_id TEXT,               -- 订单号
  market_id TEXT,              -- 市场ID
  outcome TEXT,                -- 选项（UP/DOWN）
  price REAL,                  -- 价格
  size REAL,                   -- 数量
  status TEXT,                 -- 状态
  details TEXT,                -- 详情
  market_result TEXT,          -- 市场结果
  created_at DATETIME          -- 创建时间（UTC+8）
);
```

## 🛠️ 常用脚本

### 数据库迁移（UTC → UTC+8）

```bash
npx ts-node src/scripts/migrateTimestamps.ts
```

### 查看日志

```bash
tail -f logs/bot_*.log
```

## ⚠️ 重要提醒

### 安全注意事项

1. **私钥安全**: 永远不要分享或提交私钥到代码仓库
2. **资金管理**: 测试时使用小额资金
3. **监控运行**: 定期检查订单和余额
4. **备份数据**: 定期备份 `data/orders.db`

### 最佳实践

1. **测试优先**: 首次运行设置 `AUTO_TRADING_ENABLED=false`
2. **逐步调整**: 从小额交易开始，逐步增加
3. **监控日志**: 关注异常错误和 API 问题
4. **定期检查**: 查看订单查询页面分析表现

## 🐛 故障排查

### 常见错误

**"invalid signature"**

- 检查 `PRIVATE_KEY` 是否正确
- 确认 `SIGNATURE_TYPE` 匹配登录方式
- 验证 `POLYMARKET_PROXY_ADDRESS`

**"502 Bad Gateway"**

- Polymarket API 暂时不可用
- 等待几分钟后重试
- 检查网络连接

**数据库锁定错误**

- 关闭所有访问数据库的进程
- 重启机器人

**订单未自动执行**

- 确认 `AUTO_TRADING_ENABLED=true`
- 检查时间窗口设置 `MIN_TRADE_MINUTE`
- 查看日志确认是否发现交易机会

## 📚 技术栈

- **Backend**: Node.js, TypeScript, Express
- **Database**: SQLite (better-sqlite3)
- **API Client**: @polymarket/clob-client
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Charts**: Chart.js
- **Blockchain**: ethers.js, Polygon Network

## 🔗 参考资源

- [Polymarket 官方文档](https://docs.polymarket.com/)
- [CLOB Client GitHub](https://github.com/Polymarket/clob-client)
- [Gamma API](https://gamma-api.polymarket.com/)
- [CTF 合约](https://polygonscan.com/address/0x4d97dcd97ec945f40cf65f87097ace5ea0476045)

## 📄 许可证

MIT License

## ⚖️ 免责声明

此工具仅供学习和研究目的。使用此机器人进行交易存在财务风险，请谨慎使用并自行承担风险。作者不对任何损失负责。

---

**Made with ❤️ for Polymarket traders**
