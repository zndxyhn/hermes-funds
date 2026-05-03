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
              <a href="#" className="text-blue-600 font-medium">仪表盘</a>
              <a href="#" className="text-slate-600 hover:text-slate-900">记账</a>
              <a href="#" className="text-slate-600 hover:text-slate-900">投资</a>
              <a href="#" className="text-slate-600 hover:text-slate-900">报表</a>
              <a href="#" className="text-slate-600 hover:text-slate-900">预算</a>
            </nav>
            <div className="flex items-center gap-3">
              <button className="text-sm text-slate-600 hover:text-slate-900">设置</button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                + 记账
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">欢迎回来 👋</h2>
          <p className="text-slate-500 mt-1">2025年5月 · 本月收支一览</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: "本月支出", value: "¥ 0.00", change: "+0%", up: true, color: "text-red-600" },
            { label: "本月收入", value: "¥ 0.00", change: "+0%", up: true, color: "text-green-600" },
            { label: "本月结余", value: "¥ 0.00", change: "0%", up: null, color: "text-blue-600" },
            { label: "总投资收益", value: "¥ 0.00", change: "+0%", up: true, color: "text-purple-600" },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className={`text-xs mt-1 ${card.up === true ? 'text-green-500' : card.up === false ? 'text-red-500' : 'text-slate-400'}`}>
                {card.change} vs 上月
              </p>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900">最近交易</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700">查看全部 →</button>
            </div>
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">📝</p>
              <p>暂无交易记录</p>
              <button className="mt-3 text-sm text-blue-600 hover:text-blue-700">添加第一笔</button>
            </div>
          </div>

          {/* Investment Portfolio */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900">投资组合</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700">管理 →</button>
            </div>
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">📈</p>
              <p>暂无持仓</p>
              <button className="mt-3 text-sm text-blue-600 hover:text-blue-700">添加基金/股票</button>
            </div>
          </div>
        </div>

        {/* Budget Overview */}
        <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900">预算进度</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700">设置预算 →</button>
          </div>
          <div className="text-center py-8 text-slate-400">
            <p className="text-4xl mb-2">🎯</p>
            <p>本月暂无预算</p>
            <button className="mt-3 text-sm text-blue-600 hover:text-blue-700">创建月度预算</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-400">
          <p>Hermes Funds · 开源个人/家庭资金管理系统 · MIT License</p>
        </div>
      </footer>
    </main>
  );
}
