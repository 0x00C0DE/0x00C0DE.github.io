/*
Header behavior restored to match original site motion,
while preserving the dropdown navigation.
Based on the original scroll animation logic provided by Braden. 
*/

document.addEventListener('DOMContentLoaded', function () {
  const header = document.querySelector('.header-top');
  const brand = document.querySelector('.head-top');
  const navMenu = document.querySelector('.navBar-top');
  const menuWrap = document.querySelector('.header-menu-wrap');
  const menuButton = document.querySelector('.menu-toggle');

  function syncHeaderOnScroll() {
    const scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (scrolled > 4) {
      if (header) header.classList.add('header-topActive');
      if (brand) brand.classList.add('head-topActive');
    } else {
      if (header) header.classList.remove('header-topActive');
      if (brand) brand.classList.remove('head-topActive');
    }
  }

  if (menuButton && menuWrap) {
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

    if (navMenu) {
      navMenu.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') {
          menuWrap.classList.remove('menu-open');
          menuButton.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  window.addEventListener('scroll', syncHeaderOnScroll, { passive: true });
  window.addEventListener('resize', syncHeaderOnScroll);
  syncHeaderOnScroll();
});
