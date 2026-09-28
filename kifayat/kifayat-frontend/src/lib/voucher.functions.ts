import { api } from "./api";

export type DiscountVoucher = {
  _id: string;
  voucher_code: string;
  discount_percent: number;
  points_required: number;
  expires_at: string | null;
  max_uses: number | null;
  created_by: { _id: string; name: string; email: string };
  is_active: boolean;
  created_at: string;
  status?: "Active" | "Ended" | "Purchased";
  purchased_by?: { _id: string; name: string; email: string } | null;
  purchased_at?: string | null;
};

export type AppliedProduct = {
  product: string | { _id: string; name: string; slug: string } | null;
  slug: string;
  applied_at: string;
  status: "reserved" | "consumed";
  order?: string | null;
};

export type PurchasedVoucherStatus = "Available" | "Applied" | "Used Up" | "Expired";

export type PurchasedVoucher = {
  _id: string;
  user: { _id: string; name: string; email: string };
  voucher: { _id: string; voucher_code: string; discount_percent: number } | null;
  discount_percent: number;
  points_spent: number;
  purchased_at: string;
  used: boolean;
  used_at: string | null;
  total_uses: number;
  expires_at: string | null;
  used_count: number;
  reserved_count: number;
  consumed_count: number;
  remaining_uses: number;
  is_expired: boolean;
  status: PurchasedVoucherStatus;
  applied_products: AppliedProduct[];
  source?: "purchased" | "gifted";
  gifted_by?: { _id: string; name: string; email: string } | null;
  gifted_at?: string | null;
  voucher_code?: string;
  voucher_type?: "discount_all" | "discount_specific" | "free_product";
  products?: (string | { _id: string; name: string; slug: string })[];
};

export async function generateVoucher(body: {
  discount_percent: number;
  points_required: number;
  max_uses?: number;
  expires_at?: string;
}): Promise<{ success: boolean; voucher: DiscountVoucher }> {
  return api.post("/vouchers/generate", body);
}

export async function getAdminVouchers(): Promise<{
  success: boolean;
  vouchers: DiscountVoucher[];
  ended: DiscountVoucher[];
}> {
  return api.get("/vouchers/admin");
}

export async function getAdminPurchasedVouchers(page = 1, limit = 20): Promise<{
  success: boolean;
  vouchers: PurchasedVoucher[];
  total: number;
  pages: number;
}> {
  return api.get(`/vouchers/admin/purchased?page=${page}&limit=${limit}`);
}

export async function deleteVoucher(id: string): Promise<{ success: boolean; message: string }> {
  return api.del(`/vouchers/${id}`);
}

export async function giftVoucher(body: {
  userId?: string;
  email?: string;
  voucherId?: string;
  discount_percent?: number;
  voucher_type?: "discount_all" | "discount_specific" | "free_product";
  productIds?: string[];
  max_uses?: number;
  expires_at?: string;
}): Promise<{ success: boolean; voucher: PurchasedVoucher }> {
  return api.post("/vouchers/gift", body);
}

export async function getAvailableVouchers(): Promise<{
  success: boolean;
  vouchers: DiscountVoucher[];
  userPoints: number;
}> {
  return api.get("/vouchers/available");
}

export async function buyVoucher(voucherId: string): Promise<{
  success: boolean;
  purchased: PurchasedVoucher;
  remainingPoints: number;
  priceMultiplier: number;
}> {
  return api.post("/vouchers/buy", { voucherId });
}

export async function getMyVouchers(): Promise<{
  success: boolean;
  vouchers: PurchasedVoucher[];
}> {
  return api.get("/vouchers/mine");
}

export async function applyVoucherToProduct(
  purchasedVoucherId: string,
  productId: string,
): Promise<{ success: boolean; voucher: PurchasedVoucher }> {
  return api.post("/vouchers/apply", { purchasedVoucherId, productId });
}

export async function unapplyVoucherFromProduct(
  purchasedVoucherId: string,
  productId: string,
): Promise<{ success: boolean; voucher: PurchasedVoucher }> {
  return api.post("/vouchers/unapply", { purchasedVoucherId, productId });
}

export function voucherExpired(pv: Pick<PurchasedVoucher, "expires_at" | "is_expired">, now = new Date()): boolean {
  if (pv.is_expired) return true;
  return !!(pv.expires_at && new Date(pv.expires_at) < now);
}

export function voucherAppliedToProduct(
  pv: PurchasedVoucher,
  productId: string,
  slug: string,
): boolean {
  return (pv.applied_products ?? []).some((a) => {
    const id =
      typeof a.product === "object" && a.product !== null ? a.product._id : a.product;
    return id === productId || (!!slug && a.slug === slug);
  });
}

export function voucherAppliedEntry(
  pv: PurchasedVoucher,
  productId: string,
  slug: string,
): AppliedProduct | undefined {
  return (pv.applied_products ?? []).find((a) => {
    const id =
      typeof a.product === "object" && a.product !== null ? a.product._id : a.product;
    return id === productId || (!!slug && a.slug === slug);
  });
}

// ─── Compensation Vouchers (admin) ──────────────────────────────────────────

export type CompensationVoucher = {
  _id: string;
  user: { _id: string; name: string; email: string };
  cancelOrder: { _id: string; orderId: string; reason: string } | string;
  voucher_type: "discount_all" | "discount_specific" | "free_product";
  discount_percent: number | null;
  products: { _id: string; name: string }[] | string[];
  generated_at: string;
  used: boolean;
  used_at: string | null;
  expires_at: string;
  used_on_order: string | null;
};

export async function getCompensationVouchers(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/vouchers/admin/compensation${qs ? `?${qs}` : ""}`);
}
