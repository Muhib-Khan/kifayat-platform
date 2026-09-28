import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

/**
 * Realtime receipt status notifications for the signed-in customer.
 * Shows a toast when their receipt is approved or rejected.
 */
export function useReceiptStatusSync() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?._id ?? null;

  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();

    const onApproved = (data: any) => {
      if (String(data?.userId) !== String(userId)) return;
      const pts = Number(data?.points ?? 0);
      toast.success(`Your receipt was approved! +${pts} loyalty points added to your account.`, { duration: 6000 });
      qc.invalidateQueries({ queryKey: ["my-receipts"] });
      qc.invalidateQueries({ queryKey: ["your-orders"] });
    };

    const onRejected = (data: any) => {
      if (String(data?.userId) !== String(userId)) return;
      const reason = data?.reason;
      toast.error(
        reason ? `Your receipt was rejected: ${reason}` : "Your receipt was rejected. You can resubmit with a new image.",
        { duration: 6000 },
      );
      qc.invalidateQueries({ queryKey: ["my-receipts"] });
      qc.invalidateQueries({ queryKey: ["your-orders"] });
    };

    socket.on("receipt_approved", onApproved);
    socket.on("receipt_rejected", onRejected);
    return () => {
      socket.off("receipt_approved", onApproved);
      socket.off("receipt_rejected", onRejected);
    };
  }, [qc, userId]);
}
