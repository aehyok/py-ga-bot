# Polymarket Trading Bot 🤖

自动化的 Polymarket 交易机器人，监控所有活跃市场，当选项概率超过 95% 时自动下单。

## ✨ 功能特点

- 🔍 **市场监控**: 自动扫描所有 Polymarket 活跃市场
- 🎯 **智能交易**: 当选项概率 ≥ 95% 时自动下单 5 shares
- 📊 **实时仪表板**: 现代化 Web 界面实时展示市场和交易数据
- ⚡ **高性能**: TypeScript + Express 构建，稳定可靠
- 🔒 **安全**: 私钥和敏感信息通过环境变量管理

## 📋 系统要求

- Node.js 16+ 
- npm 或 yarn
- Polymarket 账户和钱包

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`:

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的配置：

```env
# 必填：您的以太坊私钥
PRIVATE_KEY=your_private_key_here

# 必填：Polymarket Proxy 地址（如果使用 Email/Magic 或浏览器钱包）
POLYMARKET_PROXY_ADDRESS=your_proxy_address_here

# 必填：签名类型
# 1 = Email/Magic 账户
# 2 = 浏览器钱包 (Metamask, Coinbase Wallet 等)
# 留空 = 直接 EOA
SIGNATURE_TYPE=1

# 交易配置
TRADE_SIZE=5                    # 每次交易的 shares 数量
PROBABILITY_THRESHOLD=0.95      # 概率阈值 (0.95 = 95%)
POLLING_INTERVAL=30000          # 轮询间隔（毫秒）

# 安全设置
AUTO_TRADING_ENABLED=false      # 设为 'true' 启用自动交易
```

### 3. 获取配置信息

#### 获取私钥

**Magic Email 账户:**
访问 https://reveal.magic.link/polymarket

**浏览器钱包 (MetaMask 等):**
从钱包扩展导出私钥

#### 获取 Proxy 地址

登录 Polymarket 网站，Proxy 地址显示在您的头像下方。

### 4. 运行机器人

**开发模式 (推荐用于测试):**

```bash
npm run dev
```

**生产模式:**

```bash
# 编译 TypeScript
npm run build

# 运行编译后的代码
npm start
```

### 5. 访问仪表板

打开浏览器访问: http://localhost:3000

## 🎨 仪表板功能

- **实时统计**: 总交易次数、成功率、钱包地址
- **机器人配置**: 交易大小、概率阈值、轮询间隔
- **活跃市场**: 显示所有高概率市场（>90%）
- **交易历史**: 完整的交易日志和状态

## ⚙️ 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `TRADE_SIZE` | 每次交易的 shares 数量 | 5 |
| `PROBABILITY_THRESHOLD` | 触发交易的概率阈值 | 0.95 (95%) |
| `POLLING_INTERVAL` | 市场扫描间隔（毫秒） | 30000 (30秒) |
| `AUTO_TRADING_ENABLED` | 是否启用自动交易 | false |

## ⚠️ 重要提醒

1. **测试优先**: 首次运行时请将 `AUTO_TRADING_ENABLED` 设为 `false`，观察机器人行为
2. **资金安全**: 确保钱包中有足够的 USDC，但不要存放过多资金
3. **市场理解**: 请确保理解 Polymarket 的工作原理和交易风险
4. **监控运行**: 定期检查仪表板和交易日志
5. **私钥安全**: 永远不要分享您的私钥，`.env` 文件已在 `.gitignore` 中

## 🏗️ 项目结构

```
polymarket-trading-bot/
├── src/
│   ├── bot/
│   │   ├── types.ts              # TypeScript 类型定义
│   │   ├── PolymarketClient.ts   # Polymarket API 客户端
│   │   └── TradingEngine.ts      # 交易引擎核心逻辑
│   └── server/
│       └── index.ts              # Express 服务器
├── public/
│   ├── index.html                # 仪表板 HTML
│   ├── styles.css                # 样式文件
│   └── app.js                    # 前端 JavaScript
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 获取机器人状态 |
| `/api/trades` | GET | 获取交易历史 |
| `/api/markets` | GET | 获取活跃市场 |
| `/api/config` | GET | 获取配置信息 |
| `/api/control` | POST | 控制机器人（启动/停止） |

## 🐛 故障排查

**"invalid signature" 错误:**
- 检查私钥是否正确
- 确认 `SIGNATURE_TYPE` 与登录方式匹配
- 验证 `POLYMARKET_PROXY_ADDRESS` 是否正确

**"not enough balance / allowance" 错误:**
- 确保钱包有足够的 USDC
- 如使用 MetaMask，需要设置 allowance

**无法连接到 API:**
- 检查网络连接
- 确认 API URL 配置正确

## 📚 参考资源

- [Polymarket 官方文档](https://docs.polymarket.com/)
- [CLOB Client GitHub](https://github.com/Polymarket/clob-client)
- [Polymarket 网站](https://polymarket.com)

## 📄 许可证

MIT License

## ⚖️ 免责声明

此工具仅供学习和研究目的。使用此机器人进行交易存在财务风险，作者不对任何损失负责。请谨慎使用，自行承担风险。
