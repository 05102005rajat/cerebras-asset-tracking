import { cookies } from "next/headers";

const COOKIE_NAME = "asset-challenge-role";

export type Role = "tech" | "manager";

const ROLE_USERS: Record<Role, string> = {
  tech: "tech-jane",
  manager: "manager-paul",
};

export async function getServerRole(): Promise<Role> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value === "manager" ? "manager" : "tech";
}

export async function getServerUserId(): Promise<string> {
  return ROLE_USERS[await getServerRole()];
}
