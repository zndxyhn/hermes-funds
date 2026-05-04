/**
 * Hermes Funds — NLU 解析引擎
 *
 * 输入：用户自然语言，如 "餐饮花费100元"
 * 输出：{ intent, amount, date, category, canConfirm, missingSlots, confidence }
 *
 * 支持的意图：
 *  - expense           支出
 *  - income            收入
 *  - transfer          转账
 *  - investment_buy    投资买入
 *  - investment_sell   投资卖出
 *  - query_summary     查询收支
 *  - query_budget      查询预算
 *  - query_investment  查询投资
 *  - unknown            无法识别
 */

export interface NluResult {
  originalText: string;
  intent: string;
  intentConfidence: number;
  intentMethod: string;
  amount: number | null;
  amountRaw: string | null;
  date: string;
  isToday: boolean;
  category: { id: string; name: string; confidence: number; method: string } | null;
  accountHint: string | null;
  missingSlots: string[];
  canConfirm: boolean;
}

// ─────────────────────────────────────────────
// 分类映射（内联默认值）
// ─────────────────────────────────────────────
const CATEGORY_MAP: Record<string, Record<string, { id: string; aliases?: string[] }>> = {
  expense: {
    "餐饮": { id: "cat_expense_food", aliases: ["吃", "中餐", "外卖"] },
    "交通": { id: "cat_expense_transport", aliases: ["坐车", "打车", "加油"] },
    "购物": { id: "cat_expense_shopping", aliases: ["买", "网购"] },
    "居住": { id: "cat_expense_housing", aliases: ["房租", "水电"] },
    "医疗": { id: "cat_expense_medical", aliases: ["看病", "买药"] },
    "教育": { id: "cat_expense_education", aliases: ["学费", "培训"] },
    "书籍": { id: "cat_expense_books", aliases: ["买书"] },
    "娱乐": { id: "cat_expense_entertainment", aliases: ["电影", "游戏"] },
    "通讯": { id: "cat_expense_communication", aliases: ["话费", "流量"] },
    "旅行": { id: "cat_expense_travel", aliases: ["机票", "酒店"] },
    "日用": { id: "cat_expense_daily", aliases: ["日用品"] },
    "咖啡": { id: "cat_expense_coffee", aliases: ["奶茶", "咖啡"] },
    "其他支出": { id: "cat_expense_other", aliases: [] }
  },
  income: {
    "工资": { id: "cat_income_salary", aliases: ["月薪", "底薪"] },
    "奖金": { id: "cat_income_bonus", aliases: ["年终奖", "绩效"] },
    "兼职": { id: "cat_income_parttime", aliases: ["外快", "副业"] },
    "理财收益": { id: "cat_income_investment", aliases: ["分红", "投资收益"] },
    "利息": { id: "cat_income_interest", aliases: ["存款利息"] },
    "其他收入": { id: "cat_income_other", aliases: [] }
  }
};

// ─────────────────────────────────────────────
// 意图关键词
// ─────────────────────────────────────────────
const INTENT_KEYWORDS: Record<string, string[]> = {
  expense: ["花了", "花费", "消费", "支出", "付", "扣", "用了", "开销", "购买", "费", "花", "买"],
  income: ["收", "到账", "收入", "工资", "奖金", "分红", "利息", "赚了"],
  transfer: ["转账", "转出", "转入", "转移"],
  investment_buy: ["买入", "购买", "定投", "投资买入", "申购"],
  investment_sell: ["卖出", "赎回", "减仓", "清仓", "卖出份额"],
  query_summary: ["花了多少", "收支", "支出多少", "收入多少", "本月", "这个月"],
  query_budget: ["预算", "还剩多少预算", "预算超支"],
  query_investment: ["持仓", "收益", "净值", "行情", "当前价格", "我的基金", "我的股票"],
};

// ─────────────────────────────────────────────
// 意图分类
// ─────────────────────────────────────────────
function classifyIntent(text: string): { intent: string; confidence: number; method: string } {
  const lower = text.toLowerCase();

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return { intent, confidence: 0.9, method: "keyword" };
      }
    }
  }

  // 纯数字金额开头
  const amountFirst = text.match(/^([\d.,]+)[元块]?\s/);
  if (amountFirst) {
    if (text.includes("收入") || text.includes("到账")) {
      return { intent: "income", confidence: 0.7, method: "pattern" };
    }
    return { intent: "expense", confidence: 0.7, method: "pattern" };
  }

  return { intent: "unknown", confidence: 0, method: "none" };
}

// ─────────────────────────────────────────────
// 金额提取
// ─────────────────────────────────────────────
function extractAmount(text: string): { amount: number; raw: string } | null {
  const patterns = [
    /([\d,]+\.?\d*)\s*万/g,
    /([\d,]+\.?\d*)\s*千/g,
    /([\d,]+\.?\d*)\s*元/gi,
    /([\d,]+\.?\d*)\s*块/gi,
    /¥\s*([\d,]+\.?\d*)/g,
    /CNY\s*([\d,]+\.?\d*)/gi,
    /\$\s*([\d,]+\.?\d*)/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      let amount = parseFloat(match[1].replace(",", ""));
      if (pattern.source.startsWith("([\\d,]+\\.?\\d*)\\s*万")) {
        const extra = text.match(/([\d,]+\.?\d*)\s*万([\d,]+\.?\d*)/);
        if (extra) amount = parseFloat(extra[1]) * 10000 + parseFloat(extra[2]);
        else amount = parseFloat(match[1]) * 10000;
      } else if (pattern.source.startsWith("([\\d,]+\\.?\\d*)\\s*千")) {
        amount = parseFloat(match[1]) * 1000;
      }
      return { amount: Math.round(amount * 100) / 100, raw: match[0] };
    }
  }

  const pureNum = text.match(/^([\d.]+)/);
  if (pureNum) {
    return { amount: parseFloat(pureNum[1]), raw: pureNum[0] };
  }

  return null;
}

// ─────────────────────────────────────────────
// 日期提取
// ─────────────────────────────────────────────
function extractDate(text: string): { date: string; isToday: boolean } {
  const today = new Date();
  const lower = text.toLowerCase();

  const dateMap: Record<string, number> = {
    "今天": 0, "今日": 0,
    "昨天": -1, "昨日": -1,
    "前天": -2,
    "明天": 1, "明日": 1,
  };

  for (const [word, offset] of Object.entries(dateMap)) {
    if (lower.includes(word)) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return { date: d.toISOString().split("T")[0], isToday: offset === 0 };
    }
  }

  // "上周三"
  const lastWeekDay = text.match(/上周([一二三四五六日])/);
  if (lastWeekDay) {
    const dayMap: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0 };
    const targetDay = dayMap[lastWeekDay[1]];
    const d = new Date(today);
    const diff = d.getDay() - targetDay - 7;
    d.setDate(d.getDate() + diff);
    return { date: d.toISOString().split("T")[0], isToday: false };
  }

  // "5月3日"
  const monthDay = text.match(/(\d+)月(\d+)日?/);
  if (monthDay) {
    const d = new Date(today.getFullYear(), parseInt(monthDay[1]) - 1, parseInt(monthDay[2]));
    return { date: d.toISOString().split("T")[0], isToday: false };
  }

  // "2025-05-03"
  const isoDate = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDate) {
    return { date: isoDate[1], isToday: false };
  }

  return { date: today.toISOString().split("T")[0], isToday: true };
}

// ─────────────────────────────────────────────
// 分类匹配
// ─────────────────────────────────────────────
function matchCategory(hint: string, type: string): { id: string; name: string; confidence: number; method: string } | null {
  const map = CATEGORY_MAP[type];
  if (!map) return null;

  const trimmed = hint.trim();

  // 精确匹配
  if (map[trimmed]) {
    return { id: map[trimmed].id, name: trimmed, confidence: 1.0, method: "exact" };
  }

  // 别名匹配
  for (const [name, info] of Object.entries(map)) {
    if (info.aliases && info.aliases.includes(trimmed)) {
      return { id: info.id, name, confidence: 0.9, method: "alias" };
    }
  }

  // 部分匹配
  for (const [name, info] of Object.entries(map)) {
    if (name.length <= trimmed.length) continue;
    const shared = [...trimmed].filter(c => name.includes(c));
    if (shared.length >= 2 && trimmed.length >= 2) {
      return { id: info.id, name, confidence: 0.65, method: "partial" };
    }
  }

  // 包含匹配
  for (const [name, info] of Object.entries(map)) {
    if (name.length > trimmed.length) continue;
    if (trimmed.includes(name)) {
      return { id: info.id, name, confidence: 0.7, method: "contains" };
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// 在文本中搜索分类（不经意图关键词移除）
// ─────────────────────────────────────────────
function findCategoryInText(text: string, type: string): { id: string; name: string; confidence: number; method: string } | null {
  const map = CATEGORY_MAP[type];
  if (!map) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 精确匹配
  if (map[trimmed]) {
    return { id: map[trimmed].id, name: trimmed, confidence: 1.0, method: "exact" };
  }

  // 别名匹配（按长度降序优先）
  const allAliases: { alias: string; name: string; id: string; len: number }[] = [];
  for (const [name, info] of Object.entries(map)) {
    if (info.aliases) {
      for (const alias of info.aliases) {
        if (trimmed.includes(alias)) {
          allAliases.push({ alias, name, id: info.id, len: alias.length });
        }
      }
    }
  }
  if (allAliases.length > 0) {
    allAliases.sort((a, b) => b.len - a.len);
    const best = allAliases[0];
    return { id: best.id, name: best.name, confidence: 0.95, method: "alias" };
  }

  return null;
}

// ─────────────────────────────────────────────
// 账户提示词提取
// ─────────────────────────────────────────────
const ACCOUNT_KEYWORDS = ["现金", "银行卡", "支付宝", "微信", "投资账户", "信用卡", "余额", "账户"];

function extractAccountHint(text: string): string | null {
  for (const kw of ACCOUNT_KEYWORDS) {
    if (text.includes(kw)) return kw;
  }
  return null;
}

// ─────────────────────────────────────────────
// 主解析函数
// ─────────────────────────────────────────────
export function parse(text: string): NluResult {
  const originalText = text;
  const cleaned = text.trim().replace(/[。！？，、]/g, " ").trim();

  // 1. 意图分类
  const intentResult = classifyIntent(cleaned);

  // 2. 实体提取
  const amount = extractAmount(cleaned);
  const dateInfo = extractDate(cleaned);
  const accountHint = extractAccountHint(cleaned);

  // 3. 分类匹配
  let categoryHint: { id: string; name: string; confidence: number; method: string } | null = null;
  if (intentResult.intent === "expense" || intentResult.intent === "income") {
    const type = intentResult.intent;
    const typeKeywords = INTENT_KEYWORDS[intentResult.intent] ?? [];
    const beforeAmount = amount ? cleaned.split(amount.raw)[0] : cleaned;

    let match: { id: string; name: string; confidence: number; method: string } | null = null;

    // 步骤1：别名搜索
    match = findCategoryInText(beforeAmount, type);

    // 步骤2：移除意图关键词后匹配
    if (!match) {
      const sorted = [...typeKeywords].sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return a.localeCompare(b);
      });
      let reduced = beforeAmount;
      for (const kw of sorted) {
        reduced = reduced.replace(new RegExp(kw, "g"), "").trim();
      }
      if (reduced) {
        match = matchCategory(reduced, type);
      }
    }

    // 步骤3：兜底
    if (!match) {
      const cats = CATEGORY_MAP[type];
      if (cats) {
        for (const name of Object.keys(cats)) {
          if (beforeAmount.includes(name)) {
            match = { id: cats[name].id, name, confidence: 0.85, method: "substring" };
            break;
          }
        }
      }
    }

    if (match) categoryHint = match;
  }

  // 4. 组装结果
  const result: NluResult = {
    originalText,
    intent: intentResult.intent,
    intentConfidence: intentResult.confidence,
    intentMethod: intentResult.method,
    amount: amount ? amount.amount : null,
    amountRaw: amount ? amount.raw : null,
    date: dateInfo.date,
    isToday: dateInfo.isToday,
    category: categoryHint,
    accountHint,
    missingSlots: [],
    canConfirm: false,
  };

  // 5. 槽位检查
  if (intentResult.intent === "expense" || intentResult.intent === "income") {
    if (!result.amount) result.missingSlots.push("amount");
    if (!result.category) result.missingSlots.push("category");
  } else if (intentResult.intent === "transfer") {
    if (!result.amount) result.missingSlots.push("amount");
  } else if (intentResult.intent === "investment_buy" || intentResult.intent === "investment_sell") {
    if (!result.amount) result.missingSlots.push("amount");
  }

  result.canConfirm = result.missingSlots.length === 0 && result.intent !== "unknown";

  return result;
}
