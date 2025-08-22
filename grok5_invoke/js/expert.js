document.addEventListener('DOMContentLoaded', () => {
    // 动画
    gsap.from('.navbar', { opacity: 0, y: -50, duration: 1, ease: 'power2.out' });
    gsap.from('.expert-profile', { opacity: 0, y: 50, duration: 1, delay: 0.3, ease: 'power2.out' });
    gsap.from('.profile-photo', { opacity: 0, scale: 0.8, duration: 1, delay: 0.5, ease: 'power2.out' });
    gsap.from('.profile-details h4, .profile-details p, .profile-details ul', { opacity: 0, y: 20, duration: 1, stagger: 0.2, delay: 0.7, ease: 'power2.out' });
    gsap.from('.btn-profile', { opacity: 0, y: 20, duration: 1, delay: 0.9, ease: 'power2.out' });
});