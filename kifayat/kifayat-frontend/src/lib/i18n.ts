type Vars = Record<string, string | number>;

type Dict = Record<string, string>;

const en: Dict = {
  "banner.delivery": "Rs {fee} delivery — Cheapest Delivery in Pakistan",
  "banner.cod": "COD available · PKR",
  "header.help": "Help",
  "header.account": "Account",
  "header.signIn": "Sign In",
  "header.cart": "Cart",
  "search.placeholder": "Search products, brands, categories…",
  "search.submit": "Search",
  "search.suggestions": "Suggestions",
  "search.products": "Products",
  "trust.delivery": "Pakistan-wide delivery",
  "trust.cod": "Cash on delivery",
  "trust.returns": "7-day returns",
  // cod-first trust messaging
  "cod.title": "Cash on Delivery",
  "cod.payOnArrival": "Pay in cash when your order arrives",
  "cod.noAdvance": "No advance payment, ever",
  "cod.checkFirst": "Check the product, then pay",
  "cod.checkBody": "Inspect the parcel at your doorstep before paying the courier",
  "cod.noOnline": "Online payment accepted by courier",
  "cod.noOnlineBody": "Couriers accept online payments via JazzCash, EasyPaisa, and bank transfer",
  "cod.returnsBody": "Changed your mind? Return it within 7 days, no questions asked",
  "wa.label": "Chat on WhatsApp",
  "btn.addToBag": "Add to bag",
  "btn.outOfStock": "Out of stock",
  "hero.badge": "Season 01 — Edition",
  "hero.subline": "Quality essentials, fairly priced — dispatched Pakistan-wide.",
  "hero.cta": "Explore the Edit",
  "hero.secondary": "All products",
  "hero.deliveryBody": "2–5 working days",
  "hero.codBody": "Pay the courier",
  "hero.returnsBody": "Easy return policy",
  "hero.support": "Local support",
  "hero.supportBody": "Email & WhatsApp",
  "marquee.new": "New Arrivals",
  "products.browseHint": "Browse the full catalogue to find something considered.",
  "cart.title": "Your Bag",
  "cart.empty": "Your bag is empty.",
  "cart.emptyCta": "Browse the edit",
  "cart.subtotal": "Subtotal",
  "cart.shipping": "Shipping",
  "cart.total": "Total",
  "cart.checkout": "Proceed to checkout",
  "cart.continue": "Continue shopping",
  "cart.outOfStock": "Out of stock",
  "cart.stockIssues": "Stock issues",
  "cart.stockIssuesHint": "Some items in your bag are out of stock. Remove them to proceed.",
  "cart.codAccepted": "Cash on Delivery accepted",
  "cart.encrypted": "Encrypted data",
  "cart.noAdvance": "No advance payment — pay in cash at your doorstep.",
  // checkout
  "co.contact": "Contact",
  "co.name": "Full name",
  "co.phone": "Phone number",
  "co.phone2": "Phone number 2 (optional)",
  "co.address": "Delivery address",
  "co.addressFull": "Complete address",
  "co.addressPh": "Society, house/flat no., street, area",
  "co.city": "Courier city",
  "co.cityPh": "e.g. Karachi",
  "co.popular": "Popular cities",
  "co.summary": "Your order",
  "co.payment": "Payment",
  "co.placeOrder": "Place order — COD",
  "co.placing": "Placing order…",
  "co.codTitle": "Cash on Delivery",
  "co.codBody": "Pay the courier when your order arrives",
  "co.codSafe": "No advance payment — inspect the parcel, then pay the courier in cash or online via JazzCash, EasyPaisa, or bank transfer.",
  "co.confirmHint": "Confirmation link sent to {email}. Must confirm within 24 hours.",
  "co.email": "your email",
  "footer.tagline": "Three considered objects, one small story, zero shouting. Unsubscribe with a single tap.",
  // footer
  "footer.letterEyebrow": "§ The Quiet Letter",
  "footer.letterTitle1": "A short note,",
  "footer.letterTitle2": "once a month",
  "footer.subscribe": "Subscribe",
  "footer.browse": "Browse",
  "footer.allItems": "All Items",
  "footer.electronics": "Electronics",
  "footer.fashion": "Fashion",
  "footer.home": "Home & Kitchen",
  "footer.beauty": "Beauty",
  "footer.stories": "Stories",
  "footer.service": "Service",
  "footer.shipping": "Shipping",
  "footer.returns": "Returns",
  "footer.reportDefective": "Report Defective",
  "footer.orders": "Orders",
  "footer.contact": "Contact",
  "footer.faq": "FAQ",
  "footer.house": "House",
  "footer.story": "Story",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.dispatch": "Dispatch",
  "footer.dispatchBody": "Pakistan-wide · 2–5 days",
  "footer.elsewhere": "Elsewhere",
  "footer.deliveryExplained": "Delivery, explained",
  "footer.payYourWay": "Pay your way",
  "footer.codBody": "Cash on delivery is available at checkout",
  "footer.needAHand": "Need a hand?",
  "footer.helpBody": "contact@kifayat.co · replies in 1–2 business days",
  "footer.madeWith": "Made with care · dispatched across Pakistan",
  "footer.backToTop": "Back to top",
  "footer.reach": "Reach us",
  "footer.codOnly": "Cash on Delivery only — no advance payment, ever.",
};

function lookup(key: string, vars?: Vars): string {
  let s = en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

// Hook: returns a t bound to the English dictionary.
export function useT() {
  return (key: string, vars?: Vars) => lookup(key, vars);
}

// Non-hook translation for module scope / non-component code.
export function translate(key: string, vars?: Vars): string {
  return lookup(key, vars);
}
