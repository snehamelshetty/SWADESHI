// main.js extracted from index.html script

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, query, getDocs, orderBy, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-storage.js";

console.log("MAIN JS LOADED ✔");

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAs8Ee4DFiPXq3o8UgCgrLFKmLECmxiuyc",
  authDomain: "swadeshi-b73c1.firebaseapp.com",
  projectId: "swadeshi-b73c1",
  storageBucket: "swadeshi-b73c1.appspot.com",
  messagingSenderId: "976631330768",
  appId: "1:976631330768:web:addc77ae3062dee1a9abd5"
};

// INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

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
    const fileInput = document.getElementById("product-image");
    const prompt = document.getElementById("design-prompt").value;

    if (!fileInput.files.length) return alert("Upload an image!");

    const reader = new FileReader();
    reader.onload = (evt) => {
      document.getElementById("enhanced-image").src = evt.target.result;
      document.getElementById("canvas-result").classList.remove("hidden");
    };
    reader.readAsDataURL(fileInput.files[0]);
  });

  document.getElementById("sell-from-canvas").onclick = () => {
    document.getElementById("prod-name").value = document.getElementById("design-prompt").value.slice(0,30);
    window.location.hash = "#sell";
  }
} catch(err){ console.warn("Canvas tool skipped", err); }

// AUTH STATE
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state checked");

  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()){
      const role = userDoc.data().role;
      if(role === "seller"){
        window.location.href = "seller-dashboard.html";
        return;
      }
    }

    loginBtn.textContent = "Logout";
    loginBtn.onclick = async()=>{
      await signOut(auth);
      location.reload();
    };

  } else {
    loginBtn.textContent = "Login";
    loginBtn.onclick = ()=> window.location.href = "login.html";
  }
});

// PRODUCT UPLOAD
try {
  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if(!user) return window.location.href = "login.html";

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if(!userDoc.exists() || userDoc.data().role !== "seller"){
      alert("Only sellers can list products.");
      return;
    }

    const name = prod-name.value;
    const category = prod-category.value;
    const desc = prod-desc.value;
    const price = Number(prod-price.value);
    const files = prod-images.files;

    const listStatus = document.getElementById("list-status");
    listStatus.textContent = "Uploading images...";

    const urls = [];
    for(let i=0; i<files.length; i++){
      const file = files[i];
      const fileRef = storageRef(storage, `products/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      urls.push(await getDownloadURL(fileRef));
    }

    await addDoc(collection(db, "products"),{
      name,
      category,
      desc,
      price,
      images: urls,
      sellerId: user.uid,
      createdAt: serverTimestamp()
    });

    listStatus.style.color = "green";
    listStatus.textContent = "Product listed successfully!";
  });
} catch(err){ console.warn("Product form skipped", err); }

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

loadFeaturedProducts();