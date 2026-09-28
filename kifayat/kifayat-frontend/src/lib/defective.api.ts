const BASE = "/api/defective-products";

export async function submitDefectiveReport(formData: FormData) {
  const res = await fetch(BASE, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data as { success: boolean; report: unknown };
}
