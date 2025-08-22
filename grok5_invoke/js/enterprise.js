document.addEventListener('DOMContentLoaded', () => {
    gsap.from('.navbar', { opacity: 0, y: -50, duration: 1, ease: 'power2.out' });
    gsap.from('.enterprise-services h1', { opacity: 0, y: -30, duration: 1, delay: 0.3, ease: 'power2.out' });
    gsap.from('.subtitle', { opacity: 0, y: 20, duration: 1, delay: 0.5, ease: 'power2.out' });
    gsap.from('.plan-card', { opacity: 0, y: 20, duration: 1, stagger: 0.2, delay: 0.7, ease: 'power2.out' });
});