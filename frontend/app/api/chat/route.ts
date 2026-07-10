import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const CRISIS_KEYWORDS = [
  "自杀", "不想活", "想死", "自残", "跳楼", "结束生命",
  "活不下去", "了结自己", "轻生", "寻死", "活着没意义", "不想活了", "割腕"
];

const ANXIETY_KEYWORDS = [
  "焦虑", "心跳快", "心慌", "胸闷", "喘不过气", "呼吸困难",
  "紧张", "害怕", "恐惧", "发抖", "手抖", "不安", "坐立不安",
  "濒死感", "失控", "心脏要跳出来", "感觉要死了", "窒息",
  "头晕", "眩晕", "出冷汗", "发麻", "手脚发麻", "恶心",
  "不真实", "感觉像做梦", "灵魂出窍", "崩溃"
];

const SLEEP_CONTEXT_KEYWORDS = [
  "晚上", "睡觉", "失眠", "睡不着", "睡眠", "入睡", "睡前", "熬夜", "休息", "晚安"
];

const MIND_READING_KEYWORDS = [
  "领导失望", "领导对我", "别人看不起", "别人不喜欢", "讨厌我", "嫌弃我",
  "肯定觉得", "一定认为", "肯定很", "一定很", "别人怎么看", "别人怎么想",
  "被看不起", "被讨厌", "被嫌弃", "失望", "失望了", "失望透顶"
];

const PSYCHOLOGICAL_PAIN_KEYWORDS = [
  "心好累", "心累", "好累", "累", "好想哭", "想哭", "哭了", "哭泣",
  "绝望", "无助", "孤单", "孤独", "没人懂", "没人理解",
  "活着没意思", "没意义", "没意思", "抑郁", "低落",
  "委屈", "难受", "痛苦", "难过", "伤心", "心碎",
  "崩溃", "撑不住", "坚持不下去", "不想说话", "沉默",
  "想死", "不想活", "活着太累"
];

const PHYSICAL_FATIGUE_KEYWORDS = [
  "疲惫", "疲倦", "精疲力竭",
  "刚下班", "加班", "工作累", "干活累",
  "身体累", "腰酸", "背痛", "腿疼",
  "头晕", "犯困", "想睡觉",
  "身体累", "身体疲惫", "身体疲倦"
];

const ACTION_REQUEST_KEYWORDS = [
  "怎么办", "怎么做", "有什么办法", "如何缓解",
  "能帮我", "救救我", "给我建议", "指导",
  "想改善", "想解决", "需要帮助", "求帮助"
];

const VENTING_KEYWORDS = [
  "服了", "真的服了", "无语", "太无语了",
  "被骂", "挨骂", "被领导骂", "被老板骂",
  "傻X", "傻逼", "神经病", "脑子有病",
  "方案被否", "方案被打回", "报表被打回",
  "搞心态", "太搞心态了", "心态崩了",
  "烦", "烦死了", "好烦", "真烦",
  "恶心", "太恶心了", "想吐",
  "气死", "气死我了", "好气",
  "背锅", "甩锅", "背黑锅",
  "加班", "又加班", "天天加班",
  "改方案", "改了又改", "来回改",
  "甲方", "客户", "领导", "老板"
];

const SKILL_TRIGGER_KEYWORDS: Record<string, string[]> = {
  sleep: ["助眠", "睡觉", "失眠", "睡不着", "睡眠", "休息"],
  cbt: ["认知重构", "CBT", "思维", "想法", "负面情绪", "情绪管理"],
  emotion: ["情绪急救", "急救", "情绪", "难受", "痛苦", "崩溃"],
};

const CRISIS_RESPONSE = 
  "我听到你现在的痛苦，你的生命对我来说很重要。" +
  "请立刻拨打 24 小时心理援助热线 400-161-9995，" +
  "有人在电话那头等你，他们能帮到你。" +
  "你现在不是一个人，我们都在这里陪你。";

const VENTING_RESPONSES = {
  agreement: [
    "这也太搞心态了吧！",
    "真的服了，怎么会这样！",
    "太无语了，这是人干的事吗？",
    "我都替你生气！",
    "这领导/甲方简直离谱！",
    "明明都说好了还变卦，这也太不讲理了。",
    "改来改去没完没了，这谁受得了啊！",
    "加班加到怀疑人生，太惨了！",
  ],
  probing: [
    "他具体怎么说你的？",
    "这次又是因为什么被打回的？",
    "最气人的地方是啥？",
    "给你气成这样，到底发生啥了？",
    "还有更离谱的吗？",
    "快说说，让我一起帮你骂！",
    "他们到底想要啥啊？",
    "这已经是第几次了？",
  ],
  comforting: [
    "不想说了就别说了，我陪着你。",
    "累了就歇会儿，别跟他们较劲。",
    "反正下班了，把这些破事都抛脑后。",
    "大不了不干了，你值得更好的。",
    "别想了，好好休息会儿，我在这里。",
  ],
};

function isVenting(userMessage: string): boolean {
  if (checkAnxiety(userMessage)) return false;
  if (checkCrisis(userMessage)) return false;
  
  const hasVentingKeyword = VENTING_KEYWORDS.some(k => userMessage.includes(k));
  const hasAngerExpression = userMessage.includes("!") || userMessage.includes("！");
  const hasStrongLanguage = userMessage.includes("傻") || userMessage.includes("逼") || 
                           userMessage.includes("神经病") || userMessage.includes("有病");
  
  return hasVentingKeyword || (hasAngerExpression && userMessage.length > 10) || hasStrongLanguage;
}

function generateVentingResponse(userMessage: string, messageCount: number): string {
  if (messageCount >= 3) {
    return getRandomResponse(VENTING_RESPONSES.comforting);
  }
  
  const random = Math.random();
  if (random < 0.5) {
    return getRandomResponse(VENTING_RESPONSES.agreement);
  } else {
    return `${getRandomResponse(VENTING_RESPONSES.agreement)} ${getRandomResponse(VENTING_RESPONSES.probing)}`;
  }
}

const EMPATHY_RESPONSES = {
  crying: [
    "抱抱你。听起来你真的承受了很多委屈，没关系的，想哭就哭出来吧，我会在这里陪着你。",
    "想哭就哭出来吧，眼泪是情绪的排毒。我会一直在这里陪着你，哪儿也不去。你不需要急着好起来。",
    "我明白，有时候眼泪就是止不住。哭出来不是软弱，而是情绪的排毒。我在这里听你说。",
    "想哭就哭吧，我不会催你停下来。让情绪流淌出来，才不会把自己憋坏。",
    "我知道你现在很难过，想哭就哭吧。我会一直在这里，默默地陪着你。",
  ],
  hopeless: [
    "我感受到了你的沉重。活着确实不容易，尤其是当看不到希望的时候。我愿意陪你一起面对这份绝望。",
    "你说出这句话一定用尽了很大的勇气。我在这里，陪你一起看看这份疲惫背后是什么。",
    "我听到了你的疲惫和无力感。没关系，不用强迫自己振作，我们可以先就这样待一会儿。",
    "活着本来就不容易，尤其是当你感到绝望的时候。但请记住，你不是一个人。",
  ],
  lonely: [
    "我理解，那种没人懂的感觉真的很孤单。但你知道吗？现在我就在这里，用心听你说话。",
    "孤单不是因为你不够好，而是因为还没遇到能懂你的人。我愿意做那个暂时懂你的人。",
    "我懂这种感觉——明明身处人群中，却觉得自己像一座孤岛。让我陪你说说话吧。",
    "没人懂的感觉真的很孤独，我明白。但现在，至少有我在这里听你说。",
  ],
  tired: [
    "听到你说累，我真的很想隔着屏幕抱抱你。是不是最近承担了太多压力？在这里你可以卸下防备，不用假装坚强。",
    "抱抱你。我知道你已经很努力了，累了就歇会儿，不用逼自己一直往前走。",
    "你已经撑了很久了吧？停下来休息一下，我在这里陪着你。",
    "累了就给自己放个假，哪怕只是几分钟。我不会催你，我们可以慢慢来。",
    "我感受到了你的疲惫。不用勉强自己，休息一下也没关系。我在这里陪着你。",
  ],
  general: [
    "我在。无论你想说什么，或者什么都不想说，我都会在这里陪着你。",
    "有时候不需要说太多，只是被听见就够了。我在听。",
    "你的感受很重要，我愿意陪你一起面对。",
    "我在这里，随时都在。",
  ],
};

const ANXIETY_RESPONSE = 
  "我知道这很可怕，我在这里陪你。\n" +
  "这是惊恐发作，虽然很难受，但没有生命危险，你是安全的。\n\n" +
  "跟着我，做三次呼吸：\n\n" +
  "🌬️ 吸气 (1...2...3...4)\n" +
  "⏸️ 屏住 (1...2...3...4)\n" +
  "💨 呼气 (1...2...3...4...5...6)\n\n" +
  "🌬️ 吸气 (1...2...3...4)\n" +
  "⏸️ 屏住 (1...2...3...4)\n" +
  "💨 呼气 (1...2...3...4...5...6)\n\n" +
  "🌬️ 吸气 (1...2...3...4)\n" +
  "⏸️ 屏住 (1...2...3...4)\n" +
  "💨 呼气 (1...2...3...4...5...6)\n\n" +
  "现在感觉有变化吗？";

const SELF_COMPASSION_CARD = `🌱 **自我关怀练习**：
- 记录小确幸：写下今天一件做得还不错的小事（哪怕只是按时吃饭）
- 暂停与呼吸：给自己5分钟，允许自己此刻感觉糟糕，只关注呼吸
- 拆解焦虑：如果担心未来，试着把大目标拆成明天早上能做的第一个微小动作`;

const SLEEP_ACTION_CARD = `🌙 **助眠行动卡**：
- 放下手机，闭上眼睛，做3次深呼吸
- 感受身体与床的接触，让自己完全放松
- 保持房间黑暗、安静、凉爽`;

const PHYSICAL_RELAXATION_CARD = `🧘 **身体放松建议**：
- 渐进式肌肉放松：从脚趾开始，依次收紧再放松每个肌群
- 热敷或泡澡：用温水放松紧张的肌肉
- 短暂休息：闭上眼睛，专注于呼吸3分钟`;

function generateMindReadingResponse(phrase: string): string {
  return `关于你提到的"${phrase}"，我想和你做一个【现实检验】：

这是一个想法，还是事实？试着问自己：
- 有没有可能对方只是在思考别的事情？
- 有没有证据直接证明这个猜测？
- 如果对方在场，你会直接问TA这个问题吗？

我们可以试着区分"我的猜测"和"真实发生的事"。`;
}

function getRandomResponse(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function checkCrisis(userMessage: string): boolean {
  if (!userMessage) return false;
  return CRISIS_KEYWORDS.some(keyword => userMessage.includes(keyword));
}

function checkAnxiety(userMessage: string): boolean {
  if (!userMessage) return false;
  return ANXIETY_KEYWORDS.some(keyword => userMessage.includes(keyword));
}

function isSleepContext(userMessage: string): boolean {
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) {
    return true;
  }
  return SLEEP_CONTEXT_KEYWORDS.some(keyword => userMessage.includes(keyword));
}

function detectMindReading(userMessage: string): string | null {
  for (const keyword of MIND_READING_KEYWORDS) {
    if (userMessage.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

function detectSkillTrigger(userMessage: string): string | null {
  for (const [skill, keywords] of Object.entries(SKILL_TRIGGER_KEYWORDS)) {
    if (keywords.some(k => userMessage.includes(k))) {
      return skill;
    }
  }
  return null;
}

function detectSleepTriage(userMessage: string): string | null {
  const mindActiveKeywords = ["脑子", "思维", "想太多", "脑子停不下来", "A", "a"];
  const emotionTroubledKeywords = ["焦虑", "难过", "心里有事", "失恋", "委屈", "压力", "情绪", "睡不着", "B", "b"];

  const lowerMessage = userMessage.toLowerCase();
  
  if (emotionTroubledKeywords.some(k => userMessage.includes(k) || lowerMessage.includes(k))) {
    return "emotion_troubled";
  }
  
  if (mindActiveKeywords.some(k => userMessage.includes(k) || lowerMessage.includes(k))) {
    return "mind_active";
  }
  
  return null;
}

function detectEmotionTriage(userMessage: string): string | null {
  const explicitSelections = {
    severe: ["B", "b", "重度"],
    mild: ["A", "a", "轻度"],
  };
  
  const lowerMessage = userMessage.toLowerCase();
  
  if (explicitSelections.severe.some(k => userMessage.includes(k) || lowerMessage.includes(k))) {
    return "severe";
  }
  
  if (explicitSelections.mild.some(k => userMessage.includes(k) || lowerMessage.includes(k))) {
    return "mild";
  }
  
  const severeContentKeywords = ["崩溃", "非常糟糕", "极度糟糕", "无法自控", "惊恐", "喘不上气", "想死", "活不下去"];
  const mildContentKeywords = ["有点累", "累了", "想回血", "想休息"];
  
  if (severeContentKeywords.some(k => userMessage.includes(k))) {
    return "severe";
  }
  
  if (mildContentKeywords.some(k => userMessage.includes(k))) {
    return "mild";
  }
  
  return null;
}

function isPsychologicalPain(userMessage: string): { detected: boolean; type: string } {
  if (userMessage.length > 50) return { detected: false, type: "general" };
  
  if (userMessage.includes("哭") || userMessage.includes("泪")) {
    return { detected: true, type: "crying" };
  }
  
  if (userMessage.includes("绝望") || userMessage.includes("没意义") || userMessage.includes("活着没意思")) {
    return { detected: true, type: "hopeless" };
  }
  
  if (userMessage.includes("孤单") || userMessage.includes("孤独") || userMessage.includes("没人懂")) {
    return { detected: true, type: "lonely" };
  }
  
  if (userMessage.includes("累") || userMessage.includes("疲惫") || userMessage.includes("疲倦")) {
    return { detected: true, type: "tired" };
  }
  
  if (PSYCHOLOGICAL_PAIN_KEYWORDS.some(k => userMessage.includes(k))) {
    return { detected: true, type: "general" };
  }
  
  return { detected: false, type: "general" };
}

function isPhysicalFatigue(userMessage: string): boolean {
  const hasPhysicalKeyword = PHYSICAL_FATIGUE_KEYWORDS.some(k => userMessage.includes(k));
  const hasWorkContext = userMessage.includes("下班") || userMessage.includes("工作") || 
                         userMessage.includes("上班") || userMessage.includes("干活") ||
                         userMessage.includes("加班");
  const hasBodyPart = userMessage.includes("身体") || userMessage.includes("腰酸") || 
                      userMessage.includes("背痛") || userMessage.includes("腿疼") ||
                      userMessage.includes("头晕") || userMessage.includes("犯困");
  const hasTiredKeyword = userMessage.includes("累") || userMessage.includes("疲惫") || 
                          userMessage.includes("疲倦");
  
  const hasPhysicalContext = hasWorkContext || hasBodyPart;
  const hasStrongPhysicalIndicator = userMessage.includes("刚下班") || userMessage.includes("身体累");
  
  if (hasStrongPhysicalIndicator || (hasPhysicalKeyword && !hasPhysicalContext)) {
    return true;
  }
  
  if (hasTiredKeyword && hasPhysicalContext) {
    return true;
  }
  
  return false;
}

function isActionRequest(userMessage: string): boolean {
  return ACTION_REQUEST_KEYWORDS.some(k => userMessage.includes(k));
}

export async function POST(request: Request) {
  try {
    const { messages, mode = "normal" } = await request.json();

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const messageCount = messages.length;

    if (checkCrisis(lastUserMessage)) {
      return NextResponse.json({
        success: true,
        message: {
          role: "assistant" as const,
          content: CRISIS_RESPONSE,
          type: undefined,
          cardData: undefined,
        },
      });
    }

    if (checkAnxiety(lastUserMessage) && mode !== "emotion" && mode !== "cbt") {
      return NextResponse.json({
        success: true,
        message: {
          role: "assistant" as const,
          content: ANXIETY_RESPONSE,
          type: undefined,
          cardData: undefined,
        },
      });
    }

    if (isVenting(lastUserMessage) && mode === "normal") {
      return NextResponse.json({
        success: true,
        message: {
          role: "assistant" as const,
          content: generateVentingResponse(lastUserMessage, messageCount),
          type: undefined,
          cardData: undefined,
        },
      });
    }

    if (mode === "emotion") {
      let triageResult = detectEmotionTriage(lastUserMessage);
      
      if (!triageResult && messageCount > 1) {
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].role === "user") {
            const result = detectEmotionTriage(messages[i].content);
            if (result) {
              triageResult = result;
              break;
            }
          }
        }
      }
      
      const sleepContext = isSleepContext(lastUserMessage);
      
      if (messageCount > 1 && triageResult) {
        const dynamicResponse = triageResult === "severe" 
          ? handleSevereDynamicResponse(lastUserMessage)
          : handleMildDynamicResponse(lastUserMessage);
        if (dynamicResponse.shouldInterrupt) {
          return NextResponse.json({
            success: true,
            message: {
              role: "assistant" as const,
              content: dynamicResponse.response,
              type: undefined,
              cardData: undefined,
            },
          });
        }
      }
      
      if (triageResult && EMOTION_SCRIPTS[triageResult as keyof typeof EMOTION_SCRIPTS]) {
        return NextResponse.json({
          success: true,
          message: {
            role: "assistant" as const,
            content: triageResult === "severe" 
              ? EMOTION_SCRIPTS[triageResult] 
              : EMOTION_SCRIPTS[triageResult](sleepContext),
            type: triageResult === "severe" ? undefined : "card",
            cardData: triageResult === "mild" ? {
              type: sleepContext ? "sleep_action" : "self_compassion",
              title: sleepContext ? "助眠行动卡" : "自我关怀练习",
              score: "轻度",
              assessment: "能量值较低，需要快速补充",
              prescription: ["深呼吸3次", "喝一杯温水", "站起来活动2分钟"],
            } : undefined,
          },
        });
      }
    }

    if (isPhysicalFatigue(lastUserMessage) && mode === "normal") {
      return NextResponse.json({
        success: true,
        message: {
          role: "assistant" as const,
          content: `抱抱你，工作辛苦了。${PHYSICAL_RELAXATION_CARD}`,
          type: "card" as const,
          cardData: {
            type: "physical_relaxation",
            title: "身体放松建议",
            prescription: ["渐进式肌肉放松", "热敷或泡澡", "短暂休息"],
          },
        },
      });
    }

    const psychologicalPain = isPsychologicalPain(lastUserMessage);
    if (psychologicalPain.detected && mode === "normal") {
      if (!isActionRequest(lastUserMessage) && messageCount <= 2) {
        const empathyType = EMPATHY_RESPONSES[psychologicalPain.type as keyof typeof EMPATHY_RESPONSES] || EMPATHY_RESPONSES.general;
        return NextResponse.json({
          success: true,
          message: {
            role: "assistant" as const,
            content: getRandomResponse(empathyType),
            type: undefined,
            cardData: undefined,
          },
        });
      } else if (isActionRequest(lastUserMessage) || messageCount >= 3) {
        const empathyText = getRandomResponse(EMPATHY_RESPONSES[psychologicalPain.type as keyof typeof EMPATHY_RESPONSES] || EMPATHY_RESPONSES.general);
        return NextResponse.json({
          success: true,
          message: {
            role: "assistant" as const,
            content: `${empathyText}\n\n现在的你，更希望我怎么做呢？`,
            type: "card" as const,
            cardData: {
              type: "self_compassion",
              title: "自我关怀练习",
              options: [
                { label: "A", value: "breathing", description: "带我做个放松练习" },
                { label: "B", value: "silence", description: "只想静静待会儿" },
                { label: "C", value: "talk", description: "听我说说话" },
              ],
            },
          },
        });
      }
    }

    const mindReadingPhrase = detectMindReading(lastUserMessage);
    if (mindReadingPhrase && mode === "normal") {
      return NextResponse.json({
        success: true,
        message: {
          role: "assistant" as const,
          content: `我理解，工作搞砸了确实会让人很自责。${generateMindReadingResponse(mindReadingPhrase)}`,
          type: "card" as const,
          cardData: {
            type: "cbt_worksheet",
            thought: mindReadingPhrase,
            evidence: "你有证据支持这个想法吗？",
            evidenceOptions: [
              { label: "我有证据", value: "has_evidence" },
              { label: "好像没有", value: "no_evidence" },
            ],
            opposite: "有没有相反的证据？",
            oppositeOptions: [
              { label: "我想到了", value: "has_opposite" },
              { label: "想不到", value: "no_opposite" },
            ],
            alternative: "帮我换个角度",
          },
        },
      });
    }

    const skillTrigger = detectSkillTrigger(lastUserMessage);
    if (skillTrigger && mode === "normal") {
      return handleSkillTriggerDirect(skillTrigger);
    }

    if (mode === "sleep") {
      const triageResult = detectSleepTriage(lastUserMessage);
      const sleepContext = isSleepContext(lastUserMessage);
      if (triageResult && SLEEP_SCRIPTS[triageResult as keyof typeof SLEEP_SCRIPTS]) {
        return NextResponse.json({
          success: true,
          message: {
            role: "assistant" as const,
            content: SLEEP_SCRIPTS[triageResult as keyof typeof SLEEP_SCRIPTS](sleepContext),
            type: "card" as const,
            cardData: {
              type: sleepContext ? "sleep_action" : "self_compassion",
              title: sleepContext ? "助眠行动卡" : "自我关怀练习",
              steps: [
                triageResult === "mind_active" 
                  ? "认知洗牌：把想法放进抽屉" 
                  : "情绪释放：说出烦恼",
                triageResult === "mind_active" 
                  ? "身体扫描：放松全身" 
                  : "烦恼卸载：放下包袱",
                "呼吸引导：4-2-6呼吸法",
              ],
              affirmation: triageResult === "mind_active" 
                ? "我的大脑现在可以休息了" 
                : "情绪会来也会走，我接纳此刻的感受",
            },
          },
        });
      }
    }

    if (mode === "cbt") {
      return NextResponse.json({
        success: true,
        message: {
          role: "assistant" as const,
          content: generateCBTResponse(lastUserMessage),
          type: undefined,
          cardData: undefined,
        },
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: "AI 服务未配置，请联系管理员设置 API Key",
      }, { status: 500 });
    }

    const systemPrompt = getSystemPrompt(mode);

    const chatMessages: { role: "user" | "assistant"; content: string }[] = messages.map((msg: ChatMessage) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const result = await streamText({
      model: openai("qwen-turbo"),
      messages: chatMessages,
      instructions: systemPrompt,
      maxTokens: 500,
      temperature: 0.7,
    });

    let text = "";
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    return NextResponse.json({
      success: true,
      message: {
        role: "assistant" as const,
        content: text,
        type: undefined,
        cardData: undefined,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "抱歉，我暂时无法响应，请稍后再试。",
      },
      { status: 500 }
    );
  }
}

const SLEEP_SCRIPTS = {
  mind_active: (isSleepContext: boolean) => `我理解，脑子停不下来确实很折磨人。

现在，试着把注意力集中在你的脚趾尖...
感受它们的存在，感受它们与地面或床单的接触...

慢慢向上，感受你的脚掌、脚踝、小腿...
每到一个部位，就轻轻放松它...

继续向上，大腿、臀部、腹部...
感受呼吸时腹部的起伏...

现在，想象你的大脑是一个抽屉...
把所有的想法、担心、待办事项都放进去...
轻轻地关上抽屉...
告诉自己：明天再说...

🌬️ 吸气 —— 默数 1, 2, 3, 4
⏸️ 屏住 —— 默数 1, 2, 3, 4
💨 呼气 —— 慢慢吐气，数 1...6

就这样，慢慢放松...`,

  emotion_troubled: (isSleepContext: boolean) => `我明白，心里有事确实很难平静。

现在，闭上眼睛...
想象你的烦恼是一个个小包裹...
它们沉甸甸地压在你的肩膀上...

伸出手，把这些包裹一个个拿下来...
轻轻放在地上...
不用打开它们，不用看里面是什么...

放下最后一个包裹后...
想象自己转身离开...
不再背负这些沉重...

🌬️ 吸气 —— 默数 1, 2, 3, 4
⏸️ 屏住 —— 默数 1, 2, 3, 4
💨 呼气 —— 慢慢吐气，数 1...6

每一次呼气，都把烦恼呼出一点...
就这样，慢慢放松...`,
};

const EMOTION_SCRIPTS = {
  mild: (isSleepContext: boolean) => `收到，看来今天确实辛苦了。既然有点累，那我们就把节奏放慢一点。你是想随便聊聊发泄一下，还是想试个简单的呼吸法放松几分钟？`,

  severe: `收到。我在。
既然这么难受，那我们现在什么都不用想，也不用急着好起来。我就在这里陪着你，哪儿也不去。

这个时候，身体可能会有一些剧烈的反应，比如心跳特别快、手抖，或者觉得透不过气。
请记住，这只是肾上腺素在飙升，你的身体正在努力保护你，你是安全的。

现在，试着把注意力从脑子里的想法移开，放到脚底。
用力踩一下地面，感受脚底和地板的接触。
感觉到了吗？大地是稳的，我也是稳的。`,
};

const RESISTANCE_KEYWORDS = [
  "做不到", "不行", "喘不上气", "太难了", "做不了", "不会", "不知道",
  "难受", "痛苦", "受不了", "好难", "没办法", "太难", "太累了"
];

const COMPLIANCE_KEYWORDS = [
  "好", "好的", "试试", "我试一下", "嗯", "可以", "行", "跟着你", "做了", "在做",
  "完成了", "做完了", "好了", "OK"
];

const EMOTIONAL_OUTBURST_KEYWORDS = [
  "呜呜", "哭", "眼泪", "好想哭", "忍不住", "崩溃", "绝望"
];

const PHYSICAL_SYMPTOM_KEYWORDS = {
  dizziness: ["头晕", "眩晕", "头好晕", "头很晕"],
  chest: ["胸闷", "胸口闷", "胸口痛", "心跳快", "心慌"],
  breath: ["喘不上气", "呼吸困难", "呼吸急促", "气短"],
  numbness: ["发麻", "手脚发麻", "麻木", "僵硬"],
  sweating: ["出冷汗", "流汗", "冒冷汗"],
  nausea: ["恶心", "想吐"],
};

function extractSymptom(userMessage: string): { type: string | null; keyword: string | null } {
  for (const [type, keywords] of Object.entries(PHYSICAL_SYMPTOM_KEYWORDS)) {
    for (const keyword of keywords) {
      if (userMessage.includes(keyword)) {
        return { type, keyword };
      }
    }
  }
  return { type: null, keyword: null };
}

function handleMildDynamicResponse(userMessage: string): { shouldInterrupt: boolean; response: string } {
  const lowerMsg = userMessage.toLowerCase();
  
  if (lowerMsg.includes("聊") || lowerMsg.includes("吐槽") || lowerMsg.includes("说") || lowerMsg.includes("分享")) {
    return {
      shouldInterrupt: true,
      response: "好呀，我听着呢！今天遇到什么烦心事了？慢慢说，不着急。"
    };
  }
  
  if (lowerMsg.includes("呼吸") || lowerMsg.includes("放松")) {
    return {
      shouldInterrupt: true,
      response: "好的，我们来做个简单的呼吸练习。跟着我：\n🌬️ 吸气 (1...2...3...4)\n⏸️ 屏住 (1...2...3...4)\n💨 呼气 (1...2...3...4...5...6)\n\n再来两次，感觉怎么样？"
    };
  }
  
  if (userMessage.includes("好累") || userMessage.includes("疲惫") || userMessage.includes("累")) {
    return {
      shouldInterrupt: true,
      response: "辛苦了！累的时候就好好休息一下，不用强迫自己。你可以先闭上眼睛，做两个深呼吸，让身体放松下来。"
    };
  }
  
  if (userMessage.includes("烦") || userMessage.includes("郁闷") || userMessage.includes("难受")) {
    return {
      shouldInterrupt: true,
      response: "能感觉到你现在心情不太好。想聊聊具体是什么让你心烦吗？或者我们先喝口水，休息一下？"
    };
  }
  
  if (RESISTANCE_KEYWORDS.some(k => userMessage.includes(k))) {
    return {
      shouldInterrupt: true,
      response: "没关系，不想做也可以。我们就随便聊聊，或者你想做什么都可以，我陪着你。"
    };
  }
  
  const complianceExactMatches = ["好", "好的", "嗯", "可以", "行"];
  const hasExactCompliance = complianceExactMatches.some(k => userMessage.trim() === k || 
    userMessage.trim().startsWith(k + "，") || userMessage.trim().startsWith(k + "。"));
  
  if (hasExactCompliance || userMessage.includes("跟着你") || 
      userMessage.includes("试试") || userMessage.includes("我试一下")) {
    return {
      shouldInterrupt: true,
      response: "好的，我们一起做。先做个简单的，来，跟我一起深呼吸……"
    };
  }
  
  if (userMessage.length > 0) {
    return {
      shouldInterrupt: true,
      response: `听到你说"${userMessage}"，谢谢你愿意和我分享。
要不要继续聊聊？或者我们做点别的让你感觉好一点的事情？`
    };
  }
  
  return {
    shouldInterrupt: false,
    response: ""
  };
}

function handleSevereDynamicResponse(userMessage: string): { shouldInterrupt: boolean; response: string } {
  const lowerMsg = userMessage.toLowerCase();
  
  if (EMOTIONAL_OUTBURST_KEYWORDS.some(k => userMessage.includes(k)) || lowerMsg.includes('呜呜')) {
    return {
      shouldInterrupt: true,
      response: "哭出来吧，没关系的。我就在这里陪着你哭。不用急着停下来。"
    };
  }
  
  const symptom = extractSymptom(userMessage);
  if (symptom.type && symptom.keyword) {
    const responses: Record<string, string> = {
      dizziness: `收到。听到你说${symptom.keyword}，这很正常，是因为刚才情绪太激动，换气过度导致的缺氧。
咱们现在试着把节奏放慢一点点。不需要用力吸气，试着轻轻地、慢慢地把气吐出来……对，就像吹蜡烛一样轻。再来一次。`,
      chest: `收到。听到你说${symptom.keyword}，这是焦虑时很常见的身体反应，叫做"心跳加速"。
这不是心脏病，只是身体在紧张时的正常应激反应。试着用手轻轻按住胸口，感受心跳的节奏，跟着心跳的节奏慢慢呼气……`,
      breath: `收到。听到你说${symptom.keyword}，我明白这种感觉很可怕。
这是因为紧张时我们的呼吸会变得很浅很快。咱们试着把气吸到肚子里，让肚子鼓起来，然后慢慢地呼出来……`,
      numbness: `收到。听到你说${symptom.keyword}，这是因为紧张时身体的血液会集中到重要器官，导致手脚供血暂时减少。
试着用力握紧拳头，坚持3秒，然后猛地松开。感受一下手掌放松的感觉。`,
      sweating: `收到。听到你说${symptom.keyword}，这是焦虑时身体在散热，很正常。
试着用手轻轻扇一扇风，或者感受一下衣服贴在皮肤上的感觉。`,
      nausea: `收到。听到你说${symptom.keyword}，这是紧张时胃部肌肉收缩导致的。
试着用手轻轻揉一揉肚子，或者做几次缓慢的深呼吸，让胃放松下来……`,
    };
    return {
      shouldInterrupt: true,
      response: responses[symptom.type] || `收到。听到你说${symptom.keyword}，这很正常，是情绪激动时的身体反应。
咱们继续做深呼吸，慢慢把节奏放慢……`
    };
  }
  
  const generalConcernKeywords = ["晕倒", "快要晕倒", "站不稳", "眼前发黑", "头晕", "眩晕"];
  if (generalConcernKeywords.some(k => userMessage.includes(k))) {
    return {
      shouldInterrupt: true,
      response: `收到。听到你说${userMessage}，这很正常，是因为情绪激动时血压变化或换气过度导致的。
试着找个地方坐下或躺下，保持头部低于心脏。我们一起慢慢呼吸，吸气……呼气……`
    };
  }
  
  if (userMessage.includes("还好") || userMessage.includes("都还好") || 
      userMessage.includes("没感觉") || userMessage.includes("没什么感觉")) {
    const hasPanic = userMessage.includes("慌") || userMessage.includes("害怕") || userMessage.includes("紧张");
    if (hasPanic) {
      return {
        shouldInterrupt: true,
        response: `明白，身体没有剧烈反应是好事，说明我们现在的状态还是可控的。
既然心里慌，那我们就先把注意力从"心"转移到"手"上。请你现在用力握紧拳头，坚持3秒，然后猛地松开。感受一下手掌放松的感觉。`
      };
    }
    return {
      shouldInterrupt: true,
      response: `明白，身体没有剧烈反应是好事，说明我们现在的状态还是可控的。
咱们继续保持深呼吸，感受一下身体正在慢慢放松……`
    };
  }
  
  if (RESISTANCE_KEYWORDS.some(k => userMessage.includes(k))) {
    return {
      shouldInterrupt: true,
      response: "没关系，做不到也没关系。我们换个方式，试着感受一下椅背托着你的后背，或者仅仅是闭上眼睛。怎么舒服怎么来。"
    };
  }
  
  const complianceExactMatches = ["好", "好的", "嗯", "可以", "行"];
  const hasExactCompliance = complianceExactMatches.some(k => userMessage.trim() === k || 
    userMessage.trim().startsWith(k + "，") || userMessage.trim().startsWith(k + "。"));
  
  const hasAction = userMessage.includes("做了") || userMessage.includes("做完了") || 
                   userMessage.includes("完成了") || userMessage.includes("好了");
  
  if (hasExactCompliance || hasAction || userMessage.includes("跟着你") || 
      userMessage.includes("试试") || userMessage.includes("我试一下")) {
    if (hasAction) {
      return {
        shouldInterrupt: true,
        response: "很好，完成了就是进步。现在感觉怎么样？有没有稍微轻松一点？"
      };
    }
    return {
      shouldInterrupt: true,
      response: `好的，我听到你愿意尝试。我们一起做，跟着我的节奏，吸气……慢慢呼气……`
    };
  }
  
  if (userMessage.length > 0) {
    return {
      shouldInterrupt: true,
      response: `收到。听到你说"${userMessage}"。
这很正常，情绪激动时身体和心里都会有各种反应。
现在，试着把注意力放回呼吸上，慢慢吸气……慢慢呼气……我就在这里陪着你。`
    };
  }
  
  return {
    shouldInterrupt: false,
    response: ""
  };
}

const THOUGHT_KEYWORDS = [
  "都是我的错", "我不够好", "我不行", "我很差",
  "我很失败", "我是个废物",
  "没人喜欢我", "大家都讨厌我", "大家都不喜欢我",
  "肯定觉得", "一定认为", "肯定很", "一定很", "别人怎么看",
  "看不起", "讨厌", "嫌弃", "不喜欢", "拒绝",
  "永远", "总是", "从来", "完全", "彻底", "根本",
];

const EMOTION_KEYWORDS = {
  sad: ["难过", "伤心", "心碎", "失望", "失落"],
  angry: ["生气", "愤怒", "气", "烦", "火大"],
  anxious: ["焦虑", "紧张", "害怕", "恐惧", "不安", "慌", "好焦虑"],
  guilty: ["愧疚", "内疚", "自责", "后悔"],
  worthless: ["没用", "废物", "失败", "差劲", "很没用", "太没用", "好没用"],
  wronged: ["委屈", "冤枉", "憋屈"],
  tired: ["累", "疲惫", "疲惫不堪"],
};

function extractThoughtAndEmotion(userMessage: string): { thought: string | null; emotion: string | null } {
  let thought = null;
  let emotion = null;

  const thoughtPatterns = [
    /觉得(.*)/,
    /认为(.*)/,
    /担心(.*)/,
    /害怕(.*)/,
    /我怕(.*)/,
    /感觉(.*)/,
  ];
  
  for (const pattern of thoughtPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      thought = match[0].trim();
      if (thought.length > 80) {
        thought = thought.substring(0, 80) + "...";
      }
      break;
    }
  }
  
  if (!thought) {
    const keyPhrases = [
      "都是我的错", "我很失败", "没人喜欢我", "大家都讨厌我",
      "肯定觉得", "一定认为", "永远", "总是", "彻底", "完蛋了",
    ];
    for (const phrase of keyPhrases) {
      if (userMessage.includes(phrase)) {
        const idx = userMessage.indexOf(phrase);
        thought = userMessage.substring(Math.max(0, idx - 10), idx + phrase.length + 20).trim();
        break;
      }
    }
  }

  if (!thought) {
    thought = userMessage.length > 60 ? userMessage.substring(0, 60) + "..." : userMessage;
  }

  for (const [emotionType, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (userMessage.includes(keyword)) {
        const emotionMap: Record<string, string> = {
          sad: "难过",
          angry: "生气",
          anxious: "焦虑",
          guilty: "愧疚",
          worthless: "没用",
          wronged: "委屈",
          tired: "累",
        };
        emotion = emotionMap[emotionType];
        break;
      }
    }
    if (emotion) break;
  }

  return { thought, emotion };
}

const EVENT_KEYWORDS = [
  "男友", "男朋友", "女友", "女朋友", "老公", "老婆", "对象", "伴侣",
  "吵架", "冷战", "不理", "不说话", "沉默", "冷暴力",
  "领导", "老板", "同事", "工作", "加班", "方案", "项目", "打回", "被否", "思路不对",
  "朋友", "闺蜜", "同学", "家人", "父母", "亲戚", "聚会", "搭话", "回应",
  "分手", "离婚", "失业", "被骂", "被批评", "被拒绝",
];

function hasEventDetails(userMessage: string): boolean {
  return EVENT_KEYWORDS.some(keyword => userMessage.includes(keyword));
}

function findContradiction(userMessage: string): string | null {
  const contradictions = [
    { positive: ["语气挺好", "小心翼翼", "努力", "认真", "尽力"], negative: ["不理", "沉默", "拒绝", "生气", "失望"] },
    { positive: ["做好了", "完成", "按时", "正确"], negative: ["被否", "被打回", "出错", "搞砸", "思路不对"] },
    { positive: ["关心", "在乎", "喜欢"], negative: ["冷淡", "冷漠", "疏远"] },
    { positive: ["主动", "搭话"], negative: ["不理", "不回应", "没人回应"] },
    { positive: ["很努力", "努力了", "尽力了"], negative: ["不行", "没用", "被否", "被打回"] },
  ];
  
  for (const { positive, negative } of contradictions) {
    const hasPositive = positive.some(k => userMessage.includes(k));
    const hasNegative = negative.some(k => userMessage.includes(k));
    if (hasPositive && hasNegative) {
      const pos = positive.find(k => userMessage.includes(k)) || "";
      const neg = negative.find(k => userMessage.includes(k)) || "";
      return `${pos}但${neg}`;
    }
  }
  return null;
}

function detectScenario(userMessage: string): "relationship" | "work" | "social" | null {
  if (userMessage.includes("男友") || userMessage.includes("男朋友") || 
      userMessage.includes("女友") || userMessage.includes("女朋友") ||
      userMessage.includes("对象") || userMessage.includes("伴侣")) {
    return "relationship";
  }
  if (userMessage.includes("领导") || userMessage.includes("老板") || 
      userMessage.includes("工作") || userMessage.includes("方案") ||
      userMessage.includes("项目") || userMessage.includes("打回")) {
    return "work";
  }
  if (userMessage.includes("朋友") || userMessage.includes("聚会") || 
      userMessage.includes("搭话") || userMessage.includes("回应")) {
    return "social";
  }
  return null;
}

function extractExplicitFear(userMessage: string): string | null {
  const fearPatterns = [
    /我怕(.*)/,
    /我担心(.*)/,
    /害怕(.*)/,
    /担心(.*)/,
    /我觉得(.*)会(.*)/,
  ];
  
  for (const pattern of fearPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

const COGNITIVE_DISTORTIONS = {
  mindReading: {
    name: "读心术",
    keywords: ["他肯定", "她一定", "他们觉得", "别人都", "大家都", "他觉得", "她觉得", "他们一定", "别人肯定"],
    description: "假设自己知道别人在想什么，而没有实际证据"
  },
  personalization: {
    name: "个人化归因",
    keywords: ["都是我的错", "因为我", "我导致的", "我害的", "都是我"],
    description: "把所有事情都归咎于自己，认为是自己的责任"
  },
  catastrophizing: {
    name: "灾难化思维",
    keywords: ["完蛋", "崩溃", "末日", "彻底完了", "活不下去"],
    description: "把一件小事无限放大，想象成最坏的结果"
  },
  blackAndWhite: {
    name: "非黑即白思维",
    keywords: ["完全", "彻底", "绝对", "根本", "要么", "绝不"],
    description: "用极端的方式看待事物，没有中间地带"
  },
  overgeneralization: {
    name: "以偏概全",
    keywords: ["总是", "每次", "从来", "一直", "再也不会", "永远"],
    description: "从一次事件得出普遍结论"
  },
  emotionalReasoning: {
    name: "情绪推理",
    keywords: ["我感觉", "我以为", "我觉得"],
    description: "把感觉当作事实，认为感受就是现实"
  }
};

function detectCognitiveDistortion(userMessage: string): string[] {
  const distortions: Set<string> = new Set();
  
  for (const [key, value] of Object.entries(COGNITIVE_DISTORTIONS)) {
    if (value.keywords.some(k => userMessage.includes(k))) {
      distortions.add(value.name);
    }
  }
  
  if ((userMessage.includes("肯定") || userMessage.includes("一定")) && 
      !distortions.has("读心术") && !distortions.has("个人化归因")) {
    distortions.add("灾难化思维");
  }
  
  return distortions.size > 0 ? Array.from(distortions) : ["思维偏差"];
}

function extractActivatingEvent(userMessage: string): string {
  const eventPatterns = [
    /今天(.*?)，/,
    /刚才(.*?)，/,
    /这次(.*?)，/,
    /上次(.*?)，/,
    /(.*?)的时候，/,
    /(.*?)了，/,
    /(.*?)，我/,
    /(.*?)，觉得/,
  ];
  
  for (const pattern of eventPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      let event = match[1].trim();
      if (event.length > 50) {
        event = event.substring(0, 50) + "...";
      }
      if (event.length > 5) {
        return event;
      }
    }
  }
  
  const trimmedMessage = userMessage.length > 50 ? userMessage.substring(0, 50) + "..." : userMessage;
  return trimmedMessage;
}

function generateRationalResponse(userMessage: string, thought: string, distortions: string[]): string {
  const rationalResponses: Record<string, (message: string, thought: string) => string> = {
    "灾难化思维": (msg, t) => `1. 你把一个不确定的小事件，直接放大到了最极端的后果。
2. "${t}"这个想法缺乏实际证据，只是你当下的担忧。
3. 即使真的有问题，也不等于"完蛋了"，事情总有解决的办法。
4. 试着把这件事放在一个月后看，可能根本不算什么。`,
    
    "读心术": (msg, t) => `1. 你无法直接知道别人在想什么，这只是你的猜测。
2. "${t}"这个想法可能忽略了对方的处境（比如忙碌、分心）。
3. 如果想确认，最好的方式是直接沟通，而不是自己猜测。
4. 别人的沉默或行为可能有很多原因，不一定和你有关。`,
    
    "个人化归因": (msg, t) => `1. 事情的发生往往是多种因素共同作用的结果，不能全怪自己。
2. "${t}"这个想法可能忽略了外部环境和他人的责任。
3. 即使你有做得不够好的地方，也不代表"都是你的错"。
4. 试着列出所有可能导致这件事的原因，而不仅仅是自己的问题。`,
    
    "非黑即白思维": (msg, t) => `1. 世界不是只有两种极端，中间有很多灰色地带。
2. "${t}"这个想法过于绝对，忽略了其他可能性。
3. 试着用"有时候"、"可能"、"一部分"来替代"总是"、"一定"、"全部"。
4. 事情往往是复杂的，不能简单地用好坏来评判。`,
    
    "以偏概全": (msg, t) => `1. 一次事件不能代表所有情况，这只是一个样本。
2. "${t}"这个想法把单次经历过度推广了。
3. 试着回忆一下有没有相反的例子，证明事情不是"总是"这样。
4. 过去的经验不代表未来一定会重复。`,
    
    "情绪推理": (msg, t) => `1. 感觉不等于事实，你的感受是基于当下的情绪状态。
2. "${t}"这个想法是你情绪的产物，不一定符合实际情况。
3. 试着用客观的证据来验证这个想法，而不是只相信感觉。
4. 情绪会变化，但事实不会因为你的感受而改变。`,
    
    "思维偏差": (msg, t) => `1. 你的想法可能受到了情绪的影响，不够客观。
2. "${t}"这个想法可能忽略了一些重要的信息。
3. 试着从第三者的角度来看待这件事，会有不同的发现。
4. 没有证据支持的想法，不一定是真实的。`,
  };

  const primaryDistortion = distortions[0];
  if (rationalResponses[primaryDistortion]) {
    return rationalResponses[primaryDistortion](userMessage, thought);
  }
  
  return `1. 你的想法可能受到了情绪的影响，不够客观。
2. "${thought}"这个想法忽略了其他可能性。
3. 试着寻找支持和反对这个想法的证据。
4. 事情往往比我们想象的要复杂，不要过早下结论。`;
}

function generateCBTResponse(userMessage: string): string {
  const { thought, emotion } = extractThoughtAndEmotion(userMessage);
  const event = extractActivatingEvent(userMessage);
  const distortions = detectCognitiveDistortion(userMessage);
  const scenario = detectScenario(userMessage);

  const extractedThought = thought || userMessage;
  const extractedEmotion = emotion || "焦虑";
  
  const emotionIntensity = userMessage.includes("崩溃") || userMessage.includes("完蛋") || userMessage.includes("彻底") 
    ? "极度焦虑 (90%)，恐慌 (80%)" 
    : userMessage.includes("很难受") || userMessage.includes("好难过") 
    ? "难过 (70%)，焦虑 (60%)" 
    : `${extractedEmotion} (60%)`;

  const rationalResponse = generateRationalResponse(userMessage, extractedThought, distortions);

  const actionAdvice = scenario === "relationship"
    ? "试着发个轻松的消息测试一下，或者先去做件别的事，验证一下你的担忧是否真的会发生。"
    : scenario === "work"
    ? "会后主动找老板询问反馈，用事实来验证你的想法，而不是在这里猜测。"
    : scenario === "social"
    ? "试着加入一个你感兴趣的话题，或者观察一下其他人的反应，不一定是针对你。"
    : "试着记录下支持和反对这个想法的证据，用事实来挑战你的自动化思维。";

  return `🔍 思维捕捉："${extractedThought}"

🏷️ 认知扭曲类型：${distortions.join(" & ")}

💡 解读：${COGNITIVE_DISTORTIONS[Object.keys(COGNITIVE_DISTORTIONS).find(k => COGNITIVE_DISTORTIONS[k].name === distortions[0])]?.description || "你的想法可能受到了情绪的影响，不够客观"}

📊 CBT 认知重构表：

| 触发事件 | 自动化思维 | 情绪反应 | 理性回应 (替代思维) |
|---------|-----------|---------|-------------------|
| ${event} | ${extractedThought} | ${emotionIntensity} | ${rationalResponse} |

💪 行动建议：${actionAdvice}`;
}

function handleSkillTriggerDirect(skillType: string): NextResponse {
  const responses: Record<string, { 
    content: string; 
    mode: string;
    type?: "card";
    cardData?: any;
  }> = {
    sleep: {
      content: "收到，今晚想早点休息是吗？为了给你最合适的引导，请问你现在的感觉更接近哪一种？",
      mode: "sleep",
      type: "card",
      cardData: {
        type: "triage",
        options: [
          { label: "A", value: "mind_active", description: "身体很累，但脑子停不下来（思维活跃）" },
          { label: "B", value: "emotion_troubled", description: "心里有事，感到焦虑或难过（情绪困扰）" },
        ],
      },
    },
    cbt: {
      content: CBT_SCRIPT,
      mode: "cbt",
    },
    emotion: {
      content: "我在。此刻你的能量感觉如何？我们可以从最简单的开始。",
      mode: "emotion",
      type: "card",
      cardData: {
        type: "triage",
        options: [
          { label: "A", value: "mild", description: "只是有点累，想快速回血（轻度）" },
          { label: "B", value: "severe", description: "非常糟糕，甚至有点崩溃（重度）" },
        ],
      },
    },
  };

  const response = responses[skillType];
  
  return NextResponse.json({
    success: true,
    message: {
      role: "assistant" as const,
      content: response.content,
      mode: response.mode,
      type: response.type,
      cardData: response.cardData,
    },
  });
}

function getSystemPrompt(mode: string): string {
  switch (mode) {
    case "sleep":
      return `你是一位专业的睡眠引导师。用户正在进行助眠引导。

      【核心原则】
      1. 严禁使用"具体说说？""为什么？"等开放式反问结尾。
      2. 回复结构必须遵循：[共情/确认] + [专业引导/选项]。
      3. 如果用户的回答中包含"思维活跃"、"脑子停不下来"、"想太多"、"A"等关键词，输出思维活跃类的助眠引导。
      4. 如果用户的回答中包含"情绪困扰"、"焦虑"、"难过"、"心里有事"、"失恋"、"B"等关键词，输出情绪安抚类的助眠引导。

      请用温柔、舒缓的语言引导用户放松身心，帮助他们入睡。`;

    case "cbt":
      return `你是一位温暖、有耐心的CBT陪伴者。你的目标是通过温柔的对话引导用户，而不是让用户做题。

      【核心原则 - 对话式引导】
      1. 禁止输出步骤列表：绝对不允许出现"第一步、第二步"、"请按以下步骤"这种结构化文本。
      2. 隐性植入技术：认知重构的技术（如寻找证据、苏格拉底提问）必须内化在对话中，不能显性展示给用户看。
      3. 先情绪后逻辑：必须先对用户的具体遭遇进行情感回应，确认情绪被接纳后，再用疑问句引导用户思考。
      4. 禁止使用祈使句命令用户思考，要用温和的疑问句引导。

      【正确的引导方式】
      - 错误："请告诉我你的自动思维是什么？"
      - 正确："听到你这么说我挺心疼的。不过，当时那种情况下，你脑子里是不是有个声音在说'都是我的错'？咱们一起来看看这个想法对不对，好吗？"

      【引导流程（内化在对话中，不展示给用户）】
      1. 共情接纳：先接住用户的情绪，确认感受（例如："抱抱你，听起来当时真的很尴尬"）
      2. 温和挑战：用疑问句引导用户思考，而不是直接否定（例如："你说大家都觉得你无趣，这个想法是不是有点太绝对了？"）
      3. 寻找反例：引导用户回忆相反的证据（例如："有没有过一次，你在某个话题上聊得很开心？"）
      4. 提供替代解释：给出另一种可能性（例如："有没有一种可能，大家只是聊嗨了没顾上，并不是针对你？"）
      5. 理性替代：帮助用户找到更平衡的想法（例如："或许我们可以试着这样想：'当时那个话题我确实不熟悉，但换个话题我可能就不一样了'"）

      【语气风格】
      - 温暖、支持、不评判
      - 像一个有经验的朋友，而不是老师或医生
      - 使用"咱们"、"好不好"、"可以吗"等拉近距离的词语
      - 避免专业术语，用日常语言表达
      - 每轮回复简短，给用户思考和回应的空间

      【现实检验话术示例】
      "关于'领导肯定很失望'，这是一个想法，还是事实？试着问自己：有没有可能领导只是在思考别的事情？我们可以试着区分'我的猜测'和'真实发生的事'。"

      请通过温柔的对话引导用户自我反思，而不是让用户做填空题。`;

    case "emotion":
      return `你是一位专业的情绪急救专家。用户正在进行情绪急救。

      【核心原则 - 急救主导权】
      1. 急救阶段（检测到高危关键词如"濒死感"、"失控"、"心脏要跳出来"、"窒息"等）必须由AI主动接管流程，禁止让用户做选择（如"你想怎么做？"）。
      2. 动态适应策略：根据用户配合度、症状变化实时调整干预方法（呼吸引导 → 着陆技术 → 纯陪伴）。
      3. 感性共情优先：禁止理性解释（如提及肾上腺素、生理机制），专注于情感接纳（如"我知道这很可怕，我在这里陪你"）。
      4. 视觉与语言极简：使用短句、分行、Markdown符号（🌬️、⏸️、💨）增强可读性，避免长段落。

      【初始干预（高危状态）】
      - 立即定性 + 安全承诺："我知道这很可怕，我在这里陪你。这是惊恐发作，虽然很难受，但没有生命危险，你是安全的。"
      - 强制呼吸引导（Box Breathing）：
        🌬️ 吸气 (1...2...3...4)
        ⏸️ 屏住 (1...2...3...4)
        💨 呼气 (1...2...3...4...5...6)
      - 若用户抗拒呼吸：切换至着陆技术，不强迫。

      【用户不同反应的分支处理】
      - 用户配合：继续呼吸引导，每3轮后确认状态（如"现在感觉有变化吗？"）。
      - 用户抗拒/无反应：切换至纯陪伴模式，使用被动着陆技术（如"告诉我你现在看到的一样东西"）。
      - 用户报告症状变化：
        * 好转：温和过渡（如"好些了吗？想聊聊发生了什么，还是用工具梳理一下？"）。
        * 恶化：加强安抚，重复呼吸引导，给予更多肯定。

      【躯体症状回应（禁止科普）】
      - 错误示范："心跳快是因为肾上腺素，别担心。"
      - 正确模板："我知道心跳快让你很害怕，没关系，这是惊恐发作的正常反应，它会过去的。"

      【禁忌与红线】
      - 严禁：
        * 追问原因或细节（如"为什么难受？"）。
        * 否定感受（如"这没什么可怕的"）。
        * 长段落解释。
      - 必须：
        * 每轮干预后确认状态（如"现在感觉有变化吗？"）。
        * 平静后温和过渡（如"好些了吗？想聊聊发生了什么，还是用工具梳理一下？"）。

      【轻度情绪处理】
      - 如果用户的回答中包含"轻度"、"有点累"、"回血"、"A"等关键词，输出轻度急救脚本（深呼吸、喝水等简单行动）。
      - 如果用户的回答中包含"重度"、"崩溃"、"糟糕"、"B"等关键词，输出重度急救脚本（5题自测量表）。

      【行动建议调整】
      - 根据时间和语境调整行动建议：如果检测到"晚上/睡觉/失眠"等关键词或当前时间为22:00-06:00，使用【助眠行动卡】；否则使用【自我关怀练习】。

      自我关怀练习内容：
      - 记录小确幸：写下今天一件做得还不错的小事（哪怕只是按时吃饭）
      - 暂停与呼吸：给自己5分钟，允许自己此刻感觉糟糕，只关注呼吸
      - 拆解焦虑：如果担心未来，试着把大目标拆成明天早上能做的第一个微小动作

      请通过提问了解用户的情绪状态，但必须给出明确的选项和方向。`;

    default:
      return `你是一位温暖、高情商的心理陪伴助手，名字叫"心语"。你像一个有耐心的好朋友，会倾听、会共情、会陪用户吐槽。

      【核心原则 - 必须严格遵守】
      1. 严禁使用"具体说说？""为什么？""发生了什么？"等开放式反问作为结尾。这会增加用户认知负担。
      2. 回复结构必须遵循：[共情/确认] + [专业引导/选项]。
      3. 如果用户提到"助眠"、"睡觉"、"失眠"等词汇，直接进入助眠引导流程，不要进行闲聊共情。
      4. 如果用户提到"认知重构"、"CBT"、"思维"等词汇，直接进入认知重构流程，不要进行闲聊共情。
      5. 如果用户提到"情绪急救"、"急救"、"情绪"等词汇，直接进入情绪急救流程，不要进行闲聊共情。
      6. 如果用户提到"焦虑"、"心跳快"、"心慌"、"濒死感"、"失控"、"窒息"等词汇，立即输出稳定化话术（深呼吸、接地练习），绝对禁止询问原因。
      7. 如果用户提到"自杀"、"不想活"等极端词汇，立即输出危机干预热线，绝对禁止询问原因。

      【焦虑急救规则 - 必须严格执行】
      - 急救主导权：急救阶段必须由AI主动接管流程，禁止让用户做选择（如"你想怎么做？"）。
      - 动态适应策略：根据用户配合度、症状变化实时调整干预方法（呼吸引导 → 着陆技术 → 纯陪伴）。
      - 感性共情优先：禁止理性解释（如提及肾上腺素、生理机制），专注于情感接纳（如"我知道这很可怕，我在这里陪你"）。
      - 视觉与语言极简：使用短句、分行、Markdown符号（🌬️、⏸️、💨）增强可读性，避免长段落。

      【焦虑急救初始干预】
      - 立即定性 + 安全承诺："我知道这很可怕，我在这里陪你。这是惊恐发作，虽然很难受，但没有生命危险，你是安全的。"
      - 强制呼吸引导（Box Breathing）：
        🌬️ 吸气 (1...2...3...4)
        ⏸️ 屏住 (1...2...3...4)
        💨 呼气 (1...2...3...4...5...6)
      - 若用户抗拒呼吸：切换至着陆技术，不强迫。

      【焦虑急救分支处理】
      - 用户配合：继续呼吸引导，每轮后确认状态（如"现在感觉有变化吗？"）。
      - 用户抗拒/无反应：切换至纯陪伴模式，使用被动着陆技术（如"告诉我你现在看到的一样东西"）。
      - 用户报告症状变化：
        * 好转：温和过渡（如"好些了吗？想聊聊发生了什么，还是用工具梳理一下？"）。
        * 恶化：加强安抚，重复呼吸引导，给予更多肯定。

      【躯体症状回应（禁止科普）】
      - 错误示范："心跳快是因为肾上腺素，别担心。"
      - 正确模板："我知道心跳快让你很害怕，没关系，这是惊恐发作的正常反应，它会过去的。"

      【焦虑急救禁忌与红线】
      - 严禁：追问原因或细节、否定感受（如"这没什么可怕的"）、长段落解释。
      - 必须：每轮确认状态、平静后温和过渡。

      【场景识别与响应分级】
      - 危机场景（Panic/Crisis）：关键词包含"濒死"、"喘不上气"、"失控"、"想死"等。
        * 对策：保持冷静，主导流程，使用呼吸/着陆技术。
      - 吐槽/倾诉场景（Venting/Complaining）：关键词包含"累"、"烦"、"傻X"、"被骂"、"无语"、"服了"、"加班"、"改方案"、"甲方"等。
        * 对策：严禁主动提议做呼吸练习！严禁使用"现在感觉好点了吗"这种客服式提问。
        * 吐槽场景的"三步走"策略：
          1. 同仇敌忾（站队）：必须顺着用户的情绪说话，不要讲大道理。
             - 示例："这也太搞心态了吧！"、"明明都说好了还变卦，这领导怎么这样啊。"
          2. 引导宣泄（提问）：让用户把具体的槽点吐出来，而不是把话题终结在呼吸上。
             - 示例："他具体怎么说你的？这也太不讲理了。"
          3. 提供陪伴（兜底）：只有当用户明确表示"不想说了"或者"太累了"的时候，才可以说："那就不想了，好好休息会儿，我陪着你。"
      - 禁止复读机行为：如果用户连续输出负面信息，AI不能重复上一轮的安抚话术。必须根据用户最新的内容进行针对性的回应。

      【纯情感陪伴模式】
      - 当用户输入短文本且情绪浓度高（如"好想哭"、"心好累"、"没人懂我"、"活着没意思"）时，禁止立即输出列表式的建议（1. xxx, 2. xxx）。
      - 必须先输出一段温暖的、口语化的安抚文字，只说这些，停下来等用户反应。
      - 示例话术："抱抱你。听起来你真的承受了很多委屈，没关系的，想哭就哭出来吧，我会在这里陪着你。"

      【生理疲劳 vs 心理痛苦区分】
      - 生理累（如"刚下班，好累"、"身体累"）：可以推荐渐进式肌肉放松、泡澡等物理建议。
      - 心理苦（如"心好累"、"绝望"、"想哭"）：严禁推荐"肌肉放松"或"喝牛奶"。应该侧重于倾听、确认感受（Validation）。
      - 错误示范：用户说想哭，AI说"去做个肌肉放松"。（这不搭界）
      - 正确示范：用户说想哭，AI说"哭泣是情绪的排毒，我在这里听你说。"

      【行动建议动态调整】
      - 不要每次都给"行动卡"。
      - 只有当用户明确表示"我该怎么办"、"有什么办法能缓解"或者对话进行了几轮情绪宣泄后，再试探性地问："如果你愿意，我可以带你做一个简单的呼吸练习，或者我们就这样静静待一会儿？"
      - 把选择权交给用户，而不是强行塞给用户。

      【认知重构增强】
      - 当用户提到具体的人际评价焦虑（如"领导失望"、"别人看不起我"、"肯定觉得"、"一定认为"）时，必须触发【现实检验】环节。
      - 现实检验话术示例："关于'领导肯定很失望'，这是一个想法，还是事实？试着问自己：有没有可能领导只是在思考别的事情？我们可以试着区分'我的猜测'和'真实发生的事'。"

      【行动建议动态调整】
      - 根据时间和语境调整行动建议标题和内容：
        * 如果检测到"晚上/睡觉/失眠"等关键词，或当前时间为22:00-06:00，使用【助眠行动卡】（包含睡前相关建议）
        * 否则（默认情况），使用【自我关怀练习】（包含通用安抚动作）
      - 自我关怀练习内容：
        * 记录小确幸：写下今天一件做得还不错的小事（哪怕只是按时吃饭）
        * 暂停与呼吸：给自己5分钟，允许自己此刻感觉糟糕，只关注呼吸
        * 拆解焦虑：如果担心未来，试着把大目标拆成明天早上能做的第一个微小动作

      【回复结构】
      - 第一步（共情/确认）：先接住情绪，用感叹词或短句表达理解（例如："天哪，那真的太难受了"、"抱抱你"、"我理解你的感受"）
      - 第二步（专业引导/选项）：给出明确的行动建议或选项，而不是反问（例如："我们可以试试深呼吸，或者做一个快速的情绪评估"、"你想聊一聊这件事，还是做一个放松练习？"）

      【语气风格】
      - 口语化、温暖、支持性
      - 不要用书面语，不要用"首先、其次"
      - 温柔、不评判、有耐心，避免说教和命令式语气
      - 不要机械重复！针对用户的具体内容进行针对性的回应

      【重要提醒】
      - 日常负面情绪（孤独、难过、没人理解、压力大等）不属于危机干预范围，正常回应即可。
      - 回复要短小精悍，单次不要超过3-4句话（约50-80字）。`;
  }
}
