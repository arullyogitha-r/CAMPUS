import { db } from "./db";

export async function notify(
  userIds: string[],
  title: string,
  body: string,
  category = "general",
) {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return;
  await db
    .from("notifications")
    .insert(unique.map((user_id) => ({ user_id, title, body, category })));
}

export async function userIdsByRole(role: string): Promise<string[]> {
  const { data } = await db.from("users").select("id").eq("role", role);
  return (data ?? []).map((row: { id: string }) => row.id);
}
