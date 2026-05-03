/**
 * 种子数据脚本：为新用户初始化默认账户和分类
 * 运行方式: npx tsx src/lib/db/scripts/seed.ts
 */
import { getDb, initDatabase } from "../index";
import { users, accounts, categories } from "../schema";
import { eq } from "drizzle-orm";

const DEFAULT_USER_ID = "user_default";

// 先初始化数据库表
initDatabase();

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedDefaultData(userId: string = DEFAULT_USER_ID) {
  const db = getDb();

  // 检查是否已有数据
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (existingUser) {
    console.log("✅ 种子数据已存在，跳过");
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  // 1. 创建默认用户
  await db.insert(users).values({
    id: userId,
    name: "我的账户",
    email: null,
    avatar: null,
    createdAt: now,
    updatedAt: now,
  });
  console.log("✅ 默认用户创建成功");

  // 2. 创建默认账户
  const defaultAccounts = [
    { id: generateId("acc"), name: "现金", type: "cash" as const, isDefault: true, icon: "💵", sortOrder: 1 },
    { id: generateId("acc"), name: "我的银行卡", type: "bank" as const, isDefault: false, icon: "🏦", sortOrder: 2 },
    { id: generateId("acc"), name: "支付宝", type: "digital" as const, isDefault: false, icon: "💙", sortOrder: 3 },
    { id: generateId("acc"), name: "微信", type: "digital" as const, isDefault: false, icon: "💚", sortOrder: 4 },
    { id: generateId("acc"), name: "投资账户", type: "investment" as const, isDefault: false, icon: "📈", sortOrder: 5 },
  ];

  for (const acc of defaultAccounts) {
    await db.insert(accounts).values({
      id: acc.id,
      userId,
      name: acc.name,
      type: acc.type,
      balance: 0,
      currency: "CNY",
      icon: acc.icon,
      color: null,
      sortOrder: acc.sortOrder,
      isDefault: acc.isDefault,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`✅ ${defaultAccounts.length} 个默认账户创建成功`);

  // 3. 创建默认支出分类
  const expenseCategories = [
    { name: "餐饮", icon: "🍜", sortOrder: 1 },
    { name: "购物", icon: "🛒", sortOrder: 2 },
    { name: "交通", icon: "🚗", sortOrder: 3 },
    { name: "居住", icon: "🏠", sortOrder: 4 },
    { name: "医疗", icon: "🏥", sortOrder: 5 },
    { name: "教育", icon: "📚", sortOrder: 6 },
    { name: "书籍", icon: "📖", sortOrder: 7 },
    { name: "娱乐", icon: "🎮", sortOrder: 8 },
    { name: "通讯", icon: "📱", sortOrder: 9 },
    { name: "旅行", icon: "✈️", sortOrder: 10 },
    { name: "日用", icon: "🧴", sortOrder: 11 },
    { name: "咖啡", icon: "☕", sortOrder: 12 },
    { name: "其他支出", icon: "📦", sortOrder: 99 },
  ];

  for (const cat of expenseCategories) {
    await db.insert(categories).values({
      id: generateId("cat_exp"),
      userId,
      type: "expense",
      name: cat.name,
      icon: cat.icon,
      color: null,
      parentId: null,
      sortOrder: cat.sortOrder,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`✅ ${expenseCategories.length} 个支出分类创建成功`);

  // 4. 创建默认收入分类
  const incomeCategories = [
    { name: "工资", icon: "💰", sortOrder: 1 },
    { name: "奖金", icon: "🎁", sortOrder: 2 },
    { name: "兼职", icon: "💼", sortOrder: 3 },
    { name: "理财收益", icon: "📈", sortOrder: 4 },
    { name: "利息", icon: "🏧", sortOrder: 5 },
    { name: "其他收入", icon: "💵", sortOrder: 99 },
  ];

  for (const cat of incomeCategories) {
    await db.insert(categories).values({
      id: generateId("cat_inc"),
      userId,
      type: "income",
      name: cat.name,
      icon: cat.icon,
      color: null,
      parentId: null,
      sortOrder: cat.sortOrder,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`✅ ${incomeCategories.length} 个收入分类创建成功`);

  console.log("\n🎉 种子数据初始化完成！");
}

// 自动执行
seedDefaultData().catch(console.error);
