document.addEventListener("DOMContentLoaded", function () {
  const header = document.querySelector(".header-top");
  const navWrap = document.querySelector(".header-menu-wrap");
  const navMenu = document.querySelector(".navBar-top");
  const menuButton = document.querySelector(".menu-toggle");
  const filterButtons = document.querySelectorAll("[data-filter]");
  const filterCards = document.querySelectorAll("[data-category]");
  const revealNodes = document.querySelectorAll(".reveal");

  function syncHeader() {
    const scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (header) {
      header.classList.toggle("header-topActive", scrolled > 10);
    }
  }

  if (menuButton && navWrap) {
    menuButton.addEventListener("click", function (event) {
      event.stopPropagation();
      const open = navWrap.classList.toggle("menu-open");
      menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (event) {
      if (!navWrap.contains(event.target)) {
        navWrap.classList.remove("menu-open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });

    if (navMenu) {
      navMenu.addEventListener("click", function (event) {
        if (event.target.tagName === "A") {
          navWrap.classList.remove("menu-open");
          menuButton.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  if (filterButtons.length && filterCards.length) {
    filterButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const filter = button.getAttribute("data-filter");

        filterButtons.forEach(function (chip) {
          chip.classList.toggle("active", chip === button);
        });

        filterCards.forEach(function (card) {
          const category = card.getAttribute("data-category") || "";
          const visible = filter === "all" || category.indexOf(filter) !== -1;
          card.hidden = !visible;
        });
      });
    });
  }

  if (revealNodes.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    revealNodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  window.addEventListener("scroll", syncHeader, { passive: true });
  window.addEventListener("resize", syncHeader);
  syncHeader();
});
