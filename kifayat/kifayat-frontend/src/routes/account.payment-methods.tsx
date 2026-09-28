import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";

export const Route = createFileRoute("/account/payment-methods")({
  component: PaymentMethods,
});

function PaymentMethods() {
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow text-muted-foreground">§ How you pay</p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-1">
          Payment methods<span className="text-brass">.</span>
        </h2>
      </div>
      <div className="border border-dashed border-coal/15 p-12 text-center">
        <CreditCard className="size-8 mx-auto text-coal/30 mb-4" strokeWidth={1.2} />
        <p className="text-muted-foreground">
          All orders are paid via Cash on Delivery — no card required.
        </p>
      </div>
    </div>
  );
}
