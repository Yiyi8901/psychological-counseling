interface SkillButtonsProps {
  onSkillTrigger: (skillType: "sleep" | "cbt" | "emotion") => void;
}

export default function SkillButtons({ onSkillTrigger }: SkillButtonsProps) {
  const skills = [
    {
      type: "sleep" as const,
      emoji: "🌙",
      label: "助眠引导",
      description: "帮助你放松入睡",
      bgColor: "bg-morandi-blue",
      hoverColor: "hover:bg-blue-300",
    },
    {
      type: "cbt" as const,
      emoji: "🧩",
      label: "认知重构",
      description: "梳理负面思维",
      bgColor: "bg-morandi-green",
      hoverColor: "hover:bg-green-300",
    },
    {
      type: "emotion" as const,
      emoji: "🔋",
      label: "情绪急救",
      description: "快速情绪测试",
      bgColor: "bg-morandi-pink",
      hoverColor: "hover:bg-pink-300",
    },
  ];

  return (
    <div className="px-4 py-3 border-t border-morandi-gray bg-morandi-cream/50">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {skills.map((skill) => (
          <button
            key={skill.type}
            onClick={() => onSkillTrigger(skill.type)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full ${skill.bgColor} ${skill.hoverColor} transition-colors`}
          >
            <span className="text-lg">{skill.emoji}</span>
            <div className="text-left">
              <p className="text-sm font-medium text-morandi-text">{skill.label}</p>
              <p className="text-xs text-morandi-dark/70">{skill.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
