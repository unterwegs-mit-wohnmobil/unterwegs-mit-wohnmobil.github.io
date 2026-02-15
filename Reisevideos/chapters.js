/* =====================================================
   chapters.js 
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // --- KONFIGURATION ---
    const DISABLE_ON_SAFARI = false; // Auf 'false' setzen, um Kapitel in Safari zu erlauben

    // --- ELEMENTE SUCHEN ---
    const video = document.getElementById('player');
    const nav = document.getElementById('chapter-nav');
    const wrapper = document.getElementById('video-wrapper');
    const toggleBtn = document.getElementById('toggle-chapters');

    // WICHTIG: Erst prüfen, ob die Basiselemente da sind
    if (!video || !nav || !wrapper) return;

// --- VERSION-CHECK ---
const ua = navigator.userAgent;
const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

let isOldAndroid = false;
const androidMatch = ua.match(/Android\s([0-9\.]+)/);
if (androidMatch) {
    const version = parseFloat(androidMatch[1]);
    if (version < 10) isOldAndroid = true;
}
    
// --- LOGIK-WEICHE ---
if ((DISABLE_ON_SAFARI && isSafari) || isOldAndroid) {
    // UI deaktivieren: Das Tablet zeigt nur den Standard-Player
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (nav) nav.style.display = 'none';
    console.log("Legacy-Gerät oder Safari: Nutze Standard-Player.");
} else {
    if (toggleBtn) toggleBtn.style.display = 'block';
}
    
    const unmuteBtn = document.getElementById('unmute-btn');
    if (video && unmuteBtn) {
        // Button nur anzeigen, wenn JS aktiv ist
        unmuteBtn.style.display = 'inline-block';

        unmuteBtn.addEventListener('click', () => {
            video.muted = false; // Ton einschalten
            
            // In Safari sicherheitshalber play() triggern
            video.play().catch(e => console.log("Autoplay blocked:", e));
            
            // Button sofort entfernen
            unmuteBtn.style.display = 'none';
        });

        // Falls der Nutzer den Ton über die Video-Controls selbst anmacht:
        video.addEventListener('volumechange', () => {
            if (!video.muted) {
                unmuteBtn.style.display = 'none';
            }
        });
    }
    // --- 1. DRAG & CLICK LOGIK ---
    // Hier geht es jetzt ganz normal weiter...
    // --- 1. DRAG & CLICK LOGIK ---
    let isDragging = false;
    let startX, startY;
    const moveThreshold = 5;

    // 1. Position aus der Session laden
    const savedPos = sessionStorage.getItem('chapterBtnPos');
    if (savedPos && toggleBtn) {
        const pos = JSON.parse(savedPos);
        toggleBtn.style.left = pos.x;
        toggleBtn.style.top = pos.y;
        toggleBtn.style.right = 'auto';
        toggleBtn.style.bottom = 'auto';
    }

    if (toggleBtn) {
         const onStart = (e) => {
            isDragging = false;
            startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            document.addEventListener(e.type.includes('touch') ? 'touchmove' : 'mousemove', onMove);
            document.addEventListener(e.type.includes('touch') ? 'touchend' : 'mouseup', onEnd);
        };

        const onMove = (e) => {
            const x = e.type.includes('touch') ? (e.touches[0]?.clientX || 0) : e.clientX;
            const y = e.type.includes('touch') ? (e.touches[0]?.clientY || 0) : e.clientY;

            if (Math.abs(x - startX) > moveThreshold || Math.abs(y - startY) > moveThreshold) {
                isDragging = true;
                const rect = wrapper.getBoundingClientRect();
                
                let xPct = ((x - rect.left - (toggleBtn.offsetWidth / 2)) / rect.width) * 100;
                let yPct = ((y - rect.top - (toggleBtn.offsetHeight / 2)) / rect.height) * 100;

                // Sicherheitsränder (0% bis ca. 95%)
                xPct = Math.max(0, Math.min(xPct, 96)); 
                yPct = Math.max(0, Math.min(yPct, 94));

                toggleBtn.style.left = xPct + '%';
                toggleBtn.style.top = yPct + '%';
                toggleBtn.style.right = 'auto';
                toggleBtn.style.bottom = 'auto';
            }
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);

            if (isDragging) {
                sessionStorage.setItem('chapterBtnPos', JSON.stringify({ 
                    x: toggleBtn.style.left, 
                    y: toggleBtn.style.top 
                }));
            } else {
                const isHidden = nav.classList.toggle('hidden');
                nav.style.display = isHidden ? 'none' : 'flex';
            }
        };

        toggleBtn.addEventListener('mousedown', onStart);
        toggleBtn.addEventListener('touchstart', onStart, { passive: true });
        
        // --- DOPPELKLICK RESET ---
        toggleBtn.addEventListener('dblclick', (e) => {
            e.preventDefault();
            // 1. Speicher löschen
            sessionStorage.removeItem('chapterBtnPos');
            
            // 2. Position im CSS zurücksetzen (auf die Werte aus deinem Stylesheet)
            toggleBtn.style.left = 'auto';
            toggleBtn.style.top = 'auto';
            toggleBtn.style.right = '3%';
            toggleBtn.style.bottom = '5%';
            
            // Optional: Visuelles Feedback (kurzes Aufblinken)
            toggleBtn.style.opacity = '0.5';
            setTimeout(() => toggleBtn.style.opacity = '1', 200);
        });
    }

    const closeMenu = () => {
        nav.classList.add('hidden');
        nav.style.display = 'none';
    };

    // --- 2. KAPITEL-DATEN LADEN ---
    const trackElement = video.querySelector('track[kind="chapters"]');
    const vttPath = trackElement ? trackElement.src : null;
    
    if (vttPath) {
        // Wir nutzen das vorhandene trackElement aus dem HTML
        trackElement.track.mode = 'hidden'; 

        fetch(vttPath)
            .then(response => response.ok ? response.text() : Promise.reject())
            .then(text => renderButtons(parseVTT(text)))
            .catch(() => {
                if (toggleBtn) toggleBtn.style.display = 'none';
            });

        video.addEventListener('timeupdate', () => {
            const activeCues = trackElement.track.activeCues;
            if (activeCues && activeCues.length > 0) {
                const txt = activeCues[0].text;
                updateActiveButton(txt);
            } else if (label) {
                label.style.display = 'none';
            }
        });
    }

    // --- 3. VOLLBILD LOGIK (NUR Fullscreen-Toggle) ---
    let lastClick = 0;
    wrapper.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('nav')) return;
        const now = Date.now();
        if (now - lastClick < 300) {
            e.preventDefault();
            const isFS = document.fullscreenElement || document.webkitFullscreenElement;
            if (!isFS) {
                (wrapper.requestFullscreen || wrapper.webkitRequestFullscreen).call(wrapper);
            } else {
                (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            }
        } else {
            closeMenu();
        }
        lastClick = now;
    });
// --- 4. ZEITPUNKT AUS URL LADEN (?t=ssss.ttt) ---
    const urlParams = new URLSearchParams(window.location.search);
    const startTime = urlParams.get('t');

    if (startTime) {
        const startSeconds = parseFloat(startTime);
        
        // Prüfen, ob es eine gültige Zahl ist und über 0 liegt
        if (!isNaN(startSeconds) && startSeconds > 0) {
            
            // Wir warten kurz, bis das Video bereit ist, die Zeit zu setzen
            video.addEventListener('loadedmetadata', () => {
                video.currentTime = startSeconds;
            }, { once: true });

            // Falls die Metadaten schon da sind (Browser-Cache)
            if (video.readyState >= 1) {
                video.currentTime = startSeconds;
            }
        }
    }

    // --- 5. HELPER ---
    function renderButtons(chapters) {
        nav.innerHTML = '';
        chapters.forEach(ch => {
            const btn = document.createElement('button');
            btn.className = 'chapter-btn';
            btn.innerHTML = `<strong>${formatTime(ch.start)}</strong><span>${ch.title}</span>`;
            btn.onclick = (e) => {
                e.preventDefault();
                video.currentTime = ch.start;
                setTimeout(() => video.play(), 50);
                closeMenu();
            };
            nav.appendChild(btn);
        });
    }

    function updateActiveButton(title) {
        nav.querySelectorAll('.chapter-btn').forEach(btn => {
            const isMatch = btn.querySelector('span').innerText === title;
            btn.classList.toggle('active', isMatch);
            if (isMatch) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    function parseVTT(text) {
        const chapters = [];
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('-->')) {
                const start = vttTimeToSeconds(lines[i].split('-->')[0].trim());
                const title = lines[i + 1] ? lines[i + 1].trim() : "Kapitel";
                chapters.push({ start, title });
            }
        }
        return chapters;
    }

    function vttTimeToSeconds(s) {
        const p = s.split(':');
        return p.length === 3 ? (+p[0])*3600 + (+p[1])*60 + (+p[2]) : (+p[0])*60 + (+p[1]);
    }

    function formatTime(s) {
        const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
        return (h > 0 ? h + ":" + (m < 10 ? "0" + m : m) : m) + ":" + (sec < 10 ? "0" + sec : sec);
    }
});
