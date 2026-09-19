import { createServerFn } from "@tanstack/react-start";

export type ResourceInput = {
  id: string;
  title: string;
  skill: string;
  difficulty: string;
  hours: number;
  type: string;
};

export type Recommendation = {
  id: string;
  reason: string;
};

type Payload = {
  careerGoal: string;
  weakSkills: { skill: string; level: number }[];
  resources: ResourceInput[];
};

/** Deterministic fallback: weakest skill first, easiest resource first. */
function deterministic(data: Payload): { source: "rules"; items: Recommendation[] } {
  const order = new Map(data.weakSkills.map((entry, index) => [entry.skill, index]));
  const difficultyRank: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };

  const items = data.resources
    .filter((resource) => order.has(resource.skill))
    .sort((a, b) => {
      const skillDiff = (order.get(a.skill) ?? 99) - (order.get(b.skill) ?? 99);
      if (skillDiff !== 0) return skillDiff;
      return (difficultyRank[a.difficulty] ?? 1) - (difficultyRank[b.difficulty] ?? 1);
    })
    .slice(0, 8)
    .map((resource) => {
      const level = data.weakSkills.find((entry) => entry.skill === resource.skill)?.level ?? 0;
      return {
        id: resource.id,
        reason: `${resource.skill} is at ${level}% against what a ${data.careerGoal} needs — this ${resource.difficulty.toLowerCase()} ${resource.type.toLowerCase()} closes that gap in about ${resource.hours} hours.`,
      };
    });

  return { source: "rules", items };
}

export const recommendResources = createServerFn({ method: "POST" })
  .inputValidator((data: Payload) => data)
  .handler(async ({ data }): Promise<{ source: "ai" | "rules"; items: Recommendation[] }> => {
    const fallback = deterministic(data);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey || data.resources.length === 0 || data.weakSkills.length === 0) return fallback;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          messages: [
            {
              role: "system",
              content:
                "You advise engineering students on closing skill gaps. Pick the most useful resources from the supplied catalogue only. Reply with JSON: {\"items\":[{\"id\":\"<resource id>\",\"reason\":\"one sentence, max 30 words\"}]}. Return at most 6 items, weakest skill first.",
            },
            {
              role: "user",
              content: JSON.stringify({
                careerGoal: data.careerGoal,
                weakSkills: data.weakSkills,
                catalogue: data.resources,
              }),
            },
          ],
        }),
      });

      if (!response.ok) return fallback;
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return fallback;

      const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
      const parsed = JSON.parse(jsonText) as { items?: Recommendation[] };
      const valid = (parsed.items ?? []).filter((item) =>
        data.resources.some((resource) => resource.id === item.id),
      );
      if (valid.length === 0) return fallback;
      return { source: "ai", items: valid };
    } catch {
      return fallback;
    }
  });
