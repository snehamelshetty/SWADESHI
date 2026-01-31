// seller-dashboard.js (FIXED)
// Use <script type="module" src="seller-dashboard.js"></script> in your HTML

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
      log("No logged-in user. Staying on dashboard (read-only mode).");
      toast(i18n.t("seller.not_logged_in"));
      return;
    }

    currentUser = user;
    log("Logged in user:", user.uid, user.email);

    // Check user's role from users collection
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      console.warn("users doc missing for uid:", user.uid);
      await signOut(auth);
      toast(i18n.t("seller.account_missing"));
      return;
    }

    const role = userSnap.data().role;
    log("User role:", role);

    if (role !== "seller") {
      log("User not a seller; redirecting to home.");
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
        shopName: "",
        phone: "",
        state: ""
      };
      await setDoc(sellerRef, sellerProfile, { merge: true });
    }

    // update UI (guarded)
    if (exists($('seller-name'))) $('seller-name').textContent = sellerProfile.name || (user.displayName || "Seller");
    if (exists($('seller-shop'))) $('seller-shop').textContent = sellerProfile.shopName || "";
    if (exists($('seller-avatar'))) $('seller-avatar').textContent = (sellerProfile.name || user.displayName || "S").slice(0,1).toUpperCase();

    // populate profile form
    fillProfileForm();

    // load data
    await loadProducts();
    await loadOrders();
    await computeStats();
  } catch (err) {
    console.error("onAuthStateChanged error:", err);
      toast(i18n.t("seller.auth_error"));
  }
});

// ---------- Fill profile form ----------
function fillProfileForm() {
  try {
    if (exists($('profileName'))) $('profileName').value = sellerProfile?.name || currentUser.displayName || "";
    if (exists($('profileEmail'))) $('profileEmail').value = currentUser.email || "";
    if (exists($('profilePhone'))) $('profilePhone').value = sellerProfile?.phone || "";
    if (exists($('profilePehchan'))) $('profilePehchan').value = sellerProfile?.pehchan || "";
    if (exists($('profileShop'))) $('profileShop').value = sellerProfile?.shopName || "";
    if (exists($('profileState'))) $('profileState').value = sellerProfile?.state || "";
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
      if (!currentUser) { toast(i18n.t("seller.not_authenticated")); return; }

      const name = $('prodName') ? $('prodName').value.trim() : "";
      const category = $('prodCategory') ? $('prodCategory').value : "";
      const price = $('prodPrice' ) ? Number($('prodPrice').value || 0) : 0;
      const stock = $('prodStock') ? Number($('prodStock').value || 0) : 0;
      const description = $('prodDesc') ? $('prodDesc').value.trim() : "";
      const files = $('prodImages') ? $('prodImages').files : null;

      if (!name || !price || !stock) {
        toast(i18n.t("seller.fill_required"));
        return;
      }

      if (!files || files.length === 0) {
        toast(i18n.t("seller.upload_required"));
        return;
      }

      if (exists($('add-status'))) $('add-status').textContent = i18n.t('status.uploading');
      // upload images
      const urls = [];
      for (let i = 0; i < files.length; i++) {
        let fileToUpload;

        // If AI enhanced image exists -> prefer it (single enhanced image)
        // window.enhancedImageForUpload may be:
        // - a data URL (data:image/...)
        // - an HTTP(S) URL (Cloudinary or other)
        // - if it's set, we upload it once and reuse for subsequent images (so we don't upload same enhanced many times)
        if (window.enhancedImageForUpload) {
          // If enhancedImageForUpload is a data URL or an http URL, convert to Blob
          try {
            if (window.enhancedImageForUpload.startsWith('data:')) {
              fileToUpload = dataURLtoFile(window.enhancedImageForUpload, `enhanced_${Date.now()}.jpg`);
            } else {
              // remote URL - fetch blob
              const resp = await fetch(window.enhancedImageForUpload);
              const blob = await resp.blob();
              fileToUpload = new File([blob], `enhanced_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
            }
          } catch (err) {
            console.warn("Failed to prepare enhanced image for upload, falling back to original file", err);
            fileToUpload = files[i];
          }
        } else {
          // Fallback: original file
          fileToUpload = files[i];
        }

        // Upload to Firebase Storage
        const path = `products/${currentUser.uid}/${Date.now()}_${i}_${fileToUpload.name}`;
        const sRef = storageRef(storage, path);
        const uploadSnap = await uploadBytes(sRef, fileToUpload);
        const url = await getDownloadURL(uploadSnap.ref);
        urls.push(url);
      }

      if (exists($('add-status'))) $('add-status').textContent = "Saving product...";
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
      if (exists($('addProductForm'))) $('addProductForm').reset();
      // clear enhancer state
      window.enhancedImageForUpload = null;
      if (exists($('add-status'))) $('add-status').textContent = "";
      toast(i18n.t("seller.product_listed"));
      await loadProducts();
      await computeStats();

    } catch (err) {
      console.error("Add product error:", err);
      if (exists($('add-status'))) $('add-status').textContent = "";
      toast(i18n.t("seller.failed_add"));
    }
  });
} else {
  log("addProductForm not present in DOM");
}

// helper: convert dataURL to File
function dataURLtoFile(dataurl, filename) {
  // dataurl like "data:image/jpeg;base64,...."
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// ---------- Load My Products ----------
async function loadProducts() {
  try {
    if (exists($('productsGrid'))) $('productsGrid').innerHTML = '<p class="text-gray-500">Loading products...</p>';
    const q = query(collection(db, "products"), where("sellerId", "==", currentUser.uid), orderBy("createdAt","desc"));
    const snap = await getDocs(q);

    if (exists($('productsGrid'))) $('productsGrid').innerHTML = '';
    if (exists($('stat-products'))) $('stat-products').textContent = snap.size;

    if (snap.empty) {
      if (exists($('productsGrid'))) $('productsGrid').innerHTML = '<p class="text-gray-600">No products yet.</p>';
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
      if (exists($('productsGrid'))) $('productsGrid').appendChild(el);
    });

    // attach handlers
    document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', async (ev) => {
      const id = ev.currentTarget.dataset.id;
      if (!confirm("Delete this product?")) return;
      try {
        await deleteDoc(doc(db, "products", id));
        toast(i18n.t("seller.deleted"));
        await loadProducts();
        await computeStats();
      } catch (err) {
        console.error("Delete error:", err);
        toast(i18n.t("seller.delete_failed"));
      }
    }));

    document.querySelectorAll('.edit-btn').forEach(b => {
      b.addEventListener('click', ev => openEditModal(ev.currentTarget.dataset.id));
    });

  } catch (err) {
    console.error("loadProducts error:", err);
    if (exists($('productsGrid'))) $('productsGrid').innerHTML = '<p class="text-red-600">Failed to load products.</p>';
  }
}

// ---------- Open Edit Modal ----------
async function openEditModal(productId) {
  try {
    const snap = await getDoc(doc(db, "products", productId));
    if (!snap.exists()) { toast(i18n.t("misc.product_not_found")); return; }
    const p = snap.data();
    editingProductId = productId;
    if (exists($('editName'))) $('editName').value = p.name || '';
    if (exists($('editPrice'))) $('editPrice').value = p.price || 0;
    if (exists($('editStock'))) $('editStock').value = p.stock || 0;
    if (exists($('editDesc'))) $('editDesc').value = p.description || '';
    if (exists($('edit-modal'))) $('edit-modal').classList.remove('hidden');
  } catch (err) {
    console.error("openEditModal error:", err);
    toast(i18n.t("seller.could_not_open"));
  }
}

// ---------- Edit form submit ----------
if (exists($('editForm'))) {
  $('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingProductId) { toast(i18n.t("seller.no_product_selected")); return; }

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
      if (exists($('edit-modal'))) $('edit-modal').classList.add('hidden');
      toast(i18n.t("seller.updated"));
      await loadProducts();
    } catch (err) {
      console.error("edit save error:", err);
      toast(i18n.t("seller.update_failed"));
    }
  });

  if (exists($('editCancel'))) $('editCancel').addEventListener('click', () => $('edit-modal').classList.add('hidden'));
}

// ---------- Load Orders ----------
async function loadOrders() {
  try {
    if (exists($('ordersList'))) $('ordersList').innerHTML = '<p class="text-gray-500">Loading orders...</p>';
    const q = query(collection(db, "orders"), where("sellerId", "==", currentUser.uid), orderBy("date","desc"));
    const snap = await getDocs(q);
    if (exists($('ordersList'))) $('ordersList').innerHTML = '';
    if (snap.empty) {
      if (exists($('ordersList'))) $('ordersList').innerHTML = '<p class="text-gray-600">No orders yet.</p>';
      if (exists($('stat-orders'))) $('stat-orders').textContent = '0';
      if (exists($('stat-sales'))) $('stat-sales').textContent = '0';
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
      if (exists($('ordersList'))) $('ordersList').appendChild(card);
    });

    if (exists($('stat-orders'))) $('stat-orders').textContent = String(snap.size);
    if (exists($('stat-sales'))) $('stat-sales').textContent = String(totalSales);

  } catch (err) {
    console.error("loadOrders error:", err);
    if (exists($('ordersList'))) $('ordersList').innerHTML = '<p class="text-red-600">Failed to load orders.</p>';
  }
}

// ---------- Compute Stats (fallback) ----------
async function computeStats() {
  try {
    const q = query(collection(db, "orders"), where("sellerId", "==", currentUser.uid));
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach(d => total += Number(d.data().totalAmount || 0));
    if (exists($('stat-sales'))) $('stat-sales').textContent = String(total);
    if (exists($('stat-orders'))) $('stat-orders').textContent = String(snap.size);
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
      if (exists($('seller-name'))) $('seller-name').textContent = newName;
      if (exists($('seller-avatar'))) $('seller-avatar').textContent = newName.charAt(0).toUpperCase();
      toast(i18n.t("seller.profile_updated"));
    } catch (err) {
      console.error("save profile error:", err);
      toast(i18n.t("seller.failed_save_profile"));
    }
  });
}

// ---------- Sign out ----------
if (exists($('btn-signout'))) {
  $('btn-signout').addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (err) {
      console.error("signout error:", err);
      toast(i18n.t("seller.signout_failed"));
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
function cleanPrice(raw) {
  if (!raw) return "";

  // Convert to string
  let txt = String(raw);

  // Remove currency symbols + words
  txt = txt
    .replace(/₹/g, "")
    .replace(/rs/gi, "")
    .replace(/rupees/gi, "")
    .replace(/inr/gi, "")
    .replace(/approx/gi, "")
    .replace(/around/gi, "")
    .replace(/[^\d\-–to. ]/g, "")  // remove junk
    .trim();

  // Normalize range separators to '-' only
  txt = txt.replace(/to|–/gi, "-");

  // Extract numbers
  const nums = txt.match(/\d+/g);
  if (!nums) return "";

  if (nums.length === 1) {
    return `₹${nums[0]}`;        // single value
  }

  // Two values → format as a clean range
  return `₹${nums[0]} - ₹${nums[1]}`;
}

// ---------- AI Listing Assistant (safe) ----------
function getListingTitle() {
  const aiTitle = $('aiTitle') ? $('aiTitle').value.trim() : "";
  const prodName = $('prodName') ? $('prodName').value.trim() : "";
  return aiTitle || prodName || "";
}

if (exists($('generateAllBtn'))) {
  $('generateAllBtn').addEventListener('click', async () => {
    const title = getListingTitle();
    if (!title) { alert(i18n.t("seller.enter_product_title")); return; }

    const btn = $('generateAllBtn');
    const loader = $('loadingSpinner');
    const results = $('aiResults');

    try {
      btn.disabled = true;
      btn.innerText = "Generating…";
      if (loader) loader.classList.remove("hidden");
      if (results) results.classList.add("hidden");

      // NOTE: Do NOT hard-code API keys in client-side code. Use a backend to proxy requests or set an environment variable on the server.
      const OPENAI_KEY = "REDACTED";
      if (!OPENAI_KEY || OPENAI_KEY === "REDACTED" || OPENAI_KEY === "YOUR_OPENAI_API_KEY") {
        alert(i18n.t("seller.openai_key_missing"));
        return;
      }

      const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
`Generate clean JSON only.
Return JSON ONLY:
{
 "description": "",
 "highlights": "",
 "story": "",
 "price": "",
 "category": "",
 "tags": ""
}`
            },
            { role: "user", content: `Generate full listing details for handmade product: ${title}` }
          ],
          max_tokens: 350
        })
      });

      const data = await rsp.json();

      // parse safely
      let parsed = null;
      try {
        parsed = JSON.parse(data.choices[0].message.content);
      } catch (err) {
        // try substring parse
        const txt = (data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : "";
        const first = txt.indexOf('{'); const last = txt.lastIndexOf('}');
        if (first !== -1 && last !== -1) {
          try { parsed = JSON.parse(txt.slice(first, last + 1)); } catch (e) { parsed = null; }
        }
      }

      if (!parsed) {
        alert(i18n.t("seller.ai_unexpected_output"));
        console.error("AI response:", data);
      } else {
        if (exists($('aiDescription'))) $('aiDescription').value = parsed.description || "";
        if (exists($('aiHighlights'))) $('aiHighlights').value = parsed.highlights || "";
        if (exists($('aiStory'))) $('aiStory').value = parsed.story || "";
        if (exists($('aiPrice')))
    $('aiPrice').value = cleanPrice(parsed.price);

        if (exists($('aiCategory'))) $('aiCategory').value = parsed.category || "";
        if (exists($('aiTags'))) $('aiTags').value = parsed.tags || "";
        if (results) results.classList.remove("hidden");

        // optionally auto-fill main fields
        if (parsed.description && exists($('prodDesc'))) $('prodDesc').value = parsed.description;
        if (parsed.category && exists($('prodCategory'))) $('prodCategory').value = parsed.category;
      }

    } catch (err) {
      console.error("AI Listing error:", err);
      alert("AI failed to generate listing. Check console.");
    } finally {
      if (loader) loader.classList.add("hidden");
      if (btn) { btn.innerText = "Generate Full AI Listing"; btn.disabled = false; }
    }
  });
}

// =============================
// SIMPLE IMAGE ENHANCER (NO API)
// =============================

// Preview original image (if element exists)
if (exists($('prodImages')) && exists($('simplePreview'))) {
  $('prodImages').addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    $('simplePreview').src = URL.createObjectURL(file);
    $('simplePreview').classList.remove("hidden");
  });
}

// Enhance button
if (exists($('simpleEnhanceBtn'))) {
  $('simpleEnhanceBtn').addEventListener("click", async () => {
    if (!exists($('prodImages'))) return alert("Upload image first");
    const file = $('prodImages').files[0];
    if (!file) return alert("Upload image first");

    if (exists($('simpleEnhanceStatus'))) $('simpleEnhanceStatus').textContent = "Enhancing...";

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Apply simple improvements
      ctx.filter = "brightness(1.15) contrast(1.1) saturate(1.2)";

      ctx.drawImage(img, 0, 0);

      // Get final image DataURL
      const enhancedDataURL = canvas.toDataURL("image/jpeg", 0.9);

      // Show enhanced output if element exists
      if (exists($('simpleEnhancedImage'))) {
        $('simpleEnhancedImage').src = enhancedDataURL;
        $('simpleEnhancedImage').classList.remove("hidden");
      }

      // Save for Firebase upload (dataURL)
      window.enhancedImageForUpload = enhancedDataURL;

      if (exists($('simpleEnhanceStatus'))) $('simpleEnhanceStatus').textContent = "Enhanced successfully!";
    };

    img.onerror = (err) => {
      console.error("Image load error:", err);
      if (exists($('simpleEnhanceStatus'))) $('simpleEnhanceStatus').textContent = "Enhance failed.";
    };
  });
}

log("seller-dashboard.js finalised");
// ===========================
// DUMMY DATA SEEDER (FIXED)
// ===========================
import { Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

if (exists($('seedDataBtn'))) {
  $('seedDataBtn').addEventListener('click', async () => {

    if (!currentUser) return alert("Login first");

    const sellerId = currentUser.uid;

    // SAMPLE PRODUCT LIST
    const dummyProducts = [
      {
        name: "Handmade Terracotta Pot",
        category: "Pottery",
        price: 350,
        stock: 12,
        description: "Eco-friendly terracotta planter ideal for indoor plants.",
        images: ["https://i.imgur.com/OFvVhZD.jpeg"]
      },
      {
        name: "Traditional Banarasi Saree",
        category: "Saree",
        price: 1200,
        stock: 5,
        description: "Pure banarasi handloom saree with golden zari work.",
        images: ["https://i.imgur.com/Ja0QqgP.jpeg"]
      },
      {
        name: "Wooden Hand-Carved Ganesha",
        category: "Toys",
        price: 650,
        stock: 8,
        description: "Premium wooden carved idol made by rural artisans.",
        images: ["https://i.imgur.com/9qU2P5f.jpeg"]
      },
      {
        name: "Handmade Jute Basket",
        category: "Other",
        price: 280,
        stock: 15,
        description: "Strong jute basket for multipurpose use.",
        images: ["https://i.imgur.com/nYIjb0H.jpeg"]
      }
    ];

    // ADD PRODUCTS
    for (let p of dummyProducts) {
      await addDoc(collection(db, "products"), {
        sellerId,
        ...p,
        createdAt: serverTimestamp()
      });
    }

    console.log("Dummy products added.");

    // SAMPLE ORDERS
    const dummyOrders = [
      {
        productName: "Handmade Terracotta Pot",
        customerName: "Aarav",
        quantity: 2,
        totalAmount: 700,
        orderStatus: "Delivered",
        sellerId,
        date: Timestamp.fromDate(new Date())
      },
      {
        productName: "Traditional Banarasi Saree",
        customerName: "Riya",
        quantity: 1,
        totalAmount: 1200,
        orderStatus: "Delivered",
        sellerId,
        date: Timestamp.fromDate(new Date())
      },
      {
        productName: "Handmade Jute Basket",
        customerName: "Mohan",
        quantity: 3,
        totalAmount: 840,
        orderStatus: "Shipped",
        sellerId,
        date: Timestamp.fromDate(new Date())
      }
    ];

    // ADD ORDERS
    for (let o of dummyOrders) {
      await addDoc(collection(db, "orders"), o);
    }

    console.log("Dummy orders added.");

    alert("Dummy data added!");
    await loadProducts();
    await loadOrders();
    await computeStats();
  });
}
