export interface AdminRoleInfo {
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
  displayName?: string;
}

export const ADMIN_ROLES: Record<string, AdminRoleInfo> = {
  "asharkhanggc@gmail.com": {
    title: "Co-Founder",
    subtitle: "Director",
    color: "text-stone-700 dark:text-stone-300",
    bg: "bg-stone-100 dark:bg-stone-800/50",
    border: "border-stone-300 dark:border-stone-600",
    icon: "",
  },
  "aaliyan12345ilf@gmail.com": {
    title: "Co-Founder",
    subtitle: "Backend Developer",
    color: "text-stone-700 dark:text-stone-300",
    bg: "bg-stone-100 dark:bg-stone-800/50",
    border: "border-stone-300 dark:border-stone-600",
    icon: "",
  },
  "muhibkhan.dev@gmail.com": {
    title: "Co-Founder",
    subtitle: "Product Engineer",
    color: "text-stone-700 dark:text-stone-300",
    bg: "bg-stone-100 dark:bg-stone-800/50",
    border: "border-stone-300 dark:border-stone-600",
    icon: "",
    displayName: "Muhib Khan",
  },
};

export function getAdminRole(email: string): AdminRoleInfo | null {
  return ADMIN_ROLES[email.toLowerCase().trim()] ?? null;
}
