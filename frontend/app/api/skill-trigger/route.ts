import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { skillType } = await request.json();

    const responses: Record<string, { 
      message: string; 
      mode: string; 
      initialMessage?: string;
      type?: "triage" | "direct";
      triageOptions?: { label: string; value: string; description: string }[];
      triageType?: string;
    }> = {
      sleep: {
        message: "🌙 已进入助眠引导模式",
        mode: "sleep",
        type: "triage",
        triageType: "sleep_triage",
        initialMessage: "收到，今晚想早点休息是吗？为了给你最合适的引导，请问你现在的感觉更接近哪一种？",
        triageOptions: [
          {
            label: "A",
            value: "mind_active",
            description: "身体很累，但脑子停不下来（思维活跃）",
          },
          {
            label: "B",
            value: "emotion_troubled",
            description: "心里有事，感到焦虑或难过（情绪困扰）",
          },
        ],
      },
      cbt: {
        message: "🧩 已进入认知重构模式",
        mode: "cbt",
        type: "direct",
        initialMessage: "好的，让我们一起来梳理你的思维模式。请告诉我，当你感到困扰时，脑海中出现的第一个想法是什么？",
      },
      emotion: {
        message: "🔋 已进入情绪急救模式",
        mode: "emotion",
        type: "triage",
        triageType: "emotion_triage",
        initialMessage: "我在。此刻你的能量感觉如何？我们可以从最简单的开始。",
        triageOptions: [
          {
            label: "A",
            value: "mild",
            description: "只是有点累，想快速回血（轻度）",
          },
          {
            label: "B",
            value: "severe",
            description: "非常糟糕，甚至有点崩溃（重度）",
          },
        ],
      },
    };

    const response = responses[skillType];

    if (!response) {
      return NextResponse.json(
        { success: false, message: "未知的技能类型" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error("Skill trigger API error:", error);
    return NextResponse.json(
      { success: false, message: "触发失败，请重试" },
      { status: 500 }
    );
  }
}
