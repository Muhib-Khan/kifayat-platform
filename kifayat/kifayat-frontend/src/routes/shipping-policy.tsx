import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/landing/LegalPage";
import { SEO } from "@/components/seo/SEO";

export const Route = createFileRoute("/shipping-policy")({
  component: ShippingPolicyPage,
});

function ShippingPolicyPage() {
  return (
    <>
      <SEO
        title="Shipping Policy — Fast Delivery Across Pakistan"
        description="Kifayat ships Pakistan-wide. 2–5 day delivery all across Pakistan at a flat fee — the cheapest delivery in Pakistan. Learn about fees and failed deliveries."
        path="/shipping-policy"
        keywords="Kifayat shipping, delivery Pakistan, cheap delivery Pakistan, COD Pakistan"
      />
    <LegalPage
      title="Shipping Policy"
      subtitle="Pakistan-wide delivery with a flat fee and transparent pricing."
      effectiveDate="1 July 2026"
      related={[
        { label: "Return & Refund Policy", to: "/return-policy" },
        { label: "Terms & Conditions", to: "/terms" },
      ]}
      sections={[
        {
          heading: "Coverage Area",
          body: [
            "Kifayat delivers to all cities and towns across Pakistan.",
            "Same-day and next-day delivery windows are available in select major cities for eligible orders.",
            "Remote areas and far-flung regions may experience extended delivery times of up to 7–10 business days. You will be notified at checkout if your area qualifies.",
          ],
        },
        {
          heading: "Delivery Timeframes",
          body: [
            "Same-day (select major cities, e.g. Karachi): available on eligible orders placed before 12:00 PM. Not available for all items.",
            "Next-day (select major cities, e.g. Karachi): orders placed before 2:00 PM on business days.",
            "Major cities (Lahore, Islamabad, Rawalpindi, Faisalabad, Multan): 2–3 business days.",
            "All other cities and towns: 3–5 business days.",
            "Remote areas: 5–10 business days.",
            "Timeframes are estimates and begin from the point of dispatch, not order placement. Orders typically dispatch within 1 business day of confirmation.",
            "Business days exclude Sundays and public holidays.",
          ],
        },
        {
          heading: "Shipping Fees",
          body: [
            "Standard delivery Pakistan-wide: one flat fee on every order — the cheapest delivery in Pakistan.",
            "Express next-day (select major cities): Rs 350 flat fee, regardless of order value.",
            "Same-day (select major cities): Rs 500 flat fee.",
            "Shipping fees are non-refundable except where the return is due to our error such as wrong or damaged item.",
          ],
        },
        {
          heading: "Order Processing",
          body: [
            "Orders are typically processed and dispatched within 1 business day of payment confirmation.",
            "COD orders may take an additional 24 hours for verification before dispatch.",
            "During peak periods (sales events, Eid, etc.), processing times may extend to 2–3 business days. We will notify you of any significant delays.",
            "You will receive an SMS and email confirmation once your order has been dispatched.",
          ],
        },
        {
          heading: "Failed & Refused Deliveries",
          callout: "Refusing a delivery that you placed does not entitle you to a refund of shipping costs.",
          body: [
            "If a delivery attempt fails because no one was available, the courier will attempt redelivery once. A notification will be sent to the phone number on file.",
            "After two failed attempts, the package is returned to our warehouse. A refund will be issued minus a Rs 300 return handling fee.",
            "If you refuse delivery at the door for a COD order, a Rs 300 handling fee will apply.",
            "Prepaid orders that are refused at delivery will be refunded to the original payment method, minus the Rs 300 handling fee.",
            "Repeated refusals will result in restriction to prepaid orders only.",
          ],
        },
        {
          heading: "Address Accuracy",
          callout: "You are solely responsible for the accuracy of the delivery address provided at checkout.",
          body: [
            "Kifayat is not liable for delayed or failed deliveries resulting from incomplete, incorrect, or unverifiable addresses.",
            "Address changes after dispatch cannot be guaranteed and are subject to courier availability.",
            "If your order is returned due to an incorrect address, reshipping will incur a fresh delivery fee.",
          ],
        },
        {
          heading: "Risk of Loss",
          body: "Title and risk of loss for all products pass to you upon delivery, as confirmed by the courier's delivery record. If you believe your package was stolen after a confirmed delivery, please contact us and your local authorities.",
        },
        {
          heading: "Shipping Delays & Force Majeure",
          body: [
            "Kifayat is not liable for shipping delays caused by circumstances beyond our reasonable control, including natural disasters, floods, strikes, courier operational failures, government actions, or public health emergencies.",
            "During Ramadan, Eid, and other national holidays, delivery timelines may be extended. We will post advance notice on the website.",
            "If your order is significantly delayed beyond the estimated timeframe, contact contact@kifayat.co for an update.",
          ],
        },
        {
          heading: "Restricted & Prohibited Items",
          body: [
            "We do not ship hazardous materials, flammable substances, weapons, or any items prohibited under Pakistani law.",
            "Certain items may not be available for delivery to specific regions due to local regulations.",
            "Orders containing restricted items may be cancelled and refunded at our discretion.",
          ],
        },
        {
          heading: "Contact for Shipping Issues",
          body: "For any shipping-related queries or non-delivery claims, contact contact@kifayat.co or reach us on WhatsApp at the number listed on our Contact page. Please have your order number ready.",
        },
      ]}
    />
    </>
  );
}
