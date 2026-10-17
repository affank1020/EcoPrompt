import type { User } from "../types";

export const ANONYMOUS_USER: User = {
    id: "anonymous",
    name: "You",
    isAnonymous: true,
};

// TODO(auth): read the Supabase session and return the signed-in user,
// falling back to ANONYMOUS_USER (or redirecting) when there is no session.
export async function getCurrentUser(): Promise<User> {
    return ANONYMOUS_USER;
}
