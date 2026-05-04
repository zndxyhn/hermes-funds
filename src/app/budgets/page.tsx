"use client";

import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

interface Budget {
  id: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  amount: number;
  period: string;
  spent?: number;
  remaining?: number;
  progress?: number;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BudgetsPage() {
  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: budgetData, mutate: mutateBudget } = useSWR<{ success: boolean; data: Budget[] }>(
    "/api/budgets",
    fetcher
  );
  const { data: catsData } = useSWR<{ success: boolean; data: Category[] }>(
    "/api/categories?type=expense",
    fetcher
  );

  const budgets = budgetData?.data ?? [];
  const categories = catsData?.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !amount) {
      setMsg({ type: "error", text: "请填写分类和预算金额" });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, amount: parseFloat(amount), period }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: "预算设置成功！" });
        setCategoryId("");
        setAmount("");
        setShowForm(false);
        mutateBudget();
      } else {
        setMsg({ type: "error", text: data.error?.message || "设置失败" });
      }
    } catch {
      setMsg({ type: "error", text: "网络错误" });
    } finally {
      setSubmitting(false);
    }
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);

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
              <a href="/reports" className="text-slate-600 hover:text-slate-900">报表</a>
              <a href="/budgets" className="text-blue-600 font-medium">预算</a>
            </nav>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {showForm ? "取消" : "+ 设置预算"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">预算总额</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">已支出</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">剩余</p>
            <p className={`text-2xl font-bold ${totalBudget - totalSpent >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatCurrency(totalBudget - totalSpent)}
            </p>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">设置预算</h2>
            {msg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {msg.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">分类 *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">选择分类</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">预算金额 *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">周期</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">每月</option>
                    <option value="weekly">每周</option>
                    <option value="yearly">每年</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Budget Cards */}
        {budgets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-slate-500 mb-1">暂无预算设置</p>
            <p className="text-sm text-slate-400">点击右上角「设置预算」开始</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((b) => {
              const pct = b.amount > 0 ? Math.min(((b.spent ?? 0) / b.amount) * 100, 100) : 0;
              const remaining = b.amount - (b.spent ?? 0);
              return (
                <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{b.categoryIcon || "📦"}</span>
                      <span className="font-medium text-slate-900">{b.categoryName || "未知分类"}</span>
                    </div>
                    <span className="text-xs text-slate-400 capitalize">
                      {b.period === "monthly" ? "每月" : b.period === "weekly" ? "每周" : "每年"}
                    </span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500">已用 {formatCurrency(b.spent ?? 0)}</span>
                      <span className="text-slate-500">{formatCurrency(b.amount)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <p className={`text-sm font-medium ${remaining >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    剩余：{formatCurrency(remaining)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
