/* --------------------------------------------------
   FIREBASE IMPORTS
-------------------------------------------------- */
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* --------------------------------------------------
   INITIALIZE
-------------------------------------------------- */
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

/* --------------------------------------------------
   AUTH CHECK (STOPS REDIRECT LOOP)
-------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    console.log("✔ Logged in:", user.email);
    loadSellerProfile(user);
});

/* --------------------------------------------------
   LOAD SELLER PROFILE
-------------------------------------------------- */
async function loadSellerProfile(user) {
    const docRef = doc(db, "sellers", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const seller = docSnap.data();

        document.getElementById("sellerName").innerText = seller.name || "Seller";
        document.getElementById("sellerEmail").innerText = user.email;
    } else {
        document.getElementById("sellerName").innerText = "Seller";
        document.getElementById("sellerEmail").innerText = user.email;
    }
}

/* --------------------------------------------------
   IMAGE UPLOAD SYSTEM (WITH PROGRESS)
-------------------------------------------------- */
async function uploadImages(files) {
    const uploadPromises = [];

    const progressBar = document.getElementById("progress-bar");
    const uploadStatus = document.getElementById("upload-status");

    progressBar.style.display = "block";
    uploadStatus.innerText = "Uploading images...";

    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileRef = ref(storage, `product_images/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadPromises.push(
            new Promise((resolve, reject) => {
                uploadTask.on(
                    "state_changed",
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

                        const overallProgress = Math.round(
                            ((uploadedCount + progress / 100) / files.length) * 100
                        );

                        progressBar.value = overallProgress;
                    },
                    (error) => reject(error),
                    async () => {
                        uploadedCount++;
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(url);
                    }
                );
            })
        );
    }

    const urls = await Promise.all(uploadPromises);

    uploadStatus.innerText = "Images uploaded!";
    progressBar.value = 100;

    return urls;
}

/* --------------------------------------------------
   ADD PRODUCT
-------------------------------------------------- */
document.getElementById("addProductBtn").addEventListener("click", async () => {
    const name = document.getElementById("product-name").value.trim();
    const category = document.getElementById("product-category").value.trim();
    const price = document.getElementById("product-price").value.trim();
    const stock = document.getElementById("product-stock").value.trim();
    const desc = document.getElementById("product-description").value.trim();
    const files = document.getElementById("product-images").files;

    if (!name || !category || !price || !stock || !desc || files.length === 0) {
        alert("⚠ Please fill all fields and upload at least ONE image.");
        return;
    }

    document.getElementById("addProductBtn").innerText = "Uploading...";

    try {
        const urls = await uploadImages(files);

        await addDoc(collection(db, "products"), {
            name,
            category,
            price: Number(price),
            stock: Number(stock),
            description: desc,
            images: urls,
            sellerId: auth.currentUser.uid,
            createdAt: Date.now()
        });

        alert("🎉 Product Added Successfully!");

        document.getElementById("addProductBtn").innerText = "Add Product";

    } catch (e) {
        alert("❌ Failed to add product");
        console.error(e);
    }
});

/* --------------------------------------------------
   LOAD SELLER PRODUCTS (Manage Products)
-------------------------------------------------- */
async function loadProducts() {
    const container = document.getElementById("productsList");
    container.innerHTML = "<p>Loading products...</p>";

    const q = query(collection(db, "products"), where("sellerId", "==", auth.currentUser.uid));
    const qs = await getDocs(q);

    container.innerHTML = "";

    qs.forEach((docItem) => {
        const item = docItem.data();

        const div = document.createElement("div");
        div.className = "product-item";

        div.innerHTML = `
            <h3>${item.name}</h3>
            <p>Category: ${item.category}</p>
            <p>₹${item.price}</p>
            <p>Stock: ${item.stock}</p>
            <button class="deleteBtn" data-id="${docItem.id}">Delete</button>
        `;

        container.appendChild(div);
    });

    document.querySelectorAll(".deleteBtn").forEach((btn) => {
        btn.onclick = async () => {
            const id = btn.getAttribute("data-id");
            await deleteDoc(doc(db, "products", id));
            alert("🗑 Product Deleted");
            loadProducts();
        };
    });
}

/* --------------------------------------------------
   SIDEBAR BUTTON CONTROLS
-------------------------------------------------- */
document.getElementById("showAddProduct").onclick = () => {
    document.getElementById("addProductSection").style.display = "block";
    document.getElementById("manageProductsSection").style.display = "none";
};

document.getElementById("showManageProducts").onclick = () => {
    document.getElementById("addProductSection").style.display = "none";
    document.getElementById("manageProductsSection").style.display = "block";
    loadProducts();
};

/* --------------------------------------------------
   LOGOUT
-------------------------------------------------- */
document.getElementById("logoutBtn").onclick = () => {
    signOut(auth).then(() => window.location.href = "login.html");
};
