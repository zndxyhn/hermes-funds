/**
 * 种子数据脚本：为新用户初始化默认账户和分类
 * 运行方式: npx tsx src/lib/db/scripts/seed.ts
 *
 * 幂等设计：可重复运行，每次只插入不存在的记录
 */
import { getDb, initDatabase } from "../index";
import { users, accounts, categories } from "../schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_USER_ID = "user_default";

initDatabase();

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedDefaultData(userId: string = DEFAULT_USER_ID) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // 1. 确保默认用户存在
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
      name: "默认用户",
      email: null,
      avatar: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log("✅ 默认用户创建成功");
  } else {
    console.log("✅ 默认用户已存在");
  }

  // 2. 确保默认账户存在（按名称检查，避免重复）
  const existingAccounts = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();

  const existingAccountNames = new Set(existingAccounts.map((a) => a.name));

  const defaultAccounts = [
    { name: "现金", type: "cash" as const, isDefault: true, icon: "💵", sortOrder: 1 },
    { name: "我的银行卡", type: "bank" as const, isDefault: false, icon: "🏦", sortOrder: 2 },
    { name: "支付宝", type: "digital" as const, isDefault: false, icon: "💙", sortOrder: 3 },
    { name: "微信", type: "digital" as const, isDefault: false, icon: "💚", sortOrder: 4 },
    { name: "投资账户", type: "investment" as const, isDefault: false, icon: "📈", sortOrder: 5 },
  ];

  let accCreated = 0;
  for (const acc of defaultAccounts) {
    if (!existingAccountNames.has(acc.name)) {
      await db.insert(accounts).values({
        id: generateId("acc"),
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
      accCreated++;
    }
  }
  console.log(`✅ 账户: ${defaultAccounts.length - accCreated}/${defaultAccounts.length} 已存在，${accCreated} 新建`);

  // 3. 确保支出分类存在（按名称检查）
  const existingCats = await db
    .select({ name: categories.name, type: categories.type })
    .from(categories)
    .where(eq(categories.userId, userId))
    .all();

  const existingCatKeys = new Set(existingCats.map((c) => `${c.type}:${c.name}`));

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

  const incomeCategories = [
    { name: "工资", icon: "💰", sortOrder: 1 },
    { name: "奖金", icon: "🎁", sortOrder: 2 },
    { name: "兼职", icon: "💼", sortOrder: 3 },
    { name: "理财收益", icon: "📈", sortOrder: 4 },
    { name: "利息", icon: "🏧", sortOrder: 5 },
    { name: "其他收入", icon: "💵", sortOrder: 99 },
  ];

  let expCreated = 0;
  for (const cat of expenseCategories) {
    if (!existingCatKeys.has(`expense:${cat.name}`)) {
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
      expCreated++;
    }
  }
  console.log(`✅ 支出分类: ${expenseCategories.length - expCreated}/${expenseCategories.length} 已存在，${expCreated} 新建`);

  let incCreated = 0;
  for (const cat of incomeCategories) {
    if (!existingCatKeys.has(`income:${cat.name}`)) {
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
      incCreated++;
    }
  }
  console.log(`✅ 收入分类: ${incomeCategories.length - incCreated}/${incomeCategories.length} 已存在，${incCreated} 新建`);

  // 4. 验证最终数据
  const catCount = await db.select().from(categories).where(eq(categories.userId, userId)).all();
  console.log(`\n🎉 种子数据就绪：用户 1 个，账户 ${defaultAccounts.length} 个，分类 ${catCount.length} 个`);
}

// 自动执行
seedDefaultData().catch(console.error);
