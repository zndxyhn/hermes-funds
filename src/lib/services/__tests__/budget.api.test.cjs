/**
 * M8 Budget API 集成测试
 * 运行方式: node src/lib/services/__tests__/budget.api.test.js
 */
const API_BASE = "http://localhost:3000/api";

function assert(condition, message) {
  if (!condition) throw new Error(`❌ 断言失败: ${message}`);
  console.log(`  ✅ ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`❌ ${message}: 期望 ${expected}, 实际 ${actual}`);
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
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  const data = await res.json();
  return { status: res.status, data };
}

let budgetId = null;
let categoryId = null;
let accountId = null;

console.log("\n🚀 M8 Budget API 集成测试开始\n");

async function testBudgetCRUD() {
  console.log("📋 测试 1: Budget CRUD");

  // 1.1 GET /api/categories 获取分类
  let res = await apiGet("/categories");
  assertEqual(res.status, 200, "GET /api/categories 返回 200");
  assert(res.data.data.length > 0, "有分类数据");
  categoryId = res.data.data[0].id;

  // 1.2 GET /api/accounts 获取账户
  res = await apiGet("/accounts");
  assertEqual(res.status, 200, "GET /api/accounts 返回 200");
  assert(res.data.data.length > 0, "有账户数据");
  accountId = res.data.data[0].id;

  // 1.3 POST /api/budgets — 创建月度总预算
  res = await apiPost("/budgets", {
    amount: 5000,
    period: "monthly",
  });
  assertEqual(res.status, 201, "POST /api/budgets 创建月度总预算返回 201");
  assert(res.data.success, "返回 success: true");
  assertEqual(res.data.data.amount, 5000, "预算金额正确");
  assertEqual(res.data.data.period, "monthly", "周期正确");
  budgetId = res.data.data.id;

  // 1.4 POST /api/budgets — 创建分类预算
  res = await apiPost("/budgets", {
    categoryId: categoryId,
    amount: 2000,
    period: "monthly",
  });
  assertEqual(res.status, 201, "POST /api/budgets 创建分类预算返回 201");
  assertEqual(res.data.data.categoryId, categoryId, "关联分类正确");

  // 1.5 POST /api/budgets — 缺少必填字段
  res = await apiPost("/budgets", { name: "test" });
  assertEqual(res.status, 400, "缺少 amount 返回 400");

  // 1.6 GET /api/budgets — 列表查询
  res = await apiGet("/budgets");
  assertEqual(res.status, 200, "GET /api/budgets 返回 200");
  assert(Array.isArray(res.data.data), "返回数组");
  assert(res.data.data.length >= 2, "至少有 2 条预算");

  // 1.7 GET /api/budgets?period=monthly
  res = await apiGet("/budgets?period=monthly");
  assertEqual(res.status, 200, "GET /api/budgets?period=monthly 返回 200");

  // 1.8 GET /api/budgets/[id] — 获取单个
  res = await apiGet(`/budgets/${budgetId}`);
  assertEqual(res.status, 200, "GET /api/budgets/[id] 返回 200");
  assertEqual(res.data.data.budget.id, budgetId, "返回正确的 ID");

  // 1.9 GET /api/budgets/[id] — 不存在的 ID
  res = await apiGet("/budgets/nonexistent_id");
  assertEqual(res.status, 404, "不存在的 ID 返回 404");

  // 1.10 PUT /api/budgets/[id] — 更新
  res = await apiPut(`/budgets/${budgetId}`, {
    amount: 6000,
    period: "yearly",
  });
  assertEqual(res.status, 200, "PUT /api/budgets/[id] 返回 200");
  assertEqual(res.data.data.amount, 6000, "金额已更新");
  assertEqual(res.data.data.period, "yearly", "周期已更新");

  console.log("\n");
}

async function testBudgetProgress() {
  console.log("📋 测试 2: 预算进度");

  // 2.1 GET /api/budgets?progress=true — 获取预算进度
  let res = await apiGet("/budgets?progress=true");
  assertEqual(res.status, 200, "GET /api/budgets?progress=true 返回 200");
  assert(res.data.data.length >= 1, "有预算数据");
  assert(res.data.data[0].spent !== undefined, "包含 spent 字段");
  assert(res.data.data[0].percent !== undefined, "包含 percent 字段");
  assert(res.data.data[0].isOverBudget !== undefined, "包含 isOverBudget 字段");

  // 2.2 GET /api/budgets/[id]?progress=true — 获取单个预算进度
  res = await apiGet(`/budgets/${budgetId}?progress=true`);
  assertEqual(res.status, 200, "GET /api/budgets/[id]?progress=true 返回 200");
  assert(res.data.data.spent !== undefined, "包含 spent 字段");
  assert(res.data.data.remaining !== undefined, "包含 remaining 字段");
  assert(res.data.data.percent !== undefined, "包含 percent 字段");
  assert(res.data.data.isOverBudget !== undefined, "包含 isOverBudget 字段");

  console.log("\n");
}

async function testBudgetDelete() {
  console.log("📋 测试 3: 删除预算");

  // 3.1 DELETE /api/budgets/[id]
  const res = await apiDelete(`/budgets/${budgetId}`);
  assertEqual(res.status, 200, "DELETE /api/budgets/[id] 返回 200");

  // 3.2 验证删除成功
  const getRes = await apiGet(`/budgets/${budgetId}`);
  assertEqual(getRes.status, 404, "删除后查询返回 404");

  console.log("\n");
}

async function runAllTests() {
  try {
    await testBudgetCRUD();
    await testBudgetProgress();
    await testBudgetDelete();

    console.log("=".repeat(50));
    console.log("✅ M8 Budget API 集成测试全部通过!");
    console.log("=".repeat(50));
    process.exit(0);
  } catch (error) {
    console.error("\n❌ 测试失败:", error.message);
    process.exit(1);
  }
}

runAllTests();
