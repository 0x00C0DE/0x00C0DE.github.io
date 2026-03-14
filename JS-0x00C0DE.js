/*
Restored original-style scroll animation for the red header,
while preserving the dropdown navigation in the header.
*/

document.addEventListener('DOMContentLoaded', function () {
  const header = document.querySelector('.header-top');
  const head = document.querySelector('.head-top');
  const navIcons = document.querySelector('.header-menu-wrap');
  const navMenu = document.querySelector('.navBar-top');
  const menuButton = document.querySelector('.menu-toggle');

  function syncHeader() {
    const scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (scrolled > 4) {
      header && header.classList.add('header-topActive');
      head && head.classList.add('head-topActive');
      navIcons && navIcons.classList.add('icon-topActive');
    } else {
      header && header.classList.remove('header-topActive');
      head && head.classList.remove('head-topActive');
      navIcons && navIcons.classList.remove('icon-topActive');
    }
  }

  if (menuButton && navIcons) {
    menuButton.addEventListener('click', function (event) {
      event.stopPropagation();
      const open = navIcons.classList.toggle('menu-open');
      menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', function (event) {
      if (!navIcons.contains(event.target)) {
        navIcons.classList.remove('menu-open');
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });

    if (navMenu) {
      navMenu.addEventListener('click', function (event) {
        if (event.target.tagName === 'A') {
          navIcons.classList.remove('menu-open');
          menuButton.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  window.addEventListener('scroll', syncHeader, { passive: true });
  window.addEventListener('resize', syncHeader);
  syncHeader();
});
