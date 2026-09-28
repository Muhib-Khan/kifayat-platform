// ─── Kifayat Stories — blog data ─────────────────────────────────────────────
// Articles power the /blog index and /blog/:slug pages, and feed BlogPosting
// structured data. Content is written for Pakistani buyers: real PKR figures,
// COD + nationwide delivery framing, and internal links to store categories.
import earbuds from "@/assets/blog/earbuds.jpg";
import sneakers from "@/assets/blog/sneakers.jpg";
import shoeSize from "@/assets/blog/shoe-size.jpg";
import phones from "@/assets/blog/phones.jpg";
import cooktop from "@/assets/blog/cooktop.jpg";
import facewash from "@/assets/blog/facewash.jpg";
import cod from "@/assets/blog/cod.jpg";
import electronics from "@/assets/blog/electronics.jpg";
import watch from "@/assets/blog/watch.jpg";

export type BlogPost = {
  id: string;
  title: string;
  /** Meta description, 140–160 chars */
  description: string;
  /** Primary target keyword */
  keyword: string;
  /** Display date */
  date: string;
  /** ISO date for schema (YYYY-MM-DD) */
  dateISO: string;
  author: string;
  cover: string;
  coverAlt: string;
  readMins: number;
  category: string;
  excerpt: string;
  sections: { heading: string; paragraphs: string[] }[];
  faq: { q: string; a: string }[];
  cta: { to: string; label: string };
};

export const blogPosts: BlogPost[] = [
  {
    id: "wireless-earbuds-under-5000",
    title: "Best Wireless Earbuds Under Rs 5,000 in Pakistan (2026)",
    description:
      "The best wireless earbuds under Rs 5,000 in Pakistan — battery, sound, fit and COD buying tips, with honest prices from Kifayat.",
    keyword: "best wireless earbuds under 5000 in Pakistan",
    date: "Aug 10, 2026",
    dateISO: "2026-08-10",
    author: "Hira N.",
    cover: earbuds,
    coverAlt: "White wireless earbuds with charging case on a clean background",
    readMins: 7,
    category: "Electronics",
    excerpt:
      "You don't need to spend Rs 15,000 for decent wireless audio. Here's what actually matters under Rs 5,000 — and how to buy safely with cash on delivery.",
    sections: [
      {
        heading: "Why a Rs 5,000 budget is enough",
        paragraphs: [
          "The sub-Rs 5,000 tier in Pakistan has quietly become the sweet spot for wireless earbuds. Brands now ship Bluetooth 5.3, decent battery cases and passable sound at this price — the extra money beyond it mostly buys brand names and marginal quality gains.",
          "For most people — calls, commute audio, podcasts, gym sessions — a Rs 3,000–5,000 pair covers everything you'll actually use.",
        ],
      },
      {
        heading: "What to check before you buy",
        paragraphs: [
          "Battery: look for 4–6 hours per charge and 20+ hours total with the case. Latency: if you game, prefer a low-latency mode or a pair flagged for gaming. Fit: ear tips are not one-size-fits-all — check that the box includes multiple sizes.",
          "IP rating matters if you work out or walk in Karachi's rain; an IPX4 rating handles sweat and light splashes. Skip pairs that advertise impossible battery numbers or no warranty at all.",
        ],
      },
      {
        heading: "A strong nearby alternative",
        paragraphs: [
          "If you'd rather have over-ear comfort for the same money, the SoundPro Wireless Over-Ear Headphones at Rs 4,499 with active noise cancellation and a 40-hour battery is one of the best-value audio buys in Pakistan right now — and it carries a full store warranty.",
          "Either way, buy from a store that lets you inspect the parcel before paying the courier. That single habit filters out most counterfeit audio floating around the market.",
        ],
      },
      {
        heading: "Where to buy them online",
        paragraphs: [
          "Shop electronics at Kifayat with cash on delivery nationwide — you only pay when the parcel is in your hands, and any defect within 7 days is replaced or refunded.",
          "Keep the box and the invoice until the warranty period passes; they're your proof for any replacement claim.",
        ],
      },
    ],
    faq: [
      { q: "How long do earbuds under Rs 5,000 last per charge?", a: "Most pairs in this range deliver 4–6 hours per charge and 20–30 hours total with the charging case." },
      { q: "Can I pay cash on delivery for earbuds?", a: "Yes — cash on delivery is available nationwide, so you only pay when your order arrives." },
      { q: "What if my earbuds arrive defective?", a: "Report it within 7 days of delivery and Kifayat will replace them or refund you." },
      { q: "Do budget earbuds have a warranty?", a: "Reputable sellers include a 3–12 month warranty; always confirm before paying." },
    ],
    cta: { to: "/category/electronics", label: "Shop Electronics" },
  },
  {
    id: "phones-under-30000",
    title: "Best Phones Under Rs 30,000 in Pakistan (2026)",
    description:
      "What Rs 30,000 buys in a phone in Pakistan in 2026 — processor, RAM, camera and battery priorities, plus safe COD buying tips.",
    keyword: "best mobile phones under 30000 in Pakistan",
    date: "Jul 28, 2026",
    dateISO: "2026-07-28",
    author: "Bilal R.",
    cover: phones,
    coverAlt: "Smartphone held in hand — what Rs 30,000 buys in Pakistan",
    readMins: 8,
    category: "Electronics",
    excerpt:
      "Rs 30,000 is a real phone budget in Pakistan. Here's where to spend it, where to save, and how to avoid the traps in the grey market.",
    sections: [
      {
        heading: "What Rs 30,000 actually gets you",
        paragraphs: [
          "At this budget in 2026 you can expect a 6.5-inch or larger display, 6–8GB of RAM, 128GB of storage, a capable 50MP main camera and a battery that comfortably lasts a day. Flagship cameras and premium builds are the only things out of reach — and most buyers don't need them.",
          "The biggest mistake at this price is overpaying for a slightly older 'flagship-killer' that has already lost software support.",
        ],
      },
      {
        heading: "Prioritise these, in order",
        paragraphs: [
          "Processor + RAM first: 6GB RAM minimum for heavy apps, and look for a chipset with recent release date — it determines how long the phone stays fast. Battery second: 5000mAh is the safe floor. Camera third: more megapixels is not better — a good sensor and night mode matter more.",
          "Software updates are the hidden spec. A phone guaranteed 2–3 years of updates is worth more than a slightly faster one that stops at Android 14.",
        ],
      },
      {
        heading: "The grey market trap",
        paragraphs: [
          "Unregistered or 'leaked' handsets are cheaper for a reason: they can be blocked from Pakistani networks, miss official warranty, and often ship with modified software. If a deal is far below market price, assume the risk is hidden somewhere.",
          "Buy from sellers who give you a proper invoice and a real warranty claim path — you'll want both if the device has issues in month three.",
        ],
      },
      {
        heading: "Buying online with confidence",
        paragraphs: [
          "Buy electronics online at Kifayat with cash on delivery nationwide — inspect the parcel at your doorstep before paying the courier, and get 7-day protection against defects.",
          "Register any device warranty immediately after purchase, and keep the invoice saved to your email.",
        ],
      },
    ],
    faq: [
      { q: "Is 6GB RAM enough for a phone under Rs 30,000?", a: "Yes — 6GB is comfortable for daily use and most gaming; choose 8GB if the price gap is small." },
      { q: "Do budget phones support Pakistani networks?", a: "PTA-approved devices are required for reliable network use; always confirm the phone is PTA-registered before purchase." },
      { q: "Can I inspect a phone before paying?", a: "With COD at Kifayat, yes — you check the sealed parcel before handing over cash." },
    ],
    cta: { to: "/category/electronics", label: "Shop Electronics" },
  },
  {
    id: "sneakers-under-5000",
    title: "Best Sneakers Under Rs 5,000 in Pakistan (2026)",
    description:
      "The best sneakers under Rs 5,000 in Pakistan — fit, materials, durability and where to buy with cash on delivery at honest prices.",
    keyword: "best sneakers under 5000 in Pakistan",
    date: "Jul 12, 2026",
    dateISO: "2026-07-12",
    author: "Saima A.",
    cover: sneakers,
    coverAlt: "Close-up of a modern athletic sneaker — the best value under Rs 5,000",
    readMins: 6,
    category: "Fashion",
    excerpt:
      "Great sneakers under Rs 5,000 exist — the trick is knowing what to compromise on. Fit and materials first, logos last.",
    sections: [
      {
        heading: "The sub-Rs 5,000 sneaker reality",
        paragraphs: [
          "In this range you're buying real leather or quality synthetics, a cushioned sole and decent construction — not brand logos or marketing budgets. That trade is almost always worth it for daily wear.",
          "A well-made no-logo sneaker at Rs 3,500 will outlast a loud-branded pair at Rs 6,000 with thinner materials.",
        ],
      },
      {
        heading: "Fit beats everything",
        paragraphs: [
          "Sizes vary wildly between brands, so check the size guide on every product page and measure your foot before ordering. Most buyers in Pakistan are between EU 40 and 44; if you're between sizes, size up for sneakers.",
          "Thin socks vs thick socks changes fit too — decide what you'll wear them with before you order.",
        ],
      },
      {
        heading: "Our pick at this price",
        paragraphs: [
          "The Minimal White Sneakers at Rs 3,299 (marked down from Rs 4,499) are the best value in this tier right now: full-grain leather, cushioned EVA sole and unisex sizing. A white minimal sneaker also goes with everything, so cost-per-wear collapses quickly.",
          "They're a Bestseller at Kifayat for a reason — 4.8 stars from 384 reviews.",
        ],
      },
      {
        heading: "How to buy them online",
        paragraphs: [
          "Order fashion online at Kifayat with cash on delivery nationwide. If the fit isn't right, unworn items with tags can be exchanged within 7 days of delivery.",
          "Keep the original box for any exchange — it makes the process instant.",
        ],
      },
    ],
    faq: [
      { q: "What size should I order if I'm between sizes?", a: "For sneakers, size up — a half-size bigger is easy to manage with thicker socks; a half-size smaller is unwearable." },
      { q: "Are Rs 5,000 sneakers durable?", a: "Yes, when the materials are real. Check that the upper is leather or quality synthetic and the sole is cushioned EVA or rubber." },
      { q: "Can I exchange sneakers if the fit is wrong?", a: "Yes — unworn items with tags can be exchanged within 7 days of delivery." },
    ],
    cta: { to: "/category/fashion", label: "Shop Fashion" },
  },
  {
    id: "shoe-size-guide",
    title: "How to Find Your Shoe Size Online in Pakistan",
    description:
      "A simple guide to measuring your foot at home so you always order the right shoe size online in Pakistan — plus COD and exchange tips.",
    keyword: "how to know your shoe size online",
    date: "Jun 30, 2026",
    dateISO: "2026-06-30",
    author: "Ayesha K.",
    cover: shoeSize,
    coverAlt: "Side profile of a running shoe — measuring your foot at home",
    readMins: 5,
    category: "Fashion",
    excerpt:
      "Ordering shoes online is a lottery only when you skip the 60-second measurement. Here's the foolproof method.",
    sections: [
      {
        heading: "The 60-second measurement",
        paragraphs: [
          "Place a piece of paper against a wall, stand on it with your heel touching the wall, and mark where your longest toe ends. Measure heel-to-mark in centimetres with a ruler.",
          "Do both feet — one is usually a half-size larger. Order for the bigger foot.",
        ],
      },
      {
        heading: "Convert to your size",
        paragraphs: [
          "Use the size guide on the product page: in Pakistan, EU 40–41 ≈ foot length 25–26cm, EU 42–43 ≈ 26.5–27.5cm, EU 44 ≈ 28cm. When a store publishes a cm chart, trust it over the number.",
          "If you're between two sizes, pick the larger one for sneakers and the smaller for formal shoes, which stretch less forgivingly.",
        ],
      },
      {
        heading: "Width and shape matter",
        paragraphs: [
          "Not all size 42s fit the same. Pointed shoes run narrow; round-toe and athletic lasts run wide. If you have wide feet, look for 'wide fit' notes or stick to round-toe styles.",
          "Read the reviews for 'fits true to size' or 'runs small' comments — they're worth more than any chart.",
        ],
      },
      {
        heading: "Use COD to your advantage",
        paragraphs: [
          "Order shoes online with cash on delivery and inspect them before paying. If the fit is wrong, Kifayat exchanges unworn items with tags within 7 days — measure once, exchange never.",
          "Keep the box and tags intact until you've worn them indoors on a clean floor to confirm the fit.",
        ],
      },
    ],
    faq: [
      { q: "What if my two feet are different sizes?", a: "Order for the larger foot — you can always add an insole to the smaller side." },
      { q: "How do I measure without a ruler?", a: "Use a known object: a standard debit card is 8.56cm — compare against it, or use a phone measuring app." },
      { q: "Do shoe sizes differ between brands?", a: "Yes, often. Always check the brand's cm chart and recent reviews instead of trusting the number alone." },
    ],
    cta: { to: "/category/fashion", label: "Shop Fashion" },
  },
  {
    id: "induction-cooktop-under-15000",
    title: "Best Induction Cooktops Under Rs 15,000 in Pakistan",
    description:
      "The best induction cooktops under Rs 15,000 in Pakistan — wattage, coil size, pan compatibility and safe online buying.",
    keyword: "best induction cooktop under 15000 in Pakistan",
    date: "Jun 18, 2026",
    dateISO: "2026-06-18",
    author: "Omar F.",
    cover: cooktop,
    coverAlt: "Cooktop cooking with a steel pan — induction-compatible cookware",
    readMins: 7,
    category: "Home & Kitchen",
    excerpt:
      "Induction cooking is faster and safer than gas for many kitchens. Here's how to pick the right cooktop under Rs 15,000 — and what most buyers get wrong.",
    sections: [
      {
        heading: "Why induction makes sense",
        paragraphs: [
          "Induction heats the pan directly, not the air — which means faster boiling, no gas cylinder hassle, and a cooler kitchen in Pakistani summers. In apartments without gas connections, it's often the only real option.",
          "Running costs are also predictable: most single-burner cooktops consume 1800–2000W, comparable to a mid-size room air conditioner at full power.",
        ],
      },
      {
        heading: "Wattage and coil size first",
        paragraphs: [
          "Look for at least 1800W (2000W is better) for genuinely fast cooking. The coil diameter matters just as much — a wider coil heats larger pots evenly, so match the coil to your biggest pan.",
          "Below 1600W you'll notice slow boiling and poor performance on heavy pots — avoid unless you only cook for one.",
        ],
      },
      {
        heading: "Pan compatibility, the #1 mistake",
        paragraphs: [
          "Induction only works with magnetic-based pans. Test at home: a fridge magnet should stick to the pan's base. Most steel and cast-iron cookware works; most aluminium and glass doesn't.",
          "If you're buying pans alongside, look for the induction symbol (a coil icon) on the packaging.",
        ],
      },
      {
        heading: "Safety and presets",
        paragraphs: [
          "Prioritise auto shut-off, overheat protection and child lock — non-negotiable safety basics. Preset modes (milk, fry, simmer) are genuinely useful, not gimmicks, if you cook the same things weekly.",
          "Buy home appliances online with cash on delivery and confirm the warranty before paying. Major appliances at Kifayat carry brand or store warranty, with coverage listed on the product page.",
        ],
      },
    ],
    faq: [
      { q: "Do induction cooktops work with all pans?", a: "No — only magnetic-based pans (steel, cast iron). If a magnet sticks to the base, it works." },
      { q: "What wattage should I choose under Rs 15,000?", a: "Aim for 1800–2000W with a wider coil for even heating and faster cooking." },
      { q: "Is a warranty included?", a: "Yes — major appliances at Kifayat include brand or store warranty; check the product page for details." },
      { q: "Can I pay cash on delivery?", a: "Yes — cash on delivery is available nationwide on all home & kitchen orders." },
    ],
    cta: { to: "/category/home-kitchen", label: "Shop Home & Kitchen" },
  },
  {
    id: "face-wash-oily-skin",
    title: "Best Face Wash for Oily Skin in Pakistan (2026)",
    description:
      "The best face washes for oily skin in Pakistan — salicylic acid, niacinamide, what to avoid, and how to buy authentic products online.",
    keyword: "best face wash for oily skin in Pakistan",
    date: "May 25, 2026",
    dateISO: "2026-05-25",
    author: "Zara M.",
    cover: facewash,
    coverAlt: "Skincare bottle on a fresh background — cleansers for oily skin",
    readMins: 6,
    category: "Beauty",
    excerpt:
      "Oily skin in a humid climate is a constant battle. The right cleanser wins half of it — here's what to look for and what to skip.",
    sections: [
      {
        heading: "Why your current face wash might be making it worse",
        paragraphs: [
          "Harsh, stripping cleansers remove oil — and your skin responds by producing more of it. The goal isn't a squeaky-clean feeling; it's a clean that doesn't trigger rebound oiliness.",
          "In Pakistan's humidity, that usually means a gentle foaming or gel cleanser rather than heavy creams.",
        ],
      },
      {
        heading: "Ingredients that actually work",
        paragraphs: [
          "Salicylic acid (0.5–2%) clears pores and calms breakouts — the gold standard for oily skin. Niacinamide regulates oil production long-term and pairs well with most routines. Both are common at honest price points.",
          "Tea tree and witch hazel appear in many 'oil control' products, but at high concentrations they can irritate; treat them as secondary, not primary.",
        ],
      },
      {
        heading: "What to avoid",
        paragraphs: [
          "Skip products with alcohol (denatured) high on the ingredient list, fragrance-first formulas, and anything that leaves your face tight after rinsing. Those are the three signals of a stripping cleanser.",
          "Also avoid the temptation to wash more than twice a day — over-washing is a top cause of oil rebound in humid climates.",
        ],
      },
      {
        heading: "Routine basics that multiply results",
        paragraphs: [
          "Wash morning and night, pat dry (don't rub), and always follow with moisturiser — yes, even oily skin needs one; a lightweight gel is enough. Sunscreen completes the routine in Pakistani summers.",
          "Buy beauty products at Kifayat with cash on delivery nationwide — every product is sourced from authorized distributors and arrives sealed, so authenticity is guaranteed.",
        ],
      },
    ],
    faq: [
      { q: "How often should I wash oily skin?", a: "Twice a day is enough — morning and night. Over-washing triggers more oil production." },
      { q: "Is salicylic acid safe for daily use?", a: "Yes, at 0.5–2% in a cleanser it's safe for daily use for most skin types." },
      { q: "Do you sell authentic beauty products?", a: "Yes — everything is sourced from authorized distributors and arrives sealed in original packaging." },
    ],
    cta: { to: "/category/beauty", label: "Shop Beauty" },
  },
  {
    id: "cod-shopping-guide",
    title: "How to Shop Online Safely with Cash on Delivery in Pakistan",
    description:
      "A complete guide to safe online shopping with cash on delivery in Pakistan — red flags, parcel inspection, returns and your rights.",
    keyword: "how to shop online safely with COD in Pakistan",
    date: "May 10, 2026",
    dateISO: "2026-05-10",
    author: "Bilal R.",
    cover: cod,
    coverAlt: "Package being handed over — safe cash on delivery in Pakistan",
    readMins: 7,
    category: "Guides",
    excerpt:
      "COD is the safest way to shop online in Pakistan — if you use it right. Here's the checklist that keeps your money and your data safe.",
    sections: [
      {
        heading: "Why COD is your superpower",
        paragraphs: [
          "Cash on delivery means the seller earns nothing until the parcel is in your hands. That single fact filters out most scams — a fraudulent seller has no incentive to ship you anything if they never get paid in advance.",
          "At Kifayat, COD is the only payment method: no card details, no online banking, nothing to hack. You inspect the parcel, then pay the courier.",
        ],
      },
      {
        heading: "Red flags that should stop you cold",
        paragraphs: [
          "Advance payment demands (especially via private bank transfer), prices 50%+ below market, no physical address or phone, and social-media-only stores with no order system. Any one of these is a reason to walk away.",
          "'Too good to be true' discounts on branded electronics are the single most common scam pattern in Pakistan right now.",
        ],
      },
      {
        heading: "The parcel inspection ritual",
        paragraphs: [
          "Before handing over cash: check the parcel's weight and condition, confirm the seller's label matches what you ordered, open it and verify the item (and that it's the right variant/colour/size). If something's wrong, refuse delivery — with COD you lose nothing.",
          "Never pay for a parcel you haven't opened and checked, no matter how polite the courier is.",
        ],
      },
      {
        heading: "Know your return rights",
        paragraphs: [
          "A reputable store offers a return window — at Kifayat it's 7 days from delivery for replacement or refund. Keep the invoice and packaging until you're confident the item is right.",
          "If a store has no return policy at all, treat that as a warning, not a convenience.",
        ],
      },
    ],
    faq: [
      { q: "Is it safe to give my address for COD orders?", a: "Yes — your address is used only for delivery, and reputable stores never share it with third parties beyond the courier." },
      { q: "What if the courier won't let me open the parcel?", a: "You have the right to inspect before paying — with COD, payment happens only after you accept the parcel." },
      { q: "Can I refuse a parcel at the door?", a: "Yes — that's the whole point of COD. Refusing a damaged or wrong parcel costs you nothing." },
    ],
    cta: { to: "/products", label: "Browse Products" },
  },
  {
    id: "buying-electronics-online",
    title: "Buying Electronics Online in Pakistan: 10 Things to Know",
    description:
      "10 things to know before buying electronics online in Pakistan — warranty, grey market, inspection, records and safe COD buying.",
    keyword: "buying electronics online in Pakistan tips",
    date: "Apr 22, 2026",
    dateISO: "2026-04-22",
    author: "Hira N.",
    cover: electronics,
    coverAlt: "Assorted electronics and gadgets — 10 things to know before buying online",
    readMins: 8,
    category: "Guides",
    excerpt:
      "Electronics are the riskiest category to buy online — and the most rewarding when you know the rules. Ten rules, in fact.",
    sections: [
      {
        heading: "1. Verify the seller, not just the product",
        paragraphs: [
          "Anyone can list a phone. Check the seller has a physical address, a working phone line, a real return policy and a history of reviews. A store that answers WhatsApp fast and has a street address is a store you can hold accountable.",
        ],
      },
      {
        heading: "2. Compare across at least three stores",
        paragraphs: [
          "Price differences of 20% on the same model mean someone is either overcharging or selling something grey. Comparison kills both.",
        ],
      },
      {
        heading: "3. Warranty is the spec that matters most",
        paragraphs: [
          "An official warranty is worth more than an extra camera lens. Confirm what the warranty covers, who honours it, and how you file a claim before you pay.",
        ],
      },
      {
        heading: "4. Avoid the grey market",
        paragraphs: [
          "Non-PTA phones can be blocked from networks; 'imported' units often lack warranty. The savings disappear the first time something goes wrong.",
        ],
      },
      {
        heading: "5–10. The rest of the checklist",
        paragraphs: [
          "5) Inspect the sealed parcel before paying the courier. 6) Check the serial number matches the box. 7) Keep the invoice saved to email. 8) Register the warranty immediately. 9) Test everything within the return window. 10) Report any defect immediately — at Kifayat, that's within 7 days of delivery.",
          "Follow all ten and online electronics shopping in Pakistan becomes genuinely safe — and usually cheaper than the mall.",
        ],
      },
    ],
    faq: [
      { q: "Is it safe to buy electronics online in Pakistan?", a: "Yes, when you use COD, buy from verified sellers with real warranties, and inspect the parcel before paying." },
      { q: "What should I do if my electronics order arrives defective?", a: "Report it within 7 days of delivery — Kifayat arranges a replacement or refund with no complicated process." },
      { q: "Do all online electronics come with warranty?", a: "No — always confirm. Reputable sellers include brand or store warranty; the coverage is listed on the product page." },
    ],
    cta: { to: "/category/electronics", label: "Shop Electronics" },
  },
  {
    id: "watches-under-5000",
    title: "Best Watches Under Rs 5,000 in Pakistan (2026)",
    description:
      "The best watches under Rs 5,000 in Pakistan — quartz vs automatic, straps, water resistance and safe COD buying at honest prices.",
    keyword: "best watches under 5000 in Pakistan",
    date: "Aug 18, 2026",
    dateISO: "2026-08-18",
    author: "Hira N.",
    cover: watch,
    coverAlt: "Modern wristwatch on a wrist — quality watches under Rs 5,000",
    readMins: 6,
    category: "Fashion",
    excerpt:
      "You don't need a luxury budget for a watch that looks sharp and keeps perfect time. Here's what actually matters under Rs 5,000.",
    sections: [
      {
        heading: "Why Rs 5,000 is a smart watch budget",
        paragraphs: [
          "Below Rs 3,000 you're mostly buying fashion watches with quartz movements that die early and straps that wear fast. Around Rs 3,500–5,000 the build quality jumps noticeably: better movements, stainless or quality alloy cases, and mineral glass instead of acrylic.",
          "For daily wear in Pakistan — office, university, Friday prayers, weddings — a Rs 4,000–5,000 watch covers everything without the anxiety of a luxury piece.",
        ],
      },
      {
        heading: "Quartz or automatic?",
        paragraphs: [
          "Quartz is the right call at this budget. It's accurate to seconds per month, needs no winding, and replacement batteries cost a few hundred rupees every couple of years. Automatics in this price range are rarely reliable and almost never serviceable locally.",
          "If you love the look of a mechanical watch, treat it as a design choice — not an accuracy one — at this price.",
        ],
      },
      {
        heading: "What to check before you buy",
        paragraphs: [
          "Glass: prefer mineral glass over acrylic — it resists scratches from everyday bumps. Strap: stainless steel and quality leather last longer than cheap mesh or nylon. Water resistance: '3 ATM' or '30M' means rain-safe, not swim-safe; don't overpay for dive ratings you won't use.",
          "Check the case back for the movement and any warranty seal — a genuine quartz movement stamped by a known maker (Japan, Swiss) is a strong quality signal even on budget watches.",
        ],
      },
      {
        heading: "Where to buy watches online",
        paragraphs: [
          "Shop fashion and accessories at Kifayat with cash on delivery nationwide — you only pay when the parcel is in your hands, and unworn items with tags can be exchanged within 7 days of delivery.",
          "Keep the box and warranty card until you've worn the watch for a couple of weeks; they're your proof for any exchange or claim.",
        ],
      },
    ],
    faq: [
      { q: "Are quartz watches good under Rs 5,000?", a: "Yes — quartz is the most accurate and low-maintenance choice at this price. Battery changes cost a few hundred rupees every 1–2 years." },
      { q: "Is a watch with 3 ATM water resistance swim-safe?", a: "No — 3 ATM/30M handles rain and hand-washing, not swimming. For pool or shower use, look for 5 ATM or higher." },
      { q: "Can I pay cash on delivery for a watch?", a: "Yes — cash on delivery is available nationwide, and unworn watches can be exchanged within 7 days." },
      { q: "How do I know a budget watch will last?", a: "Check for mineral glass, a stainless or alloy case, and a quartz movement from a known maker — those three predict durability better than the brand." },
    ],
    cta: { to: "/category/fashion", label: "Shop Fashion" },
  },
];
