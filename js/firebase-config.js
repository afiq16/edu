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

/**
 * Deep sanitize an object before sending to Cloud Firestore.
 * Removes all undefined properties and converts them safely.
 */
function sanitizeForFirestore(obj) {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForFirestore(item)).filter(item => item !== undefined);
    }
    const clean = {};
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val === undefined) {
            clean[key] = null;
        } else if (val !== null && typeof val === 'object') {
            clean[key] = sanitizeForFirestore(val);
        } else {
            clean[key] = val;
        }
    }
    return clean;
}

/**
 * Update UI online status badge
 */
function updateFirebaseOnlineIndicator(isOnline) {
    const badge = document.getElementById("storageModeBadge");
    const badgeText = document.getElementById("storageModeText");
    if (badge && badgeText) {
        if (isOnline) {
            badge.style.background = "linear-gradient(135deg, #ecfdf5, #d1fae5)";
            badge.style.borderColor = "#10b981";
            badgeText.innerHTML = `অনলাইন`;
        } else {
            badge.style.background = "linear-gradient(135deg, #fef3c7, #fde68a)";
            badge.style.borderColor = "#f59e0b";
            badgeText.innerHTML = `অফলাইন`;
        }
    }
}

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
            if (firebase.firestore) {
                fbFirestore = firebase.firestore();
                // Enable offline cache persistence for instant offline & cloud sync
                try {
                    fbFirestore.enablePersistence({ synchronizeTabs: true }).catch(err => {
                        console.warn("Firestore persistence notice:", err.code);
                    });
                } catch (e) {}
            }
            if (firebase.storage) fbStorage = firebase.storage();

            console.log("🔥 Firebase initialized successfully with project:", FIREBASE_CONFIG.projectId);
            updateFirebaseOnlineIndicator(true);
        } catch (e) {
            console.warn("Firebase initialization error:", e);
            updateFirebaseOnlineIndicator(false);
        }
    }
}

// Storage Engine with Firebase Cloud Sync + Local IndexedDB fallback
class StorageEngine {
    constructor() {
        this.dbName = "EduCheckDB_CloudSync_v1";
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const stores = ["students", "assignments", "submissions", "notifications", "attendance", "doubts", "study_materials", "notices"];
                stores.forEach(s => {
                    if (!db.objectStoreNames.contains(s)) {
                        db.createObjectStore(s, { keyPath: "id" });
                    }
                });
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
        if (!fbFirestore && typeof initFirebaseApp === 'function') {
            initFirebaseApp();
        }

        // 1. Get local cached records
        const localList = await this.getLocalAll(storeName);
        const localMap = new Map();
        (localList || []).forEach(item => { if (item && item.id) localMap.set(String(item.id), item); });

        // 2. Query Cloud Firestore with 6s timeout
        if (fbFirestore) {
            try {
                const fetchPromise = fbFirestore.collection(storeName).get();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000));
                const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
                
                if (snapshot) {
                    const cloudList = [];
                    const cloudDocIds = new Set();

                    snapshot.forEach(doc => {
                        const cloudItem = doc.data();
                        if (!cloudItem || !cloudItem.id) return;
                        const docIdStr = String(cloudItem.id);
                        cloudDocIds.add(docIdStr);

                        const localItem = localMap.get(docIdStr);

                        // If local item has status 'checked' and cloud is still 'pending', keep local checked and sync to cloud
                        if (localItem && localItem.status === 'checked' && cloudItem.status === 'pending') {
                            cloudList.push(localItem);
                            this.set(storeName, localItem);
                        } else if (localItem && localItem.evaluation && !cloudItem.evaluation) {
                            cloudList.push(localItem);
                            this.set(storeName, localItem);
                        } else {
                            cloudList.push(cloudItem);
                            this.setLocal(storeName, cloudItem);
                        }
                    });

                    // Cloud is source of truth when online. Any item in local IndexedDB not found in Cloud -> delete it permanently
                    for (const [locId] of localMap.entries()) {
                        if (!cloudDocIds.has(locId)) {
                            await this.deleteLocal(storeName, locId);
                        }
                    }

                    return cloudList;
                }
            } catch (err) {
                console.warn(`Firestore getAll fallback for ${storeName}:`, err.message);
            }
        }

        // Fallback to IndexedDB when offline
        return localList || [];
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
        if (!fbFirestore && typeof initFirebaseApp === 'function') {
            initFirebaseApp();
        }
        if (fbFirestore) {
            try {
                const doc = await fbFirestore.collection(storeName).doc(String(id)).get();
                if (doc.exists) return doc.data();
            } catch (e) {}
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
        if (!item) return false;
        if (!fbFirestore && typeof initFirebaseApp === 'function') {
            initFirebaseApp();
        }

        // 1. Save to local IndexedDB immediately
        await this.setLocal(storeName, item);

        // 2. Sync to Firebase Cloud Firestore
        if (fbFirestore && item.id) {
            try {
                const sanitized = sanitizeForFirestore(item);
                await fbFirestore.collection(storeName).doc(String(item.id)).set(sanitized, { merge: true });
                console.log(`☁️ Synced to Firebase Firestore [${storeName}/${item.id}]`);
            } catch (err) {
                console.warn(`Cloud Firestore sync error for ${storeName}/${item.id}:`, err.message);
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

    async deleteLocal(storeName, id) {
        if (!id) return false;
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                store.delete(id);
                store.delete(String(id));
                if (typeof id === 'string' && !isNaN(Number(id))) {
                    store.delete(Number(id));
                }
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }

    async clearLocal(storeName) {
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

    async delete(storeName, id) {
        if (!id) return false;
        if (!fbFirestore && typeof initFirebaseApp === 'function') {
            initFirebaseApp();
        }

        // 1. Delete from Firebase Cloud Firestore
        if (fbFirestore) {
            try {
                await fbFirestore.collection(storeName).doc(String(id)).delete();
                console.log(`☁️ Deleted from Firebase Firestore [${storeName}/${id}]`);
            } catch (err) {
                console.warn(`Cloud delete error for ${storeName}/${id}:`, err.message);
            }
        }

        // 2. Delete from local IndexedDB with robust ID type handling
        return await this.deleteLocal(storeName, id);
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
        return await this.clearLocal(storeName);
    }

    async purgeAllDataPermanently() {
        console.log("🧨 Initiating full permanent database wipe...");
        const collections = ["students", "assignments", "submissions", "notifications", "attendance", "doubts", "study_materials", "notices"];

        // 1. Wipe all local IndexedDB stores first
        for (const store of collections) {
            try {
                await this.clearLocal(store);
            } catch (e) {}
        }

        // 2. Wipe all Cloud Firestore collections completely
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

        // 3. Clear stored user session cached data
        localStorage.removeItem("educheck_saved_user_data");

        console.log("✅ Full permanent database wipe completed!");
        return true;
    }
}

// Auto initialize immediately
initFirebaseApp();
window.dbStorage = new StorageEngine();
