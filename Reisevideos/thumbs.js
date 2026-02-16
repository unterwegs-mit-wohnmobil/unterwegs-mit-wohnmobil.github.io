/* =====================================================
   thumbs.js 
   ===================================================== */

window.addEventListener("load", () => {
  const hash = window.location.hash.substring(1);
  if (!hash) return;

  const scrollToElement = () => {
    const element = document.getElementById(hash);
    if (element) {
      // "force" scroll
      const offset = 100; // Dein Header-Abstand
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      console.log("Erzwungener Sprung zu ID:", hash, "Position:", offsetPosition);
    }
  };

  // Doppelte Ausführung: Sofort und nach einer winzigen Pause
  scrollToElement();
  setTimeout(scrollToElement, 300);
});
