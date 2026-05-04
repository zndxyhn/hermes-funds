# Hermes Funds 部署文档 v1.0

> 面向中文用户，默认货币 CNY，追踪基金/ETF 投资组合。
>
> 本项目包含两部分：
> 1. **后端 API** — Next.js 应用（数据存储、API 接口）
> 2. **Agent Skill** — 可被任何 Agent 调用的技能包

---

## 目录

1. [系统架构](#1-系统架构)
2. [环境要求](#2-环境要求)
3. [后端 API 部署](#3-后端-api-部署)
4. [Agent Skill 部署](#4-agent-skill-部署)
5. [数据库管理](#5-数据库管理)
6. [API 文档](#6-api-文档)
7. [常见问题](#7-常见问题)

---

## 1. 系统架构

```
┌──────────────────────────────────────────────────────┐
│                     用户                              │
│   ┌─────────────────┐    ┌──────────────────────┐   │
│   │   Web 浏览器     │    │  Agent (任意类型)     │   │
│   │  http://:3001   │    │  读取 openapi.yaml    │   │
│   └────────┬────────┘    └──────────┬───────────┘   │
│            │                        │               │
│            │  HTTP REST API         │  HTTP REST   │
│            ▼                        ▼               │
│   ┌────────────────────────────────────────────┐   │
│   │           Hermes Funds API 后端              │   │
│   │         Next.js + SQLite                     │   │
│   │                                              │   │
│   │  /api/nlu/parse     — NLU 自然语言解析       │   │
│   │  /api/transactions  — 记账                   │   │
│   │  /api/investments   — 投资                   │   │
│   │  /api/fund-quotes   — 基金行情               │   │
│   │  /api/reports       — 报表                   │   │
│   │  /api/budgets       — 预算                   │   │
│   └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Skill 组成部分

```
hermes-funds/
├── SKILL.md              ← Agent Skill 定义（Hermes Agent 格式）
├── openapi.yaml          ← 通用 API 规范（任何 Agent 可用）
└── skills/productivity/hermes-funds/
    └── scripts/
        ├── nlu_engine.js       ← NLU 解析引擎
        └── dialog_manager.js   ← 对话管理器
```

---

## 2. 环境要求

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18.0 | 推荐 LTS |
| npm | ≥ 9.0 | 随 Node.js 安装 |
| Git | 任意稳定版 | 代码管理 |

---

## 3. 后端 API 部署

### 3.1 从 GitHub 拉取代码

```bash
git clone https://github.com/zndxyhn/hermes-funds.git
cd hermes-funds
```

### 3.2 切换分支

```bash
# main 分支 = 生产环境代码
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
# 自动建表 + 种子数据（幂等，可重复执行）
npx tsx src/lib/db/scripts/seed.ts
```

### 3.6 构建

```bash
NODE_ENV=production npm run build
```

### 3.7 启动服务

```bash
# 方式一：直接启动
npm run start -- -p 3001

# 方式二：PM2（推荐生产使用）
npm install -g pm2
pm2 start npm --name "hermes-funds" -- start -- -p 3001
pm2 set hermes-funds:NODE_ENV production
pm2 save
pm2 startup
```

### 3.8 验证部署

```bash
# 检查服务状态
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/

# 测试 NLU 接口
curl -X POST http://localhost:3001/api/nlu/parse \
  -H "Content-Type: application/json" \
  -d '{"text":"餐饮花费128元"}'
```

---

## 4. Agent Skill 部署

### 4.1 概述

Hermes Funds 提供两种 Skill 格式：

| 格式 | 用途 | 适用 Agent |
|------|------|-----------|
| `SKILL.md` | Hermes Agent 专用 | Hermes Agent |
| `openapi.yaml` | 通用 OpenAPI 规范 | 任何 HTTP Agent |

### 4.2 Hermes Agent — 部署 Skill

#### 步骤 1：复制 Skill 文件到 Hermes Agent 目录

```bash
# 替换 YOUR_AGENT_NAME 为实际 Agent 名称
SKILL_DIR="$HOME/.hermes/profiles/YOUR_AGENT_NAME/skills/productivity/hermes-funds"
mkdir -p "$SKILL_DIR/scripts"

# 复制 Skill 定义
cp hermes-funds/skills/productivity/hermes-funds/SKILL.md "$SKILL_DIR/"

# 复制脚本
cp -r hermes-funds/skills/productivity/hermes-funds/scripts/* "$SKILL_DIR/scripts/"

# 复制 OpenAPI 规范（可选，通用格式）
cp hermes-funds/openapi.yaml "$SKILL_DIR/"
```

#### 步骤 2：配置后端地址

在 `~/.hermes/profiles/YOUR_AGENT_NAME/.env` 中设置：

```bash
export HERMES_FUNDS_API_URL=http://localhost:3001
# 生产环境改为实际地址，如：
# export HERMES_FUNDS_API_URL=https://funds.your-domain.com
```

#### 步骤 3：验证 Skill 加载

在新会话中运行：

```
/skills list
```

确认 `hermes-funds` 出现在列表中。

#### 步骤 4：测试 Skill

```
使用 hermes-funds skill，解析"餐饮花费128元"
```

### 4.3 通用 Agent — 使用 OpenAPI 规范

#### 方式一：通过 openapi.yaml 导入

大多数 Agent 平台支持直接导入 OpenAPI 规范文件：

```bash
# 查看规范
cat openapi.yaml
```

将 `openapi.yaml` 导入到你的 Agent 平台，Agent 将自动获得所有工具定义。

#### 方式二：通过 URL 导入

如果 Agent 平台支持 URL：

```
https://raw.githubusercontent.com/zndxyhn/hermes-funds/main/openapi.yaml
```

#### 方式三：直接 HTTP 调用

任何 Agent 只需发送 HTTP 请求即可调用 Skill 能力：

```python
# Python 示例
import requests

API_BASE = "http://localhost:3001"  # 改为实际地址

def parse_nlu(text: str):
    resp = requests.post(f"{API_BASE}/api/nlu/parse", json={"text": text})
    return resp.json()

def create_expense(amount: float, category_id: str, account_id: str, date: str, description: str = ""):
    resp = requests.post(f"{API_BASE}/api/transactions", json={
        "type": "expense",
        "amount": amount,
        "categoryId": category_id,
        "accountId": account_id,
        "date": date,
        "description": description
    })
    return resp.json()

# 使用示例
result = parse_nlu("餐饮花费128元")
print(result["data"]["intent"])  # "expense"
```

```javascript
// JavaScript/Node.js 示例
const API_BASE = "http://localhost:3001";

async function parseNlu(text) {
  const resp = await fetch(`${API_BASE}/api/nlu/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return resp.json();
}

async function createExpense(amount, categoryId, accountId, date, description) {
  const resp = await fetch(`${API_BASE}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "expense", amount, categoryId, accountId, date, description })
  });
  return resp.json();
}

// 使用示例
const parsed = await parseNlu("餐饮花费128元");
console.log(parsed.data.intent);  // "expense"
```

### 4.4 Skill 能力速查

| 能力 | 调用方式 | 说明 |
|------|---------|------|
| 自然语言解析 | `POST /api/nlu/parse` | "餐饮花费128元" → 结构化数据 |
| 记支出 | `POST /api/transactions` | 记录支出 |
| 记收入 | `POST /api/transactions` | 记录收入 |
| 查账户 | `GET /api/accounts` | 获取账户列表 |
| 查分类 | `GET /api/categories` | 获取分类列表 |
| 查投资 | `GET /api/investments` | 获取投资组合 |
| 基金搜索 | `GET /api/investments/search?q=华夏` | 按名称搜索基金 |
| 基金行情 | `GET /api/fund-quotes?ticker=000001` | 实时行情 |
| 月度报表 | `GET /api/reports/monthly_summary?year=2026&month=5` | 月度收支 |
| 净资产 | `GET /api/reports/net-worth` | 资产负债表 |
| 现金流 | `GET /api/reports/cash-flow` | 现金流报表 |
| 预算 | `GET/POST /api/budgets` | 预算管理 |

---

## 5. 数据库管理

### 5.1 数据库文件

| 环境 | 文件路径 |
|------|---------|
| 生产 | `data/hermes-funds-prod.db` |
| 开发 | `data/hermes-funds-dev.db` |

> `data/` 目录在 `.gitignore` 中，不会上传 Git。

### 5.2 备份

```bash
cp data/hermes-funds-prod.db "data/backup/hermes-funds-$(date +%Y%m%d).db"
```

### 5.3 重置

```bash
rm data/hermes-funds-prod.db
npx tsx src/lib/db/scripts/seed.ts
```

---

## 6. API 文档

所有 API 返回格式：

```json
// 成功
{ "success": true, "data": { ... } }

// 失败
{ "success": false, "error": { "message": "..." } }
```

详细规范见 `openapi.yaml`。

### 核心接口

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/nlu/parse` | 自然语言解析 |
| GET | `/api/transactions?limit=50` | 交易列表 |
| POST | `/api/transactions` | 创建交易 |
| GET | `/api/accounts` | 账户列表 |
| GET | `/api/categories?type=expense` | 分类列表 |
| GET | `/api/investments` | 投资组合 |
| GET | `/api/fund-quotes?ticker=000001` | 基金行情 |
| GET | `/api/investments/search?q=华夏` | 基金搜索 |
| GET | `/api/reports/monthly_summary?year=2026&month=5` | 月度报表 |
| GET | `/api/reports/net-worth` | 净资产 |
| GET | `/api/budgets` | 预算列表 |

### NLU Intent 类型

| Intent | 示例输入 |
|--------|---------|
| `expense` | "餐饮花费128元" |
| `income` | "工资到账8000元" |
| `transfer` | "转账1000元到银行卡" |
| `investment_buy` | "定投500元" |
| `investment_sell` | "赎回基金" |
| `query_summary` | "本月花了多少" |
| `query_budget` | "还剩多少预算" |
| `query_investment` | "我的基金收益" |

---

## 7. 常见问题

### Q: Skill 加载失败

```bash
# 确认文件存在
ls ~/.hermes/profiles/YOUR_AGENT_NAME/skills/productivity/hermes-funds/SKILL.md

# 确认是新会话（skill 在会话启动时加载，已有的会话不会自动更新）
```

### Q: API 请求返回 400/500

```bash
# 检查服务是否运行
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/

# 检查环境变量
echo $HERMES_FUNDS_API_URL
```

### Q: 基金行情获取失败

东方财富接口有频率限制，建议间隔 5 分钟以上。

### Q: 端口被占用

```bash
lsof -i :3001
PORT=3002 npm run start -- -p 3002
```
