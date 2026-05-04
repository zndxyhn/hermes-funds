"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface NetWorthData {
  date: string;
  totalAssets: number;
  netWorth: number;
  cashBalance: number;
  investmentValue: number;
  byAccount: Array<{ accountId: string; accountName: string; accountType: string; balance: number; proportion: number }>;
  byInvestment: Array<{ investmentId: string; name: string; ticker: string; type: string; currentValue: number; proportion: number }>;
}

interface Transaction {
  id: string;
  type: "income" | "expense" | "transfer" | "investment";
  amount: number;
  description: string;
  date: number;
  accountName?: string;
  categoryName?: string;
}

interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: string;
  spent?: number;
  categoryName?: string;
}

function formatCurrency(amount: number): string {
  return `¥ ${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

export default function DashboardCards() {
  const { data: netWorthData } = useSWR<{ success: boolean; data: NetWorthData }>(
    "/api/reports/net-worth",
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: txData } = useSWR<{ success: boolean; data: { data: Transaction[] } }>(
    "/api/transactions?limit=5",
    fetcher
  );
  const { data: invData } = useSWR<{ success: boolean; data: any }>(
    "/api/investments",
    fetcher
  );
  const { data: budgetData } = useSWR<{ success: boolean; data: Budget[] }>(
    "/api/budgets",
    fetcher
  );

  const nw = netWorthData?.data;
  const transactions = txData?.data?.data ?? [];
  const investments = invData?.data ?? [];
  const budgets = budgetData?.data ?? [];

  const monthExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const monthIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const monthBalance = monthIncome - monthExpenses;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Welcome */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          欢迎回来 👋
        </h2>
        <p className="text-slate-500 mt-1">
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long" })} ·
          本月收支一览
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">本月支出</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(monthExpenses)}</p>
          <p className="text-xs mt-1 text-slate-400">本月总计</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">本月收入</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(monthIncome)}</p>
          <p className="text-xs mt-1 text-slate-400">本月总计</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">本月结余</p>
          <p className={`text-2xl font-bold ${monthBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {formatCurrency(monthBalance)}
          </p>
          <p className="text-xs mt-1 text-slate-400">收入 - 支出</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">净资产</p>
          <p className="text-2xl font-bold text-purple-600">
            {nw ? formatCurrency(nw.netWorth) : "—"}
          </p>
          <p className="text-xs mt-1 text-slate-400">
            {nw ? `资产 ${formatCurrency(nw.totalAssets)}` : "加载中…"}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900">最近交易</h3>
            <a href="/transactions" className="text-sm text-blue-600 hover:text-blue-700">
              查看全部 →
            </a>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">📝</p>
              <p>暂无交易记录</p>
              <a href="/transactions" className="mt-3 text-sm text-blue-600 hover:text-blue-700 block">
                添加第一笔
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      tx.type === "expense" ? "bg-red-50 text-red-600" :
                      tx.type === "income" ? "bg-green-50 text-green-600" :
                      tx.type === "investment" ? "bg-blue-50 text-blue-600" :
                      "bg-slate-50 text-slate-600"
                    }`}>
                      {tx.type === "expense" ? "↓" : tx.type === "income" ? "↑" : tx.type === "investment" ? "⟳" : "↔"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{tx.description || tx.type}</p>
                      <p className="text-xs text-slate-400">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${
                    tx.type === "expense" || tx.type === "transfer" ? "text-red-600" : "text-green-600"
                  }`}>
                    {tx.type === "expense" || tx.type === "transfer" ? "-" : "+"}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Investment Portfolio */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900">投资组合</h3>
            <a href="/investments" className="text-sm text-blue-600 hover:text-blue-700">
              管理 →
            </a>
          </div>
          {investments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">📈</p>
              <p>暂无持仓</p>
              <a href="/investments" className="mt-3 text-sm text-blue-600 hover:text-blue-700 block">
                添加基金/股票
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {investments.slice(0, 5).map((inv: any) => (
                <div key={inv.id} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{inv.name}</p>
                    <p className="text-xs text-slate-400">{inv.ticker} · {inv.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatCurrency(inv.currentValue ?? inv.currentNav * inv.units)}
                    </p>
                    {inv.profit !== undefined && (
                      <p className={`text-xs ${inv.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {inv.profit >= 0 ? "+" : ""}
                        {formatCurrency(inv.profit)} ({inv.profitRate?.toFixed(2) ?? "0.00"}%)
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Budget & Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Progress */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900">预算进度</h3>
            <a href="/budgets" className="text-sm text-blue-600 hover:text-blue-700">
              设置预算 →
            </a>
          </div>
          {budgets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-4xl mb-2">🎯</p>
              <p>本月暂无预算</p>
              <a href="/budgets" className="mt-3 text-sm text-blue-600 hover:text-blue-700 block">
                创建月度预算
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map((b: Budget) => {
                const spent = b.spent ?? 0;
                const pct = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
                const over = spent > b.amount;
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{b.categoryName || "未分类"}</span>
                      <span className={over ? "text-red-600 font-medium" : "text-slate-500"}>
                        {formatCurrency(spent)} / {formatCurrency(b.amount)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          over ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Asset Allocation */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900">资产分布</h3>
          </div>
          {nw ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700">💵 现金</span>
                <span className="text-sm font-semibold text-blue-700">
                  {formatCurrency(nw.cashBalance)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-purple-700">📈 投资</span>
                <span className="text-sm font-semibold text-purple-700">
                  {formatCurrency(nw.investmentValue)}
                </span>
              </div>
              {nw.byAccount.map((a) => (
                <div key={a.accountId} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700">{a.accountName}</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {formatCurrency(a.balance)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p>加载中…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
