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
        this.dbName = "EduCheckDB_Fresh_v6";
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    async init() {
        // Drop legacy old IndexedDB databases if they exist
        try {
            indexedDB.deleteDatabase("EduCheckDB");
            indexedDB.deleteDatabase("EduCheckDB_v1");
            indexedDB.deleteDatabase("EduCheckDB_v2");
        } catch (e) {}

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
        const localList = await this.getLocalAll(storeName);
        const localMap = new Map();
        localList.forEach(item => { if (item && item.id) localMap.set(item.id, item); });

        // Try Cloud Firestore first if available (with fast 1.5s timeout to prevent freezing)
        if (fbFirestore) {
            try {
                const fetchPromise = fbFirestore.collection(storeName).get();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500));
                const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
                if (!snapshot.empty) {
                    const mergedList = [];
                    snapshot.forEach(doc => {
                        const cloudItem = doc.data();
                        const localItem = localMap.get(cloudItem.id);

                        // If local item has status 'checked' and cloud is still 'pending', keep local checked and sync to cloud
                        if (localItem && localItem.status === 'checked' && cloudItem.status === 'pending') {
                            mergedList.push(localItem);
                            this.set(storeName, localItem);
                        } else if (localItem && localItem.evaluation && !cloudItem.evaluation) {
                            mergedList.push(localItem);
                            this.set(storeName, localItem);
                        } else {
                            mergedList.push(cloudItem);
                            this.setLocal(storeName, cloudItem);
                        }
                        localMap.delete(cloudItem.id);
                    });

                    // Add remaining local items that haven't reached cloud yet
                    localMap.forEach(remainingItem => {
                        mergedList.push(remainingItem);
                        this.set(storeName, remainingItem);
                    });

                    return mergedList;
                }
            } catch (err) {
                console.warn(`Firestore getAll fallback for ${storeName}:`, err.message);
            }
        }

        // Fallback to IndexedDB
        return localList;
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

    async clear(storeName) {
        if (fbFirestore) {
            try {
                const snap = await fbFirestore.collection(storeName).get();
                if (!snap.empty) {
                    const batch = fbFirestore.batch();
                    snap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } catch (e) {
                console.warn(`Cloud clear error for ${storeName}:`, e);
            }
        }
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                const req = store.clear();
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }

    async purgeAllDataPermanently() {
        console.log("🧨 Initiating full permanent database wipe...");
        const collections = ["students", "assignments", "submissions", "notifications"];

        // 1. Wipe all Cloud Firestore collections completely
        if (fbFirestore) {
            for (const col of collections) {
                try {
                    const snap = await fbFirestore.collection(col).get();
                    if (!snap.empty) {
                        const batch = fbFirestore.batch();
                        snap.docs.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                        console.log(`☁️ Cloud Firestore [${col}] wiped permanently (${snap.size} docs deleted)`);
                    }
                } catch (e) {
                    console.warn(`Firestore wipe notice for ${col}:`, e.message);
                }
            }
        }

        // 2. Wipe all local IndexedDB stores
        for (const store of collections) {
            try {
                await this.clear(store);
            } catch (e) {}
        }

        // 3. Clear all LocalStorage / SessionStorage except the wipe flag
        try {
            const preserved = ["educheck_fresh_db_permanent_wipe_v7"];
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (!preserved.includes(key)) {
                    localStorage.removeItem(key);
                }
            }
            sessionStorage.clear();
        } catch (e) {}

        console.log("✅ Full permanent database wipe completed!");
        return true;
    }
}

window.dbStorage = new StorageEngine();
