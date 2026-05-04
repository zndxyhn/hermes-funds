"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

interface Account { id: string; name: string; type: string; balance: number; icon?: string; }
interface OverviewData { totalBalance: number; byType: Record<string, number>; accounts: Account[]; }
interface MonthlyData { year: number; month: number; income: { total: number; count: number }; expense: { total: number; count: number }; balance: number; categoryBreakdown: Array<{ categoryId: string|null; categoryName: string; categoryIcon: string; type: string; amount: number }>; daily: Array<{ date: string; income: number; expense: number }>; }

export default function ReportsPage() {
  const { data: overview } = useSWR<{ success: boolean; data: OverviewData }>("/api/reports/overview", fetcher);
  const { data: monthly } = useSWR<{ success: boolean; data: MonthlyData }>("/api/reports/monthly_summary?year=2026&month=5", fetcher);

  const o = overview?.data;
  const m = monthly?.data;

  const accountIcons: Record<string, string> = {
    cash: "💵", bank: "🏦", digital: "📱", investment: "📈"
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">💰</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Hermes Funds</h1>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <a href="/" className="text-slate-600 hover:text-slate-900">仪表盘</a>
              <a href="/transactions" className="text-slate-600 hover:text-slate-900">记账</a>
              <a href="/investments" className="text-slate-600 hover:text-slate-900">投资</a>
              <a href="/reports" className="text-blue-600 font-medium">报表</a>
              <a href="/budgets" className="text-slate-600 hover:text-slate-900">预算</a>
            </nav>
            <a href="/transactions" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ 记账</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900">财务报表</h2>
          <p className="text-sm text-slate-500 mt-1">2026年5月</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">总资产</p>
            <p className="text-2xl font-bold text-slate-900">{o ? formatCurrency(o.totalBalance) : "-"}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">本月收入</p>
            <p className="text-2xl font-bold text-emerald-600">{m ? formatCurrency(m.income.total) : "-"}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">本月支出</p>
            <p className="text-2xl font-bold text-red-500">{m ? formatCurrency(m.expense.total) : "-"}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">本月净收支</p>
            <p className={`text-2xl font-bold ${m && m.balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {m ? formatCurrency(m.balance) : "-"}
            </p>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accounts breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">账户概览</h3>
            </div>
            <div className="p-6 space-y-4">
              {o?.accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{accountIcons[acc.type] || "💰"}</span>
                    <div>
                      <p className="font-medium text-slate-900">{acc.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{acc.type}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-slate-900">{formatCurrency(acc.balance)}</p>
                </div>
              ))}
              {o?.accounts.length === 0 && (
                <p className="text-center text-slate-400 py-4">暂无账户数据</p>
              )}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">支出分类</h3>
            </div>
            <div className="p-6 space-y-4">
              {m?.categoryBreakdown
                .filter((c) => c.type === "expense")
                .map((cat) => (
                  <div key={cat.categoryId ?? "unknown"} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cat.categoryIcon || "📦"}</span>
                      <p className="font-medium text-slate-700">{cat.categoryName}</p>
                    </div>
                    <p className="font-semibold text-slate-900">{formatCurrency(cat.amount)}</p>
                  </div>
                ))}
              {(!m?.categoryBreakdown || m.categoryBreakdown.filter(c => c.type === "expense").length === 0) && (
                <p className="text-center text-slate-400 py-4">暂无支出数据</p>
              )}
            </div>
          </div>
        </div>

        {/* Daily breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">每日收支</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">日期</th>
                  <th className="text-right px-6 py-3 text-slate-500 font-medium">收入</th>
                  <th className="text-right px-6 py-3 text-slate-500 font-medium">支出</th>
                  <th className="text-right px-6 py-3 text-slate-500 font-medium">净额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {m?.daily.map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-700">{day.date}</td>
                    <td className="px-6 py-3 text-right text-emerald-600">
                      {day.income > 0 ? `+${formatCurrency(day.income)}` : "-"}
                    </td>
                    <td className="px-6 py-3 text-right text-red-500">
                      {day.expense > 0 ? formatCurrency(day.expense) : "-"}
                    </td>
                    <td className={`px-6 py-3 text-right font-medium ${day.income - day.expense >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {formatCurrency(day.income - day.expense)}
                    </td>
                  </tr>
                ))}
                {(!m?.daily || m.daily.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">暂无每日数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
