import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Pencil, Trash, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAddresses,
  upsertAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/account.functions";

export const Route = createFileRoute("/account/addresses")({
  component: Addresses,
});

const PROVINCES = [
  "Sindh","Punjab","Khyber Pakhtunkhwa","Balochistan",
  "Islamabad Capital Territory","Gilgit-Baltistan","Azad Kashmir",
];

type AddrForm = {
  id?: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postal_code: string;
  is_default: boolean;
};

const EMPTY: AddrForm = {
  label: "Home", full_name: "", phone: "", line1: "", line2: "",
  city: "", province: "Sindh", postal_code: "", is_default: false,
};

function Addresses() {
  const qc = useQueryClient();
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
  });
  const [editing, setEditing] = useState<AddrForm | null>(null);

  async function save() {
    if (!editing) return;
    try {
      await upsertAddress(editing);
      toast.success("Address saved.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["addresses"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed."); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this address?")) return;
    try {
      await deleteAddress(id);
      toast.success("Removed.");
      qc.invalidateQueries({ queryKey: ["addresses"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed."); }
  }

  async function makeDefault(id: string) {
    try {
      await setDefaultAddress(id);
      toast.success("Set as default.");
      qc.invalidateQueries({ queryKey: ["addresses"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground">§ Where it goes</p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-1">
            Address book<span className="text-brass">.</span>
          </h2>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center justify-center gap-2 bg-coal text-bone eyebrow px-5 py-3 hover:bg-brass hover:text-coal transition sm:w-auto w-full"
        >
          <Plus className="size-4" /> Add address
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-coal/15 p-5 space-y-3">
              <div className="h-3.5 w-24 rounded animate-pulse bg-coal/10" />
              <div className="h-3 w-2/3 rounded animate-pulse bg-coal/10" />
              <div className="h-3 w-1/2 rounded animate-pulse bg-coal/10" />
            </div>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="border border-dashed border-coal/15 p-12 text-center">
          <p className="text-muted-foreground">No addresses saved yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a: any) => (
            <div key={a.id} className="border border-coal/15 p-5 bg-paper">
              <div className="flex items-start justify-between mb-3">
                <span className="eyebrow text-xs bg-coal/10 px-2 py-1">{a.label}</span>
                {a.is_default && (
                  <span className="eyebrow text-xs text-brass flex items-center gap-1">
                    <Check className="size-3" /> Default
                  </span>
                )}
              </div>
              <p className="font-medium text-sm">{a.full_name}</p>
              <p className="text-sm text-muted-foreground mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
              <p className="text-sm text-muted-foreground">{a.city}, {a.province} {a.postal_code}</p>
              <p className="text-sm text-muted-foreground">{a.phone}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setEditing({ ...a })} className="size-8 grid place-items-center border border-coal/15 hover:bg-coal hover:text-bone transition">
                  <Pencil className="size-3.5" />
                </button>
                <button onClick={() => remove(a.id)} className="size-8 grid place-items-center border border-coal/15 hover:bg-destructive hover:text-white transition">
                  <Trash className="size-3.5" />
                </button>
                {!a.is_default && (
                  <button onClick={() => makeDefault(a.id)} className="text-xs eyebrow px-3 border border-coal/15 hover:bg-coal hover:text-bone transition">
                    Set default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-coal/60 z-50 flex items-center justify-center p-4">
          <div className="bg-bone w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display italic text-2xl">{editing.id ? "Edit address" : "New address"}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <FField label="Label" value={editing.label} onChange={(v) => setEditing((a) => a && { ...a, label: v })} className="sm:col-span-2" />
              <FField label="Full name *" value={editing.full_name} onChange={(v) => setEditing((a) => a && { ...a, full_name: v })} />
              <FField label="Phone *" value={editing.phone} onChange={(v) => setEditing((a) => a && { ...a, phone: v })} />
              <FField label="Address line 1 *" value={editing.line1} onChange={(v) => setEditing((a) => a && { ...a, line1: v })} className="sm:col-span-2" />
              <FField label="Address line 2" value={editing.line2} onChange={(v) => setEditing((a) => a && { ...a, line2: v })} className="sm:col-span-2" />
              <FField label="City *" value={editing.city} onChange={(v) => setEditing((a) => a && { ...a, city: v })} />
              <label className="block">
                <span className="eyebrow text-xs mb-1 block">Province</span>
                <select value={editing.province} onChange={(e) => setEditing((a) => a && { ...a, province: e.target.value })}
                  className="w-full h-10 px-3 border border-coal/20 text-sm">
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <FField label="Postal code" value={editing.postal_code} onChange={(v) => setEditing((a) => a && { ...a, postal_code: v })} />
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={editing.is_default} onChange={(e) => setEditing((a) => a && { ...a, is_default: e.target.checked })} />
                <span className="text-sm">Set as default address</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={save} className="bg-coal text-bone eyebrow px-6 py-2.5 hover:bg-brass hover:text-coal transition">Save</button>
              <button onClick={() => setEditing(null)} className="eyebrow px-6 py-2.5 border border-coal/15 hover:bg-coal/5 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FField({ label, value, onChange, className = "" }: {
  label: string; value: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow text-xs mb-1 block">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 border border-coal/20 text-sm focus:outline-none focus:border-coal" />
    </label>
  );
}
