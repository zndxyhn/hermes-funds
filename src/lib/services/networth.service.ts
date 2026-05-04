/**
 * Net Worth Service — 净资产计算
 * 净资产 = 总资产 - 总负债
 * 总资产 = 账户余额 + 投资市值
 * 负债 = 信用账户透支等（暂无，简单版 = 总资产）
 */
import { getDb } from "../db";
import { accounts, investments, type Account } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export interface NetWorthData {
  date: string; // ISO 日期
  totalAssets: number; // 总资产
  totalLiabilities: number; // 总负债
  netWorth: number; // 净资产
  // 资产分布
  cashBalance: number; // 现金账户总额
  investmentValue: number; // 投资持仓总额
  // 资产明细
  byAccount: {
    accountId: string;
    accountName: string;
    accountType: string;
    balance: number;
    proportion: number; // 占总资产比例 %
  }[];
  byInvestment: {
    investmentId: string;
    name: string;
    ticker: string;
    type: string;
    currentValue: number;
    proportion: number; // 占投资总额比例 %
  }[];
  // 负债明细
  liabilities: {
    accountId: string;
    accountName: string;
    amount: number;
  }[];
}

export async function calculateNetWorth(userId: string): Promise<NetWorthData> {
  const db = getDb();

  // 获取所有账户
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();

  // 获取所有投资
  const userInvestments = await db
    .select()
    .from(investments)
    .where(eq(investments.userId, userId))
    .all();

  // 资产计算
  let cashBalance = 0;
  let investmentValue = 0;
  const liabilities: { accountId: string; accountName: string; amount: number }[] = [];

  for (const acc of userAccounts) {
    if (acc.type === "credit") {
      // 信用卡：余额为负是负债
      if ((acc.balance ?? 0) < 0) {
        liabilities.push({
          accountId: acc.id,
          accountName: acc.name,
          amount: Math.abs(acc.balance ?? 0),
        });
      }
    }
    // 现金类账户计入总资产
    if (acc.type !== "credit" || (acc.balance ?? 0) >= 0) {
      cashBalance += acc.balance ?? 0;
    }
  }

  for (const inv of userInvestments) {
    investmentValue += inv.currentValue ?? 0;
  }

  const totalAssets = cashBalance + investmentValue;
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
  const netWorth = totalAssets - totalLiabilities;

  // 账户明细
  const byAccount = userAccounts
    .filter(acc => (acc.balance ?? 0) !== 0 || acc.type !== "credit")
    .map(acc => ({
      accountId: acc.id,
      accountName: acc.name,
      accountType: acc.type,
      balance: acc.balance ?? 0,
      proportion: totalAssets > 0 ? ((acc.balance ?? 0) / totalAssets) * 100 : 0,
    }))
    .filter(item => item.balance !== 0);

  // 投资明细
  const byInvestment = userInvestments
    .filter(inv => (inv.currentValue ?? 0) > 0)
    .map(inv => ({
      investmentId: inv.id,
      name: inv.name,
      ticker: inv.ticker ?? "",
      type: inv.type,
      currentValue: inv.currentValue ?? 0,
      proportion: investmentValue > 0 ? ((inv.currentValue ?? 0) / investmentValue) * 100 : 0,
    }));

  return {
    date: new Date().toISOString().split("T")[0],
    totalAssets,
    totalLiabilities,
    netWorth,
    cashBalance,
    investmentValue,
    byAccount,
    byInvestment,
    liabilities,
  };
}

/**
 * 净资产历史走势
 * 按月聚合计算历史净资产
 */
export async function getNetWorthHistory(
  userId: string,
  months: number = 12
): Promise<{ month: string; netWorth: number }[]> {
  const db = getDb();
  const now = new Date();
  const result: { month: string; netWorth: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // 简化版：取本月账户余额快照
    // 实际应该从 assets 表历史快照读取
    const accountsSnapshot = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .all();

    const investmentsSnapshot = await db
      .select()
      .from(investments)
      .where(eq(investments.userId, userId))
      .all();

    const cashBalance = accountsSnapshot.reduce((sum, acc) => sum + (acc.balance ?? 0), 0);
    const investmentValue = investmentsSnapshot.reduce((sum, inv) => sum + (inv.currentValue ?? 0), 0);
    const netWorth = cashBalance + investmentValue;

    result.push({ month, netWorth });
  }

  return result;
}
