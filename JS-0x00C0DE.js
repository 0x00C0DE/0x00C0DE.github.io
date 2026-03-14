
/* header interaction */
document.addEventListener('DOMContentLoaded', function () {
  const header = document.querySelector('.header-dynamic');
  const menuWrap = document.querySelector('.header-menu-wrap');
  const menuButton = document.querySelector('.menu-toggle');
  if (!header || !menuWrap || !menuButton) return;

  function syncHeader() {
    if (window.scrollY > 12) {
      header.classList.add('header-compact');
    } else {
      header.classList.remove('header-compact');
    }
  }

  menuButton.addEventListener('click', function (e) {
    e.stopPropagation();
    const open = menuWrap.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', function (e) {
    if (!menuWrap.contains(e.target)) {
      menuWrap.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('scroll', syncHeader, { passive: true });
  syncHeader();
});
