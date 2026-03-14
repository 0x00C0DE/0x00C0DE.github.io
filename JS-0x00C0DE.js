/*
Header behavior restored to match original site motion,
while preserving the dropdown navigation.
Based on the original scroll animation logic provided by Braden. 
*/

document.addEventListener('DOMContentLoaded', function () {
  const brand = document.querySelector('.head-top');
  const navMenu = document.querySelector('.navBar-top');
  const menuWrap = document.querySelector('.header-menu-wrap');
  const menuButton = document.querySelector('.menu-toggle');

var _0x5558=["\x2E\x68\x65\x61\x64\x65\x72\x2D\x74\x6F\x70","\x2E\x68\x65\x61\x64\x2D\x74\x6F\x70","\x2E\x6E\x61\x76\x42\x61\x72\x2D\x74\x6F\x70","\x73\x63\x72\x6F\x6C\x6C\x54\x6F\x70","\x68\x65\x61\x64\x65\x72\x2D\x74\x6F\x70\x41\x63\x74\x69\x76\x65","\x72\x65\x6D\x6F\x76\x65\x43\x6C\x61\x73\x73","\x68\x65\x61\x64\x65\x72\x2D\x74\x6F\x70","\x61\x64\x64\x43\x6C\x61\x73\x73","\x68\x65\x61\x64\x2D\x74\x6F\x70\x41\x63\x74\x69\x76\x65","\x68\x65\x61\x64\x2D\x74\x6F\x70","\x69\x63\x6F\x6E\x2D\x74\x6F\x70\x41\x63\x74\x69\x76\x65","\x6E\x61\x76\x42\x61\x72\x2D\x74\x6F\x70","\x73\x63\x72\x6F\x6C\x6C","\x72\x65\x61\x64\x79"];$(document)[_0x5558[13]](function(){header= $(_0x5558[0]);head= $(_0x5558[1]);navIcons= $(_0x5558[2]);$(document)[_0x5558[12]](function(){var _0x7646x1=$(this)[_0x5558[3]]();if(_0x7646x1> 4){header[_0x5558[5]](_0x5558[4]);header[_0x5558[7]](_0x5558[6]);head[_0x5558[5]](_0x5558[8]);head[_0x5558[7]](_0x5558[9]);navIcons[_0x5558[5]](_0x5558[10]);navIcons[_0x5558[7]](_0x5558[11])}else {header[_0x5558[7]](_0x5558[4]);head[_0x5558[7]](_0x5558[8]);navIcons[_0x5558[7]](_0x5558[10])}})})

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

});
