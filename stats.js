import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCghzssgZv-EgxhB8jVLcTK7CYUNNIL11Q",
  authDomain: "jeffgallery-45ac1.firebaseapp.com",
  projectId: "jeffgallery-45ac1",
  storageBucket: "jeffgallery-45ac1.appspot.com",
  messagingSenderId: "415183494170",
  appId: "1:415183494170:web:7153457b83407a16e905a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const statsRef = doc(db, "jeffgallery", "8CHgXo5VtsJvnjcmfCKT");
const STORAGE_KEY = "jeffgallery_stats";

function getStoredStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { visitors: 0, downloads: 0 };
    }

    const parsed = JSON.parse(raw);
    return {
      visitors: Number(parsed?.visitors || 0),
      downloads: Number(parsed?.downloads || 0)
    };
  } catch (error) {
    console.warn("Unable to read local stats.", error);
    return { visitors: 0, downloads: 0 };
  }
}

function persistStats(stats) {
  const safeStats = {
    visitors: Number(stats?.visitors || 0),
    downloads: Number(stats?.downloads || 0)
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeStats));
  window.dispatchEvent(new CustomEvent("stats-updated", { detail: safeStats }));
  return safeStats;
}

function updateDom(stats) {
  const visitorsEl = document.getElementById("visitors");
  const downloadsEl = document.getElementById("downloads");

  if (visitorsEl) {
    visitorsEl.textContent = stats.visitors || 0;
  }

  if (downloadsEl) {
    downloadsEl.textContent = stats.downloads || 0;
  }
}

function mergeStats(localStats, remoteStats = {}) {
  return {
    visitors: Math.max(Number(localStats?.visitors || 0), Number(remoteStats?.visitors || 0)),
    downloads: Math.max(Number(localStats?.downloads || 0), Number(remoteStats?.downloads || 0))
  };
}

async function ensureStatsDoc() {
  try {
    const snap = await getDoc(statsRef);
    if (!snap.exists()) {
      await setDoc(statsRef, { visitors: 0, downloads: 0 });
    }
  } catch (error) {
    console.warn("Firestore is unavailable, using local storage for now.", error);
  }
}

async function loadStats() {
  const localStats = getStoredStats();
  updateDom(localStats);

  try {
    await ensureStatsDoc();
    const snap = await getDoc(statsRef);

    if (snap.exists()) {
      const remoteStats = snap.data() || {};
      const mergedStats = persistStats(mergeStats(localStats, remoteStats));

      updateDom(mergedStats);
      return mergedStats;
    }
  } catch (error) {
    console.warn("Unable to sync stats from Firestore.", error);
  }

  return localStats;
}

async function addVisitor() {
  const visited = sessionStorage.getItem("visited");
  if (visited) {
    return loadStats();
  }

  sessionStorage.setItem("visited", "true");

  const currentStats = getStoredStats();
  const nextStats = persistStats({
    ...currentStats,
    visitors: Number(currentStats.visitors || 0) + 1
  });

  updateDom(nextStats);

  try {
    await ensureStatsDoc();
    await updateDoc(statsRef, { visitors: increment(1) });
    return loadStats();
  } catch (error) {
    console.warn("Visitor count could not be saved to Firestore.", error);
    return nextStats;
  }
}

async function addDownload() {
  const currentStats = getStoredStats();
  const nextStats = persistStats({
    ...currentStats,
    downloads: Number(currentStats.downloads || 0) + 1
  });

  updateDom(nextStats);

  try {
    await ensureStatsDoc();
    await updateDoc(statsRef, { downloads: increment(1) });
    return loadStats();
  } catch (error) {
    console.warn("Download count could not be saved to Firestore.", error);
    return nextStats;
  }
}

function bindStatsUI() {
  updateDom(getStoredStats());

  window.addEventListener("storage", () => {
    updateDom(getStoredStats());
  });

  window.addEventListener("stats-updated", (event) => {
    if (event.detail) {
      updateDom(event.detail);
    }
  });

  setInterval(() => {
    loadStats();
  }, 5000);
}

window.addDownload = addDownload;
window.addVisitor = addVisitor;
window.loadStats = loadStats;

export { addVisitor, addDownload, loadStats, bindStatsUI };
