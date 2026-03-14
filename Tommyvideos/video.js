/* =====================================================
   video.js 
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // ZUERST die Overlay-Elemente definieren
  const overlay = document.getElementById("thumbs-overlay");
  const contentTarget = document.getElementById("thumbs-content-target");
  const closeOverlayBtn = document.getElementById("close-overlay");

  // JETZT das System aktivieren
  if (overlay) {
    overlay.classList.add("js-enabled");
  }
  // --- KONFIGURATION ---
  const DISABLE_ON_SAFARI = false; // Auf 'false' setzen, um Kapitel in Safari zu erlauben

  // --- ELEMENTE SUCHEN ---
  const video = document.getElementById("player");
  const nav = document.getElementById("chapter-nav");
  const wrapper = document.getElementById("video-wrapper");
  const toggleBtn = document.getElementById("toggle-chapters");

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
    if (toggleBtn) toggleBtn.style.display = "none";
    if (nav) nav.style.display = "none";
    console.log("Legacy-Gerät oder Safari: Nutze Standard-Player.");
  } else {
    if (toggleBtn) toggleBtn.style.display = "block";
  }

  const unmuteBtn = document.getElementById("unmute-btn");
  if (video && unmuteBtn) {
    // Button nur anzeigen, wenn JS aktiv ist
    unmuteBtn.style.display = "inline-block";

    unmuteBtn.addEventListener("click", () => {
      video.muted = false; // Ton einschalten

      // In Safari sicherheitshalber play() triggern
      video.play().catch((e) => console.log("Autoplay blocked:", e));

      // Button sofort entfernen
      unmuteBtn.style.display = "none";
    });

    // Falls der Nutzer den Ton über die Video-Controls selbst anmacht:
    video.addEventListener("volumechange", () => {
      if (!video.muted) {
        unmuteBtn.style.display = "none";
      }
    });
  }
  // --- 1. DRAG & CLICK LOGIK ---
  let isDragging = false;
  let startX, startY;
  const moveThreshold = 5;

  // Prüfen, ob ein Kapitel-Track im Video vorhanden ist
  const hasChapters = video.querySelector('track[kind="chapters"]');

  if (!hasChapters && toggleBtn) {
    // Falls keine Kapitel da sind: Button komplett verstecken und Skript hier abbrechen
    toggleBtn.style.display = "none";
  } else if (toggleBtn) {
    // NUR WENN Kapitel da sind, führen wir deine Logik aus:
    // 1. Position aus der Session laden
    const savedPos = sessionStorage.getItem("chapterBtnPos");
    if (savedPos && toggleBtn) {
      const pos = JSON.parse(savedPos);
      toggleBtn.style.left = pos.x;
      toggleBtn.style.top = pos.y;
      toggleBtn.style.right = "auto";
      toggleBtn.style.bottom = "auto";
    }

    if (toggleBtn) {
      const onStart = (e) => {
        isDragging = false;
        startX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
        startY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

        document.addEventListener(e.type.includes("touch") ? "touchmove" : "mousemove", onMove);
        document.addEventListener(e.type.includes("touch") ? "touchend" : "mouseup", onEnd);
      };

      const onMove = (e) => {
        const x = e.type.includes("touch") ? e.touches[0]?.clientX || 0 : e.clientX;
        const y = e.type.includes("touch") ? e.touches[0]?.clientY || 0 : e.clientY;

        if (Math.abs(x - startX) > moveThreshold || Math.abs(y - startY) > moveThreshold) {
          isDragging = true;
          const rect = wrapper.getBoundingClientRect();

          let xPct = ((x - rect.left - toggleBtn.offsetWidth / 2) / rect.width) * 100;
          let yPct = ((y - rect.top - toggleBtn.offsetHeight / 2) / rect.height) * 100;

          // Sicherheitsränder (0% bis ca. 95%)
          xPct = Math.max(0, Math.min(xPct, 96));
          yPct = Math.max(0, Math.min(yPct, 94));

          toggleBtn.style.left = xPct + "%";
          toggleBtn.style.top = yPct + "%";
          toggleBtn.style.right = "auto";
          toggleBtn.style.bottom = "auto";
        }
      };

      const onEnd = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onEnd);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);

        if (isDragging) {
          sessionStorage.setItem(
            "chapterBtnPos",
            JSON.stringify({
              x: toggleBtn.style.left,
              y: toggleBtn.style.top,
            }),
          );
        } else {
          const isHidden = nav.classList.toggle("hidden");
          nav.style.display = isHidden ? "none" : "flex";
        }
      };

      toggleBtn.addEventListener("mousedown", onStart);
      toggleBtn.addEventListener("touchstart", onStart, { passive: true });

      // --- DOPPELKLICK RESET ---
      toggleBtn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        // 1. Speicher löschen
        sessionStorage.removeItem("chapterBtnPos");

        // 2. Position im CSS zurücksetzen (auf die Werte aus deinem Stylesheet)
        toggleBtn.style.left = "auto";
        toggleBtn.style.top = "auto";
        toggleBtn.style.right = "3%";
        toggleBtn.style.bottom = "5%";

        // Optional: Visuelles Feedback (kurzes Aufblinken)
        toggleBtn.style.opacity = "0.5";
        setTimeout(() => (toggleBtn.style.opacity = "1"), 200);
      });
    }
  }

  const closeMenu = () => {
    nav.classList.add("hidden");
    nav.style.display = "none";
  };

  // --- 2. KAPITEL-DATEN LADEN ---
  const trackElement = video.querySelector('track[kind="chapters"]');
  const vttPath = trackElement ? trackElement.src : null;

  if (vttPath) {
    // Wir nutzen das vorhandene trackElement aus dem HTML
    trackElement.track.mode = "hidden";

    fetch(vttPath)
      .then((response) => (response.ok ? response.text() : Promise.reject()))
      .then((text) => renderButtons(parseVTT(text)))
      .catch(() => {
        if (toggleBtn) toggleBtn.style.display = "none";
      });

    video.addEventListener("timeupdate", () => {
      const activeCues = trackElement.track.activeCues;
      if (activeCues && activeCues.length > 0) {
        const txt = activeCues[0].text;
        updateActiveButton(txt);
      }
    });
  }

  // --- 3. VOLLBILD LOGIK (NUR Fullscreen-Toggle) ---
  let lastClick = 0;
  wrapper.addEventListener("click", (e) => {
    if (e.target.closest("button") || e.target.closest("nav")) return;
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
  const startTime = urlParams.get("t");

  if (startTime) {
    const startSeconds = parseFloat(startTime);

    // Prüfen, ob es eine gültige Zahl ist und über 0 liegt
    if (!isNaN(startSeconds) && startSeconds > 0) {
      // Wir warten kurz, bis das Video bereit ist, die Zeit zu setzen
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = startSeconds;
        },
        { once: true },
      );

      // Falls die Metadaten schon da sind (Browser-Cache)
      if (video.readyState >= 1) {
        video.currentTime = startSeconds;
      }
    }
  }

  /* --- 5. SPA OVERLAY & AUTO-SCROLL LOGIK --- */
  /* --- FLEXIBLE SPA LOGIK (Bilder & Kapitel) --- */
  document.querySelectorAll(".spa-link").forEach((trigger) => {
    trigger.addEventListener("click", async (e) => {
      e.preventDefault();

      if (video) video.pause();

      const url = trigger.getAttribute("href");

      // SCHRITT 1: Hier wird entschieden, welche Daten wir nutzen
      const data = url.toLowerCase().includes("kapitel") ? video.dataset.timelineChapters : video.dataset.timeline;
      const timelineData = JSON.parse(data || "{}");

      try {
        const response = await fetch(url);
        const htmlText = await response.text();
        const doc = new DOMParser().parseFromString(htmlText, "text/html");

        const galleryContent = doc.querySelector(".clearfix");
        contentTarget.innerHTML = galleryContent ? galleryContent.outerHTML : doc.body.innerHTML;

        overlay.classList.add("is-visible");
        document.body.classList.add("overlay-open");

        // SCHRITT 2: Das Scrollen (Innerhalb deines Timeouts)
        // Nur scrollen, wenn es NICHT der "Galerie oben" Link ist
        const shouldScroll = trigger.getAttribute("title") !== "Galerie oben";

        if (shouldScroll) {
          setTimeout(() => {
            const currentTime = video.currentTime;

            if (timelineData && Object.keys(timelineData).length > 0) {
              let bestMatchId = "";
              const times = Object.keys(timelineData)
                .map(Number)
                .sort((a, b) => a - b);

              for (let t of times) {
                // + 0.1 Sekunden Puffer fängt kleine Ungenauigkeiten ab
                if (t <= currentTime + 0.1) {
                  bestMatchId = timelineData[t.toFixed(3)];
                } else break;
              }

              if (bestMatchId) {
                // WICHTIG: Erst alle alten Markierungen entfernen
                contentTarget.querySelectorAll(".spa-highlight").forEach((el) => el.classList.remove("spa-highlight"));

                const targetEl = contentTarget.querySelector(`[id="${bestMatchId}"]`);
                if (targetEl) {
                  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                  targetEl.classList.add("spa-highlight");
                }
              }
            }
          }, 300);
        }

        if (typeof setupInternalLinks === "function") setupInternalLinks();
      } catch (err) {
        console.warn("Fetch fehlgeschlagen, wechsle normal zur Seite:", err);
        window.location.href = url;
      }
    });
  });
  // Event-Listener für den Schließen-Button (das "X")
  if (closeOverlayBtn) {
    closeOverlayBtn.addEventListener("click", closeOverlay);
  }

  // --- 6. HELPER ---

  function setupInternalLinks() {
    const links = contentTarget.querySelectorAll("a");
    links.forEach((link) => {
      link.addEventListener("click", (evt) => {
        const href = link.getAttribute("href");
        if (href && href.includes("?t=")) {
          evt.preventDefault();
          const time = parseFloat(href.split("?t=")[1]);
          if (!isNaN(time)) {
            video.currentTime = time;
            // Video springt zur Zeit UND spielt los
            video.play().catch((err) => console.log("Play blockiert:", err));
            closeOverlay();
          }
        }
      });
    });
  }

  function closeOverlay() {
    if (overlay) {
      overlay.classList.remove("is-visible");
      document.body.classList.remove("overlay-open");

      setTimeout(() => {
        if (!overlay.classList.contains("is-visible")) {
          contentTarget.innerHTML = "";
          // WICHTIG: Auch den Scrollzustand für das nächste Mal zurücksetzen
          contentTarget.scrollTop = 0;
        }
      }, 500); // Entsprechend deiner CSS-Transition-Zeit (0.5s)

      if (video) {
        video.play().catch((err) => console.log("Play blockiert:", err));
      }
    }
  }
  function renderButtons(chapters) {
    nav.innerHTML = "";
    chapters.forEach((ch) => {
      const btn = document.createElement("button");
      btn.className = "chapter-btn";
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
    nav.querySelectorAll(".chapter-btn").forEach((btn) => {
      const isMatch = btn.querySelector("span").innerText === title;
      btn.classList.toggle("active", isMatch);
      if (isMatch) btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function parseVTT(text) {
    const chapters = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        const start = vttTimeToSeconds(lines[i].split("-->")[0].trim());
        const title = lines[i + 1] ? lines[i + 1].trim() : "Kapitel";
        chapters.push({ start, title });
      }
    }
    return chapters;
  }

  function vttTimeToSeconds(s) {
    const p = s.split(":");
    return p.length === 3 ? +p[0] * 3600 + +p[1] * 60 + +p[2] : +p[0] * 60 + +p[1];
  }

  function formatTime(s) {
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = Math.floor(s % 60);
    return (h > 0 ? h + ":" + (m < 10 ? "0" + m : m) : m) + ":" + (sec < 10 ? "0" + sec : sec);
  }
});
