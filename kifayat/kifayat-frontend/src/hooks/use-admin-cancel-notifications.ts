import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";

/**
 * Realtime order cancellation notifications for the admin.
 * Listens for `order_cancelled` events and shows a toast.
 */
export function useAdminCancelNotifications() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onCancel = (data: any) => {
      const name = data?.userName ?? "A customer";
      const orderNum = data?.orderID ?? "";
      const amount = Number(data?.totalAmount ?? 0);
      toast.error(
        `Order cancelled: ${name} cancelled ${orderNum}${amount ? ` (Rs ${amount.toLocaleString()})` : ""}.`,
        { duration: 8000 },
      );
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    };

    socket.on("order_cancelled", onCancel);
    return () => {
      socket.off("order_cancelled", onCancel);
    };
  }, [qc]);
}
