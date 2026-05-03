# 💰 Hermes Funds

> Personal & Family Finance Manager — Expense Tracking + Investment Portfolio (Funds, Stocks, ETF)

[![Stars](https://img.shields.io/github/stars/zndxyhn/hermes-funds?style=flat-square)](https://github.com/zndxyhn/hermes-funds)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)

## 🎯 目标

打造一款**以记账为核心，以投资组合为延伸**的个人/家庭资金管理平台。

- 🏠 **家庭记账** — 收支记录、预算控制、报表分析
- 📈 **投资追踪** — 基金/股票/ETF 全生命周期管理，含实时行情
- 🔒 **隐私优先** — 本地优先，数据自主，不追踪不上报

## 🚧 状态

**Phase 1 — MVP 开发中**

查看 [SPEC.md](SPEC.md) 了解完整规划。

## 🛠 技术栈

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | Drizzle ORM |
| Charts | Recharts |
| Auth | NextAuth.js |

## 📂 项目结构

```
hermes-funds/
├── src/
│   ├── app/          # Next.js App Router
│   ├── components/   # React 组件
│   ├── lib/          # 工具函数、数据库客户端
│   ├── types/        # TypeScript 类型定义
│   └── hooks/        # 自定义 React Hooks
├── docs/             # 文档
├── public/           # 静态资源
├── SPEC.md           # 项目规范文档
└── README.md
```

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/zndxyhn/hermes-funds.git
cd hermes-funds

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 📊 功能路线图

- [ ] Phase 1: MVP — 项目初始化，记账核心 CRUD，投资组合基础
- [ ] Phase 2: 预算系统，周期账单，实时行情，财务报表
- [ ] Phase 3: 家庭多成员，权限管理，数据共享
- [ ] Phase 4: 移动端优化，数据导入，高级分析

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT © 2025 zndxyhn
