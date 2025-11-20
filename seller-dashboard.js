// seller-dashboard.js
// Fully reworked and debugged seller dashboard logic

// ---------- Firebase imports (v10.x) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ---------- Config (use your project config) ----------
const firebaseConfig = {
  apiKey: "AIzaSyAs8Ee4DFiPXq3o8UgCgrLFKmLECmxiuyc",
  authDomain: "swadeshi-b73c1.firebaseapp.com",
  projectId: "swadeshi-b73c1",
  storageBucket: "swadeshi-b73c1.appspot.com",
  messagingSenderId: "976631330768",
  appId: "1:976631330768:web:addc77ae3062dee1a9abd5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const log = (...args) => console.log("[seller-dashboard]", ...args);
const toast = (msg, timeout = 2500) => {
  const el = $('toast');
  if (!el) { console.warn("Toast element missing:", msg); return; }
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(()=> el.classList.add('hidden'), timeout);
};

// graceful null-check helper
const exists = (el) => el !== null && el !== undefined;

// ---------- UI elements safety checks ----------
if (!exists($('productsGrid'))) log("Warning: productsGrid element not found.");
if (!exists($('addProductForm'))) log("Warning: addProductForm element not found.");
if (!exists($('btn-signout'))) log("Warning: signout button not found.");

// ---------- State ----------
let currentUser = null;
let sellerProfile = null;
let editingProductId = null;

// ---------- Auth state & role check ----------
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      log("No logged-in user. Redirecting to login.");
      window.location.href = "login.html";
      return;
    }

    currentUser = user;
    log("Logged in user:", user.uid, user.email);

    // Check user's role from users collection
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      console.warn("users doc missing for uid:", user.uid);
      // You might choose to create the users doc here - but we'll redirect to login for safety
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }

    const role = userSnap.data().role;
    log("User role:", role);

    if (role !== "seller") {
      log("User not a seller; redirecting to index.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    // Load seller profile (sellers collection)
    const sellerRef = doc(db, "sellers", user.uid);
    const sellerSnap = await getDoc(sellerRef);
    if (sellerSnap.exists()) {
      sellerProfile = sellerSnap.data();
    } else {
      // create a minimal seller doc if missing (merge)
      sellerProfile = {
        name: user.displayName || "Seller",
        shopName: sellerProfile?.shopName || "",
        phone: sellerProfile?.phone || "",
        state: sellerProfile?.state || ""
      };
      await setDoc(sellerRef, sellerProfile, { merge: true });
    }

    // update UI
    $('seller-name').textContent = sellerProfile.name || (user.displayName || "Seller");
    $('seller-shop').textContent = sellerProfile.shopName || "";
    $('seller-avatar').textContent = (sellerProfile.name || user.displayName || "S").slice(0,1).toUpperCase();

    // populate profile form
    fillProfileForm();

    // load data
    await loadProducts();
    await loadOrders();
    await computeStats();
  } catch (err) {
    console.error("onAuthStateChanged error:", err);
    toast("Auth/initialization error — check console.");
  }
});

// ---------- Fill profile form ----------
function fillProfileForm() {
  try {
    $('profileName').value = sellerProfile?.name || currentUser.displayName || "";
    $('profileEmail').value = currentUser.email || "";
    $('profilePhone').value = sellerProfile?.phone || "";
    $('profilePehchan').value = sellerProfile?.pehchan || "";
    $('profileShop').value = sellerProfile?.shopName || "";
    $('profileState').value = sellerProfile?.state || "";
  } catch (err) {
    console.warn("fillProfileForm error:", err);
  }
}

// ---------- Tab switching ----------
const tabBtns = Array.from(document.querySelectorAll('.tab-btn') || []);
const tabPanels = Array.from(document.querySelectorAll('.tab-panel') || []);
function showTab(name) {
  tabPanels.forEach(panel => {
    panel.id === `tab-${name}` ? panel.classList.remove('hidden') : panel.classList.add('hidden');
  });
  tabBtns.forEach(b => b.dataset.tab === name ? b.classList.add('bg-[var(--accent)]','bg-opacity-10') : b.classList.remove('bg-[var(--accent)]','bg-opacity-10'));
}
tabBtns.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
showTab('overview'); // default

// ---------- Add product (form submit) ----------
if (exists($('addProductForm'))) {
  $('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      if (!currentUser) { toast("Not authenticated"); return; }

      const name = $('prodName').value.trim();
      const category = $('prodCategory').value;
      const price = Number($('prodPrice').value || 0);
      const stock = Number($('prodStock').value || 0);
      const description = $('prodDesc').value.trim();
      const files = $('prodImages').files;

      if (!name || !price || !stock) {
        toast("Please complete required fields");
        return;
      }

      if (!files || files.length === 0) {
        toast("Please upload at least one image");
        return;
      }

      $('add-status').textContent = "Uploading images...";
      // upload images
      const urls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `products/${currentUser.uid}/${Date.now()}_${i}_${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadSnap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(uploadSnap.ref);
        urls.push(url);
      }

      $('add-status').textContent = "Saving product...";
      const product = {
        sellerId: currentUser.uid,
        name,
        category,
        price,
        stock,
        description,
        images: urls,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "products"), product);

      // reset form + refresh
      $('addProductForm').reset();
      $('add-status').textContent = "";
      toast("Product listed");
      await loadProducts();
      await computeStats();

    } catch (err) {
      console.error("Add product error:", err);
      $('add-status').textContent = "";
      toast("Failed to add product — see console");
    }
  });
} else {
  log("addProductForm not present in DOM");
}

// ---------- Load My Products ----------
async function loadProducts() {
  try {
    $('productsGrid').innerHTML = '<p class="text-gray-500">Loading products...</p>';
    const q = query(collection(db, "products"), where("sellerId", "==", currentUser.uid), orderBy("createdAt","desc"));
    const snap = await getDocs(q);

    $('productsGrid').innerHTML = '';
    $('stat-products').textContent = snap.size;

    if (snap.empty) {
      $('productsGrid').innerHTML = '<p class="text-gray-600">No products yet.</p>';
      return;
    }

    snap.forEach(d => {
      const p = d.data();
      const id = d.id;
      const img = (p.images && p.images.length) ? p.images[0] : 'https://via.placeholder.com/300x200?text=No+Image';
      const el = document.createElement('div');
      el.className = 'p-4 border rounded-xl flex gap-4';
      el.innerHTML = `
        <img src="${img}" class="w-28 h-28 object-cover rounded-xl" alt="${escapeHtml(p.name)}" />
        <div class="flex-1">
          <h4 class="font-bold">${escapeHtml(p.name)}</h4>
          <p class="text-sm text-gray-600 mt-1">${escapeHtml(p.description || '')}</p>
          <div class="mt-3 flex items-center justify-between">
            <div><span class="text-[var(--primary)] font-bold">₹${escapeHtml(String(p.price || 0))}</span>
              <span class="text-sm text-gray-500 ml-3">Stock: ${escapeHtml(String(p.stock || 0))}</span>
            </div>
            <div class="flex gap-2">
              <button data-id="${id}" class="edit-btn px-3 py-1 rounded-full border">Edit</button>
              <button data-id="${id}" class="delete-btn px-3 py-1 rounded-full bg-red-500 text-white">Delete</button>
            </div>
          </div>
        </div>
      `;
      $('productsGrid').appendChild(el);
    });

    // attach handlers
    document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', async (ev) => {
      const id = ev.currentTarget.dataset.id;
      if (!confirm("Delete this product?")) return;
      try {
        await deleteDoc(doc(db, "products", id));
        toast("Deleted");
        await loadProducts();
        await computeStats();
      } catch (err) {
        console.error("Delete error:", err);
        toast("Delete failed");
      }
    }));

    document.querySelectorAll('.edit-btn').forEach(b => {
      b.addEventListener('click', ev => openEditModal(ev.currentTarget.dataset.id));
    });

  } catch (err) {
    console.error("loadProducts error:", err);
    $('productsGrid').innerHTML = '<p class="text-red-600">Failed to load products.</p>';
  }
}

// ---------- Open Edit Modal ----------
async function openEditModal(productId) {
  try {
    const snap = await getDoc(doc(db, "products", productId));
    if (!snap.exists()) { toast("Product not found"); return; }
    const p = snap.data();
    editingProductId = productId;
    $('editName').value = p.name || '';
    $('editPrice').value = p.price || 0;
    $('editStock').value = p.stock || 0;
    $('editDesc').value = p.description || '';
    $('edit-modal').classList.remove('hidden');
  } catch (err) {
    console.error("openEditModal error:", err);
    toast("Could not open editor");
  }
}

// ---------- Edit form submit ----------
if (exists($('editForm'))) {
  $('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingProductId) { toast("No product selected"); return; }

    try {
      const name = $('editName').value.trim();
      const price = Number($('editPrice').value || 0);
      const stock = Number($('editStock').value || 0);
      const description = $('editDesc').value.trim();
      const files = $('editImages').files;

      const updateData = { name, price, stock, description };

      if (files && files.length > 0) {
        // upload new images and append
        const urls = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const path = `products/${currentUser.uid}/${Date.now()}_${i}_${file.name}`;
          const snap = await uploadBytes(storageRef(storage, path), file);
          const url = await getDownloadURL(snap.ref);
          urls.push(url);
        }

        // merge with existing images list
        const pSnap = await getDoc(doc(db, "products", editingProductId));
        const existing = pSnap.exists() ? (pSnap.data().images || []) : [];
        updateData.images = existing.concat(urls);
      }

      await updateDoc(doc(db, "products", editingProductId), updateData);
      $('edit-modal').classList.add('hidden');
      toast("Product updated");
      await loadProducts();
    } catch (err) {
      console.error("edit save error:", err);
      toast("Update failed");
    }
  });

  $('editCancel').addEventListener('click', () => $('edit-modal').classList.add('hidden'));
}

// ---------- Load Orders ----------
async function loadOrders() {
  try {
    $('ordersList').innerHTML = '<p class="text-gray-500">Loading orders...</p>';
    const q = query(collection(db, "orders"), where("sellerId", "==", currentUser.uid), orderBy("date","desc"));
    const snap = await getDocs(q);
    $('ordersList').innerHTML = '';
    if (snap.empty) {
      $('ordersList').innerHTML = '<p class="text-gray-600">No orders yet.</p>';
      $('stat-orders').textContent = '0';
      $('stat-sales').textContent = '0';
      return;
    }

    let totalSales = 0;
    snap.forEach(d => {
      const o = d.data();
      totalSales += Number(o.totalAmount || 0);
      const card = document.createElement('div');
      card.className = 'p-4 border rounded-xl';
      card.innerHTML = `
        <div class="flex justify-between">
          <div>
            <p class="font-semibold">${escapeHtml(o.productName || 'Order')}</p>
            <p class="text-sm text-gray-600">${escapeHtml(o.customerName || o.customerId || '')} • ${o.date ? new Date(o.date).toLocaleString() : ''}</p>
            <p class="mt-2">Qty: ${escapeHtml(String(o.quantity || 1))}</p>
          </div>
          <div class="text-right">
            <p class="font-bold text-[var(--primary)]">₹${escapeHtml(String(o.totalAmount || 0))}</p>
            <p class="text-sm text-gray-500">${escapeHtml(o.orderStatus || '')}</p>
          </div>
        </div>`;
      $('ordersList').appendChild(card);
    });

    $('stat-orders').textContent = String(snap.size);
    $('stat-sales').textContent = String(totalSales);

  } catch (err) {
    console.error("loadOrders error:", err);
    $('ordersList').innerHTML = '<p class="text-red-600">Failed to load orders.</p>';
  }
}

// ---------- Compute Stats (fallback) ----------
async function computeStats() {
  try {
    // products count already set in loadProducts
    // recompute sales/orders if needed
    const q = query(collection(db, "orders"), where("sellerId", "==", currentUser.uid));
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach(d => total += Number(d.data().totalAmount || 0));
    $('stat-sales').textContent = String(total);
    $('stat-orders').textContent = String(snap.size);
  } catch (err) {
    console.warn("computeStats error:", err);
  }
}

// ---------- Profile save (updates Auth + Firestore merged) ----------
if (exists($('btn-save-profile'))) {
  $('btn-save-profile').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const newName = $('profileName').value.trim();
      const phone = $('profilePhone').value.trim();
      const pehchan = $('profilePehchan').value.trim();
      const shopName = $('profileShop').value.trim();
      const state = $('profileState').value;

      // update auth profile displayName
      if (newName && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newName });
      }

      // update sellers doc (merge)
      const sellerRef = doc(db, "sellers", currentUser.uid);
      await setDoc(sellerRef, {
        name: newName,
        phone,
        pehchan,
        shopName,
        state,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // also update users collection name (merge)
      await setDoc(doc(db, "users", currentUser.uid), { name: newName }, { merge: true });

      // update UI
      $('seller-name').textContent = newName;
      $('seller-avatar').textContent = newName.charAt(0).toUpperCase();
      toast("Profile updated");
    } catch (err) {
      console.error("save profile error:", err);
      toast("Failed to save profile — see console");
    }
  });
}

// ---------- Sign out ----------
if (exists($('btn-signout'))) {
  $('btn-signout').addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (err) {
      console.error("signout error:", err);
      toast("Sign out failed");
    }
  });
}

// ---------- Escape helper ----------
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;');
}

// ---------- End of file ----------
log("seller-dashboard.js loaded");
