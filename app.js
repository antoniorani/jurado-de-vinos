document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const pageShell = document.querySelector('.page-shell');
if (pageShell && !document.querySelector('.site-footer')) {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = '<p>Curso de IA y Estadística de datos. Autor: Antonio Ramos Nieto.</p>';
  pageShell.insertAdjacentElement('beforeend', footer);
}
