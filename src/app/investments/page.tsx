"use client";

import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Investment {
  id: string;
  name: string;
  type: string;
  ticker: string;
  totalUnits: number;
  totalCost: number;
  avgCost: number;
  currentNav?: number;
  currentPrice?: number;
  currentValue: number;
  profit: number;
  profitRate: number;
  lastNavUpdate?: number;
}

interface Quote {
  ticker: string;
  name: string;
  nav?: number;
  estNav?: number;
  dailyReturn?: number;
  lastUpdate?: string;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function formatPct(rate: number): string {
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;
}

export default function InvestmentsPage() {
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<{ ticker: string; msg: string } | null>(null);
  const [searchTicker, setSearchTicker] = useState("");

  const { data: invData, mutate: mutateInv } = useSWR<{
    success: boolean;
    data: Investment[];
  }>("/api/investments", fetcher);

  const investments = invData?.data ?? [];

  async function refreshQuote(ticker: string) {
    setRefreshing(ticker);
    setRefreshMsg(null);
    try {
      const res = await fetch("/api/fund-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (data.success) {
        setRefreshMsg({ ticker, msg: "行情已更新" });
        mutateInv();
      } else {
        setRefreshMsg({ ticker, msg: data.error?.message || "更新失败" });
      }
    } catch {
      setRefreshMsg({ ticker, msg: "网络错误" });
    } finally {
      setRefreshing(null);
    }
  }

  const totalValue = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalCost = investments.reduce((s, i) => s + i.totalCost, 0);
  const totalProfit = investments.reduce((s, i) => s + i.profit, 0);
  const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

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
              <a href="/investments" className="text-blue-600 font-medium">投资</a>
              <a href="/reports" className="text-slate-600 hover:text-slate-900">报表</a>
              <a href="/budgets" className="text-slate-600 hover:text-slate-900">预算</a>
            </nav>
            <a
              href="/transactions"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + 记账
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">总市值</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">总成本</p>
            <p className="text-2xl font-bold text-slate-700">{formatCurrency(totalCost)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">总收益</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">收益率</p>
            <p className={`text-2xl font-bold ${totalProfitRate >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatPct(totalProfitRate)}
            </p>
          </div>
        </div>

        {/* Investments List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">我的投资</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value)}
                placeholder="基金代码"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              />
              <button
                onClick={() => searchTicker && refreshQuote(searchTicker)}
                disabled={!searchTicker || refreshing === searchTicker}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                查询
              </button>
            </div>
          </div>

          {investments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="text-4xl mb-3">📈</p>
              <p>暂无投资记录</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {investments.map((inv) => (
                <div key={inv.id} className="px-6 py-5 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{inv.type === "fund" ? "📊" : "📈"}</span>
                        <h3 className="font-semibold text-slate-900">{inv.name}</h3>
                        <span className="text-sm text-slate-400 font-mono">{inv.ticker}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500 mt-2">
                        <span>持有份额：{inv.totalUnits}</span>
                        <span>平均成本：{formatCurrency(inv.avgCost)}</span>
                        {inv.currentNav && <span>最新净值：{inv.currentNav}</span>}
                        {inv.lastNavUpdate && <span>更新：{formatDate(inv.lastNavUpdate)}</span>}
                      </div>
                      {refreshMsg?.ticker === inv.ticker && (
                        <p className={`text-xs mt-1 ${refreshMsg.msg.includes("成功") ? "text-emerald-600" : "text-red-500"}`}>
                          {refreshMsg.msg}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{formatCurrency(inv.currentValue)}</p>
                      <p className={`text-sm font-medium ${inv.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {inv.profit >= 0 ? "+" : ""}{formatCurrency(inv.profit)} ({formatPct(inv.profitRate)})
                      </p>
                      <button
                        onClick={() => refreshQuote(inv.ticker)}
                        disabled={refreshing === inv.ticker}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        {refreshing === inv.ticker ? "更新中..." : "刷新行情"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tip */}
        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-sm text-blue-700">
            💡 提示：在搜索框输入基金代码（如 <code className="font-mono bg-blue-100 px-1 rounded">000001</code>）可查询实时行情。
            投资数据每5分钟自动刷新。
          </p>
        </div>
      </main>
    </div>
  );
}
