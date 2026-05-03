# Hermes Funds — 系统设计文档 v1.0

> 版本：v1.0（详细设计）
> 日期：2025-05-03
> 阶段：系统设计

---

## 目录

1. [总体架构](#1-总体架构)
2. [记账模块详细设计](#2-记账模块详细设计)
3. [投资模块详细设计](#3-投资模块详细设计)
4. [数据库设计](#4-数据库设计)
5. [API 设计](#5-数据库设计)
6. [Skill 设计（自然语言解析）](#6-skill-设计自然语言解析)
7. [开发优先级与里程碑](#7-开发优先级与里程碑)

---

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户（Feishu / CLI / Web）                │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 自然语言对话
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    🤖 Hermes Funds Skill                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 自然语言解析 │  │  对话管理器  │  │  API 调用器  │              │
│  │  NLU Engine │  │ Dialog Mgr  │  │ API Caller  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                       │
│         └────────────────┼────────────────┘                       │
│                          │ Intent + Entities                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTP / internal call
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    📡 后端 API 层（Next.js）                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     API Routes                               │ │
│  │  /api/accounts  /api/transactions  /api/categories          │ │
│  │  /api/investments  /api/reports  /api/budgets               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    业务逻辑层（Service）                     │ │
│  │  AccountService / TransactionService / CategoryService       │ │
│  │  InvestmentService / ReportService / BudgetService           │ │
│  │  MarketService（行情） / ParserService（解析辅助）            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    数据访问层（Drizzle ORM）                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    🗄️ 数据库层（SQLite / PG）                    │
│  accounts / transactions / categories / investments              │
│  budgets / asset_snapshots / fund_cache / sip_plans             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 记账模块详细设计

### 2.1 模块总览

```
记账模块（Accounting）
├── M1-NLU    自然语言解析（Skill层）
├── M2-ACC   账户管理
├── M3-TX     交易记录管理
├── M4-CAT    分类管理
└── M5-REP    报表
```

### 2.2 M1-NLU：自然语言解析（Skill层）

#### 2.2.1 解析流程

```
用户输入: "餐饮花费100元"
    │
    ▼
┌─────────────────────────────────────────┐
│ Step 1: 意图识别（Intent Classification） │
│ 输出: intent = "expense"                 │
│ 置信度: 0.95                            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Step 2: 实体提取（Entity Extraction）    │
│ • amount: 100 (金额)                     │
│ • category_hint: "餐饮" (分类提示)        │
│ • account_hint: null                     │
│ • date_hint: "today" (默认今天)          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Step 3: 槽位填充（Slot Filling）        │
│ 槽位: amount=✓ category=? date=✓       │
│ 缺失槽位: category_id (需要确认)          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Step 4a: 分类推断                        │
│ "餐饮" → 匹配分类 "餐饮" (id=cat_001)   │
│ 置信度: 0.92 → 直接使用                  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Step 4b: 调用 API                        │
│ POST /api/transactions                   │
│ { type:"expense", amount:100,           │
│   categoryId:"cat_001", date:"今天" }   │
└─────────────────────────────────────────┘
```

#### 2.2.2 意图类型定义

| Intent | 说明 | 触发关键词 |
|--------|------|-----------|
| `expense` | 支出 | 花、买、消费、支出、付、扣除 |
| `income` | 收入 | 收、到账、收入、工资、奖金、分红、利息 |
| `transfer` | 转账 | 转账、转出、转入 |
| `investment_buy` | 投资买入 | 买入、购买、定投、投资（基金/股票） |
| `investment_sell` | 投资卖出 | 卖出、赎回、减仓 |
| `query_summary` | 收支查询 | 花了多少、收支、支出多少 |
| `query_investment` | 投资收益查询 | 收益、持仓、行情、净值 |
| `query_budget` | 预算查询 | 预算、还剩多少 |
| `unknown` | 无法识别 | — |

#### 2.2.3 实体类型定义

| Entity | 类型 | 示例 |
|--------|------|------|
| `amount` | number | 100、50.5、"50块" → 50.5 |
| `date` | string | 今天、昨天、5月1日、2025-05-03 |
| `category_hint` | string | 餐饮、工资、书籍 |
| `account_hint` | string | 支付宝、微信、银行卡 |
| `fund_code` | string | 000001、招商中证白酒 |
| `fund_name` | string | 招商中证白酒、沪深300 |
| `stock_code` | string | sh600519、sz000858 |
| `notes` | string | 备注、自由文本 |

#### 2.2.4 分类映射表（中文 → ID）

```
支出分类：
  餐饮    → cat_expense_food
  交通    → cat_expense_transport
  购物    → cat_expense_shopping
  娱乐    → cat_expense_entertainment
  居住    → cat_expense_housing
  医疗    → cat_expense_medical
  教育    → cat_expense_education
  书籍    → cat_expense_books
  日用    → cat_expense_daily
  通讯    → cat_expense_communication
  旅行    → cat_expense_travel
  咖啡    → cat_expense_coffee
  其他支出 → cat_expense_other

收入分类：
  工资    → cat_income_salary
  奖金    → cat_income_bonus
  分红    → cat_income_dividend
  利息    → cat_income_interest
  兼职    → cat_income_parttime
  理财收益 → cat_income_investment
  其他收入 → cat_income_other
```

---

### 2.3 M2-ACC：账户管理

#### 2.3.1 账户类型

| Type | 说明 | 例子 |
|------|------|------|
| `cash` | 现金 | 钱包里的现金 |
| `bank` | 银行卡 | 储蓄卡、信用卡 |
| `digital` | 数字账户 | 支付宝、微信钱包 |
| `investment` | 投资账户 | 基金账户、股票账户 |
| `other` | 其他 | — |

#### 2.3.2 账户数据流

```
创建账户
  POST /api/accounts
  Body: { name, type, balance, currency }
    │
    ▼
  AccountService.create()
    │
    ▼
  Drizzle ORM INSERT → accounts 表
    │
    ▼
  返回 { id, name, type, balance, ... }

更新余额（交易后）
  TransactionService.create() → 自动更新 account.balance
    │
    ▼
  事务内：INSERT transaction + UPDATE account.balance
```

#### 2.3.3 默认账户

系统初始化时自动创建：

| 账户名 | 类型 | 默认余额 |
|--------|------|---------|
| 现金 | cash | 0 |
| 我的银行卡 | bank | 0 |
| 支付宝 | digital | 0 |
| 微信 | digital | 0 |

---

### 2.4 M3-TX：交易记录管理

#### 2.4.1 交易类型

| Type | 说明 | 金额方向 |
|------|------|---------|
| `expense` | 支出 | 减少余额 |
| `income` | 收入 | 增加余额 |
| `transfer` | 转账 | 两账户间转移 |
| `investment_buy` | 投资买入 | 从账户扣款 |
| `investment_sell` | 投资赎回 | 入账到账户 |

#### 2.4.2 交易数据流

```
用户: "餐饮花费100元"
    │
    ▼
NLU 解析
  intent: "expense"
  amount: 100
  category_hint: "餐饮"
  date: "today"
    │
    ▼
Skill 调用 API
  POST /api/transactions
  {
    type: "expense",
    amount: 100,
    categoryId: "cat_expense_food",
    accountId: "acc_cash",     // 默认账户
    date: "2025-05-03",
    description: "餐饮花费",
    source: "dialog"            // 标记来源：对话/表单/导入
  }
    │
    ▼
TransactionService.create() [事务内]
  ① INSERT transactions (记录)
  ② UPDATE accounts SET balance = balance - 100
    │
    ▼
  返回 { id: "tx_xxx", success: true }
    │
    ▼
Skill 格式化响应
  "✅ 已记录\n💸 支出 ¥100.00 | 餐饮 | 今天"
```

#### 2.4.3 交易筛选与查询

```
GET /api/transactions

Query Parameters:
  type          — expense | income | transfer
  categoryId    — 分类ID
  accountId     — 账户ID
  startDate     — 开始日期 (YYYY-MM-DD)
  endDate       — 结束日期 (YYYY-MM-DD)
  page          — 页码 (默认1)
  pageSize      — 每页条数 (默认20)

Response:
  {
    data: [transaction, ...],
    pagination: { total, page, pageSize, totalPages }
  }
```

---

### 2.4 M4-CAT：分类管理

#### 2.4.1 分类结构

```
分类为二级体系：
  一级分类（Type 层）
    └── 二级分类（Name 层）

示例：
  支出 (expense)
    ├── 餐饮
    │   ├── 中餐
    │   ├── 西餐
    │   ├── 外卖
    │   └── 零食
    ├── 交通
    │   ├── 公交
    │   ├── 地铁
    │   ├── 打车
    │   └── 加油
    └── 购物
        ├── 日用
        ├── 服装
        └── 电子

  收入 (income)
    ├── 工资
    ├── 奖金
    └── 理财收益
```

#### 2.4.2 预设分类（系统初始化时创建）

**支出分类（13个一级）：**
```
餐饮、购物、交通、居住、医疗、教育、
书籍、娱乐、通讯、旅行、日用、咖啡、其他
```

**收入分类（6个一级）：**
```
工资、奖金、兼职、理财收益、利息、其他
```

#### 2.4.3 分类匹配算法

```
输入: category_hint = "餐饮"
输出: categoryId

算法:
  Step 1. 精确匹配
    查询 categories WHERE name = "餐饮" AND type = "expense"
    命中 → 返回 id

  Step 2. 模糊匹配（包含）
    查询 categories WHERE name LIKE "%餐饮%" AND type = "expense"
    命中唯一 → 返回 id
    命中多个 → 返回第一个，置信度 0.7

  Step 3. 别名匹配
    alias_map = {
      "买": "购物",
      "吃": "餐饮",
      "坐车": "交通",
      "工资": "工资",
      ...
    }
    匹配 alias → 返回对应 id

  Step 4. 未匹配
    → 归入 "其他支出" 或 "其他收入"
```

---

### 2.5 M5-REP：报表

#### 2.5.1 月度收支汇总

```
API: GET /api/reports/monthly-summary?year=2025&month=5

Response:
{
  year: 2025,
  month: 5,
  income: { total: 8000, items: [...] },
  expense: { total: 3456, items: [...] },
  balance: 4544,
  daily: [
    { date: "2025-05-01", income: 0, expense: 156 },
    { date: "2025-05-02", income: 8000, expense: 300 },
    ...
  ],
  categoryBreakdown: [
    { category: "餐饮", amount: 856, percent: 24.8 },
    { category: "交通", amount: 420, percent: 12.1 },
    ...
  ]
}
```

#### 2.5.2 收支趋势图数据

```
API: GET /api/reports/trend?type=monthly&months=6

Response:
{
  labels: ["12月", "1月", "2月", "3月", "4月", "5月"],
  income: [5000, 6000, 5000, 8000, 5000, 8000],
  expense: [3000, 3500, 3200, 4000, 2800, 3456],
  savings: [2000, 2500, 1800, 4000, 2200, 4544]
}
```

---

## 3. 投资模块详细设计

### 3.1 模块总览

```
投资模块（Investment）
├── M6-HOLD  持仓管理
├── M7-NAV   基金净值
├── M8-PROF  收益计算
├── M9-SIP   定投计划
└── M10-IREP 投资报表
```

### 3.2 M6-HOLD：持仓管理

#### 3.2.1 投资类型

| Type | 说明 | 行情数据 |
|------|------|---------|
| `fund` | 场外基金 | 东方财富 NAV |
| `stock` | 股票 | 新浪/腾讯实时 |
| `etf` | ETF | 新浪/腾讯实时 |
| `gold` | 黄金 | 腾讯行情 |
| `bond` | 债券/存款 | 手动 |
| `mmf` | 货币基金 | 手动 |
| `other` | 其他 | 手动 |

#### 3.2.2 持仓数据结构

```
Investments 表:
  id, userId, name, type, ticker,
  totalUnits, totalCost, avgCost,
  currentNav/price, currentValue, profit,
  lastNavUpdate, createdAt
```

#### 3.2.3 买入流程

```
用户: "买入1000元招商中证白酒"
    │
    ▼
NLU 解析
  intent: "investment_buy"
  amount: 1000
  fund_name_hint: "招商中证白酒"
  // 注意：基金名称需要解析为基金代码
    │
    ▼
基金名称 → 代码转换（NAV-1 查询）
  "招商中证白酒" → 基金代码?
    │
    ▼
若代码未知 → 追问用户：
  "请提供基金代码，例如 000011"
    │
    ▼
确认基金代码后:
  POST /api/investments/buy
  {
    type: "fund",
    ticker: "000011",
    name: "招商中证白酒",
    amount: 1000,         // 买入金额
    nav: 1.234,           // 买入时净值
    units: 810.37,        // 计算得出：1000/1.234
    accountId: "acc_invest",
    date: "2025-05-03"
  }
    │
    ▼
InvestmentService.buy() [事务]
  ① INSERT investment_transactions
  ② UPDATE investment_holdings (更新总份额/总成本)
  ③ UPDATE accounts SET balance = balance - 1000
    │
    ▼
返回持仓更新后状态
```

#### 3.2.4 卖出流程

```
用户: "卖出招商中证白酒200元"
    │
    ▼
NLU 解析
  intent: "investment_sell"
  amount: 200
  fund_name_hint: "招商中证白酒"
    │
    ▼
查找持仓
  SELECT * FROM investments
  WHERE name LIKE "%招商中证白酒%"
    │
    ▼
计算可卖份额
  currentNav = 1.30
  sellUnits = 200 / 1.30 = 153.85份
    │
    ▼
验证
  IF sellUnits <= currentUnits → 允许
  IF sellUnits > currentUnits → 警告："份额不足，当前持有xxx份"
    │
    ▼
POST /api/investments/sell
  {
    investmentId: "inv_xxx",
    amount: 200,
    units: 153.85,
    nav: 1.30,
    accountId: "acc_invest",
    date: "2025-05-03"
  }
    │
    ▼
InvestmentService.sell() [事务]
  ① INSERT sell_transaction
  ② 计算收益 = (1.30 - avgCost) * sellUnits
  ③ UPDATE investment_holdings
  ④ UPDATE accounts SET balance = balance + 200
```

---

### 3.3 M7-NAV：基金净值

#### 3.3.1 东方财富接口

```
接口: GET https://fundgz.1234567.com.cn/js/{fundCode}.js?rt={timestamp}

示例请求:
  GET https://fundgz.1234567.com.cn/js/000001.js?rt=1704067200000

响应 (JSONP):
  jsonpgz({
    "fundcode": "000001",
    "name": "华夏成长混合",
    "jzrq": "2026-04-29",    // 最新净值日期
    "dwjz": "1.1470",         // 单位净值
    "gsz": "1.1628",          // 估算净值（当日收盘后更新）
    "gszzl": "1.38",          // 估算涨跌幅 %
    "gztime": "2026-04-30 15:00"  // 估算更新时间
  })
```

#### 3.3.2 净值查询策略

```
首次查询 → 调用东方财富接口 → 缓存到 fund_cache 表
    │
    ▼
后续查询 → 检查缓存
    │
    ├── 缓存时间 < 5分钟 → 直接返回缓存
    │
    └── 缓存时间 >= 5分钟 → 后台刷新，返回缓存（避免延迟）
    │
    └── 缓存失效（如节假日）→ 返回上次有效值，标记 stale
```

#### 3.3.3 基金搜索

```
API: GET /api/investments/search-fund?q=招商中证白酒

策略：
  ① 调用东方财富搜索 API 或本地基金名称库
  ② 返回匹配结果列表
  [{ code: "000011", name: "招商中证白酒指数" }, ...]
```

#### 3.3.4 新浪股票/ETF行情

```
接口: GET https://hq.sinajs.cn/list={codes}

示例:
  GET https://hq.sinajs.cn/list=sh600519,sz000858,f_000011

解析规则（f_前缀 = 基金）:
  var hq_str_f_000011="基金名,现价,最高,最低,...,日期,时间"
```

---

### 3.4 M8-PROF：收益计算

#### 3.4.1 基金收益计算

```
关键公式：
  当前总成本 = Σ(每次买入金额) - Σ(每次卖出金额(含手续费)) - Σ(分红金额)
  当前总份额 = Σ(每次买入份额) - Σ(每次卖出份额)
  成本均价 = 当前总成本 / 当前总份额
  当前价值 = 当前总份额 × 当前净值
  总收益 = 当前价值 - 当前总成本
  收益率 = 总收益 / 当前总成本 × 100%
  日涨幅 = (今日净值 - 昨日净值) / 昨日净值 × 100%
```

#### 3.4.2 FIFO 卖出计算

```
卖出时采用 FIFO（先进先出）原则：
  买入记录A: 100份 @1.0元 = 100元（2024-01）
  买入记录B: 100份 @1.2元 = 120元（2024-03）
  卖出: 50份 @1.5元
  → 优先消耗买入记录A的份额
  → 收益 = 50 × (1.5 - 1.0) = 25元
```

#### 3.4.3 收益数据流

```
GET /api/investments/portfolio

InvestmentService.getPortfolio():
  ① 获取所有持仓
  ② 批量查询最新净值（MarketService.batchGetNav）
  ③ 计算每只持仓的 profit / profitRate
  ④ 汇总：总投入 / 总现值 / 总收益 / 总收益率
    │
    ▼
Response:
{
  holdings: [
    {
      id: "inv_xxx",
      name: "招商中证白酒",
      ticker: "000011",
      type: "fund",
      totalCost: 10000,
      totalUnits: 8103.73,
      avgCost: 1.234,
      currentNav: 1.350,
      currentValue: 10940.04,
      profit: 940.04,
      profitRate: 9.40,
      dayChange: 1.38,
      dayChangeRate: 1.03
    },
    ...
  ],
  summary: {
    totalCost: 50000,
    totalValue: 53200,
    totalProfit: 3200,
    totalProfitRate: 6.4
  }
}
```

---

### 3.5 M9-SIP：定投计划

#### 3.5.1 定投计划结构

```
SIP Plans 表:
  id, userId, investmentId, type,
  amount, frequency, nextRunDate,
  enabled, createdAt
```

#### 3.5.2 频率定义

| Frequency | 说明 | 执行日规则 |
|-----------|------|-----------|
| `daily` | 每日 | 每日 |
| `weekly` | 每周 | 每周第一个交易日 |
| `biweekly` | 每两周 | 每两周第一个交易日 |
| `monthly` | 每月 | 每月第一个交易日 |
| `quarterly` | 每季度 | 每季度第一个交易日 |

#### 3.5.3 定投执行流程（定时任务）

```
定时任务（每日凌晨检查）:
  ① 查询所有 enabled=true AND nextRunDate <= today 的 SIP 计划
  ② 对每个计划执行:
      a. 获取当前 NAV
      b. 计算买入份额 = amount / nav
      c. 调用 InvestmentService.buy()
      d. 更新 nextRunDate = 下次执行日
  ③ 记录执行结果
```

---

## 4. 数据库设计

### 4.1 ER 图（实体关系）

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│    users     │────▶│    accounts      │◀────│ transactions │
│  (用户)       │     │  (账户)           │     │  (交易记录)    │
└──────────────┘     └──────────────────┘     └──────┬───────┘
                                                      │
                          ┌────────────────────────────┤
                          │                            │
                          ▼                            ▼
              ┌──────────────┐              ┌──────────────────┐
              │ categories   │              │  investments      │
              │  (分类)       │              │   (投资持仓)       │
              └──────────────┘              └────────┬─────────┘
                                                      │
                                      ┌───────────────┬┴────────────┐
                                      ▼               ▼             ▼
                          ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                          │inv_trans    │  │ fund_cache   │  │  sip_plans   │
                          │(投资买卖记录) │  │ (净值缓存)    │  │ (定投计划)    │
                          └──────────────┘  └──────────────┘  └──────────────┘

              ┌──────────────┐
              │  budgets     │
              │  (预算)       │
              └──────────────┘
```

---

### 4.2 表结构详细定义

#### 4.2.1 users（用户表）

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,           -- UUID
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,
  avatar      TEXT,
  created_at  INTEGER,                     -- Unix timestamp
  updated_at  INTEGER
);
```

#### 4.2.2 accounts（账户表）

```sql
CREATE TABLE accounts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,               -- 账户名称
  type        TEXT NOT NULL CHECK(type IN (
                  'cash','bank','digital','investment','other')),
  balance     REAL DEFAULT 0,             -- 当前余额
  currency    TEXT DEFAULT 'CNY',
  icon        TEXT,                        -- Emoji 图标
  color       TEXT,                        -- 颜色
  sort_order  INTEGER DEFAULT 0,           -- 排序
  is_default  INTEGER DEFAULT 0,           -- 是否默认账户
  created_at  INTEGER,
  updated_at  INTEGER
);
```

#### 4.2.3 categories（分类表）

```sql
CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK(type IN ('expense','income','investment')),
  name        TEXT NOT NULL,               -- 分类名称
  icon        TEXT,                        -- Emoji 图标
  color       TEXT,
  parent_id   TEXT REFERENCES categories(id),  -- 父分类（一级为null）
  sort_order  INTEGER DEFAULT 0,
  is_system   INTEGER DEFAULT 0,           -- 是否系统预设（1=系统，0=自定义）
  created_at  INTEGER,
  updated_at  INTEGER
);
```

#### 4.2.4 transactions（交易记录表）

```sql
CREATE TABLE transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  category_id TEXT REFERENCES categories(id),
  type        TEXT NOT NULL CHECK(type IN (
                  'expense','income','transfer','investment_buy','investment_sell')),
  amount      REAL NOT NULL,               -- 金额（始终为正）
  description TEXT,                         -- 描述
  notes       TEXT,                         -- 备注
  date        INTEGER NOT NULL,             -- 交易日期（Unix timestamp）
  tags        TEXT,                         -- JSON: ["标签1","标签2"]
  source      TEXT DEFAULT 'dialog' CHECK(source IN (
                  'dialog','form','import','sip')),
  investment_id TEXT REFERENCES investments(id), -- 关联投资记录
  transfer_to_account_id TEXT REFERENCES accounts(id), -- 转账目标账户
  created_at  INTEGER,
  updated_at  INTEGER
);

CREATE INDEX idx_tx_date ON transactions(date);
CREATE INDEX idx_tx_user_date ON transactions(user_id, date);
CREATE INDEX idx_tx_category ON transactions(category_id);
```

#### 4.2.5 investments（投资持仓表）

```sql
CREATE TABLE investments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,               -- 投资名称
  type        TEXT NOT NULL CHECK(type IN (
                  'fund','stock','etf','gold','bond','mmf','other')),
  ticker      TEXT,                         -- 基金代码/股票代码
  total_units REAL DEFAULT 0,               -- 总持有份额
  total_cost  REAL DEFAULT 0,              -- 总投入成本
  avg_cost    REAL DEFAULT 0,               -- 成本均价
  current_nav REAL,                          -- 当前净值（基金）
  current_price REAL,                       -- 当前价格（股票/ETF）
  current_value REAL,                       -- 当前市值
  profit      REAL DEFAULT 0,               -- 总收益
  profit_rate REAL DEFAULT 0,               -- 收益率 %
  last_nav_update INTEGER,                   -- 最后净值更新时间
  notes       TEXT,
  created_at  INTEGER,
  updated_at  INTEGER
);

CREATE INDEX idx_inv_user ON investments(user_id);
CREATE INDEX idx_inv_ticker ON investments(ticker);
```

#### 4.2.6 investment_transactions（投资交易明细表）

```sql
CREATE TABLE investment_transactions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  investment_id   TEXT NOT NULL REFERENCES investments(id),
  account_id      TEXT NOT NULL REFERENCES accounts(id),
  type            TEXT NOT NULL CHECK(type IN ('buy','sell','dividend','split')),
  amount          REAL NOT NULL,           -- 交易金额
  units           REAL NOT NULL,           -- 交易份额
  nav_price       REAL NOT NULL,           -- 成交净值/价格
  date            INTEGER NOT NULL,
  notes           TEXT,
  source          TEXT DEFAULT 'dialog',   -- dialog / form / sip
  created_at      INTEGER
);

CREATE INDEX idx_invtx_investment ON investment_transactions(investment_id);
CREATE INDEX idx_invtx_date ON investment_transactions(date);
```

#### 4.2.7 fund_cache（基金净值缓存表）

```sql
CREATE TABLE fund_cache (
  ticker      TEXT PRIMARY KEY,             -- 基金代码
  name        TEXT,                         -- 基金名称
  nav         REAL,                         -- 单位净值
  nav_date    TEXT,                         -- 净值日期
  est_nav     REAL,                         -- 估算净值
  est_nav_time TEXT,                        -- 估算更新时间
  day_change  REAL,                         -- 日涨跌幅 %
  updated_at  INTEGER                        -- 最后更新时间
);
```

#### 4.2.8 sip_plans（定投计划表）

```sql
CREATE TABLE sip_plans (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  investment_id   TEXT NOT NULL REFERENCES investments(id),
  account_id      TEXT NOT NULL REFERENCES accounts(id),
  amount          REAL NOT NULL,           -- 每次定投金额
  frequency       TEXT NOT NULL CHECK(frequency IN (
                      'daily','weekly','biweekly','monthly','quarterly')),
  next_run_date   INTEGER NOT NULL,         -- 下次执行日期
  last_run_date   INTEGER,                   -- 上次执行日期
  enabled         INTEGER DEFAULT 1,
  created_at      INTEGER,
  updated_at      INTEGER
);
```

#### 4.2.9 budgets（预算表）

```sql
CREATE TABLE budgets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  category_id TEXT REFERENCES categories(id), -- null = 总预算
  amount      REAL NOT NULL,               -- 预算金额
  period      TEXT DEFAULT 'monthly' CHECK(period IN ('weekly','monthly','yearly')),
  start_date  INTEGER,                      -- 预算周期开始日期
  created_at  INTEGER,
  updated_at  INTEGER
);
```

#### 4.2.10 asset_snapshots（资产快照表）

```sql
CREATE TABLE asset_snapshots (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  total_net_worth REAL DEFAULT 0,          -- 总净资产
  total_investments REAL DEFAULT 0,        -- 投资总额
  total_cash      REAL DEFAULT 0,          -- 现金总额
  total_debt      REAL DEFAULT 0,          -- 负债总额
  snapshot_date   INTEGER,                  -- 快照日期
  created_at      INTEGER
);

CREATE INDEX idx_snap_user ON asset_snapshots(user_id);
```

---

### 4.3 数据流转总图

```
【记账数据流】
用户对话 → NLU解析 → POST /api/transactions
                              │
                              ▼
                    TransactionService.create()
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            INSERT transactions   UPDATE accounts.balance
                    │                   │
                    └─────────┬─────────┘
                              ▼
                          事务提交

【投资数据流】
用户对话 → NLU解析 → 基金名称→代码转换
                              │
                              ▼
                    POST /api/investments/buy
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
     INSERT investment_transactions  UPDATE investments
                    │                   │
                    │         ┌─────────┴─────────┐
                    │         ▼                   ▼
                    │   total_units+=x    total_cost+=amt
                    │   avg_cost=重新计算  current_value=重新计算
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    UPDATE accounts.balance (扣款)
                              │
                              ▼
                    可选: INSERT asset_snapshots
```

---

## 5. API 设计

### 5.1 API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET | /api/accounts | 账户列表 |
| POST | /api/accounts | 创建账户 |
| PUT | /api/accounts/:id | 更新账户 |
| DELETE | /api/accounts/:id | 删除账户 |
| GET | /api/transactions | 交易列表（分页+筛选） |
| POST | /api/transactions | 创建交易 |
| PUT | /api/transactions/:id | 更新交易 |
| DELETE | /api/transactions/:id | 删除交易 |
| GET | /api/categories | 分类列表 |
| POST | /api/categories | 创建分类 |
| GET | /api/investments | 持仓列表 |
| POST | /api/investments/buy | 买入 |
| POST | /api/investments/sell | 卖出 |
| POST | /api/investments/dividend | 分红 |
| GET | /api/investments/portfolio | 持仓汇总+收益 |
| GET | /api/investments/search-fund | 搜索基金 |
| GET | /api/investments/quote/:ticker | 查询实时净值 |
| GET | /api/budgets | 预算列表 |
| POST | /api/budgets | 创建预算 |
| PUT | /api/budgets/:id | 更新预算 |
| GET | /api/reports/monthly-summary | 月度收支汇总 |
| GET | /api/reports/trend | 收支趋势 |
| GET | /api/reports/investment | 投资收益报表 |
| GET | /api/sip/plans | 定投计划列表 |
| POST | /api/sip/plans | 创建定投计划 |
| PUT | /api/sip/plans/:id | 更新定投计划 |
| DELETE | /api/sip/plans/:id | 删除定投计划 |

---

### 5.2 核心 API 详细设计

#### POST /api/transactions

**请求：**
```json
{
  "type": "expense",
  "amount": 100.00,
  "categoryId": "cat_expense_food",
  "accountId": "acc_cash",
  "date": "2025-05-03",
  "description": "餐饮花费",
  "notes": "",
  "tags": [],
  "source": "dialog"
}
```

**响应（成功）：**
```json
{
  "success": true,
  "data": {
    "id": "tx_abc123",
    "type": "expense",
    "amount": 100.00,
    "category": { "id": "cat_expense_food", "name": "餐饮" },
    "account": { "id": "acc_cash", "name": "现金" },
    "date": "2025-05-03",
    "balanceAfter": 900.00
  }
}
```

**响应（失败）：**
```json
{
  "success": false,
  "error": { "code": "INSUFFICIENT_BALANCE", "message": "账户余额不足" }
}
```

---

#### POST /api/investments/buy

**请求：**
```json
{
  "type": "fund",
  "ticker": "000011",
  "name": "招商中证白酒指数",
  "amount": 1000.00,
  "nav": 1.2340,
  "units": 810.37,
  "accountId": "acc_invest",
  "date": "2025-05-03",
  "source": "dialog"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "transactionId": "itx_xxx",
    "investment": {
      "id": "inv_yyy",
      "name": "招商中证白酒指数",
      "totalUnits": 810.37,
      "totalCost": 1000.00,
      "avgCost": 1.2340
    }
  }
}
```

---

#### GET /api/investments/portfolio

**响应：**
```json
{
  "success": true,
  "data": {
    "holdings": [
      {
        "id": "inv_yyy",
        "name": "招商中证白酒指数",
        "ticker": "000011",
        "type": "fund",
        "totalUnits": 8103.73,
        "totalCost": 10000.00,
        "avgCost": 1.234,
        "currentNav": 1.350,
        "currentValue": 10940.04,
        "profit": 940.04,
        "profitRate": 9.40,
        "dayChange": 0.018,
        "dayChangeRate": 1.38
      }
    ],
    "summary": {
      "totalCost": 50000.00,
      "totalValue": 53200.00,
      "totalProfit": 3200.00,
      "totalProfitRate": 6.40
    }
  }
}
```

---

## 6. Skill 设计（自然语言解析）

### 6.1 Skill 工作流程

```
用户输入
    │
    ▼
┌─────────────────────────────────────────┐
│          NLU 解析引擎                     │
│                                          │
│  ① 预处理                                │
│     - 去除语气词、标点                    │
│     - 数字归一化："50块"→50，"1000元"→1000│
│                                          │
│  ② 意图分类（规则 + 模糊匹配）             │
│     - 关键词命中 → 直接确定意图            │
│     - 无关键词 → 归类为 "unknown"         │
│                                          │
│  ③ 实体提取（正则 + 映射）                 │
│     - amount: 金额正则                    │
│     - date: 日期正则 + 相对日期映射        │
│     - category: 分类映射表                │
│     - fund_name: 基金名提取               │
│     - fund_code: 基金代码正则              │
│                                          │
│  ④ 槽位填充与验证                         │
│     - 必填槽位缺失 → 生成追问             │
│     - 验证金额 > 0                        │
│     - 验证日期 合理范围                    │
│                                          │
└──────────────────┬──────────────────────┘
                   │ Intent + Entities
                   ▼
┌─────────────────────────────────────────┐
│          对话管理器                       │
│                                          │
│  状态机: INITIAL → WAITING_CONFIRM →     │
│          CONFIRMED → PROCESSING → DONE   │
│                                          │
│  pendingSlots: {} // 待确认槽位           │
│  confirmedSlots: {} // 已确认槽位         │
│                                          │
└──────────────────┬──────────────────────┘
                   │ confirmed + validated
                   ▼
┌─────────────────────────────────────────┐
│          API 调用器                       │
│                                          │
│  ① 根据 intent 选择 API                  │
│  ② 填充请求参数                          │
│  ③ 调用后端                              │
│  ④ 处理响应                              │
│  ⑤ 格式化用户消息                        │
│                                          │
└─────────────────────────────────────────┘
```

### 6.2 数字归一化规则

```
"100元"     → 100
"50块"      → 50
"200.5元"   → 200.5
"1万5"      → 15000
"1.2万"     → 12000
"1000刀"    → 1000（美元，暂不支持汇率）
```

### 6.3 日期解析规则

```
"今天"     → 2025-05-03
"昨天"     → 2025-05-02
"明天"     → 2025-05-04
"前天"     → 2025-05-01
"上周三"   → 需计算上周三的日期
"上个月15号" → 2025-04-15
"5月1日"   → 2025-05-01
"2025-05-03" → 直接解析
```

### 6.4 Skill 与后端交互

```
Skill 保存位置: ~/.hermes/profiles/gaoshou/skills/hermes-funds/

hermes-funds/
├── SKILL.md           # Skill 定义文档
├── scripts/
│   ├── nlu_engine.js  # 自然语言解析
│   ├── dialog_mgr.js  # 对话状态管理
│   └── api_caller.js  # 后端 API 调用
├── data/
│   └── category_map.json  # 分类映射表
└── config/
    └── api_config.json   # 后端 API 地址配置
```

---

## 7. 开发优先级与里程碑

### 7.1 Sprint 划分

```
Sprint 1  (目标：记账核心可用)
├── 后端：数据库初始化 + 账户/分类 CRUD
├── 后端：交易记录 CRUD（含余额更新事务）
├── 后端：月度报表 API
├── 前端：Dashboard 展示
└── Skill：基础记账解析 + API 对接

Sprint 2  (目标：对话记账可用)
├── Skill：意图识别完善 + 日期/分类解析
├── Skill：追问机制
├── 后端：优化查询性能
└── 前端：交易列表 + 筛选

Sprint 3  (目标：投资基础)
├── 后端：投资持仓 CRUD
├── 后端：东方财富基金净值 API
├── 后端：收益计算
├── 前端：投资组合展示
└── Skill：投资买入解析

Sprint 4  (目标：投资完整)
├── 后端：基金搜索
├── 后端：股票/ETF 行情
├── 后端：定投计划
├── 前端：定投管理
└── Skill：投资卖出 + 定投解析

Sprint 5  (目标：报表完善)
├── 后端：趋势图数据 API
├── 后端：资产快照
├── 前端：图表完善
└── 预算功能
```

### 7.2 里程碑

| 里程碑 | 内容 | 验收方式 |
|--------|------|---------|
| M1 | 对话记账可用 | "餐饮花费100元" → 系统记录成功 |
| M2 | 收支报表可用 | Dashboard 展示月度数据 |
| M3 | 基金持仓可用 | 买入/查询基金，收益计算正确 |
| M4 | 投资组合完整 | 股票/ETF/黄金 + 定投 |
| M5 | 生产就绪 | 部署文档 + 验收测试通过 |

---

## 8. 技术债务与扩展点

### 8.1 当前限制

| 问题 | 说明 | 应对 |
|------|------|------|
| 行情接口不稳定 | 东方财富接口可能变 | 缓存 + 降级 + 手动录入兜底 |
| 基金名称歧义 | "白酒"可能匹配多个 | 追问确认 + 模糊匹配置信度 |
| SQLite 并发 | 开发用 SQLite，生产建议 PG | 预留切换成本 |

### 8.2 扩展点

| 方向 | 说明 |
|------|------|
| 微信/钉钉接入 | Skill 改为通用 Handler 即可 |
| 数据导入 | CSV 导入器 |
| 通知推送 | 预算超支/定投执行通知 |
| 数据导出 | PDF/Excel 导出 |

---

*系统设计文档版本记录：*
- v1.0 — 2025-05-03，完成详细设计
