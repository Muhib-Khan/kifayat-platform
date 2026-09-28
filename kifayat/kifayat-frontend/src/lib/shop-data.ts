import h from "@/assets/p-headphones.jpg";
import w from "@/assets/p-watch.jpg";
import s from "@/assets/p-sneakers.jpg";
import se from "@/assets/p-serum.jpg";
import el from "@/assets/cat-electronics.jpg";
import fa from "@/assets/cat-fashion.jpg";
import ho from "@/assets/cat-home.jpg";
import be from "@/assets/cat-beauty.jpg";

export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  badge?: string;
  category: string;
  brand: string;
  stock: number;
  description: string;
  features: string[];
};

export type Category = {
  slug: string;
  name: string;
  image: string;
  count: number;
};

export const categories: Category[] = [
  { slug: "electronics", name: "Electronics", image: el, count: 1240 },
  { slug: "fashion", name: "Fashion", image: fa, count: 2800 },
  { slug: "home-kitchen", name: "Home & Kitchen", image: ho, count: 960 },
  { slug: "beauty", name: "Beauty", image: be, count: 740 },
  { slug: "sports", name: "Sports", image: el, count: 410 },
  { slug: "toys", name: "Toys", image: fa, count: 280 },
];

const base: Omit<Product, "id" | "slug">[] = [
  { name: "Wireless Over-Ear Headphones", price: 4499, oldPrice: 6999, rating: 4.7, reviews: 218, image: h, badge: "−35%", category: "electronics", brand: "SoundPro", stock: 24, description: "Premium over-ear headphones with active noise cancellation, 40-hour battery life and plush memory-foam ear cushions for all-day comfort.", features: ["Active noise cancellation", "40-hour battery", "Bluetooth 5.3", "Foldable design", "Built-in mic"] },
  { name: "Classic Steel Smartwatch", price: 7899, oldPrice: 10999, rating: 4.6, reviews: 142, image: w, badge: "New", category: "electronics", brand: "Chronos", stock: 12, description: "Elegant stainless steel smartwatch with always-on AMOLED display, heart-rate tracking, and 14-day standby battery.", features: ["AMOLED display", "Heart-rate sensor", "Water resistant 5ATM", "14-day battery", "60+ workout modes"] },
  { name: "Minimal White Sneakers", price: 3299, oldPrice: 4499, rating: 4.8, reviews: 384, image: s, badge: "Bestseller", category: "fashion", brand: "Stride", stock: 50, description: "Clean, versatile low-top sneakers crafted from full-grain leather with a cushioned EVA sole.", features: ["Full-grain leather", "EVA cushioned sole", "Breathable lining", "Unisex sizing"] },
  { name: "Vitamin C Glow Serum 30ml", price: 1499, oldPrice: 1999, rating: 4.5, reviews: 96, image: se, category: "beauty", brand: "Lumière", stock: 80, description: "Brightening serum with 15% Vitamin C, hyaluronic acid and ferulic acid for a visibly radiant complexion.", features: ["15% Vitamin C", "Hyaluronic acid", "Cruelty-free", "Dermatologist tested"] },
  { name: "Fast Charging USB-C Cable 2m", price: 599, oldPrice: 899, rating: 4.6, reviews: 512, image: el, category: "electronics", brand: "Volt", stock: 200, description: "Nylon-braided 60W USB-C cable rated for 10,000+ bend cycles.", features: ["60W fast charge", "Nylon braided", "2m length", "1-year warranty"] },
  { name: "Ceramic Mug Set of 4", price: 1899, rating: 4.7, reviews: 73, image: ho, category: "home-kitchen", brand: "Hearth", stock: 35, description: "Hand-glazed stoneware mugs, microwave and dishwasher safe.", features: ["Stoneware", "350ml each", "Dishwasher safe", "Set of 4"] },
  { name: "Premium Cotton Crew Tee", price: 1299, oldPrice: 1799, rating: 4.4, reviews: 210, image: fa, category: "fashion", brand: "Everyday", stock: 120, description: "Garment-dyed heavyweight cotton tee with a relaxed boxy fit.", features: ["240gsm cotton", "Pre-shrunk", "Relaxed fit", "5 colors"] },
  { name: "Aromatic Hair Oil 100ml", price: 999, rating: 4.5, reviews: 64, image: be, category: "beauty", brand: "Lumière", stock: 60, description: "Argan + rosemary nourishing hair oil for shine and scalp health.", features: ["Argan oil", "Rosemary extract", "Paraben-free", "100ml"] },
];

export const products: Product[] = base.map((p, i) => ({
  ...p,
  id: `KFY-${1000 + i}`,
  slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  images: [p.image, p.image, p.image, p.image],
}));

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const productsByCategory = (slug: string) => products.filter((p) => p.category === slug);
