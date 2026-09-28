/**
 * Shared product categorization utility.
 *
 * Scoring rules
 * ─────────────
 * • strong keywords  → 3 pts (specific, unambiguous product-type signals)
 * • weak   keywords  → 1 pt  (generic modifiers; only break ties)
 *
 * Matching uses word-boundary guards for single-word keywords so that short
 * words like "table", "mat", "pan", "mouse" cannot fire inside longer words
 * like "portable", "automatic", "expansion", "mousetrap".
 * Multi-word phrases (e.g. "air fryer") use plain substring matching — safe
 * because long phrases almost never appear inside unrelated words.
 *
 * Highest total score wins. Returns "Uncategorized" when nothing matches.
 */

// ---------------------------------------------------------------------------
// Keyword matching helpers
// ---------------------------------------------------------------------------

/** Escape regex special chars in a keyword. */
function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a compiled match function for a keyword list.
 * Single-word keywords get \b…\b word-boundary anchors.
 * Multi-word / hyphenated keywords use plain includes().
 */
function buildMatchers(keywords) {
  return keywords.map((kw) => {
    // Multi-word or hyphenated → substring match (safe for long phrases)
    if (/[\s-]/.test(kw)) {
      return (text) => text.includes(kw);
    }
    // Single word → word boundary so "table" ≠ "portable"
    const re = new RegExp(`\\b${escRe(kw)}\\b`);
    return (text) => re.test(text);
  });
}

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

const _CATEGORIES = [
  // ─── Electronics ──────────────────────────────────────────────────────────
  {
    slug: "electronics",
    name: "Electronics",
    strong: [
      // Phones & computing
      "smartphone", "mobile phone", "iphone", "android phone",
      "laptop", "notebook computer", "ultrabook", "chromebook",
      "android tablet", "ipad", "drawing tablet", "graphics tablet",
      "smart tv", "led tv", "oled tv", "qled television", "television",
      "monitor", "display screen", "projector",
      // Peripherals
      "mechanical keyboard", "gaming keyboard",
      "computer mouse", "gaming mouse", "wireless mouse", "optical mouse",
      "webcam", "graphics card", "gpu", "processor", "cpu",
      "ram", "ssd", "hard drive", "pendrive", "flash drive", "memory card",
      "extension board", "power strip", "surge protector",
      // Audio
      "headphone", "earphone", "earbuds", "earbud", "airpods",
      "soundbar", "home theater", "subwoofer",
      // Camera & imaging
      "dslr", "mirrorless camera", "action camera", "dashcam", "cctv",
      "security camera", "surveillance camera", "doorbell camera",
      "mini camera", "spy camera",
      // Connectivity & power
      "wifi router", "wifi extender", "modem", "network switch",
      "power bank", "powerbank",
      "fast charger", "wireless charger", "wall charger",
      "usb cable", "hdmi cable", "data cable", "charging cable",
      "usb adapter", "hdmi adapter", "type-c adapter",
      "inverter", "ups system", "solar panel",
      // Wearables
      "smartwatch", "smart band", "fitness tracker",
      // Misc gadgets
      "bluetooth speaker", "portable speaker",
      "drone", "quadcopter",
      "gaming console", "playstation", "xbox", "nintendo",
      "printer", "scanner", "photocopier",
      // Large appliances (clearly consumer-electronics domain)
      "refrigerator", "fridge", "deep freezer",
      "washing machine", "fully automatic",
      "air conditioner", "split ac", "window ac",
      "microwave oven",                    // oven only when paired with microwave
      // Cooling for devices
      "phone cooler", "laptop cooler", "cooling fan for mobile",
    ],
    weak: [
      "electric", "digital", "electronic", "wireless", "bluetooth",
      "rechargeable", "led", "usb", "hdmi", "smart", "battery",
      "speaker", "camera", "charger",
    ],
  },

  // ─── Fashion ──────────────────────────────────────────────────────────────
  {
    slug: "fashion",
    name: "Fashion",
    strong: [
      "shirt", "t-shirt", "tshirt", "polo shirt",
      "dress", "frock", "gown", "maxi dress",
      "jeans", "denim jeans",
      "trouser", "chino", "palazzo",
      "sneakers", "trainer shoes",
      "ankle boot", "chelsea boot",
      "sandal", "slipper", "flip flop",
      "handbag", "tote bag", "satchel", "clutch bag", "purse",
      "wallet", "card holder",
      "cap", "baseball cap", "beanie", "fedora hat",
      "bomber jacket", "denim jacket", "leather jacket",
      "overcoat", "trench coat",
      "blazer",
      "bow tie",
      "stocking",
      "kurta", "shalwar kameez", "dupatta",
      "saree", "lehenga",
      "abaya", "hijab", "niqab",
      "pullover", "cardigan",
      "hoodie", "sweatshirt",
      "mitten", "winter glove",
      "leggings",
      "boxer brief", "underwear",
      "tracksuit",
      "sunglasses",
      "jewellery set", "jewelry set", "necklace set", "earring set",
      "bracelet", "anklet",
      "school uniform",
    ],
    weak: [
      "watch", "fashion", "wear", "cloth", "fabric", "outfit",
      "apparel", "wristband", "belt", "coat", "suit", "scarf",
      "glove", "sock", "hat", "bag", "shoes", "boot", "pant",
      "necklace", "ring", "earring",
    ],
  },

  // ─── Home & Kitchen ───────────────────────────────────────────────────────
  {
    slug: "home-kitchen",
    name: "Home & Kitchen",
    strong: [
      // Kitchen appliances — must be explicit to avoid false matches
      "air fryer",
      "deep fryer",
      "coffee maker", "coffee machine", "espresso machine", "drip coffee",
      "electric kettle",
      "convection oven", "baking oven", "toaster oven", "oven toaster",
      "bread toaster", "pop-up toaster",
      "sandwich maker", "sandwich press", "sandwich toaster",
      "waffle maker", "waffle iron",
      "rice cooker", "electric rice cooker",
      "pressure cooker",
      "slow cooker", "crockpot",
      "induction cooker", "induction stove", "induction cooktop",
      "hot plate", "electric stove", "electric hob",
      "egg boiler", "egg cooker",
      "food processor", "food chopper",
      "hand blender", "immersion blender",
      "juice extractor", "fruit juicer",
      "stand mixer", "hand mixer", "kitchen mixer",
      "food steamer", "steam cooker",
      "gas stove", "cooking range", "gas burner",
      "bbq grill", "electric grill", "grill machine",
      "popcorn maker",
      "yogurt maker",
      "ice cream maker",
      "humidifier",
      "air purifier",
      "aroma diffuser", "essential oil diffuser",
      // Cookware & utensils
      "cookware set", "non-stick pan", "nonstick pan", "frying pan",
      "cooking pot", "saucepan", "casserole dish",
      "wok pan",
      "dinner plate", "serving plate", "ceramic plate",
      "salad bowl", "mixing bowl", "serving bowl",
      "tea cup", "coffee mug",
      "cutlery set", "knife set", "kitchen knife",
      "spatula set", "cooking spatula",
      "chopping board", "cutting board",
      "colander", "strainer",
      "kitchen scale", "food scale", "weighing scale",
      "measuring spoon", "measuring cup",
      "tin opener", "bottle opener", "can opener",
      "vegetable peeler", "apple corer", "grater",
      "ice cube tray",
      "food storage container", "airtight container",
      // Fans — home fans only
      "ceiling fan", "exhaust fan", "pedestal fan",
      // Lighting — home lamps only
      "desk lamp", "floor lamp", "table lamp", "study lamp", "reading lamp",
      "night light", "bedside lamp",
      // Furniture & home
      "dining chair", "office chair",
      "dining table", "coffee table", "folding table", "study table",
      "side table", "end table",
      "bookshelf", "book shelf",
      "shoe rack",
      "clothes rack", "drying rack",
      "storage organizer", "storage box", "storage container",
      "pillow cover", "cushion cover",
      "window curtain", "door curtain",
      "floor carpet", "area rug",
      "bedsheet", "bed sheet", "duvet cover", "comforter", "quilt",
      "mattress topper",
      "sofa cover",
      "wardrobe organizer",
      "waste bin", "trash can", "dustbin",
      "mop set", "spin mop", "floor mop",
      "broom set", "sweeping brush",
      "dish soap", "washing liquid",
      "candle holder", "aroma candle",
      "flower vase", "artificial flower",
      "picture frame", "photo frame", "wall frame",
      "wall art", "wall decor", "decorative showpiece",
      "shower curtain",
      "toilet brush", "toilet cleaner",
      "toothbrush holder", "soap dispenser",
      "laundry basket", "clothes basket",
      // Pest & sealing
      "mosquito net", "mosquito mesh", "insect screen", "fly screen",
      "mousetrap", "rat trap", "pest trap",
      "door seal", "window seal", "weather strip",
      // Miscellaneous home
      "wall mount", "tv bracket", "tv stand",
      "suction cup holder",
      "corner protector", "furniture protector",
      "car blind spot mirror",
    ],
    weak: [
      "kitchen", "home", "cooking", "baking", "household", "indoor",
      "bathroom", "bedroom", "living room",
    ],
  },

  // ─── Beauty ───────────────────────────────────────────────────────────────
  {
    slug: "beauty",
    name: "Beauty",
    strong: [
      // Haircare
      "shampoo", "hair conditioner",
      "hair mask", "hair serum", "hair oil", "hair spray", "hair mist",
      "hair wax", "hair gel", "hair clay", "hair pomade",
      "hair dye", "hair color", "hair colour", "root touch",
      "dry shampoo",
      "hair dryer", "hair blower", "blow dryer",
      "hot air brush", "hair straightener", "straightening iron",
      "curling iron", "curling wand", "hair curler",
      "hair volumizer",
      "hair soap", "herbal hair soap",
      // Skincare
      "face wash", "facial cleanser", "foam cleanser",
      "face scrub", "facial scrub",
      "face mask", "facial mask", "clay mask", "peel off mask", "sheet mask",
      "mud mask", "charcoal mask", "blackhead mask",
      "moisturizer", "face moisturizer",
      "face cream", "night cream", "day cream",
      "eye cream", "under eye cream",
      "bb cream", "cc cream",
      "glow serum", "brightening serum", "vitamin c serum",
      "niacinamide serum", "hyaluronic serum", "retinol serum",
      "skin serum",
      "toner", "facial toner",
      "sunscreen", "sun block", "spf cream",
      "body lotion", "body butter", "body cream",
      "body wash", "shower gel",
      "exfoliating gel", "exfoliating scrub", "body exfoliator",
      "skin whitening", "whitening cream", "whitening serum",
      "dark spot corrector", "brightening cream",
      "de-tan", "tan removal", "anti-tan",
      "face pack", "mud pack", "skin pack",
      "collagen cream", "anti-aging cream",
      "blackhead remover", "pore strip", "pore cleanser",
      "skin polish", "face polish",
      "glycolic acid wash", "salicylic acid",
      // Body & hair removal
      "wax powder", "body wax", "waxing strip", "wax strip",
      "hair removal cream", "hair removal powder",
      "depilatory", "epilator",
      "shaving cream", "shaving gel", "aftershave",
      "electric shaver", "electric razor",
      // Makeup
      "lipstick", "lip gloss", "lip liner", "lip tint", "lip balm",
      "mascara", "eyeliner", "eyeshadow", "eyebrow pencil", "eye pencil",
      "foundation", "liquid foundation",
      "concealer", "color corrector",
      "face powder", "compact powder", "setting powder",
      "blush", "bronzer", "highlighter",
      "setting spray", "makeup fixer",
      "makeup primer",
      "nail polish", "nail art", "nail gel",
      "manicure set", "pedicure set", "mani pedi",
      // Fragrance
      "eau de parfum", "eau de toilette", "extrait de parfum",
      "perfume oil", "attar", "deodorant spray", "body spray", "deodorant",
      "antiperspirant",
      // Grooming & tools
      "trimmer", "hair trimmer", "beard trimmer", "nose trimmer",
      "shaver", "men shaver", "women shaver",
      "beard oil", "beard balm", "beard serum",
      "grooming kit",
      "eyelash extension", "false lashes", "lash kit", "lash glue",
      "eyelash serum",
      "eyebrow threading",
      "makeup brush", "foundation brush", "blending sponge",
      "makeup remover", "micellar water",
      // Body patches & slimming
      "belly patch", "slimming patch", "fat burning patch",
      "body wrap",
      // Intimate & hygiene
      "underarm pad", "sweat pad", "sweat absorber",
      "intimate wash", "feminine wash",
      "scar gel", "stretch mark cream",
      // Massage & device (face/neck/body beauty devices)
      "face massager", "face roller", "jade roller",
      "ems device", "ems massager", "microcurrent device",
      "face lift device", "neck massager device",
      "lice comb", "anti-lice",
    ],
    weak: [
      "beauty", "skin", "hair", "nail", "organic", "natural", "herbal",
      "grooming", "cosmetic", "serum", "cream", "mask", "lotion",
      "powder", "gel", "oil", "spray",
    ],
  },

  // ─── Sports ───────────────────────────────────────────────────────────────
  {
    slug: "sports",
    name: "Sports",
    strong: [
      // Equipment
      "dumbbell set", "barbell set", "weight plate", "kettlebell",
      "pull-up bar", "chin-up bar", "push-up board",
      "resistance band", "exercise band",
      "skipping rope", "jump rope",
      "yoga mat", "yoga block", "yoga strap",
      "foam roller",
      "massage gun", "percussion massager", "deep tissue massager",
      "hand gripper", "grip strengthener", "wrist strengthener",
      "ab roller", "sit-up bench",
      "gym gloves",
      // Cardio machines
      "treadmill", "elliptical machine", "exercise bike", "rowing machine",
      "mini bike pedal",
      // Sports by type
      "cricket bat", "cricket ball", "cricket kit", "cricket gloves",
      "football", "soccer ball",
      "basketball hoop",
      "badminton racket", "badminton set",
      "tennis racket", "tennis ball",
      "boxing gloves", "punching bag", "boxing set",
      "golf club", "golf set",
      "mountain bike", "road bike",
      "cycling helmet", "bike helmet",
      "skating shoes", "skateboard", "roller blade",
      "swim goggles", "swimming cap",
      "camping tent", "sleeping bag", "hiking backpack",
      // Supplements
      "whey protein", "protein powder", "creatine supplement",
      "pre-workout", "mass gainer",
    ],
    weak: [
      "sport", "sports", "fitness", "gym", "exercise", "workout",
      "training", "outdoor", "athletic", "running", "cycling",
      "swimming", "hiking", "camping",
    ],
  },

  // ─── Toys ─────────────────────────────────────────────────────────────────
  {
    slug: "toys",
    name: "Toys",
    strong: [
      "kids toy", "children toy", "baby toy", "toddler toy", "infant toy",
      "educational toy", "learning toy",
      "doll", "barbie doll",
      "action figure",
      "stuffed animal", "plush toy", "teddy bear",
      "rc car", "remote control car", "remote controlled car",
      "building blocks set", "lego set",
      "board game", "card game set", "chess set",
      "jigsaw puzzle",
      "fidget spinner", "fidget toy",
      "slime kit",
      "play doh", "playdough",
      "water gun", "nerf gun", "foam blaster",
      "kite",
      "kids bicycle", "balance bike", "tricycle",
      "toy kitchen", "toy doctor", "toy tools",
      "musical toy", "kids instrument",
    ],
    weak: [
      "toy", "kids", "children", "baby", "infant", "toddler",
      "newborn", "play", "cartoon", "anime", "game", "puzzle",
    ],
  },
];

// ---------------------------------------------------------------------------
// Pre-compile all matchers once at module load
// ---------------------------------------------------------------------------

const CATEGORIES = _CATEGORIES.map((cat) => ({
  ...cat,
  _strongMatchers: buildMatchers(cat.strong),
  _weakMatchers:   buildMatchers(cat.weak),
}));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a product into one of the 6 storefront categories.
 *
 * The product name is weighted 3× relative to the description — the name is
 * the true signal; descriptions are often long and noisy. We score them
 * separately and combine: nameScore×3 + descScore×1.
 *
 * @param {string} name        Product name
 * @param {string} description Product description (may be empty)
 * @returns {string} Category display name, e.g. "Home & Kitchen"
 */
function categorizeProduct(name = "", description = "") {
  const nameText = (name || "").toLowerCase();
  const descText = (description || "").toLowerCase();

  let best     = null;
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    let nameScore = 0;
    let descScore = 0;

    for (const match of cat._strongMatchers) {
      if (match(nameText)) nameScore += 3;
      if (descText && match(descText)) descScore += 3;
    }
    for (const match of cat._weakMatchers) {
      if (match(nameText)) nameScore += 1;
      if (descText && match(descText)) descScore += 1;
    }

    // Name is weighted 3× — a clear name signal beats a noisy description
    const total = nameScore * 3 + descScore;

    if (total > bestScore) {
      bestScore = total;
      best = cat;
    }
  }

  return best ? best.name : "Uncategorized";
}

module.exports = { CATEGORIES: _CATEGORIES, categorizeProduct };
