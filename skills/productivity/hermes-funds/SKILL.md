---
name: hermes-funds
description: Use when managing personal finance — expenses, income, investments, fund quotes, budgets, or reports. Handles natural language parsing of Chinese financial statements like "餐饮花费128元". Returns structured data for expense/income recording, portfolio queries, and fund searches.
version: 1.0.0
author: zndxyhn
license: MIT
metadata:
  hermes:
    tags: [finance, expense-tracking, investment-portfolio, fund-quotes, budget, nlu]
    related_skills: []
---

# Hermes Funds — Personal Finance Management Skill

## Overview

Hermes Funds is a personal and family finance management skill that provides:
- **Expense/Income tracking** — record transactions via natural language
- **Investment portfolio** — track funds, stocks, ETFs with real-time quotes
- **Budget management** — set and monitor spending budgets
- **Financial reports** — monthly summaries, net worth, cash flow
- **NLU parsing** — convert Chinese natural language to structured data

The skill wraps a REST API backend. All capabilities are accessible via HTTP calls to the deployed backend URL.

## When to Use

- User says something like "花了100元", "工资到账8000", "本月花了多少"
- User wants to check investment returns or fund quotes
- User asks about budget status or financial reports
- User wants to record an expense/income in natural language
- User searches for a fund by name or ticker code

**Do NOT use for**: non-financial queries, system administration, code generation.

## Backend Configuration

The skill requires a deployed Hermes Funds API backend. Set the backend URL via environment variable:

```bash
HERMES_FUNDS_API_URL=http://localhost:3001  # development
HERMES_FUNDS_API_URL=https://your-domain.com  # production
```

Default: `http://localhost:3001`

## Core API Endpoints

All endpoints return `{"success": true, "data": {...}}` on success, `{"success": false, "error": {"message": "..."}}` on failure.

### NLU Parsing (Natural Language → Structured Data)

**POST** `{BASE_URL}/api/nlu/parse`

Convert natural language to structured financial intent.

```json
// Request
{ "text": "餐饮花费128元" }

// Response
{
  "success": true,
  "data": {
    "intent": "expense",
    "intentConfidence": 0.9,
    "amount": 128,
    "date": "2026-05-04",
    "category": { "id": "cat_expense_food", "name": "餐饮", "confidence": 1, "method": "exact" },
    "account": null,
    "canConfirm": true,
    "missingSlots": []
  }
}
```

**Supported intents**: `expense`, `income`, `transfer`, `investment_buy`, `investment_sell`, `query_summary`, `query_budget`, `query_investment`

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions?limit=50&page=1` | List transactions |
| POST | `/api/transactions` | Create transaction |
| DELETE | `/api/transactions/[id]` | Delete transaction |

**POST /api/transactions body**:
```json
{
  "type": "expense",
  "amount": 128,
  "categoryId": "cat_expense_food",
  "accountId": "acc_xxx",
  "date": "2026-05-04",
  "description": "餐饮花费"
}
```

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List all accounts |
| POST | `/api/accounts` | Create account |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories?type=expense` | List categories by type |
| GET | `/api/categories?type=income` | List income categories |

### Investments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/investments` | List investment portfolio |
| POST | `/api/investments` | Add investment |
| GET | `/api/investments/search?q=华夏` | Search funds by name |

### Fund Quotes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fund-quotes?ticker=000001` | Get real-time fund quote |

Data source: 东方财富（天天基金网）, no API key required.

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/monthly_summary?year=2026&month=5` | Monthly expense/income report |
| GET | `/api/reports/net-worth` | Net worth statement |
| GET | `/api/reports/cash-flow` | Cash flow report |

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | List budgets |
| POST | `/api/budgets` | Create budget |

## Intent Patterns

| Pattern | Intent | Example |
|---------|--------|---------|
| `[花了/花费/消费/支出] [金额]元` | expense | "餐饮花费128元" |
| `[工资/奖金/收入/到账] [金额]元` | income | "工资到账8000元" |
| `[转账/转出/转入]` | transfer | "转账1000元到银行卡" |
| `[买入/定投/申购]` | investment_buy | "定投500元" |
| `[卖出/赎回/清仓]` | investment_sell | "赎回基金" |
| `[本月/花了多少/收支]` | query_summary | "本月花了多少" |
| `[预算/还剩多少]` | query_budget | "还剩多少预算" |
| `[持仓/收益/净值/行情]` | query_investment | "我的基金收益" |

## Common Pitfalls

1. **Backend URL not set** — skill fails with connection error. Always verify `HERMES_FUNDS_API_URL` is set.
2. **Category ID mismatch** — use category IDs from `/api/categories`, not category names, when creating transactions.
3. **Account balance insufficient** — creating an expense checks balance. Use an account with sufficient funds.
4. **Fund ticker format** — tickers must be 6-digit codes (e.g., `000001`, not `1`).
5. **Date format** — use ISO format `YYYY-MM-DD` for all date fields.

## Verification Checklist

- [ ] Backend API is running and accessible
- [ ] `HERMES_FUNDS_API_URL` environment variable is set correctly
- [ ] Database initialized (`npx tsx src/lib/db/scripts/seed.ts`)
- [ ] NLU parsing returns correct intent for test inputs
- [ ] Transaction creation works end-to-end
- [ ] Fund quote retrieval works for known tickers
