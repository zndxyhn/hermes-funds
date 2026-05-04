/**
 * Hermes Funds — Dialog Manager
 *
 * 对话管理：整合 NLU 解析结果 + 追问机制 + 状态机
 *
 * 状态流转：
 *   idle → intent_detected (有 intent)
 *   intent_detected → slot_filling (缺少必填槽位)
 *   slot_filling → awaiting_confirmation (所有必填槽位已填)
 *   awaiting_confirmation → idle (confirmed) | idle (cancelled)
 *
 * 追问策略：
 *   缺少 amount → "请问金额是多少？"
 *   缺少 category → "这是什么分类？（餐饮/交通/购物/...）"
 *   缺少 account → "用哪个账户？"
 *   多个槽位缺失 → 优先问最重要的（amount > category > account）
 */

const { parse } = require('./nlu_engine.js');

// 账户中文名映射（用于追问）
const ACCOUNT_CHINESE = {
  cash: "现金",
  bank_card: "银行卡",
  alipay: "支付宝",
  wechat: "微信",
  credit_card: "信用卡",
  investment: "投资账户",
};

// 分类选项（用于追问）
function getCategoryOptions(type = "expense") {
  const expense = [
    "餐饮", "交通", "购物", "居住", "医疗",
    "教育", "书籍", "娱乐", "通讯", "旅行", "日用", "咖啡",
  ];
  const income = ["工资", "奖金", "兼职", "理财收益", "利息"];
  return type === "income" ? income : expense;
}

/**
 * 生成追问文本（只用当前已知的 parseResult，不继承历史 entity）
 */
function generateClarification(intent, missingSlots, parseResult) {
  const options = getCategoryOptions(intent);

  if (missingSlots.includes("amount") && missingSlots.includes("category")) {
    return "请问这笔钱的金额和分类是什么？分类可选：" + options.slice(0, 6).join("、") + "等";
  }
  if (missingSlots.includes("amount")) {
    return "请问金额是多少？";
  }
  if (missingSlots.includes("category")) {
    return `请问这是什么分类？可选：${options.slice(0, 6).join("、")}等`;
  }
  if (missingSlots.includes("account")) {
    const accounts = ["现金", "银行卡", "支付宝", "微信", "信用卡"];
    return `请问用哪个账户？可选：${accounts.join("、")}`;
  }
  return "请提供更多信息";
}

/**
 * 生成确认文本
 */
function generateConfirmation(entity, intent) {
  const { amount, category, account, date, note } = entity;
  const catName = category?.name ?? "未分类";
  const accName = ACCOUNT_CHINESE[account] ?? account ?? "未指定账户";
  const dateStr = date ? `（${date}）` : "";
  const noteStr = note ? `，备注：${note}` : "";

  if (intent === "expense") {
    return `确认支出 ¥${amount}，分类：${catName}，账户：${accName}${dateStr}${noteStr}。确认请说"确认"或"好的"，取消请说"取消"。`;
  }
  if (intent === "income") {
    return `确认收入 ¥${amount}，分类：${catName}，账户：${accName}${dateStr}${noteStr}。确认请说"确认"或"好的"，取消请说"取消"。`;
  }
  if (intent === "transfer") {
    return `确认转账 ¥${amount}，从账户：${accName}${dateStr}。确认请说"确认"或"好的"，取消请说"取消"。`;
  }
  return `确认操作 ¥${amount}${dateStr}。确认请说"确认"。`;
}

/**
 * 处理用户输入
 * @param {string} text - 用户输入
 * @param {object} state - 当前对话状态
 * @returns {{ response, state, action }}
 *   action: "clarify" | "confirm" | "executed" | "query_result" | "unknown"
 */
function process(text, state = {}) {
  let currentState = {
    intent: state.intent ?? null,
    entity: state.entity ?? {},
    pendingSlots: state.pendingSlots ?? [],
    step: state.step ?? "idle",
    lastBotMessage: state.lastBotMessage ?? null,
  };

  const cleaned = text.trim();

  // 处理确认/取消关键词
  if (/^(确认|好的|是|没错|ok|yes|y)$/i.test(cleaned)) {
    if (currentState.step === "awaiting_confirmation" && currentState.intent) {
      return {
        response: "✅ 已确认，正在执行操作...",
        action: "executed",
        state: currentState,
        entity: currentState.entity,
      };
    }
    // 没有待确认内容
    return { response: "没有正在等待确认的操作。", action: "unknown", state: currentState };
  }

  if (/^(取消|算了|不要|no|n)$/i.test(cleaned)) {
    if (currentState.step !== "idle") {
      return {
        response: "已取消。有什么其他需要帮忙的吗？",
        action: "cancelled",
        state: { step: "idle", intent: null, entity: {}, pendingSlots: [] },
      };
    }
    return { response: "好的。", action: "unknown", state: currentState };
  }

  // 解析输入
  const parseResult = parse(cleaned);

  // 如果是槽位填充阶段（当前有 pending intent），尝试从输入中提取槽位
  // 重要：如果用户换了话题（新intent与当前intent不同），则跳出到主分支处理重置
  if (currentState.step === "slot_filling" && currentState.intent) {
    // Intent 不匹配 → 跳出到主分支（会触发 reset）
    if (parseResult.intent !== currentState.intent) {
      // fall through to main branch
    } else {
      const updatedEntity = { ...currentState.entity };
      const newPending = [...currentState.pendingSlots];

      if (!updatedEntity.amount && parseResult.amount) {
        updatedEntity.amount = parseResult.amount;
        updatedEntity.amountRaw = parseResult.amountRaw;
        const idx = newPending.indexOf("amount");
        if (idx !== -1) newPending.splice(idx, 1);
      }

      if (!updatedEntity.category && parseResult.category) {
        updatedEntity.category = parseResult.category;
        const idx = newPending.indexOf("category");
        if (idx !== -1) newPending.splice(idx, 1);
      }

      if (!updatedEntity.account && parseResult.accountHint) {
        updatedEntity.account = parseResult.accountHint;
        const idx = newPending.indexOf("account");
        if (idx !== -1) newPending.splice(idx, 1);
      }

      if (!updatedEntity.date && parseResult.date) {
        updatedEntity.date = parseResult.date;
        const idx = newPending.indexOf("date");
        if (idx !== -1) newPending.splice(idx, 1);
      }

      if (newPending.length === 0) {
        // 所有槽位已填满
        const nextState = {
          ...currentState,
          entity: updatedEntity,
          pendingSlots: [],
          step: "awaiting_confirmation",
        };
        return {
          response: generateConfirmation(updatedEntity, currentState.intent),
          action: "confirm",
          state: nextState,
        };
      }

      // 仍有缺失槽位，继续追问
      const nextState = {
        ...currentState,
        entity: updatedEntity,
        pendingSlots: newPending,
        step: "slot_filling",
      };
      return {
        response: generateClarification(currentState.intent, newPending, parseResult),
        action: "clarify",
        state: nextState,
      };
    }
  }

  // 正常解析流程
  if (parseResult.intent === "unknown") {
    return {
      response: '抱歉，我没有理解您的意思。请尝试描述一笔支出、收入或转账，例如："吃饭花了50元"或"工资到账8000元"。',
      action: "unknown",
      state: { step: "idle", intent: null, entity: {}, pendingSlots: [] },
    };
  }

  if (parseResult.intent === "query_summary" || parseResult.intent === "query_budget") {
    return {
      response: `您想查询${parseResult.intent === "query_summary" ? "收支情况" : "预算"}。请稍等，我来查一下。`,
      action: "query_result",
      state: { step: "idle", intent: null, entity: {}, pendingSlots: [] },
      queryType: parseResult.intent,
    };
  }

  // 支出/收入/转账：检查槽位
  if (["expense", "income", "transfer"].includes(parseResult.intent)) {
    // 新意图与当前状态意图不同 → 重置状态（用户换了话题）
    const didReset = currentState.step === "slot_filling" && currentState.intent !== null && currentState.intent !== parseResult.intent;
    if (didReset) {
      console.log("🔄 RESET: old intent=" + currentState.intent + " new intent=" + parseResult.intent);
      currentState = { step: "idle", intent: null, entity: {}, pendingSlots: [] };
    }

    const missing = [];
    if (!parseResult.amount) missing.push("amount");
    if (!parseResult.category) missing.push("category");
    if (!parseResult.accountHint) missing.push("account");
    if (!parseResult.date) missing.push("date");

    const entity = {
      amount: parseResult.amount ?? null,
      amountRaw: parseResult.amountRaw ?? null,
      category: parseResult.category ?? null,
      account: parseResult.accountHint ?? null,
      date: parseResult.date ?? null,
      note: null,
    };

    if (missing.length > 0) {
      // 槽位不完整，进入追问流程
      const nextState = {
        intent: parseResult.intent,
        entity,
        pendingSlots: missing,
        step: "slot_filling",
      };
      return {
        response: generateClarification(parseResult.intent, missing, parseResult),
        action: "clarify",
        state: nextState,
      };
    }

    // 槽位完整，进入确认
    const nextState = {
      intent: parseResult.intent,
      entity,
      pendingSlots: [],
      step: "awaiting_confirmation",
    };
    return {
      response: generateConfirmation(entity, parseResult.intent),
      action: "confirm",
      state: nextState,
    };
  }

  return {
    response: "收到，我理解您想要进行某种操作。请描述具体金额和内容。",
    action: "unknown",
    state: currentState,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────
if (require.main === module) {
  const scenarios = [
    "买书花了50块",
    "工资到账8000元",
    "转账1000元到银行卡",
    "本月花了多少钱",
    "确认",
    "取消",
    "咖啡花了35元",
    "9.9元",
  ];

  let state = {};
  for (const input of scenarios) {
    console.log(`\n👤 用户: ${input}`);
    const { response, action, state: newState } = process(input, state);
    console.log(`🤖 助手: ${response}`);
    console.log(`   [action=${action}, step=${newState.step}]`);
    state = newState;
  }
}

module.exports = { process, generateClarification, generateConfirmation };
