/* Mobile navigation */
const navToggle = document.querySelector("[data-nav-toggle]");
const navMenu = document.querySelector("[data-nav-menu]");

if (navToggle && navMenu) {
  const close = () => {
    navMenu.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const open = navMenu.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  navMenu.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });

  document.addEventListener("click", (e) => {
    if (!navMenu.classList.contains("is-open")) return;
    if (navMenu.contains(e.target) || navToggle.contains(e.target)) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navMenu.classList.contains("is-open")) {
      close();
      navToggle.focus();
    }
  });
}

/* Event filtering */
const filterForm = document.querySelector("[data-event-filters]");

if (filterForm) {
  const cards = Array.from(document.querySelectorAll("[data-event-card]"));
  const sections = Array.from(document.querySelectorAll("[data-event-section]"));

  const apply = () => {
    const fd = new FormData(filterForm);
    const search = String(fd.get("search") || "").trim().toLowerCase();
    const category = String(fd.get("category") || "");
    const month = String(fd.get("month") || "");

    cards.forEach((card) => {
      card.hidden = !(
        (!search || card.dataset.search.includes(search)) &&
        (!category || card.dataset.category === category) &&
        (!month || card.dataset.month === month)
      );
    });

    sections.forEach((sec) => {
      const visible = sec.querySelectorAll("[data-event-card]:not([hidden])").length;
      const count = sec.querySelector("[data-event-count]");
      const empty = sec.querySelector("[data-filter-empty]");
      if (count) count.textContent = `${visible} event${visible === 1 ? "" : "s"}`;
      if (empty) empty.hidden = visible !== 0;
    });
  };

  filterForm.addEventListener("input", apply);
  filterForm.addEventListener("change", apply);
  filterForm.addEventListener("reset", () => requestAnimationFrame(apply));
}

/* Carousel */
const track = document.querySelector("[data-carousel-track]");
const prev = document.querySelector("[data-carousel-prev]");
const next = document.querySelector("[data-carousel-next]");

if (track && prev && next) {
  const step = () => {
    const first = track.firstElementChild;
    const gap = parseFloat(getComputedStyle(track).gap || "0");
    return first ? first.getBoundingClientRect().width + gap : track.clientWidth * 0.9;
  };

  const update = () => {
    const max = Math.max(0, track.scrollWidth - track.clientWidth - 2);
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  };

  prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
  track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  window.addEventListener("resize", update);
  update();
}
