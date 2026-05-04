"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  icon?: string;
}

interface Transaction {
  id: string;
  type: "income" | "expense" | "transfer" | "investment";
  amount: number;
  description: string;
  notes?: string;
  date: number;
  categoryId?: string;
  accountId?: string;
  categoryName?: string;
  accountName?: string;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function TransactionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: txData, mutate: mutateTx } = useSWR<{
    success: boolean;
    data: { data: Transaction[]; total: number; page: number; pageSize: number; totalPages: number };
  }>("/api/transactions?limit=50", fetcher);

  const { data: expenseCats } = useSWR<{ success: boolean; data: Category[] }>(
    "/api/categories?type=expense",
    fetcher
  );
  const { data: incomeCats } = useSWR<{ success: boolean; data: Category[] }>(
    "/api/categories?type=income",
    fetcher
  );
  const { data: accountsData } = useSWR<{ success: boolean; data: Account[] }>(
    "/api/accounts",
    fetcher
  );

  const categories = formType === "expense" ? expenseCats?.data ?? [] : incomeCats?.data ?? [];
  const accounts = accountsData?.data ?? [];
  const transactions = txData?.data?.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !categoryId || !accountId || !date) {
      setSubmitMsg({ type: "error", text: "请填写所有必填项" });
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          amount: parseFloat(amount),
          categoryId,
          accountId,
          date,
          description: description || `${formType === "expense" ? "支出" : "收入"} ¥${amount}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitMsg({ type: "success", text: "记录成功！" });
        setAmount("");
        setDescription("");
        setCategoryId("");
        setAccountId("");
        setShowForm(false);
        mutateTx();
      } else {
        setSubmitMsg({ type: "error", text: data.error?.message || "添加失败" });
      }
    } catch {
      setSubmitMsg({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSubmitting(false);
    }
  }

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

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
              <a href="/transactions" className="text-blue-600 font-medium">记账</a>
              <a href="/investments" className="text-slate-600 hover:text-slate-900">投资</a>
              <a href="/reports" className="text-slate-600 hover:text-slate-900">报表</a>
              <a href="/budgets" className="text-slate-600 hover:text-slate-900">预算</a>
            </nav>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {showForm ? "取消" : "+ 记账"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">总收入</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">总支出</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">净收支</p>
            <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </p>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">新建记录</h2>
            {submitMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${submitMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {submitMsg.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setFormType("expense"); setCategoryId(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${formType === "expense" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => { setFormType("income"); setCategoryId(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${formType === "income" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                >
                  收入
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">金额 *</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">日期 *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
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
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">账户 *</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">选择账户</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.icon ? `${a.icon} ` : ""}{a.name}（{formatCurrency(a.balance)}）
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="简要描述..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "提交中..." : "保存记录"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Transaction List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">记账记录</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="text-4xl mb-3">📝</p>
              <p>暂无记录</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      tx.type === "income" ? "bg-emerald-100" : "bg-red-100"
                    }`}>
                      {tx.type === "income" ? "💰" : "💸"}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{tx.description || (tx.type === "income" ? "收入" : "支出")}</p>
                      <p className="text-sm text-slate-400">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <p className={`font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
