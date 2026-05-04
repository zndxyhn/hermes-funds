import DashboardCards from "@/components/DashboardCards";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
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
              <a href="/" className="text-blue-600 font-medium">仪表盘</a>
              <a href="/transactions" className="text-slate-600 hover:text-slate-900">记账</a>
              <a href="/investments" className="text-slate-600 hover:text-slate-900">投资</a>
              <a href="/reports" className="text-slate-600 hover:text-slate-900">报表</a>
              <a href="/budgets" className="text-slate-600 hover:text-slate-900">预算</a>
            </nav>
            <div className="flex items-center gap-3">
              <a
                href="/transactions"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                + 记账
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <DashboardCards />

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-400">
          <p>Hermes Funds · 开源个人/家庭资金管理系统 · MIT License</p>
        </div>
      </footer>
    </main>
  );
}
