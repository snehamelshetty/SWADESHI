/*  
==========================================================
  SWADESHI • SELLER DASHBOARD JAVASCRIPT
  DEBUG-ENABLED VERSION — EXACT ERROR MESSAGES
==========================================================
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore, collection, addDoc, doc, setDoc, getDocs,
  query, where, orderBy, updateDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";


// ----------------------------------------------------------
// FIREBASE CONFIG
// ----------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAs8Ee4DFiPXq3o8UgCgrLFKmLECmxiuyc",
  authDomain: "swadeshi-b73c1.firebaseapp.com",
  projectId: "swadeshi-b73c1",
  storageBucket: "swadeshi-b73c1.appspot.com",
  messagingSenderId: "976631330768",
  appId: "1:976631330768:web:addc77ae3062dee1a9abd5"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);



// ----------------------------------------------------------
// BASIC DOM HELPERS
// ----------------------------------------------------------
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}



// ----------------------------------------------------------
// DEBUG FUNCTION
// ----------------------------------------------------------
function debug(message) {
  console.warn(`DEBUG: ${message}`);
  toast(message);
}



// ----------------------------------------------------------
// AUTH PROTECTION + DEBUG
// ----------------------------------------------------------
let currentUser = null;

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    debug("No user logged in → redirecting to login.");
    return location.href = "login.html";
  }

  currentUser = user;
  debug(`Logged in as: ${user.email}`);

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));

    // USER DOCUMENT CHECK
    if (!userSnap.exists()) {
      debug("ERROR: User Firestore document DOES NOT EXIST.");
      debug("Fix: Create users/UID document during registration.");
      await signOut(auth);
      return location.href = "login.html";
    }

    const userDoc = userSnap.data();
    debug("User Firestore document loaded.");

    // ROLE CHECK
    if (userDoc.role !== "seller") {
      debug(`ERROR: User role = ${userDoc.role}. Seller account required.`);
      await signOut(auth);
      return (location.href = "index.html");
    }

    debug("User role = seller ✔");

    // Load seller profile
    await loadSellerProfile();

    // Load dashboard modules
    await loadProducts();
    await loadOrders();
    await computeStats();

  } catch (err) {
    debug("FIRESTORE ERROR: " + err.message);
    await signOut(auth);
    return location.href = "login.html";
  }

});


// ----------------------------------------------------------
// LOAD SELLER PROFILE
// ----------------------------------------------------------
async function loadSellerProfile() {

  const sellerSnap = await getDoc(doc(db, "sellers", currentUser.uid));

  if (!sellerSnap.exists()) {
    debug("Seller profile missing → creating empty profile.");

    const newProfile = {
      uid: currentUser.uid,
      name: currentUser.displayName || "Seller",
      email: currentUser.email,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "sellers", currentUser.uid), newProfile);
  }

  const data = sellerSnap.data();
  $("seller-name").textContent = data.name;
  $("seller-shop").textContent = data.shopName || "";
  $("seller-avatar").textContent = data.name[0].toUpperCase();
}



// ----------------------------------------------------------
// SIGN OUT
// ----------------------------------------------------------
$("btn-signout").onclick = async () => {
  await signOut(auth);
  location.href = "login.html";
};



// ----------------------------------------------------------
// LOAD PRODUCTS
// ----------------------------------------------------------
async function loadProducts() {
  $("productsGrid").innerHTML = "Loading...";

  const q = query(
    collection(db, "products"),
    where("sellerId", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    $("productsGrid").innerHTML = "<p>No products found.</p>";
    return;
  }

  $("productsGrid").innerHTML = "";

  snap.forEach((docSnap) => {
    const p = docSnap.data();
    const id = docSnap.id;

    const card = document.createElement("div");
    card.className = "p-4 border rounded-lg";

    card.innerHTML = `
      <h3 class="font-bold">${p.name}</h3>
      <p>₹${p.price}</p>
      <button class="editBtn bg-yellow-500 text-white px-3 py-1 rounded" data-id="${id}">
        Edit
      </button>
      <button class="deleteBtn bg-red-600 text-white px-3 py-1 rounded" data-id="${id}">
        Delete
      </button>
    `;

    $("productsGrid").appendChild(card);
  });
}



// ----------------------------------------------------------
// LOAD ORDERS
// ----------------------------------------------------------
async function loadOrders() {
  $("ordersList").innerHTML = "Loading orders...";

  const q = query(
    collection(db, "orders"),
    where("sellerId", "==", currentUser.uid)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    $("ordersList").innerHTML = "<p>No orders found.</p>";
    return;
  }

  $("ordersList").innerHTML = "";

  snap.forEach((d) => {
    const o = d.data();
    const el = document.createElement("div");
    el.className = "border p-3 rounded-lg";

    el.innerHTML = `
      <p>Order #${d.id}</p>
      <p>${o.productName}</p>
      <p>Qty: ${o.quantity}</p>
      <p>₹${o.totalAmount}</p>
    `;

    $("ordersList").appendChild(el);
  });
}



// ----------------------------------------------------------
// COMPUTE STATS
// ----------------------------------------------------------
async function computeStats() {
  let sales = 0;

  const q = query(
    collection(db, "orders"),
    where("sellerId", "==", currentUser.uid)
  );

  const snap = await getDocs(q);

  snap.forEach(d => sales += Number(d.data().totalAmount || 0));

  $("stat-orders").textContent = snap.size;
  $("stat-sales").textContent = sales;
}



// ----------------------------------------------------------
// FINAL LOG
// ----------------------------------------------------------
debug("Seller Dashboard JS loaded successfully.");
