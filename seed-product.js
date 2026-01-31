// =======================
// DUMMY PRODUCTS SEEDER
// =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config
// Do NOT check API keys into source. Set `window.FIREBASE_API_KEY` at runtime or replace during build.
const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || "REDACTED",
  authDomain: "swadeshi-b73c1.firebaseapp.com",
  projectId: "swadeshi-b73c1",
  storageBucket: "swadeshi-b73c1.appspot.com",
  messagingSenderId: "976631330768",
  appId: "1:976631330768:web:addc77ae3062dee1a9abd5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dummyProducts = [
  {
    name: "Handmade Terracotta Pot",
    category: "Pottery",
    price: 350,
    stock: 12,
    description: "Eco-friendly terracotta planter ideal for indoor plants.",
    images: ["https://i.imgur.com/OFvVhZD.jpeg"],
    sellerId: "dummySeller1"
  },
  {
    name: "Traditional Banarasi Saree",
    category: "Saree",
    price: 1200,
    stock: 5,
    description: "Pure banarasi handloom saree with golden zari work.",
    images: ["https://i.imgur.com/Ja0QqgP.jpeg"],
    sellerId: "dummySeller2"
  },
  {
    name: "Wooden Hand-Carved Ganesha",
    category: "Toys",
    price: 650,
    stock: 8,
    description: "Premium wooden carved idol made by rural artisans.",
    images: ["https://i.imgur.com/9qU2P5f.jpeg"],
    sellerId: "dummySeller3"
  },
  {
    name: "Handmade Jute Basket",
    category: "Other",
    price: 280,
    stock: 15,
    description: "Strong jute basket for multipurpose use.",
    images: ["https://i.imgur.com/nYIjb0H.jpeg"],
    sellerId: "dummySeller1"
  }
];

async function seedProducts() {
  for (let p of dummyProducts) {
    const docRef = await addDoc(collection(db, "products"), {
      ...p,
      createdAt: serverTimestamp()
    });
    console.log(`Added product with id: ${docRef.id}`);
  }
  console.log("All dummy products added!");
}

seedProducts();
