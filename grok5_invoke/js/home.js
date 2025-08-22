document.addEventListener('DOMContentLoaded', () => {
    gsap.from('.navbar', { opacity: 0, y: -50, duration: 1, ease: 'power2.out' });
    gsap.from('.hero h2', { opacity: 0, y: -30, duration: 1, delay: 0.3, ease: 'power2.out' });
    gsap.from('.hero p', { opacity: 0, y: 20, duration: 1, delay: 0.5, ease: 'power2.out' });
    gsap.from('.hero-buttons', { opacity: 0, y: 20, duration: 1, delay: 0.7, ease: 'power2.out' });
    gsap.from('.experts h3', { opacity: 0, y: 20, duration: 1, delay: 0.9, ease: 'power2.out' });
    gsap.from('.expert-card', { opacity: 0, y: 20, duration: 1, stagger: 0.2, delay: 1.0, ease: 'power2.out' });
    gsap.from('.team h3', { opacity: 0, y: 20, duration: 1, delay: 1.2, ease: 'power2.out' });
    gsap.from('.team-member', { opacity: 0, y: 20, duration: 1, stagger: 0.2, delay: 1.3, ease: 'power2.out' });
    gsap.from('.cases h3', { opacity: 0, y: 20, duration: 1, delay: 1.5, ease: 'power2.out' });
    gsap.from('.case-card', { opacity: 0, y: 20, duration: 1, stagger: 0.2, delay: 1.6, ease: 'power2.out' });
    gsap.from('.pricing h3', { opacity: 0, y: 20, duration: 1, delay: 1.8, ease: 'power2.out' });
    gsap.from('.pricing-card', { opacity: 0, y: 20, duration: 1, stagger: 0.2, delay: 1.9, ease: 'power2.out' });
});