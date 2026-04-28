import './style.css';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";

const urlParams = new URLSearchParams(window.location.search);

let analytics;
if (import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) {
  try {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: "G-BJLK9339LN",
    };
    const app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    logEvent(analytics, 'session_start');
  } catch (e) {
    console.warn("Analytics error:", e);
  }
}

// Meta-Cipher System (IDL Timezone)
function getSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}
function getDailyCypher(gameIndex) {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dateStr = formatter.format(new Date());
    let seed = getSeed(dateStr);
    let rand = mulberry32(seed);
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let cyphers = [];
    for(let k=0; k<3; k++) {
        let str = "";
        for(let j=0; j<4; j++) { str += chars.charAt(Math.floor(rand() * chars.length)); }
        cyphers.push(str);
    }
    let assignment = [0,1,2];
    for (var i = assignment.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var temp = assignment[i];
        assignment[i] = assignment[j];
        assignment[j] = temp;
    }
    let result = ["","",""];
    result[assignment[0]] = cyphers[0];
    result[assignment[1]] = cyphers[1];
    result[assignment[2]] = cyphers[2];
    return result[gameIndex] || "ZEUS";
}

const LOGICAL_WIDTH = 450;
const LOGICAL_HEIGHT = 800;

let scale = 1;
let dictionary = {};

// Game State
let boardTiles = [];
let trayTiles = [];
let lightningUsesLeft = 5;
let score = 0;
let isFlashActive = false;

// Elements
const boardContainer = document.getElementById('board-container');
const trayContainer = document.getElementById('tray-container');
const btnLightning = document.getElementById('btn-lightning');
const btnReveal = document.getElementById('btn-reveal');
const btnScore = document.getElementById('btn-score');
const scoreDisplay = document.getElementById('score');
const countDisplay = document.getElementById('lightning-count');
const flashOverlay = document.getElementById('flash-overlay');

const thunderSound = new Audio('/thunder.mp3');
const successSound = new Audio('/success.mp3');

// --- PRNG for Daily Seed ---
function getDailySeed() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Pacific/Kiritimati" }));
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
const rng = mulberry32(getDailySeed());

// Letter frequencies based on English
const letterPoolStr = 
  "E".repeat(12) + "A".repeat(9) + "I".repeat(9) + "O".repeat(8) + "N".repeat(6) + 
  "R".repeat(6) + "T".repeat(6) + "L".repeat(4) + "S".repeat(4) + "U".repeat(4) + 
  "D".repeat(4) + "G".repeat(3) + "B".repeat(2) + "C".repeat(2) + "M".repeat(2) + 
  "P".repeat(2) + "F".repeat(2) + "H".repeat(2) + "V".repeat(2) + "W".repeat(2) + 
  "Y".repeat(2) + "K".repeat(1) + "J".repeat(1) + "X".repeat(1) + "Q".repeat(1) + "Z".repeat(1);
const letterPool = letterPoolStr.split("");

function getRandomLetter() {
    const index = Math.floor(rng() * letterPool.length);
    return letterPool[index];
}

// --- Initialization ---
function resizeGame() {
  const container = document.getElementById('game-container');
  if (!container) return;
  
  const scaleWidth = window.innerWidth / LOGICAL_WIDTH;
  const scaleHeight = window.innerHeight / LOGICAL_HEIGHT;
  scale = Math.min(scaleWidth, scaleHeight);

  container.style.width = `${LOGICAL_WIDTH}px`;
  container.style.height = `${LOGICAL_HEIGHT}px`;
  container.style.minHeight = `${LOGICAL_HEIGHT}px`;
  container.style.transform = `scale(${scale})`;
  
  container.style.left = '50%';
  container.style.top = '50%';
  container.style.marginLeft = `-${LOGICAL_WIDTH / 2}px`;
  container.style.marginTop = `-${LOGICAL_HEIGHT / 2}px`;
}

async function loadDictionary() {
    try {
        const res = await fetch('/dictionary.json');
        dictionary = await res.json();
    } catch(e) {
        console.error("Failed to load dictionary:", e);
    }
}

function initBoard() {
    boardContainer.innerHTML = '';
    boardTiles = [];
    trayTiles = [];
    trayContainer.innerHTML = '';
    
    // Generate tray slots
    for (let i=0; i<6; i++) {
        const slot = document.createElement('div');
        slot.className = 'tray-slot';
        trayContainer.appendChild(slot);
    }

    const tileSize = 60;
    const gap = 20;
    const startX = (400 - (4 * tileSize + 3 * gap)) / 2;
    const startY = (400 - (5 * tileSize + 4 * gap)) / 2;

    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
            const letter = getRandomLetter();
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.innerText = letter;
            
            const x = startX + col * (tileSize + gap);
            const y = startY + row * (tileSize + gap);
            
            tile.style.left = `${x}px`;
            tile.style.top = `${y}px`;
            
            tile.dataset.letter = letter;
            tile.dataset.originX = x;
            tile.dataset.originY = y;
            tile.dataset.inTray = "false";
            
            boardContainer.appendChild(tile);
            boardTiles.push({ element: tile, x, y, inTray: false });
            
            setupDragAndDrop(tile);
        }
    }
}

// --- Drag & Drop Logic ---
function setupDragAndDrop(tile) {
    let isDragging = false;
    let startPointerX, startPointerY;
    let startTileX, startTileY;

    const onPointerDown = (e) => {
        if (e.target !== tile) return;
        isDragging = true;
        
        // Remove from tray if it was in there
        if (tile.dataset.inTray === "true") {
            tile.dataset.inTray = "false";
            // remove from tray array
            trayTiles = trayTiles.filter(t => t !== tile);
            updateTrayLayout();
        }

        tile.classList.add('dragging');
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startPointerX = clientX;
        startPointerY = clientY;
        startTileX = parseFloat(tile.style.left) || 0;
        startTileY = parseFloat(tile.style.top) || 0;

        e.preventDefault();
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Normalize coordinates!
        const dx = (clientX - startPointerX) / scale;
        const dy = (clientY - startPointerY) / scale;

        tile.style.left = `${startTileX + dx}px`;
        tile.style.top = `${startTileY + dy}px`;
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        tile.classList.remove('dragging');

        // Check if dropped over the tray
        const tileRect = tile.getBoundingClientRect();
        const trayRect = trayContainer.getBoundingClientRect();
        
        const tileCenterY = tileRect.top + tileRect.height / 2;
        const tileCenterX = tileRect.left + tileRect.width / 2;
        
        if (
            tileCenterY >= trayRect.top && tileCenterY <= trayRect.bottom &&
            tileCenterX >= trayRect.left && tileCenterX <= trayRect.right
        ) {
            // Drop in tray (if space)
            if (trayTiles.length < 6) {
                tile.dataset.inTray = "true";
                trayTiles.push(tile);
                updateTrayLayout();
                return;
            }
        } 
        
        // Otherwise snap back to origin
        snapBack(tile);
    };

    tile.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);

    tile.addEventListener('touchstart', onPointerDown, {passive: false});
    document.addEventListener('touchmove', onPointerMove, {passive: false});
    document.addEventListener('touchend', onPointerUp);
}

function updateTrayLayout() {
    const trayRect = trayContainer.getBoundingClientRect();
    const boardRect = boardContainer.getBoundingClientRect();
    
    // We want to visually move the tiles into the tray positions
    // Coordinates are relative to boardContainer
    
    // Y position of tray center relative to board container
    const relativeTrayY = (trayRect.top - boardRect.top) / scale + 10; // +10 for center alignment
    
    const startX = 15; // Matches slot padding logic roughly
    const tileSize = 60;
    const gap = 5;
    
    // The width of tray container is 400. 6 slots * 60 + 5*5 = 385. Center it.
    const trayContentWidth = (6 * tileSize) + (5 * gap);
    const trayStartX = (400 - trayContentWidth) / 2;

    trayTiles.forEach((tile, index) => {
        const x = trayStartX + index * (tileSize + gap);
        tile.style.left = `${x}px`;
        tile.style.top = `${relativeTrayY}px`;
    });
}

function snapBack(tile) {
    tile.dataset.inTray = "false";
    tile.style.left = `${tile.dataset.originX}px`;
    tile.style.top = `${tile.dataset.originY}px`;
    trayTiles = trayTiles.filter(t => t !== tile);
    updateTrayLayout();
}

// --- Features ---
function callLightning() {
    if (lightningUsesLeft <= 0 || isFlashActive) return;
    
    lightningUsesLeft--;
    countDisplay.innerText = `Bolts: ${lightningUsesLeft}`;
    if (lightningUsesLeft === 0) {
        btnLightning.disabled = true;
    }

    isFlashActive = true;
    
    // Audio
    thunderSound.currentTime = 0;
    thunderSound.play().catch(e => console.log("Audio play blocked by browser until user interacts.", e));
    
    // Visual flash
    flashOverlay.classList.add('flash-active');
    
    // Reveal all tiles (board and tray)
    const allTiles = document.querySelectorAll('.tile');
    allTiles.forEach(t => t.classList.add('revealed'));
    
    // Sequence
    setTimeout(() => {
        flashOverlay.classList.remove('flash-active');
    }, 150);
    
    setTimeout(() => {
        flashOverlay.classList.add('flash-active');
    }, 250);
    
    setTimeout(() => {
        flashOverlay.classList.remove('flash-active');
        // Start fading out letters immediately after flash
        allTiles.forEach(t => t.classList.remove('revealed'));
    }, 400);

    // Re-enable lightning button after 5s total
    setTimeout(() => {
        isFlashActive = false;
    }, 5000);
}

function revealWord() {
    if (trayTiles.length === 0) return;
    
    // Show letters temporarily for evaluation
    trayTiles.forEach(t => t.classList.add('revealed'));
    
    const word = trayTiles.map(t => t.dataset.letter).join('').toLowerCase();
    
    setTimeout(() => {
        if (isValidWord(word)) {
            // Calculate Score
            let wordScore = 0;
            if (word.length >= 2 && word.length <= 3) wordScore = 1;
            else if (word.length >= 4) wordScore = word.length + (word.length - 4);
            
            score += wordScore;
            
            // Remove tiles from play entirely
            trayTiles.forEach(t => {
                t.remove(); // Remove from DOM
                boardTiles = boardTiles.filter(bt => bt.element !== t);
            });
            trayTiles = [];
            
            // Audio and Visual Feedback
            successSound.currentTime = 0;
            successSound.play().catch(e => console.log("Audio play blocked", e));
            
            scoreDisplay.classList.remove('score-flash');
            void scoreDisplay.offsetWidth; // trigger reflow
            scoreDisplay.classList.add('score-flash');

            // Board clear check
            if (boardTiles.length === 0) {
                score += 50;
                scoreMe(); // End game automatically
            }
        } else {
            // Invalid word, return to board
            [...trayTiles].forEach(t => {
                t.classList.remove('revealed');
                snapBack(t);
            });
        }
        scoreDisplay.innerText = `Score: ${score}`;
    }, 1000); // Wait 1s so they can see the letters
}

function isValidWord(word) {
    if (word.length < 2) return false;
    return dictionary.hasOwnProperty(word) || dictionary[word] === 1;
}

function scoreMe() {
    document.getElementById('win-score').innerText = `Final Score: ${score}`;
    document.getElementById('win-cypher').textContent = getDailyCypher(0); // Assuming gameIndex 0 for Lightning Words
    
    if (analytics) logEvent(analytics, 'level_complete', { score: score });

    const isCarousel = urlParams.get('carousel') === 'true';
    const regBtns = document.getElementById('regular-win-btns');
    const carBtns = document.getElementById('carousel-btns');
    
    if (isCarousel) {
        if (regBtns) regBtns.style.display = 'none';
        if (carBtns) carBtns.style.display = 'flex';
        
        let playedGames = urlParams.get('played') ? urlParams.get('played').split(',').filter(Boolean) : [];
        if (!playedGames.includes('LW')) playedGames.push('LW');
        
        const playNextBtn = document.getElementById('carousel-play-next');
        const shareBtn = document.getElementById('carousel-share');
        
        fetch('https://oops-games-hub.web.app/carousel_config.json')
            .then(res => res.json())
            .then(configList => {
                if (playedGames.length >= configList.length) {
                    if (playNextBtn) playNextBtn.style.display = 'none';
                    if (shareBtn) shareBtn.style.display = 'flex';
                }
            }).catch(console.warn);
    } else {
        if (carBtns) carBtns.style.display = 'none';
        if (regBtns) regBtns.style.display = 'flex';
    }

    const modal = document.getElementById('win-modal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
    
    // Autoplay finish hook
    if (urlParams.get('autoplay')) {
        window._VIDEO_RECORDING_DONE = true;
    }
}

async function runAutoplay() {
    await new Promise(r => setTimeout(r, 1000));
    callLightning();
    await new Promise(r => setTimeout(r, 1500));
    
    // Pick first 3 tiles
    for (let i = 0; i < 3; i++) {
        const t = boardTiles[i].element;
        t.dataset.inTray = "true";
        trayTiles.push(t);
        updateTrayLayout();
        await new Promise(r => setTimeout(r, 500));
    }
    
    await new Promise(r => setTimeout(r, 500));
    revealWord();
    
    // revealWord takes 1000ms. Force win screen soon after for video hook.
    setTimeout(() => {
        if (!window._VIDEO_RECORDING_DONE) {
            score += 20;
            scoreMe();
        }
    }, 2000);
}

// --- Ecosystem Event Listeners ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

document.getElementById('btn-install')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'install_prompt_clicked');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        const iosModal = document.getElementById('ios-install-modal');
        iosModal.classList.remove('hidden');
        iosModal.classList.add('active');
    } else {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
        } else {
            alert("App is already installed or not supported on this browser.");
        }
    }
});

document.getElementById('btn-close-ios-modal')?.addEventListener('click', () => {
    document.getElementById('ios-install-modal').classList.remove('active');
});

document.getElementById('tutorial-btn')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'tutorial_opened');
    document.getElementById('tutorial-modal').classList.remove('hidden');
    document.getElementById('tutorial-modal').classList.add('active');
});

document.getElementById('btn-close-tutorial')?.addEventListener('click', () => {
    document.getElementById('tutorial-modal').classList.remove('active');
});

document.getElementById('btn-binge')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'binge_presale_click');
    window.location.href = 'https://oops-games-hub.web.app/presale.html';
});

document.getElementById('carousel-binge')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'binge_presale_click');
    let playedGames = urlParams.get('played') ? urlParams.get('played').split(',').filter(Boolean) : [];
    if (!playedGames.includes('LW')) playedGames.push('LW');
    window.location.href = 'https://oops-games-hub.web.app/presale.html?carousel=true&played=' + playedGames.join(',') + '&returnUrl=' + encodeURIComponent(window.location.href);
});

const advanceCarousel = async (isAnotherRide = false) => {
    const playedGamesStr = urlParams.get('played') || '';
    let currentPlayed = playedGamesStr ? playedGamesStr.split(',').filter(Boolean) : [];
    if (!currentPlayed.includes('LW')) currentPlayed.push('LW');
    if (isAnotherRide) currentPlayed = ['LW'];
    
    try {
        const res = await fetch('https://oops-games-hub.web.app/carousel_config.json');
        const configList = await res.json();
        const unplayed = configList.filter(g => !currentPlayed.includes(g.id));
        if (unplayed.length > 0) {
            const nextGame = unplayed[Math.floor(Math.random() * unplayed.length)];
            window.location.href = `${nextGame.url}?carousel=true&played=${currentPlayed.join(',')}`;
        } else {
            window.location.href = 'https://oops-games-hub.web.app/';
        }
    } catch(e) {
        window.location.href = 'https://oops-games-hub.web.app/';
    }
};

document.getElementById("carousel-play-next")?.addEventListener("click", () => advanceCarousel(false));
document.getElementById("carousel-share")?.addEventListener("click", async () => {
    const text = "I rode the carousel at oops-games.";
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Oops-Games Carousel', text });
            await advanceCarousel(true);
        } catch(e) {}
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert("Copied to clipboard!");
            advanceCarousel(true);
        });
    }
});

document.getElementById('btn-share')?.addEventListener('click', () => {
    const text = `⚡ Lightning Words \nI scored ${score}!\n\nPlay free at https://lightning-words.web.app`;
    if (navigator.share) {
        navigator.share({ title: 'Lightning Words', text: text });
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    }
});

// --- Event Listeners ---
btnLightning.addEventListener('click', callLightning);
btnReveal.addEventListener('click', revealWord);
btnScore.addEventListener('click', scoreMe);

window.addEventListener('resize', resizeGame);
document.addEventListener('DOMContentLoaded', async () => {
    resizeGame();
    await loadDictionary();
    initBoard();
    if (urlParams.get('autoplay')) {
        runAutoplay();
    }
});
