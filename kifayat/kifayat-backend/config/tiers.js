const TIERS = {
  bronze: {
    label: "Bronze",
    emoji: "🥉",
    minOrders: 0,
    minSpent: 0,
    color: "#CD7F32",
    bgGrad: "from-amber-700/20 to-amber-900/10",
    borderGrad: "amber-700/30",
    perks: [
      { icon: "Package", label: "Standard order processing" },
    ],
  },
  silver: {
    label: "Silver",
    emoji: "🥈",
    minOrders: 3,
    minSpent: 5000,
    color: "#A8A8A8",
    bgGrad: "from-gray-400/20 to-gray-500/10",
    borderGrad: "gray-400/30",
    perks: [
      { icon: "Zap", label: "Priority order processing" },
      { icon: "Truck", label: "Flat delivery — cheapest in Pakistan" },
      { icon: "ShieldCheck", label: "Exclusive Silver badge" },
    ],
  },
  gold: {
    label: "Gold",
    emoji: "🥇",
    minOrders: 10,
    minSpent: 25000,
    color: "#FFD700",
    bgGrad: "from-yellow-500/20 to-yellow-600/10",
    borderGrad: "yellow-500/30",
    perks: [
      { icon: "Zap", label: "VIP order processing" },
      { icon: "Truck", label: "Flat delivery — cheapest in Pakistan" },
      { icon: "Star", label: "Early access to new products" },
      { icon: "Gift", label: "Birthday surprise" },
      { icon: "ShieldCheck", label: "Exclusive Gold badge" },
    ],
  },
  platinum: {
    label: "Platinum",
    emoji: "💎",
    minOrders: 25,
    minSpent: 75000,
    color: "#E5E4E2",
    bgGrad: "from-purple-400/20 to-purple-600/10",
    borderGrad: "purple-400/30",
    perks: [
      { icon: "Zap", label: "Personal concierge support" },
      { icon: "Truck", label: "Flat delivery — cheapest in Pakistan" },
      { icon: "Star", label: "Early access to new products" },
      { icon: "Gift", label: "Birthday surprise" },
      { icon: "Timer", label: "Fastest processing priority" },
      { icon: "ShieldCheck", label: "Exclusive Platinum badge" },
      { icon: "Calendar", label: "Invite to exclusive events" },
    ],
  },
};

function getTier(orders, spent) {
  if (orders >= 25 || spent >= 75000) return "platinum";
  if (orders >= 10 || spent >= 25000) return "gold";
  if (orders >= 3 || spent >= 5000) return "silver";
  return "bronze";
}

module.exports = { TIERS, getTier };
