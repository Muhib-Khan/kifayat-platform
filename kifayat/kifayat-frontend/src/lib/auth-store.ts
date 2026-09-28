/**
 * Auth store backed by the Kifayat MongoDB/Express backend.
 * The backend issues an httpOnly cookie (kifayat_token) on login —
 * we never touch the token directly; just call /api/auth/me to check session.
 */
import { useEffect, useState } from "react";
import { api } from "./api";

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "seller" | "user";
  storeName?: string;
  storeSlug?: string;
  title?: string;
  gender?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  isVerified: boolean;
  isVerifiedCustomer?: boolean;
  createdAt?: string;
  lastActiveAt?: string;
  totalOrdersCount?: number;
  totalSpentAmount?: number;
  customDiscountPercent?: number;
  priceMultiplier?: number;
  loyaltyPoints?: number;
  tier?: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
};

let listeners = new Set<(s: AuthState) => void>();
let state: AuthState = { user: null, loading: true };
let initialized = false;

function emit() {
  listeners.forEach((l) => l({ ...state }));
}

export async function refreshAuth() {
  try {
    const data = await api.get<{ success: boolean; user: AuthUser }>(
      "/auth/me",
    );
    state = { user: data.user ?? null, loading: false };
  } catch {
    state = { user: null, loading: false };
  }
  emit();
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  refreshAuth();
}

export function useAuth() {
  const [s, setS] = useState<AuthState>(state);
  useEffect(() => {
    init();
    listeners.add(setS);
    setS({ ...state });
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

export async function signOut() {
  await api.post("/auth/logout").catch(() => {});
  state = { user: null, loading: false };
  emit();
}

export function getPostLoginPath(user: Pick<AuthUser, "role">): "/admin" | "/seller/dashboard" | "/account" {
  if (user.role === "admin") return "/admin";
  if (user.role === "seller") return "/seller/dashboard";
  return "/account";
}
