// main.js extracted from index.html script

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, query, getDocs, orderBy, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-storage.js";

console.log("MAIN JS LOADED ✔");

// FIREBASE CONFIG
// Do NOT check API keys into source. Set `window.FIREBASE_API_KEY` at runtime or replace during build.
const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || "REDACTED",
  authDomain: "swadeshi-b73c1.web.app",
  projectId: "swadeshi-b73c1",
  storageBucket: "swadeshi-b73c1.appspot.com",
  messagingSenderId: "976631330768",
  appId: "1:976631330768:web:addc77ae3062dee1a9abd5"
};

// INIT (avoid duplicate app if another script already inits)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ELEMENTS
const loginBtn = document.getElementById("login-btn");
const contactModal = document.getElementById("contact-modal");
const closeContactBtn = document.getElementById("close-contact");

// CONTACT MODAL
try {
  document.querySelector('a[href="#contact"]').addEventListener('click', (e) => {
    e.preventDefault();
    contactModal.classList.remove("hidden");
    contactModal.classList.add("flex");
  });

  closeContactBtn.onclick = () => {
    contactModal.classList.add("hidden");
    contactModal.classList.remove("flex");
  };
} catch(err){ console.warn("Contact modal skipped", err); }

// CANVAS TOOL
try {
  document.getElementById("canvas-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // If user pressed Enter inside the prompt, trigger the same action as clicking "Generate"
    const generateBtn = document.getElementById("generate-canvas");
    if (generateBtn) generateBtn.click();
  });

  document.getElementById("sell-from-canvas").onclick = () => {
    document.getElementById("prod-name").value = document.getElementById("design-prompt").value.slice(0,30);
    window.location.hash = "#sell";
  }
} catch(err){ console.warn("Canvas tool skipped", err); }

// AUTH STATE
onAuthStateChanged(auth, async (user) => {
  const isIndexPage = !window.location.pathname || window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");
  if (loginBtn) {
    if (user) {
      loginBtn.textContent = i18n.t("login.logout");
      loginBtn.onclick = async () => { await signOut(auth); location.reload(); };
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role === "seller" && !isIndexPage) {
          window.location.href = "seller-dashboard.html";
          return;
        }
        if (role === "customer" && !isIndexPage) {
          window.location.href = "customer-home.html";
          return;
        }
      }
    } else {
      loginBtn.textContent = i18n.t("login.login");
      loginBtn.onclick = () => { window.location.href = "login.html"; };
    }
  }
});

// PRODUCT UPLOAD (index.html Sell Your Products form)
try {
  const productForm = document.getElementById("product-form");
  if (productForm) {
    productForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById('prod-name')?.value?.trim();
      const category = document.getElementById('prod-category')?.value?.trim();
      const desc = document.getElementById('prod-desc')?.value?.trim();
      const price = Number(document.getElementById('prod-price')?.value);
      const files = document.getElementById('prod-images')?.files;

      if (!name || !category || !desc || !price) {
        alert(i18n.t("alerts.fill_fields"));
        return;
      }
      if (!files || files.length === 0) {
        alert(i18n.t("alerts.upload_image"));
        return;
      }

      const listStatus = document.getElementById("list-status");
      const setStatus = (text, color) => {
        if (listStatus) { listStatus.textContent = text; listStatus.style.color = color || ''; }
      };

      const user = auth.currentUser;

      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== "seller") {
          alert(i18n.t("alerts.only_sellers"));
          saveLocalProductAndRedirect(name, category, desc, price, files);
          return;
        }
        setStatus(i18n.t("status.uploading") || "Uploading images...", "blue");
        const urls = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileRef = storageRef(storage, `products/${user.uid}/${Date.now()}_${i}_${file.name}`);
          await uploadBytes(fileRef, file);
          urls.push(await getDownloadURL(fileRef));
        }
        await addDoc(collection(db, "products"), {
          name,
          category,
          desc,
          price,
          stock: 10,
          images: urls,
          sellerId: user.uid,
          createdAt: serverTimestamp()
        });
        setStatus(i18n.t("status.listed_product"), "green");
      } else {
        saveLocalProductAndRedirect(name, category, desc, price, files);
        return;
      }

      setTimeout(() => { window.location.href = "product.html"; }, 1200);
    });
  }
} catch (err) { console.warn("Product form skipped", err); }

function saveLocalProductAndRedirect(name, category, desc, price, files) {
  const listStatus = document.getElementById("list-status");
  if (listStatus) {
    listStatus.textContent = i18n.t("status.saving_locally");
    listStatus.style.color = "green";
  }
  const reader = new FileReader();
  reader.onload = function () {
    const img = reader.result;
    const localProducts = JSON.parse(localStorage.getItem("swadeshi_local_products") || "[]");
    localProducts.push({
      id: "local_" + Date.now(),
      name,
      category,
      description: desc,
      desc,
      price,
      stock: 10,
      sellerId: "local",
      images: [img]
    });
    localStorage.setItem("swadeshi_local_products", JSON.stringify(localProducts));
    setTimeout(() => { window.location.href = "product.html"; }, 800);
  };
  reader.readAsDataURL(files[0]);
}

// LOAD PRODUCTS
async function loadFeaturedProducts(){
  const grid = document.getElementById("products-grid");
  if(!grid) return;

  grid.innerHTML = "Loading...";
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  grid.innerHTML = "";
  snap.forEach(docSnap =>{
    const p = docSnap.data();
    const img = p.images?.[0] ?? "https://via.placeholder.com/400x300";

    grid.innerHTML += `
      <div class='bg-white p-4 rounded-xl shadow'>
        <img src='${img}' class='h-56 w-full object-cover rounded mb-4'>
        <h3 class='font-bold text-xl'>${p.name}</h3>
        <p>${p.desc?.slice(0,50) || ''}...</p>
        <p class='text-[var(--primary)] font-bold mt-2'>₹${p.price}</p>
      </div>
    `;
  });
}

loadFeaturedProducts().then(()=>{ try{ if(window.i18n && window.i18n.applyTranslations) window.i18n.applyTranslations(); }catch(e){} });