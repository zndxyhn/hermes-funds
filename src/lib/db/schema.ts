import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

// 用户表
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  avatar: text("avatar"),
  role: text("role", { enum: ["owner", "admin", "member"] }).default("member"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 账户表
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["cash", "bank", "digital", "investment", "credit"] }).notNull(),
  balance: real("balance").default(0),
  currency: text("currency").default("CNY"),
  icon: text("icon"),
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 分类表
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["income", "expense", "investment"] }).notNull(),
  icon: text("icon"),
  color: text("color"),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 交易记录表
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  categoryId: text("category_id").references(() => categories.id),
  type: text("type", { enum: ["income", "expense", "transfer", "investment"] }).notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  notes: text("notes"),
  date: integer("date", { mode: "timestamp" }).notNull(),
  tags: text("tags"), // JSON array string
  investmentId: text("investment_id").references(() => investments.id), // 关联投资记录
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 投资记录表
export const investments = sqliteTable("investments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["fund", "stock", "etf", "bond", "other"] }).notNull(),
  ticker: text("ticker"), // 基金代码/股票代码
  purchasePrice: real("purchase_price").notNull(),
  currentNav: real("current_nav"), // 基金净值/股票价格
  currentPrice: real("current_price"), // 实时价格
  units: real("units").notNull(),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }).notNull(),
  notes: text("notes"),
  lastPriceUpdate: integer("last_price_update", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 预算表
export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: text("category_id").references(() => categories.id),
  amount: real("amount").notNull(),
  period: text("period", { enum: ["weekly", "monthly", "yearly"] }).default("monthly"),
  startDate: integer("start_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 资产快照表
export const assetSnapshots = sqliteTable("asset_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  totalNetWorth: real("total_net_worth").default(0),
  totalInvestments: real("total_investments").default(0),
  totalCash: real("total_cash").default(0),
  totalDebt: real("total_debt").default(0),
  snapshotDate: integer("snapshot_date", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 类型导出
export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Investment = typeof investments.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type AssetSnapshot = typeof assetSnapshots.$inferSelect;
