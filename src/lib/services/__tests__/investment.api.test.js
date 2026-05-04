/**
 * M7 API 集成测试
 * 测试所有 Investment 相关 API Routes
 * 运行方式: node src/lib/services/__tests__/investment.api.test.js
 */
const API_BASE = "http://localhost:3000/api";

// 辅助函数
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ 断言失败: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`❌ ${message}: 期望 ${expected}, 实际 ${actual}`);
  }
  console.log(`  ✅ ${message}`);
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  return { status: res.status, data };
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ─────────────────────────────────────────────
// 测试数据准备
// ─────────────────────────────────────────────
let investmentId = null;
let investmentId2 = null;
let transactionId = null;
let sipPlanId = null;
let accountId = null;
let fundCacheTicker = "005827";

console.log("\n🚀 M7 API 集成测试开始\n");

// ─────────────────────────────────────────────
// 测试 1: Investments CRUD
// ─────────────────────────────────────────────
async function testInvestmentsCRUD() {
  console.log("📋 测试 1: Investments CRUD");

  // 1.1 POST /api/investments — 创建基金持仓
  let res = await apiPost("/investments", {
    name: "易方达蓝筹精选",
    type: "fund",
    ticker: "005827",
    totalUnits: 100,
    totalCost: 1000,
    avgCost: 10,
    currentNav: 10,
    currentValue: 1000,
  });
  assertEqual(res.status, 201, "POST /api/investments 创建基金返回 201");
  assert(res.data.success, "返回 success: true");
  assert(res.data.data.name === "易方达蓝筹精选", "基金名称正确");
  investmentId = res.data.data.id;
  assert(investmentId, "返回投资记录 ID");

  // 1.2 POST /api/investments — 创建股票持仓
  res = await apiPost("/investments", {
    name: "腾讯控股",
    type: "stock",
    ticker: "00700",
    totalUnits: 10,
    totalCost: 3500,
    avgCost: 350,
    currentPrice: 350,
    currentValue: 3500,
  });
  assertEqual(res.status, 201, "POST /api/investments 创建股票返回 201");
  investmentId2 = res.data.data.id;

  // 1.3 POST /api/investments — 缺少必填字段
  res = await apiPost("/investments", { name: "测试" });
  assertEqual(res.status, 400, "缺少必填字段返回 400");

  // 1.4 GET /api/investments — 列表查询
  res = await apiGet("/investments");
  assertEqual(res.status, 200, "GET /api/investments 返回 200");
  assert(res.data.success, "返回 success: true");
  assert(Array.isArray(res.data.data), "返回数组");
  assert(res.data.data.length >= 2, "至少返回 2 条投资记录");

  // 1.5 GET /api/investments?type=fund — 按类型筛选
  res = await apiGet("/investments?type=fund");
  assertEqual(res.status, 200, "GET /api/investments?type=fund 返回 200");
  res.data.data.forEach((inv) => assertEqual(inv.type, "fund", `筛选结果 type=fund`));

  // 1.6 GET /api/investments/[id] — 获取单个
  res = await apiGet(`/investments/${investmentId}`);
  assertEqual(res.status, 200, "GET /api/investments/[id] 返回 200");
  assertEqual(res.data.data.id, investmentId, "返回正确的 ID");
  assertEqual(res.data.data.name, "易方达蓝筹精选", "返回正确的名称");

  // 1.7 GET /api/investments/[id] — 不存在的 ID
  res = await apiGet("/investments/nonexistent_id");
  assertEqual(res.status, 404, "不存在的 ID 返回 404");

  // 1.8 PUT /api/investments/[id] — 更新
  res = await apiPut(`/investments/${investmentId}`, {
    notes: "测试备注",
    name: "易方达蓝筹精选（更新）",
  });
  assertEqual(res.status, 200, "PUT /api/investments/[id] 返回 200");
  assertEqual(res.data.data.notes, "测试备注", "备注已更新");
  assertEqual(res.data.data.name, "易方达蓝筹精选（更新）", "名称已更新");

  // 1.9 DELETE /api/investments/[id] — 有持仓不可删除
  res = await apiDelete(`/investments/${investmentId}`);
  assertEqual(res.status, 400, "有持仓不可删除返回 400");
  assert(res.data.error.message.includes("仍有持仓份额"), "错误信息正确");

  console.log("\n");
}

// ─────────────────────────────────────────────
// 测试 2: Price Update
// ─────────────────────────────────────────────
async function testPriceUpdate() {
  console.log("📋 测试 2: 行情更新");

  // 2.1 POST /api/investments/[id]/price — 更新净值
  let res = await apiPost(`/investments/${investmentId}/price`, {
    navOrPrice: 11,
  });
  assertEqual(res.status, 200, "POST /api/investments/[id]/price 返回 200");
  assertEqual(res.data.data.currentNav, 11, "净值已更新为 11");
  assertEqual(res.data.data.currentValue, 1100, "市值 = 100 * 11 = 1100");
  assertEqual(res.data.data.profit, 100, "收益 = 1100 - 1000 = 100");
  assertEqual(res.data.data.profitRate, 10, "收益率 = 10%");

  // 2.2 POST /api/investments/[id]/price — 缺少必填字段
  res = await apiPost(`/investments/${investmentId}/price`, {});
  assertEqual(res.status, 400, "缺少 navOrPrice 返回 400");

  // 2.3 POST /api/investments/[id]/price — 不存在的投资
  res = await apiPost("/investments/nonexistent_id/price", { navOrPrice: 11 });
  assertEqual(res.status, 404, "不存在的投资返回 404");

  console.log("\n");
}

// ─────────────────────────────────────────────
// 测试 3: Investment Transactions
// ─────────────────────────────────────────────
async function testInvestmentTransactions() {
  console.log("📋 测试 3: Investment Transactions");

  // 3.1 GET /api/investment-transactions — 初始为空
  let res = await apiGet("/investment-transactions");
  assertEqual(res.status, 200, "GET /api/investment-transactions 返回 200");
  assert(Array.isArray(res.data.data), "返回数组");

  // 3.2 POST /api/investment-transactions — 创建买入交易
  // 先创建一个账户用于交易
  const accRes = await apiPost("/accounts", {
    name: "投资账户",
    type: "investment",
    balance: 50000,
  });
  accountId = accRes.data.data.id;

  res = await apiPost("/investment-transactions", {
    investmentId: investmentId,
    accountId: accountId,
    type: "buy",
    amount: 500,
    units: 50,
    navPrice: 10,
    date: Math.floor(Date.now() / 1000),
    source: "form",
  });
  assertEqual(res.status, 201, "POST /api/investment-transactions 创建买入返回 201");
  assert(res.data.success, "返回 success: true");
  transactionId = res.data.data.id;

  // 3.3 POST /api/investment-transactions — 缺少必填字段
  res = await apiPost("/investment-transactions", { name: "test" });
  assertEqual(res.status, 400, "缺少必填字段返回 400");

  // 3.4 GET /api/investment-transactions — 验证交易已创建
  res = await apiGet("/investment-transactions");
  assertEqual(res.status, 200, "GET /api/investment-transactions 返回 200");
  assert(res.data.data.length >= 1, "至少有 1 条交易记录");

  // 3.5 GET /api/investment-transactions?investmentId=xxx
  res = await apiGet(`/investment-transactions?investmentId=${investmentId}`);
  assertEqual(res.status, 200, "按 investmentId 筛选返回 200");
  res.data.data.forEach((tx) => assertEqual(tx.investmentId, investmentId, "筛选结果正确"));

  // 3.6 GET /api/investment-transactions?type=buy
  res = await apiGet("/investment-transactions?type=buy");
  assertEqual(res.status, 200, "按 type=buy 筛选返回 200");

  console.log("\n");
}

// ─────────────────────────────────────────────
// 测试 4: SIP Plans
// ─────────────────────────────────────────────
async function testSipPlans() {
  console.log("📋 测试 4: SIP Plans");

  const nextMonth = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // 4.1 POST /api/sip-plans — 创建定投计划
  let res = await apiPost("/sip-plans", {
    investmentId: investmentId,
    accountId: accountId,
    amount: 1000,
    frequency: "monthly",
    nextRunDate: nextMonth,
  });
  assertEqual(res.status, 201, "POST /api/sip-plans 创建返回 201");
  assert(res.data.success, "返回 success: true");
  assertEqual(res.data.data.amount, 1000, "定投金额正确");
  assertEqual(res.data.data.frequency, "monthly", "定投频率正确");
  sipPlanId = res.data.data.id;

  // 4.2 POST /api/sip-plans — 缺少必填字段
  res = await apiPost("/sip-plans", { name: "test" });
  assertEqual(res.status, 400, "缺少必填字段返回 400");

  // 4.3 GET /api/sip-plans — 列表
  res = await apiGet("/sip-plans");
  assertEqual(res.status, 200, "GET /api/sip-plans 返回 200");
  assert(Array.isArray(res.data.data), "返回数组");
  assert(res.data.data.length >= 1, "至少有 1 个定投计划");

  // 4.4 PUT /api/sip-plans/[id] — 更新
  res = await apiPut(`/sip-plans/${sipPlanId}`, {
    amount: 2000,
    enabled: false,
  });
  assertEqual(res.status, 200, "PUT /api/sip-plans/[id] 返回 200");
  assertEqual(res.data.data.amount, 2000, "金额已更新");
  assertEqual(res.data.data.enabled, false, "enabled 已更新");

  // 4.5 DELETE /api/sip-plans/[id] — 删除
  res = await apiDelete(`/sip-plans/${sipPlanId}`);
  assertEqual(res.status, 200, "DELETE /api/sip-plans/[id] 返回 200");

  // 4.6 验证删除成功
  res = await apiGet("/sip-plans");
  const deleted = res.data.data.find((p) => p.id === sipPlanId);
  assert(!deleted, "定投计划已删除");

  console.log("\n");
}

// ─────────────────────────────────────────────
// 测试 5: Fund Cache
// ─────────────────────────────────────────────
async function testFundCache() {
  console.log("📋 测试 5: Fund Cache");

  // 5.1 GET /api/fund-cache — 初始为空
  let res = await apiGet("/fund-cache");
  assertEqual(res.status, 200, "GET /api/fund-cache 返回 200");
  assert(Array.isArray(res.data.data), "返回数组");

  // 5.2 POST /api/fund-cache — 添加/更新缓存
  res = await apiPost("/fund-cache", {
    ticker: fundCacheTicker,
    name: "易方达蓝筹精选",
    nav: 2.35,
    navDate: "2024-05-03",
    estNav: 2.36,
    estNavTime: "2024-05-04 15:30",
    dayChange: 0.43,
  });
  assertEqual(res.status, 201, "POST /api/fund-cache 创建返回 201");
  assertEqual(res.data.data.ticker, fundCacheTicker, "基金代码正确");
  assertEqual(res.data.data.nav, 2.35, "净值正确");

  // 5.3 POST /api/fund-cache — 缺少 ticker
  res = await apiPost("/fund-cache", { name: "测试" });
  assertEqual(res.status, 400, "缺少 ticker 返回 400");

  // 5.4 GET /api/fund-cache?ticker=xxx — 获取单个
  res = await apiGet(`/fund-cache?ticker=${fundCacheTicker}`);
  assertEqual(res.status, 200, "GET /api/fund-cache?ticker=xxx 返回 200");
  assertEqual(res.data.data.ticker, fundCacheTicker, "返回正确的基金");
  assertEqual(res.data.data.name, "易方达蓝筹精选", "基金名称正确");

  // 5.5 GET /api/fund-cache?ticker=不存在的基金
  res = await apiGet("/fund-cache?ticker=NONEXIST");
  assertEqual(res.status, 404, "不存在的基金返回 404");

  // 5.6 POST /api/fund-cache — 更新现有基金
  res = await apiPost("/fund-cache", {
    ticker: fundCacheTicker,
    nav: 2.40,
    dayChange: 2.13,
  });
  assertEqual(res.status, 201, "POST /api/fund-cache 更新返回 201");
  assertEqual(res.data.data.nav, 2.40, "净值已更新");

  // 5.7 GET /api/fund-cache — 列表验证
  res = await apiGet("/fund-cache");
  assertEqual(res.status, 200, "GET /api/fund-cache 列表返回 200");
  const fund = res.data.data.find((f) => f.ticker === fundCacheTicker);
  assert(fund, "基金在列表中");
  assertEqual(fund.nav, 2.40, "列表中净值已更新");

  console.log("\n");
}

// ─────────────────────────────────────────────
// 测试 6: 清理测试数据
// ─────────────────────────────────────────────
async function cleanup() {
  console.log("📋 清理测试数据");

  // 先清空持仓（设置为0）
  const res = await apiGet("/investments");
  for (const inv of res.data.data) {
    if ((inv.totalUnits ?? 0) > 0) {
      // 无法通过 API 清空持仓，这里只删除测试创建的空仓
    }
  }

  // 删除测试创建的投资记录
  if (investmentId) {
    // 先将持仓设为0才能删除（通过直接更新）
    await apiPut(`/investments/${investmentId}`, { totalUnits: 0, totalCost: 0 });
    await apiDelete(`/investments/${investmentId}`);
  }
  if (investmentId2) {
    await apiPut(`/investments/${investmentId2}`, { totalUnits: 0, totalCost: 0 });
    await apiDelete(`/investments/${investmentId2}`);
  }

  console.log("  ✅ 清理完成\n");
}

// ─────────────────────────────────────────────
// 运行所有测试
// ─────────────────────────────────────────────
async function runAllTests() {
  try {
    await testInvestmentsCRUD();
    await testPriceUpdate();
    await testInvestmentTransactions();
    await testSipPlans();
    await testFundCache();
    await cleanup();

    console.log("=".repeat(50));
    console.log("✅ M7 API 集成测试全部通过!");
    console.log("=".repeat(50));
    process.exit(0);
  } catch (error) {
    console.error("\n❌ 测试失败:", error.message);
    process.exit(1);
  }
}

runAllTests();
