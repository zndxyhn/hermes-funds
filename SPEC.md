# Hermes Funds — 个人/家庭资金管理系统

> Personal & Family Finance Manager: Expense Tracking + Investment Portfolio (Funds, Stocks, ETF)

## 1. Project Overview

**Hermes Funds** 是一款开源的个人/家庭资金管理平台，以记账为核心，投资组合为延伸。

### Core Features (优先级排序)

1. **记账模块** — 收支记录、分类管理、预算控制
2. **投资组合** — 基金/股票/ETF 全生命周期管理（含实时行情）
3. **家庭账户** — 多成员、多账户、统一视图
4. **财务报表** — 资产负债表、收支趋势、投资收益分析
5. **预算预警** — 支出超预算提醒

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js 14 + TypeScript | App Router, RSC, 良好的 Dashboard 生态 |
| UI | Tailwind CSS + shadcn/ui | 快速开发，美观组件 |
| Backend | Next.js API Routes (or tRPC) | 前后端同栈，降低复杂度 |
| Database | SQLite (开发) / PostgreSQL (生产) | 本地优先，迁移成本低 |
| ORM | Drizzle ORM | 类型安全，轻量 |
| Charts | Recharts / Tremor | React 原生图表库 |
| State | Zustand / React Query | 轻量状态管理 |
| Auth | NextAuth.js | 快速接入多 Provider |
| Deploy | Docker / Vercel | 灵活部署 |

---

## 3. Data Model

### Core Entities

```
User
├── id, name, email, avatar, role (owner/member)
└── relations: accounts, categories, budgets

Account (账户)
├── id, user_id, name, type (cash/bank/digital/investment)
├── balance, currency, icon, color
└── relations: transactions, user

Category (分类)
├── id, user_id, name, type (income/expense/investment)
├── icon, color, parent_id (子分类)
└── relations: transactions

Transaction (交易记录)
├── id, account_id, category_id, amount
├── type (income/expense/transfer/investment)
├── date, description, notes
└── relations: account, category, investment

Investment (投资记录)
├── id, user_id, name, type (fund/stock/etf/bond)
├── ticker, purchase_price, units, purchase_date
├── current_nav, current_price (实时更新)
└── relations: user, transactions

Budget (预算)
├── id, user_id, category_id, amount, period (monthly/weekly)
└── relations: category, user

Asset (资产快照)
├── id, user_id, total_net_worth, total_investments
├── total_cash, total_debt, snapshot_date
└── relations: user
```

---

## 4. Module Breakdown

### 4.1 记账模块 (Expense Tracking)

- **账户管理** — 添加/编辑/删除账户，支持余额初始化
- **收支记录** — 快速记账，支持批量导入（CSV/银行账单）
- **分类管理** — 收支/投资三级分类体系（餐饮→中餐→外卖）
- **周期账单** — 水电煤、房租、订阅等周期性自动记账
- **预算** — 按月/周设置分类预算，超支预警

### 4.2 投资组合 (Investment Portfolio)

- **持仓管理** — 基金/股票/ETF 买入/卖出/分红记录
- **实时行情** — 通过第三方 API 获取基金 NAV、股票价格
- **盈亏分析** — 成本均价、总收益、收益率IRR
- **定投计划** — 定期定额自动记录
- **基金筛选** — 按类型/规模/评级筛选（扩展功能）

### 4.3 家庭成员 (Household)

- **成员管理** — 家庭成员账号注册/邀请
- **权限控制** — 所有者/管理员/成员角色
- **统一报表** — 全家资产合并视图
- **成员隔离** — 按需共享或隔离数据

### 4.4 财务报表 (Reports)

- **收支趋势** — 月度/年度收支对比，环比/同比
- **资产配置** — 饼图展示资产分布
- **投资收益** — 持仓收益、累计收益曲线
- **净资产走势** — 净资产历史变化
- **导出** — PDF/Excel 导出

---

## 5. Development Phases

### Phase 1 — MVP (当前)
- [x] 项目初始化，GitHub 仓库创建
- [ ] 技术栈确定，开发环境配置
- [ ] 数据模型设计，数据库初始化
- [ ] 记账核心 CRUD
- [ ] 投资组合基础管理
- [ ] 基础 Dashboard

### Phase 2 — Core
- [ ] 预算系统
- [ ] 周期账单
- [ ] 实时行情 API 集成
- [ ] 投资收益计算
- [ ] 基础财务报表

### Phase 3 — Household
- [ ] 多用户认证
- [ ] 家庭成员管理
- [ ] 数据共享/隔离

### Phase 4 — Polish
- [ ] 移动端优化
- [ ] 数据导入（银行 CSV）
- [ ] 高级分析
- [ ] Docker 部署

---

## 6. API Design

```
POST   /api/auth/*              # 认证
GET    /api/accounts            # 账户列表
POST   /api/accounts            # 创建账户
PUT    /api/accounts/:id        # 更新账户
DELETE /api/accounts/:id        # 删除账户

GET    /api/transactions        # 交易列表 (支持分页/筛选)
POST   /api/transactions        # 创建交易
PUT    /api/transactions/:id    # 更新交易
DELETE /api/transactions/:id    # 删除交易

GET    /api/investments         # 投资列表
POST   /api/investments         # 添加投资
PUT    /api/investments/:id    # 更新投资
DELETE /api/investments/:id    # 删除投资
GET    /api/investments/:id/price  # 获取实时行情

GET    /api/categories          # 分类列表
POST   /api/categories         # 创建分类

GET    /api/budgets             # 预算列表
POST   /api/budgets            # 创建预算
PUT    /api/budgets/:id        # 更新预算

GET    /api/reports/net-worth   # 净资产报表
GET    /api/reports/cash-flow  # 现金流报表
GET    /api/reports/investment  # 投资收益报表
```

---

## 7. Design Principles

1. **本地优先，数据自主** — 用户数据存在本地或自有服务器，不强制云端
2. **极简上手** — 5 分钟内完成第一笔记账
3. **投资友好** — 专为基金定投用户设计，支持中国基金
4. **隐私安全** — 不追踪，不上报，代码透明
5. **可扩展** — 模块化架构，支持二次开发

---

## 8. License

MIT License
