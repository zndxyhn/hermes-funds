import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────
// 用户表
// ─────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  avatar: text("avatar"),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 账户表
// ─────────────────────────────────────────────
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["cash", "bank", "digital", "investment", "credit", "other"],
  }).notNull(),
  balance: real("balance").default(0),
  currency: text("currency").default("CNY"),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").default(0),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 分类表
// ─────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type", {
    enum: ["expense", "income", "investment"],
  }).notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").default(0),
  isSystem: integer("is_system", { mode: "boolean" }).default(false),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 交易记录表
// ─────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  categoryId: text("category_id").references(() => categories.id),
  type: text("type", {
    enum: ["expense", "income", "transfer", "investment_buy", "investment_sell"],
  }).notNull(),
  amount: real("amount").notNull(), // 金额（始终为正）
  description: text("description"),
  notes: text("notes"),
  date: integer("date").notNull(), // Unix timestamp (秒)
  tags: text("tags"), // JSON array
  source: text("source", {
    enum: ["dialog", "form", "import", "sip"],
  }).default("form"),
  investmentId: text("investment_id"),
  transferToAccountId: text("transfer_to_account_id").references(
    () => accounts.id
  ),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 投资持仓表
// ─────────────────────────────────────────────
export const investments = sqliteTable("investments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["fund", "stock", "etf", "gold", "bond", "mmf", "cb", "reits", "private", "other"],
  }).notNull(),
  ticker: text("ticker"), // 基金代码/股票代码
  totalUnits: real("total_units").default(0), // 总持有份额
  totalCost: real("total_cost").default(0), // 总投入成本
  avgCost: real("avg_cost").default(0), // 成本均价
  currentNav: real("current_nav"), // 当前净值（基金）
  currentPrice: real("current_price"), // 当前价格（股票/ETF）
  currentValue: real("current_value").default(0), // 当前市值
  profit: real("profit").default(0), // 总收益
  profitRate: real("profit_rate").default(0), // 收益率 %
  lastNavUpdate: integer("last_nav_update"),
  notes: text("notes"),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 投资交易明细表（基金买卖记录）
// ─────────────────────────────────────────────
export const investmentTransactions = sqliteTable("investment_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  investmentId: text("investment_id").notNull().references(() => investments.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  type: text("type", { enum: ["buy", "sell", "dividend", "split"] }).notNull(),
  amount: real("amount").notNull(), // 交易金额
  units: real("units").notNull(), // 交易份额
  navPrice: real("nav_price").notNull(), // 成交净值/价格
  date: integer("date").notNull(),
  notes: text("notes"),
  source: text("source", { enum: ["dialog", "form", "sip", "recurring_bill"] }).default("form"),
  createdAt: integer("created_at"),
});

// ─────────────────────────────────────────────
// 基金净值缓存表
// ─────────────────────────────────────────────
export const fundCache = sqliteTable("fund_cache", {
  ticker: text("ticker").primaryKey(), // 基金代码
  name: text("name"),
  nav: real("nav"), // 单位净值
  navDate: text("nav_date"), // 净值日期
  estNav: real("est_nav"), // 估算净值
  estNavTime: text("est_nav_time"), // 估算更新时间
  dayChange: real("day_change"), // 日涨跌幅 %
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 定投计划表
// ─────────────────────────────────────────────
export const sipPlans = sqliteTable("sip_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  investmentId: text("investment_id").notNull().references(() => investments.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  amount: real("amount").notNull(), // 每次定投金额
  frequency: text("frequency", {
    enum: ["daily", "weekly", "biweekly", "monthly", "quarterly"],
  }).notNull(),
  nextRunDate: integer("next_run_date").notNull(),
  lastRunDate: integer("last_run_date"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 预算表
// ─────────────────────────────────────────────
export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: text("category_id").references(() => categories.id), // null = 总预算
  amount: real("amount").notNull(),
  period: text("period", { enum: ["weekly", "monthly", "yearly"] }).default("monthly"),
  startDate: integer("start_date"),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 周期账单表
// ─────────────────────────────────────────────
export const recurringBills = sqliteTable("recurring_bills", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  categoryId: text("category_id").references(() => categories.id),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  frequency: text("frequency", {
    enum: ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"],
  }).notNull(),
  nextDueDate: integer("next_due_date").notNull(),
  lastRunDate: integer("last_run_date"),
  notes: text("notes"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// ─────────────────────────────────────────────
// 资产快照表
// ─────────────────────────────────────────────
export const assetSnapshots = sqliteTable("asset_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  totalNetWorth: real("total_net_worth").default(0),
  totalInvestments: real("total_investments").default(0),
  totalCash: real("total_cash").default(0),
  totalDebt: real("total_debt").default(0),
  snapshotDate: integer("snapshot_date"),
  createdAt: integer("created_at"),
});

// ─────────────────────────────────────────────
// 关系定义
// ─────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  investments: many(investments),
  budgets: many(budgets),
  assetSnapshots: many(assetSnapshots),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parentChild",
  }),
  children: many(categories, { relationName: "parentChild" }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  transferToAccount: one(accounts, {
    fields: [transactions.transferToAccountId],
    references: [accounts.id],
  }),
}));

export const investmentsRelations = relations(investments, ({ one, many }) => ({
  user: one(users, { fields: [investments.userId], references: [users.id] }),
  investmentTransactions: many(investmentTransactions),
  sipPlans: many(sipPlans),
}));

export const investmentTransactionsRelations = relations(
  investmentTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [investmentTransactions.userId],
      references: [users.id],
    }),
    investment: one(investments, {
      fields: [investmentTransactions.investmentId],
      references: [investments.id],
    }),
    account: one(accounts, {
      fields: [investmentTransactions.accountId],
      references: [accounts.id],
    }),
  })
);

export const sipPlansRelations = relations(sipPlans, ({ one }) => ({
  user: one(users, { fields: [sipPlans.userId], references: [users.id] }),
  investment: one(investments, {
    fields: [sipPlans.investmentId],
    references: [investments.id],
  }),
  account: one(accounts, {
    fields: [sipPlans.accountId],
    references: [accounts.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const assetSnapshotsRelations = relations(assetSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [assetSnapshots.userId],
    references: [users.id],
  }),
}));

export const recurringBillsRelations = relations(recurringBills, ({ one }) => ({
  user: one(users, {
    fields: [recurringBills.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [recurringBills.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [recurringBills.categoryId],
    references: [categories.id],
  }),
}));

// ─────────────────────────────────────────────
// 类型导出
// ─────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Investment = typeof investments.$inferSelect;
export type NewInvestment = typeof investments.$inferInsert;
export type InvestmentTransaction =
  typeof investmentTransactions.$inferSelect;
export type NewInvestmentTransaction =
  typeof investmentTransactions.$inferInsert;
export type FundCache = typeof fundCache.$inferSelect;
export type NewFundCache = typeof fundCache.$inferInsert;
export type SipPlan = typeof sipPlans.$inferSelect;
export type NewSipPlan = typeof sipPlans.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type RecurringBill = typeof recurringBills.$inferSelect;
export type NewRecurringBill = typeof recurringBills.$inferInsert;
export type AssetSnapshot = typeof assetSnapshots.$inferSelect;
export type NewAssetSnapshot = typeof assetSnapshots.$inferInsert;
