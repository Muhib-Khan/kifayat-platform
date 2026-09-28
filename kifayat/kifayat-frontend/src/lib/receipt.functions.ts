import { api } from "./api";

export type ProductReceipt = {
  _id: string;
  user: { _id: string; name: string; email: string };
  orderId: string;
  items: { name: string; price: number; quantity: number; imageUrl: string }[];
  totalAmount: number;
  image: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewNote?: string;
  pointsAwarded: number;
  createdAt: string;
};

export async function submitReceipt(orderId: string, imageFile: File): Promise<any> {
  const formData = new FormData();
  formData.append("orderId", orderId);
  formData.append("image", imageFile);

  const res = await fetch("/api/receipts", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function getMyReceipts(): Promise<ProductReceipt[]> {
  const res = await api.get<{ success: boolean; receipts: ProductReceipt[] }>("/receipts/mine");
  return res.receipts ?? [];
}

export async function getAdminReceipts(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/receipts/admin${qs ? `?${qs}` : ""}`);
}

export async function approveReceipt(id: string): Promise<any> {
  return api.patch<any>(`/receipts/${id}/approve`);
}

export async function rejectReceipt(id: string, reason?: string): Promise<any> {
  return api.patch<any>(`/receipts/${id}/reject`, { reason });
}
