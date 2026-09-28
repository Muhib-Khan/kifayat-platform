import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";

/**
 * Realtime receipt notifications for the admin.
 * Listens for `receipt_submitted` events and shows a toast so the admin
 * can immediately review the new receipt.
 */
export function useReceiptNotifications() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onSubmit = (data: any) => {
      const name = data?.userName ?? "A customer";
      const amt = Number(data?.totalAmount ?? 0);
      toast.info(
        `${name} submitted a receipt — Rs ${amt.toLocaleString()} (${data?.itemCount ?? 0} items).`,
        { duration: 8000 },
      );
      qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    };

    const onApprove = (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    };

    const onReject = (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    };

    socket.on("receipt_submitted", onSubmit);
    socket.on("receipt_approved", onApprove);
    socket.on("receipt_rejected", onReject);
    return () => {
      socket.off("receipt_submitted", onSubmit);
      socket.off("receipt_approved", onApprove);
      socket.off("receipt_rejected", onReject);
    };
  }, [qc]);
}
