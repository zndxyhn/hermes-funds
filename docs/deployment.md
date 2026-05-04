# Hermes Funds 部署文档 v1.0

> 面向中文用户，默认货币 CNY，重点追踪基金/ETF 投资组合。

---

## 目录

1. [系统架构](#1-系统架构)
2. [环境要求](#2-环境要求)
3. [快速部署（生产环境）](#3-快速部署生产环境)
4. [数据库管理](#4-数据库管理)
5. [API 文档](#5-api-文档)
6. [目录结构](#6-目录结构)
7. [常见问题](#7-常见问题)

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────┐
│                   用户（Web 浏览器）                │
│         http://localhost:3001                    │
└─────────────────────────┬───────────────────────┘
                          │ HTTP REST API
                          ▼
┌─────────────────────────────────────────────────┐
│              📡 后端 API 层（Next.js 14）          │
│                                                  │
│  前端页面          API Routes        业务逻辑层     │
│  /transactions → /api/transactions → TransactionService
│  /investments  → /api/investments  → InvestmentService
│  /reports       → /api/reports       → ReportService
│  /budgets       → /api/budgets       → BudgetService
│                 /api/nlu/parse       → NLU Engine（内置）
│                 /api/fund-quotes    → FundCacheService
│                                                  │
│  数据访问层（Drizzle ORM + SQLite）               │
└─────────────────────────┬───────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────┐
│            🗄️ 数据库层（SQLite）                   │
│        data/hermes-funds-prod.db                │
└─────────────────────────────────────────────────┘
```

**特点**：
- 完全自包含，从 GitHub 拉取后无需额外依赖
- NLU 解析引擎内置于项目中，无外部 Skill 依赖
- 基金行情数据来自东方财富公开接口，无需 API Key

---

## 2. 环境要求

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18.0 | 推荐 LTS |
| npm | ≥ 9.0 | 随 Node.js 安装 |

无需安装 SQLite（`better-sqlite3` 会自动编译嵌入）。

---

## 3. 快速部署（生产环境）

### 3.1 从 GitHub 拉取代码

```bash
git clone https://github.com/zndxyhn/hermes-funds.git
cd hermes-funds
```

### 3.2 切换到生产分支

```bash
git checkout main
```

### 3.3 安装依赖

```bash
npm ci
```

### 3.4 环境变量配置

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```bash
NODE_ENV=production
PORT=3001
DB_NAME=hermes-funds-prod.db
```

### 3.5 初始化数据库

```bash
# 运行种子脚本（自动建表 + 初始数据，幂等可重复执行）
npx tsx src/lib/db/scripts/seed.ts
```

> 种子数据包含：默认用户、账户（现金/银行卡/支付宝/微信/投资账户）、13 个支出分类 + 7 个收入分类。

### 3.6 构建

```bash
NODE_ENV=production npm run build
```

### 3.7 启动服务

```bash
npm run start -- -p 3001
```

服务地址：**http://localhost:3001**

### 3.8 Nginx 反向代理（生产推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3.9 PM2 进程管理（生产推荐）

```bash
# 安装
npm install -g pm2

# 启动
pm2 start npm --name "hermes-funds" -- start -- -p 3001

# 设置环境变量
pm2 set hermes-funds:NODE_ENV production

# 保存
pm2 save

# 开机自启
pm2 startup
```

---

## 4. 数据库管理

### 4.1 数据库文件

| 环境 | 文件路径 |
|------|---------|
| 生产 | `data/hermes-funds-prod.db` |
| 开发（备用） | `data/hermes-funds-dev.db` |

> `data/` 目录在 `.gitignore` 中，不会被提交。

### 4.2 数据库 Schema 变更

```bash
# 生成迁移文件
npm run db:generate

# 推送到数据库
npm run db:push
```

### 4.3 备份与恢复

```bash
# 备份
cp data/hermes-funds-prod.db "data/backup/hermes-funds-$(date +%Y%m%d).db"

# 恢复
cp data/backup/hermes-funds-20260504.db data/hermes-funds-prod.db
```

### 4.4 重置数据

```bash
rm data/hermes-funds-prod.db
npx tsx src/lib/db/scripts/seed.ts
```

---

## 5. API 文档

所有 API 返回统一格式：

```json
{
  "success": true,
  "data": { ... }
}
```

失败时：

```json
{
  "success": false,
  "error": { "message": "错误描述" }
}
```

### 5.1 核心 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/accounts` | 获取账户列表 |
| POST | `/api/accounts` | 创建账户 |
| GET | `/api/transactions?limit=50&page=1` | 获取交易记录（分页） |
| POST | `/api/transactions` | 创建交易 |
| DELETE | `/api/transactions/[id]` | 删除交易 |
| GET | `/api/categories?type=expense` | 获取分类列表 |
| GET | `/api/investments` | 获取投资列表 |
| POST | `/api/investments` | 创建投资 |
| GET | `/api/reports/monthly_summary?year=2026&month=5` | 月度收支报表 |
| GET | `/api/reports/net-worth` | 净资产报表 |
| GET | `/api/reports/cash-flow` | 现金流报表 |
| GET | `/api/budgets` | 获取预算列表 |
| POST | `/api/budgets` | 创建预算 |
| GET | `/api/fund-quotes?ticker=000001` | 基金实时行情 |

### 5.2 NLU 解析 API

**端点**：`POST /api/nlu/parse`

**请求**：

```json
{
  "text": "餐饮花费128元"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "intent": "expense",
    "intentConfidence": 0.9,
    "amount": 128,
    "date": "2026-05-04",
    "category": {
      "id": "cat_expense_food",
      "name": "餐饮",
      "confidence": 1,
      "method": "exact"
    },
    "canConfirm": true,
    "missingSlots": []
  }
}
```

**支持的 Intent**：

| Intent | 说明 | 示例 |
|--------|------|------|
| `expense` | 支出 | "餐饮花费100元" |
| `income` | 收入 | "工资到账8000元" |
| `transfer` | 转账 | "转账1000元到银行卡" |
| `investment_buy` | 买入 | "定投500元" |
| `investment_sell` | 卖出 | "赎回基金" |
| `query_summary` | 查询 | "本月花了多少" |
| `query_budget` | 预算查询 | "还剩多少预算" |
| `query_investment` | 投资查询 | "我的基金收益" |

### 5.3 基金搜索 API

**端点**：`GET /api/investments/search?q=华夏`

**响应**：

```json
{
  "success": true,
  "data": [
    { "ticker": "000001", "name": "华夏成长混合", "type": "fund" }
  ]
}
```

### 5.4 基金行情 API

**端点**：`GET /api/fund-quotes?ticker=000001`

**响应**：

```json
{
  "success": true,
  "data": {
    "ticker": "000001",
    "name": "华夏成长混合",
    "nav": 1.147,
    "navDate": "2026-04-29",
    "estNav": 1.1628,
    "estNavTime": "2026-05-04 15:30",
    "dayChange": 1.38
  }
}
```

**行情数据来源**：东方财富（天天基金网），公开免费，无需 API Key。

---

## 6. 目录结构

```
hermes-funds/
├── .env.example              # 环境变量模板
├── .env.local                # 本地环境变量（不提交 Git）
├── .gitignore
├── package.json
│
├── docs/
│   ├── deployment.md         # 本文档
│   ├── BRANCH_STRATEGY.md   # 分支策略
│   ├── requirements.md      # 需求文档
│   └── system-design.md     # 系统设计
│
├── data/                     # 数据库（不提交 Git）
│   └── hermes-funds-prod.db
│
└── src/
    ├── app/                  # Next.js App Router
    │   ├── page.tsx          # 首页/仪表盘
    │   ├── transactions/      # 记账页面
    │   ├── investments/      # 投资页面
    │   ├── reports/          # 报表页面
    │   ├── budgets/          # 预算页面
    │   └── api/              # API Routes
    │       ├── accounts/
    │       ├── transactions/
    │       ├── categories/
    │       ├── investments/
    │       ├── reports/
    │       ├── budgets/
    │       ├── fund-quotes/
    │       ├── nlu/parse/     # NLU 解析
    │       └── ...
    │
    ├── components/           # React 组件
    │   └── DashboardCards.tsx
    │
    └── lib/
        ├── db/
        │   ├── index.ts      # 数据库连接
        │   ├── schema.ts     # 表结构
        │   └── scripts/
        │       └── seed.ts   # 种子数据
        │
        └── services/         # 业务逻辑层
            ├── nlu-engine.ts  # NLU 解析引擎（内置）
            ├── account.service.ts
            ├── transaction.service.ts
            ├── category.service.ts
            ├── investment.service.ts
            ├── roi.service.ts
            ├── report.service.ts
            ├── budget.service.ts
            ├── fund-cache.service.ts
            └── fund-search.service.ts
```

---

## 7. 常见问题

### Q: 端口被占用

```bash
# 查看占用
lsof -i :3001

# 换端口
PORT=3002 npm run start -- -p 3002
```

### Q: 数据库初始化失败

```bash
# 确保 data 目录存在
mkdir -p data

# 重新运行种子脚本
npx tsx src/lib/db/scripts/seed.ts
```

### Q: 基金行情获取失败

东方财富接口有频率限制，建议间隔 5 分钟以上。行情数据会缓存。

### Q: 测试如何运行

```bash
npm test           # 全部测试
npx vitest run     # 同上
npx vitest run src/lib/services/transaction.service.test.ts  # 单文件
```

### Q: 如何查看日志？

```bash
# Next.js 生产日志
npm run start -- -p 3001 2>&1 | tee app.log

# PM2 日志
pm2 logs hermes-funds
```

### Q: 部署后数据为空

```bash
# 运行种子脚本初始化数据
npx tsx src/lib/db/scripts/seed.ts
```

---

## 附录：环境变量参考

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `development` | `development` 或 `production` |
| `PORT` | `3001` | 服务监听端口 |
| `DB_NAME` | `hermes-funds-dev.db`（开发）或 `hermes-funds-prod.db`（生产） | 数据库文件名 |
