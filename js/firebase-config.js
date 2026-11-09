/**
 * Firebase Live Configuration & Cloud Database Integration
 * Project: eduapp-b8a5e
 */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDyMUtp3xE0ShkFT17oKNeQM66DO1BhfaA",
    authDomain: "eduapp-b8a5e.firebaseapp.com",
    projectId: "eduapp-b8a5e",
    storageBucket: "eduapp-b8a5e.firebasestorage.app",
    messagingSenderId: "477570855078",
    appId: "1:477570855078:web:80b31ef6e4ec27c9310467",
    measurementId: "G-2BJC566Y3L"
};

// Check if Firebase keys are set
const isFirebaseLive = (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_API_KEY");

// Global Firebase service references
let fbApp = null;
let fbAuth = null;
let fbFirestore = null;
let fbStorage = null;

// Initialize Firebase SDK when loaded
function initFirebaseApp() {
    if (typeof firebase !== 'undefined' && isFirebaseLive) {
        try {
            if (!firebase.apps.length) {
                fbApp = firebase.initializeApp(FIREBASE_CONFIG);
            } else {
                fbApp = firebase.app();
            }
            if (firebase.auth) fbAuth = firebase.auth();
            if (firebase.firestore) fbFirestore = firebase.firestore();
            if (firebase.storage) fbStorage = firebase.storage();

            console.log("🔥 Firebase initialized successfully with project:", FIREBASE_CONFIG.projectId);

            const badge = document.getElementById("storageModeBadge");
            const badgeText = document.getElementById("storageModeText");
            if (badge && badgeText) {
                badge.style.background = "linear-gradient(135deg, #ecfdf5, #d1fae5)";
                badge.style.borderColor = "#10b981";
                badgeText.innerHTML = `🔥 Firebase লাইভ কানেক্টেড`;
            }
        } catch (e) {
            console.warn("Firebase initialization notice:", e);
        }
    }
}

// Storage Engine with Firebase Cloud Sync + Local IndexedDB fallback
class StorageEngine {
    constructor() {
        this.dbName = "EduCheckDB";
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("students")) {
                    db.createObjectStore("students", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("assignments")) {
                    db.createObjectStore("assignments", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("submissions")) {
                    db.createObjectStore("submissions", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("notifications")) {
                    db.createObjectStore("notifications", { keyPath: "id" });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                resolve(null);
            };
        });
    }

    async getAll(storeName) {
        // Try Cloud Firestore first if available
        if (fbFirestore) {
            try {
                const snapshot = await fbFirestore.collection(storeName).get();
                if (!snapshot.empty) {
                    const list = [];
                    snapshot.forEach(doc => list.push(doc.data()));
                    // Cache to local IndexedDB
                    for (const item of list) {
                        await this.setLocal(storeName, item);
                    }
                    return list;
                }
            } catch (err) {
                console.warn(`Firestore getAll fallback for ${storeName}:`, err.message);
            }
        }

        // Fallback to IndexedDB
        return this.getLocalAll(storeName);
    }

    async getLocalAll(storeName) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });
    }

    async getById(storeName, id) {
        if (fbFirestore) {
            try {
                const doc = await fbFirestore.collection(storeName).doc(id).get();
                if (doc.exists) return doc.data();
            } catch (e) {
                // Ignore and use local
            }
        }
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const req = store.get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    async set(storeName, item) {
        // Save to local IndexedDB immediately
        await this.setLocal(storeName, item);

        // Sync to Firebase Cloud Firestore
        if (fbFirestore && item && item.id) {
            try {
                await fbFirestore.collection(storeName).doc(item.id).set(item, { merge: true });
                console.log(`☁️ Synced to Firebase Firestore [${storeName}/${item.id}]`);
            } catch (err) {
                console.warn(`Cloud Firestore sync error for ${storeName}:`, err.message);
            }
        }
        return true;
    }

    async setLocal(storeName, item) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                const req = store.put(item);
                req.onsuccess = () => resolve(true);
                req.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    async delete(storeName, id) {
        if (fbFirestore) {
            try {
                await fbFirestore.collection(storeName).doc(id).delete();
            } catch (e) {
                console.warn("Cloud delete error:", e);
            }
        }
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                const req = store.delete(id);
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }
}

window.dbStorage = new StorageEngine();
