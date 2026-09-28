import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/landing/LegalPage";
import { SEO } from "@/components/seo/SEO";

export const Route = createFileRoute("/return-policy")({
  component: ReturnPolicyPage,
});

function ReturnPolicyPage() {
  return (
    <>
      <SEO
        title="Return & Refund Policy — 7-Day Easy Returns"
        description="Kifayat's 7-day return and refund policy. Learn what can be returned, how to start a return online in Pakistan, and our refund processing timelines."
        path="/return-policy"
        keywords="Kifayat return policy, online shopping returns Pakistan, refund policy Pakistan, 7 day returns"
      />
    <LegalPage
      title="Return & Refund Policy"
      subtitle="We stand behind every product we sell. Here is what happens when something is not right."
      effectiveDate="1 July 2026"
      related={[
        { label: "Terms & Conditions", to: "/terms" },
        { label: "Shipping Policy", to: "/shipping-policy" },
      ]}
      sections={[
        {
          heading: "Return Eligibility Window",
          callout: "You have 7 calendar days from the date of delivery to initiate a return. Claims submitted after this window will not be accepted.",
          body: [
            "The return window begins on the day the courier marks your order as delivered.",
            "Returns must be initiated through My Account then Orders before the 7-day window expires. Contacting us via WhatsApp or email alone does not constitute initiating a return.",
            "If you believe your delivery date is incorrect, contact support with photographic evidence of the unopened parcel and we will review the case.",
          ],
        },
        {
          heading: "Eligible Return Conditions",
          body: [
            "The item must be unused, unworn, and in its original condition.",
            "All original packaging, tags, accessories, manuals, and bundled items must be included.",
            "The item must not be damaged by the customer. Any damage occurring after delivery is the customer's responsibility.",
            "Items showing signs of use, washing, installation, alteration, or tampering are not eligible for return.",
          ],
        },
        {
          heading: "Non-Returnable Items",
          callout: "The following items cannot be returned under any circumstances except where they arrive damaged or incorrect.",
          body: [
            "Intimate apparel, swimwear, and undergarments — for hygiene reasons.",
            "Opened beauty, skincare, and personal care products.",
            "Perishable goods, food items, and supplements.",
            "Personalised or custom-made products.",
            "Digital products, downloadable software, or gift cards.",
            "Items marked Final Sale or Non-Returnable at the time of purchase.",
            "Hazardous materials or flammable items.",
            "Products with broken seals where the seal is a hygiene or safety feature.",
          ],
        },
        {
          heading: "How to Initiate a Return",
          body: [
            "Log in to your Kifayat account and navigate to My Account then Orders.",
            "Select the order and the specific item you wish to return.",
            "Choose your reason from the dropdown. You must provide clear photographs showing the item's condition.",
            "Our team will review your request within 1–2 business days and either approve or deny it with a written explanation.",
            "If approved, a courier will be arranged to collect the item. Do not send items back without an approved return request — unsolicited returns will not be accepted.",
            "Packaging the item securely is your responsibility. Items damaged in return transit due to inadequate packaging are not eligible for refund.",
          ],
        },
        {
          heading: "Refund Processing",
          body: [
            "Once the returned item is received and inspected (1–3 business days), we will notify you of the outcome.",
            "Approved refunds are processed within 5–7 business days to the original payment method.",
            "For Cash on Delivery (COD) orders, refunds are issued via bank transfer or Easypaisa/JazzCash. You must provide valid account details.",
            "Original shipping fees are non-refundable unless the return is due to our error.",
            "If the returned item does not meet our eligibility conditions, it will be returned to you at your cost and no refund will be issued.",
          ],
        },
        {
          heading: "Exchanges",
          body: "We offer size or variant exchanges where stock is available. Exchanges follow the same eligibility conditions as returns. If the replacement item is of higher value, you will be charged the difference. If lower, the difference will be refunded. Exchanges are processed once the original item is received and inspected.",
        },
        {
          heading: "Damaged, Defective, or Incorrect Items",
          callout: "You must report damaged, defective, or incorrect items within 48 hours of delivery with photographic evidence.",
          body: [
            "Email contact@kifayat.co with your order number, a description of the issue, and clear photos of the item, packaging, and any damage.",
            "If the claim is verified, we will arrange a free replacement or full refund at our discretion.",
            "Claims submitted after 48 hours of delivery for damaged items will be assessed on a case-by-case basis and may be denied.",
            "Kifayat is not responsible for damage caused by misuse, mishandling, or improper storage after delivery.",
          ],
        },
        {
          heading: "Fraud & Return Abuse Prevention",
          callout: "Kifayat employs automated and manual review processes to detect and prevent return fraud.",
          body: [
            "Returning a different item than what was ordered (item switching) is fraud and will be reported to law enforcement.",
            "Customers found to have a pattern of excessive or suspicious returns may have their return privileges restricted or accounts suspended.",
            "Submitting false claims of damage or non-delivery to obtain refunds constitutes fraud. Evidence of such conduct will be referred to the FIA Cybercrime Wing.",
            "Filing a payment chargeback without first completing the returns process constitutes bad-faith conduct. All relevant records — including IP logs, device data, delivery confirmations, and courier GPS scans — will be submitted to the issuing bank.",
          ],
        },
        {
          heading: "COD Refusal & Non-Collection",
          body: [
            "Refusing a COD delivery at the door after it has been dispatched will incur a handling fee of Rs 300, deducted from any future refund or credit.",
            "Repeatedly refusing COD deliveries (3 or more times) will result in restriction to prepaid-only orders.",
            "Orders that cannot be delivered after two courier attempts will be returned to our warehouse. A refund will be issued minus the Rs 300 return shipping fee.",
          ],
        },
      ]}
    />
    </>
  );
}
