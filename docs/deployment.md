# Hermes Funds 部署文档 v1.0

> 本文档涵盖本地开发、生产部署的完整流程，包括数据库、前后端、Skill 配置。

---

## 目录

1. [系统架构](#1-系统架构)
2. [环境要求](#2-环境要求)
3. [快速开始（开发环境）](#3-快速开始开发环境)
4. [生产部署](#4-生产部署)
5. [数据库管理](#5-数据库管理)
6. [API 文档](#6-api-文档)
7. [Skill 配置](#7-skill-配置)
8. [外部数据源](#8-外部数据源)
9. [目录结构](#9-目录结构)
10. [常见问题](#10-常见问题)

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     用户层（Web / Feishu / CLI）                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP REST API
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    📡 后端 API 层（Next.js 14）                   │
│                                                                 │
│  前端页面          API Routes           业务逻辑层（Service）       │
│  /transactions  →  /api/transactions  →  TransactionService       │
│  /investments   →  /api/investments   →  InvestmentService       │
│  /reports       →  /api/reports       →  ReportService           │
│  /budgets        →  /api/budgets       →  BudgetService           │
│                   /api/nlu/parse      →  NLU Engine (Skill)       │
│                                                                 │
│  数据访问层（Drizzle ORM + SQLite）                               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    🗄️ 数据库层（SQLite）                          │
│                                                                 │
│  开发环境: data/hermes-funds-dev.db                               │
│  生产环境: data/hermes-funds-prod.db                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 环境要求

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | ≥ 18.0 | 推荐 LTS 版本 |
| npm | ≥ 9.0 | 随 Node.js 安装 |
| SQLite | 3.x | 通常随 Node.js 内置（better-sqlite3） |
| Git | 任意稳定版 | 代码管理 |

### 推荐开发环境

```bash
# 检查版本
node -v   # ≥ 18.0
npm -v    # ≥ 9.0
git -v    # 任意
```

---

## 3. 快速开始（开发环境）

### 3.1 克隆代码

```bash
git clone https://github.com/zndxyhn/hermes-funds.git
cd hermes-funds
```

### 3.2 安装依赖

```bash
npm install
```

### 3.3 环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env.local
```

编辑 `.env.local`：

```bash
NODE_ENV=development
PORT=3001
DB_NAME=hermes-funds-dev.db
```

### 3.4 初始化数据库

```bash
# 方式一：运行初始化脚本（自动建表 + 种子数据）
npx tsx src/lib/db/scripts/seed.ts

# 方式二：使用 Drizzle Kit（仅生成表结构）
npm run db:push
```

### 3.5 启动开发服务器

```bash
npm run dev
```

服务启动后访问：**http://localhost:3001**

| 页面 | 地址 |
|------|------|
| 首页/仪表盘 | http://localhost:3001 |
| 记账 | http://localhost:3001/transactions |
| 投资 | http://localhost:3001/investments |
| 报表 | http://localhost:3001/reports |
| 预算 | http://localhost:3001/budgets |

### 3.6 运行测试

```bash
npm test          # 运行所有测试
npx vitest run     # 同上
npx vitest run src/lib/services/__tests__/transaction.service.test.ts  # 单文件
```

---

## 4. 生产部署

### 4.1 分支策略

```
main    ← 生产环境（稳定版本）
develop ← 开发环境（最新功能）
```

### 4.2 生产部署步骤

#### 前端构建

```bash
# 1. 切换到 main 分支
git checkout main

# 2. 安装生产依赖
npm ci --production

# 3. 构建
NODE_ENV=production npm run build
```

#### 启动服务

```bash
# 设置环境变量
export NODE_ENV=production
export PORT=3001

# 启动
npm run start -- -p 3001
```

或使用 PM2 管理进程：

```bash
npm install -g pm2

# 启动
pm2 start npm --name "hermes-funds" -- start -- -p 3001

# 设置环境变量
pm2 set hermes-funds:NODE_ENV production

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

#### Nginx 反向代理（可选）

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

### 4.3 Docker 部署（可选）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start", "--", "-p", "3001"]
```

```bash
docker build -t hermes-funds .
docker run -d -p 3001:3001 \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  hermes-funds
```

---

## 5. 数据库管理

### 5.1 数据库文件位置

| 环境 | 文件路径 | 说明 |
|------|---------|------|
| 开发 | `data/hermes-funds-dev.db` | 自动创建 |
| 生产 | `data/hermes-funds-prod.db` | 需手动创建或迁移 |

> **注意**：`data/` 目录在 `.gitignore` 中，不会被提交到 Git。

### 5.2 数据库 Schema 迁移

```bash
# 生成迁移文件（根据 schema.ts）
npm run db:generate

# 推送到数据库（开发用）
npm run db:push

# 查看数据库（图形界面）
npm run db:studio
```

### 5.3 种子数据

种子脚本路径：`src/lib/db/scripts/seed.ts`

```bash
# 运行种子脚本（幂等，可重复执行）
npx tsx src/lib/db/scripts/seed.ts
```

种子数据包括：
- 1 个默认用户
- 6 个账户（现金/银行卡/支付宝/微信/投资账户/测试账户）
- 13 个支出分类 + 7 个收入分类
- 1 个测试投资（华夏成长优选）
- 历史交易记录

### 5.4 备份与恢复

```bash
# 备份
cp data/hermes-funds-prod.db data/backup/hermes-funds-$(date +%Y%m%d).db

# 恢复
cp data/backup/hermes-funds-20260504.db data/hermes-funds-prod.db
```

### 5.5 清空数据（重置）

```bash
# 删除数据库文件
rm data/hermes-funds-dev.db

# 重新初始化
npx tsx src/lib/db/scripts/seed.ts
```

---

## 6. API 文档

所有 API 均返回统一格式：

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

### 6.1 核心 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/accounts` | 获取账户列表 |
| POST | `/api/accounts` | 创建账户 |
| GET | `/api/transactions` | 获取交易记录 |
| POST | `/api/transactions` | 创建交易 |
| GET | `/api/categories` | 获取分类列表 |
| GET | `/api/investments` | 获取投资列表 |
| POST | `/api/investments` | 创建投资 |
| GET | `/api/reports/monthly_summary` | 月度收支报表 |
| GET | `/api/reports/net-worth` | 净资产报表 |
| GET | `/api/reports/cash-flow` | 现金流报表 |
| GET | `/api/budgets` | 获取预算列表 |
| POST | `/api/budgets` | 创建预算 |
| GET | `/api/fund-quotes?ticker=000001` | 基金实时行情 |
| GET | `/api/investments/search?q=华夏` | 基金搜索 |
| POST | `/api/nlu/parse` | 自然语言解析 |

### 6.2 NLU 解析 API

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

**Intent 类型**：`expense` | `income` | `transfer` | `investment_buy` | `investment_sell` | `query`

### 6.3 基金行情 API

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

### 6.4 基金搜索 API

**端点**：`GET /api/investments/search?q=华夏`

**响应**：

```json
{
  "success": true,
  "data": [
    { "ticker": "000001", "name": "华夏成长混合", "type": "fund" },
    { "ticker": "002001", "name": "华夏国证半导体", "type": "fund" }
  ]
}
```

---

## 7. Skill 配置

### 7.1 NLU Skill 架构

NLU（自然语言理解）引擎以 **Hermes Agent Skill** 的形式运行，独立于主应用。

```
Hermes Funds App (Next.js)
        │
        │  POST /api/nlu/parse
        │  file:// 动态加载
        ▼
~/.hermes/profiles/gaoshou/skills/hermes-funds/scripts/nlu_engine.js
```

### 7.2 Skill 文件结构

```
~/.hermes/profiles/gaoshou/skills/hermes-funds/
├── SKILL.md           ← Skill 定义文件
└── scripts/
    └── nlu_engine.js  ← NLU 解析引擎（导出 parse 函数）
```

### 7.3 NLU Engine 接口

```typescript
// nlu_engine.js 导出格式
export function parse(text: string): {
  intent: string;
  intentConfidence: number;
  amount: number | null;
  date: string | null;
  category: { id: string; name: string; confidence: number; method: string } | null;
  account: { id: string; name: string } | null;
  investment: { id: string; name: string } | null;
  canConfirm: boolean;
  missingSlots: string[];
  response: string | null;
}
```

### 7.4 Skill 调用链路

```
用户输入: "餐饮花费128元"
    │
    ▼
Hermes Funds Web App
    │
    │  POST /api/nlu/parse { text: "餐饮花费128元" }
    ▼
Next.js API Route: src/app/api/nlu/parse/route.ts
    │
    │  import(`file://${nluPath}`)
    │  nluPath = ~/.hermes/profiles/gaoshou/skills/hermes-funds/scripts/nlu_engine.js
    ▼
Hermes NLU Skill (nlu_engine.js)
    │
    │  parse(text) → { intent, amount, category, ... }
    ▼
返回结构化数据给前端
```

### 7.5 Skill 部署要求

NLU Skill 必须存在于运行服务器的用户的 HOME 目录下：

```bash
# 确认路径存在
ls ~/.hermes/profiles/gaoshou/skills/hermes-funds/scripts/nlu_engine.js
```

若 Skill 路径不存在，`/api/nlu/parse` 会返回错误。

### 7.6 开发/调试 Skill

```bash
# 直接测试 NLU 引擎
node --input-type=module -e "
import { parse } from 'file:///home/admin/.hermes/profiles/gaoshou/skills/hermes-funds/scripts/nlu_engine.js';
console.log(JSON.stringify(parse('餐饮花费128元'), null, 2));
"
```

---

## 8. 外部数据源

### 8.1 基金行情数据

| 数据源 | 接口 | 说明 |
|--------|------|------|
| 东方财富（天天基金网） | `fundgz.1234567.com.cn` | 实时基金净值/估算净值，公开免费，无需 API Key |

**调用示例**：

```bash
curl "https://fundgz.1234567.com.cn/js/000001.js?rt=20260504"
```

**返回格式**（JSONP）：

```json
pgz({"fundcode":"000001","name":"华夏成长混合","jzrq":"2026-04-29","dwjz":"1.1470","gsz":"1.1628","gszzf":"1.38",...})
```

**字段映射**：

| 东方财富字段 | App 字段 | 说明 |
|-------------|---------|------|
| fundcode | ticker | 基金代码 |
| name | name | 基金名称 |
| dwjz | nav | 单位净值 |
| jzrq | navDate | 净值日期 |
| gsz | estNav | 估算净值 |
| gszzf | dayChange | 日涨跌(%) |

### 8.2 基金搜索数据

搜索功能通过东方财富搜索接口获取基金列表，接口地址在 `fund-search.service.ts` 中配置。

### 8.3 无需外部 API Key

所有外部数据源均为公开接口，无需申请 API Key 或 Token。

---

## 9. 目录结构

```
hermes-funds/
├── .env.example              # 环境变量模板
├── .env.local                # 本地环境变量（不提交）
├── .gitignore
├── package.json
├── drizzle.config.ts        # Drizzle ORM 配置
├── vitest.config.ts         # Vitest 测试配置
├── next.config.js           # Next.js 配置
├── tailwind.config.ts       # Tailwind CSS 配置
├── SPEC.md                   # 项目规范
│
├── docs/
│   ├── deployment.md         # 本文档
│   ├── BRANCH_STRATEGY.md   # 分支策略
│   ├── requirements.md      # 需求文档
│   └── system-design.md     # 系统设计
│
├── data/                     # 数据库文件（不提交 Git）
│   ├── hermes-funds-dev.db  # 开发数据库
│   └── hermes-funds-prod.db # 生产数据库
│
└── src/
    ├── app/                  # Next.js App Router
    │   ├── page.tsx          # 首页/仪表盘
    │   ├── transactions/      # 记账页面
    │   ├── investments/      # 投资页面
    │   ├── reports/          # 报表页面
    │   ├── budgets/         # 预算页面
    │   └── api/             # API Routes
    │       ├── accounts/
    │       ├── transactions/
    │       ├── categories/
    │       ├── investments/
    │       ├── reports/
    │       ├── budgets/
    │       ├── fund-quotes/  # 基金行情
    │       ├── nlu/parse/    # NLU 解析
    │       └── ...
    │
    ├── components/           # React 组件
    ├── lib/
    │   ├── db/
    │   │   ├── index.ts      # 数据库连接（环境隔离）
    │   │   ├── schema.ts     # 表结构定义
    │   │   └── scripts/
    │   │       └── seed.ts   # 种子数据脚本
    │   ├── services/        # 业务逻辑层
    │   │   ├── account.service.ts
    │   │   ├── transaction.service.ts
    │   │   ├── category.service.ts
    │   │   ├── investment.service.ts
    │   │   ├── roi.service.ts
    │   │   ├── report.service.ts
    │   │   ├── budget.service.ts
    │   │   ├── fund-cache.service.ts
    │   │   ├── fund-search.service.ts
    │   │   └── nlu.service.ts
    │   └── utils/
    └── lib/services/__tests__/  # 单元测试
```

---

## 10. 常见问题

### Q: 数据库连接失败

```bash
# 检查数据库文件是否存在
ls -la data/hermes-funds-dev.db

# 若不存在，运行初始化
npx tsx src/lib/db/scripts/seed.ts
```

### Q: `/api/nlu/parse` 返回错误

检查 NLU Skill 文件是否存在：

```bash
ls ~/.hermes/profiles/gaoshou/skills/hermes-funds/scripts/nlu_engine.js
```

若不存在，需在 Hermes Agent 中部署 Skill。

### Q: 基金行情获取失败

东方财富接口可能有访问频率限制，建议缓存 5-10 分钟。

### Q: 端口被占用

```bash
# 查看端口占用
lsof -i :3001

# 使用其他端口
PORT=3002 npm run dev
```

### Q: 如何查看日志？

```bash
# Next.js 开发日志
npm run dev 2>&1 | tee dev.log

# PM2 日志
pm2 logs hermes-funds
```

### Q: 测试数据如何重置？

```bash
# 删除数据库后重新初始化
rm data/hermes-funds-dev.db
npx tsx src/lib/db/scripts/seed.ts
```

---

## 附录：环境变量参考

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `development` | 环境：`development` 或 `production` |
| `PORT` | `3001` | 服务监听端口 |
| `DB_NAME` | `hermes-funds-dev.db`（开发）或 `hermes-funds-prod.db`（生产） | 数据库文件名 |
| `HOME` | 系统默认值 | 用于解析 NLU Skill 路径（通常不需要设置） |
