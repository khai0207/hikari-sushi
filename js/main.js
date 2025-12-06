// ===== IMAGE CACHE SYSTEM =====
const imageCache = new Map();
let criticalImagesLoaded = false;
let allMenuImages = [];

// Helper function to add resize params to image URL
// Sizes are doubled for retina displays (actual size rendered by worker)
function getResizedImageUrl(url, width, height, quality = 85) {
    if (!url || url.startsWith('data:')) return url;
    // Only add params to our API URLs
    if (url.includes('hikari-sushi-api')) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}w=${width}&h=${height}&q=${quality}`;
    }
    return url;
}

// For content images that are pre-resized during upload
// These folders contain optimized images: about/, signature/, specialties/, reservation/, gallery/
function isPreResizedContentImage(url) {
    if (!url || !url.includes('hikari-sushi-api')) return false;
    return url.includes('/assets/about/') ||
           url.includes('/assets/signature/') ||
           url.includes('/assets/specialties/') ||
           url.includes('/assets/reservation/') ||
           url.includes('/assets/gallery/');
}

// Get image URL - use direct URL for pre-resized content, resize for others
function getOptimizedImageUrl(url, width, height, quality = 85) {
    if (!url || url.startsWith('data:')) return url;
    // Pre-resized content images - use directly
    if (isPreResizedContentImage(url)) {
        return url;
    }
    // Other images - add resize params
    return getResizedImageUrl(url, width, height, quality);
}

// Predefined sizes for different contexts (before 2x scaling in worker)
const IMAGE_SIZES = {
    menuCard: { w: 300, h: 300, q: 85 },      // Menu item thumbnails
    specialty: { w: 400, h: 400, q: 85 },     // Specialty cards
    specialtyLarge: { w: 600, h: 600, q: 85 },// Large specialty card
    about: { w: 600, h: 700, q: 85 },         // About section main
    aboutSmall: { w: 300, h: 300, q: 85 },    // About section secondary
    gallery: { w: 600, h: 400, q: 85 },       // Gallery thumbnails
    signature: { w: 600, h: 600, q: 85 },     // Signature dish
    reservation: { w: 600, h: 600, q: 85 },   // Reservation section
    hero: null                                 // Hero - no resize (full quality)
};

function preloadImage(url) {
    if (!url || imageCache.has(url)) return Promise.resolve(imageCache.get(url));
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(url, img);
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function preloadImages(urls) {
    const promises = urls.filter(url => url && !imageCache.has(url)).map(url => preloadImage(url));
    return Promise.allSettled(promises);
}

// Preload ALL images early (called before DOMContentLoaded)
async function preloadCriticalImages() {
    try {
        // Fetch menu data early
        const response = await fetch('https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/api/menu');
        const result = await response.json();
        
        if (result.success && result.items) {
            // Get ALL menu images with resize params for menu cards
            allMenuImages = result.items
                .map(item => item.image)
                .filter(Boolean)
                .map(url => getResizedImageUrl(url, IMAGE_SIZES.menuCard.w, IMAGE_SIZES.menuCard.h, IMAGE_SIZES.menuCard.q));
            
            console.log('🚀 Preloading', allMenuImages.length, 'resized images...');
            
            // Preload all resized images in parallel
            await preloadImages(allMenuImages);
            
            console.log('✅ Critical images preloaded');
            criticalImagesLoaded = true;
        }
    } catch (e) {
        console.log('Preload skipped:', e.message);
        criticalImagesLoaded = true; // Don't block on error
    }
}

// Start preloading immediately
const preloadPromise = preloadCriticalImages();

// ===== ALWAYS START AT TOP ON PAGE LOAD =====
// Reset scroll position and URL hash on page load/refresh
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// Clear hash from URL on page load
if (window.location.hash) {
    history.replaceState(null, null, window.location.pathname);
}

// ===== PRELOADER =====
window.addEventListener('load', async () => {
    const preloader = document.querySelector('.preloader');
    document.body.classList.add('loading');
    
    // Ensure we're at the top
    window.scrollTo(0, 0);
    
    // Wait for critical images (max 3 seconds)
    const timeout = new Promise(resolve => setTimeout(resolve, 3000));
    await Promise.race([preloadPromise, timeout]);
    
    // Hide preloader
    preloader.classList.add('hidden');
    document.body.classList.remove('loading');
    setTimeout(() => preloader.remove(), 500);
});

// ===== HERO SLIDESHOW =====
let heroSlides = document.querySelectorAll('.hero-slide');
let heroCurrentSlide = 0;
const heroSlideInterval = 5000; // Change slide every 5 seconds
let heroIntervalId = null;

function nextHeroSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length <= 1) return;
    
    slides[heroCurrentSlide].classList.remove('active');
    heroCurrentSlide = (heroCurrentSlide + 1) % slides.length;
    slides[heroCurrentSlide].classList.add('active');
}

function startHeroSlideshow() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length > 1 && !heroIntervalId) {
        heroIntervalId = setInterval(nextHeroSlide, heroSlideInterval);
    }
}

// Load hero images from menu items
async function loadHeroFromMenu() {
    try {
        const response = await fetch('https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/api/menu');
        const result = await response.json();
        
        if (!result.success || !result.items || result.items.length === 0) {
            console.log('No menu items for hero, keeping default');
            startHeroSlideshow();
            return;
        }
        
        // Get items with valid images (not base64 for better performance)
        const itemsWithImages = result.items.filter(item => 
            item.image && 
            (item.image.startsWith('http') || item.image.startsWith('/assets/'))
        );
        
        if (itemsWithImages.length === 0) {
            console.log('No valid images in menu items');
            startHeroSlideshow();
            return;
        }
        
        // Shuffle and take up to 5 images
        const shuffled = itemsWithImages.sort(() => Math.random() - 0.5);
        const heroImages = shuffled.slice(0, 5).map(item => item.image);
        
        // Update hero slideshow
        const slideshow = document.getElementById('heroSlideshow');
        if (slideshow) {
            // Keep overlay
            const overlay = slideshow.querySelector('.hero-overlay');
            
            // Clear existing slides
            slideshow.innerHTML = '';
            
            // Add new slides from menu
            heroImages.forEach((imageUrl, index) => {
                const slide = document.createElement('div');
                slide.className = 'hero-slide' + (index === 0 ? ' active' : '');
                slide.style.backgroundImage = `url('${imageUrl}')`;
                slideshow.appendChild(slide);
            });
            
            // Re-add overlay
            if (overlay) {
                slideshow.appendChild(overlay);
            } else {
                const newOverlay = document.createElement('div');
                newOverlay.className = 'hero-overlay';
                slideshow.appendChild(newOverlay);
            }
            
            // Update floating images too
            const floatingElements = document.getElementById('floatingElements');
            if (floatingElements && heroImages.length >= 2) {
                const floating1 = floatingElements.querySelector('.floating-1');
                const floating2 = floatingElements.querySelector('.floating-2');
                if (floating1) floating1.src = heroImages[0];
                if (floating2) floating2.src = heroImages[1];
            }
            
            // Reset and start slideshow
            heroCurrentSlide = 0;
            startHeroSlideshow();
            
            console.log(`✅ Hero loaded with ${heroImages.length} images from menu`);
        }
    } catch (error) {
        console.error('Error loading hero images:', error);
        startHeroSlideshow();
    }
}

// Initialize hero on load
loadHeroFromMenu();

if (heroSlides.length > 1) {
    startHeroSlideshow();
}

// ===== INITIALIZE AOS =====
// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

AOS.init({
    duration: prefersReducedMotion ? 0 : 600, // Faster animations
    easing: 'ease-out',
    once: true, // Only animate once for better performance
    offset: 80,
    disable: prefersReducedMotion // Disable if user prefers reduced motion
});

// ===== TYPING EFFECT =====
const typedTextElement = document.querySelector('.typed-text');
let words = ['cuisine japonaise', 'sushis frais', 'saveurs uniques', 'traditions'];
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeSpeed = 100;

function type() {
    const currentWord = words[wordIndex];
    
    if (isDeleting) {
        typedTextElement.textContent = currentWord.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 50;
    } else {
        typedTextElement.textContent = currentWord.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 100;
    }
    
    if (!isDeleting && charIndex === currentWord.length) {
        typeSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        typeSpeed = 500;
    }
    
    setTimeout(type, typeSpeed);
}

// Start typing effect
setTimeout(type, 1500);

// ===== HEADER & TOP BAR SCROLL EFFECT =====
const header = document.querySelector('.header');
const topBar = document.querySelector('.top-bar');
const backToTop = document.querySelector('.back-to-top');

// Use passive listener for better scroll performance
let ticking = false;
let lastScrollY = 0;

function updateHeaderOnScroll() {
    const scrollY = lastScrollY;
    
    if (scrollY > 100) {
        header.classList.add('scrolled');
        header.classList.add('top-hidden');
        topBar.classList.add('hidden');
        backToTop.classList.add('visible');
    } else {
        header.classList.remove('scrolled');
        header.classList.remove('top-hidden');
        topBar.classList.remove('hidden');
        backToTop.classList.remove('visible');
    }
    ticking = false;
}

window.addEventListener('scroll', () => {
    lastScrollY = window.scrollY;
    if (!ticking) {
        requestAnimationFrame(updateHeaderOnScroll);
        ticking = true;
    }
}, { passive: true });

// ===== MOBILE NAVIGATION =====
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const navOverlay = document.getElementById('navOverlay');
const navLinks = document.querySelectorAll('.nav-link');

function closeMobileMenu() {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
    if (navOverlay) navOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function openMobileMenu() {
    hamburger.classList.add('active');
    navMenu.classList.add('active');
    if (navOverlay) navOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

hamburger.addEventListener('click', () => {
    if (navMenu.classList.contains('active')) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
});

// Close menu when clicking overlay
if (navOverlay) {
    navOverlay.addEventListener('click', closeMobileMenu);
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        // Close mobile menu
        closeMobileMenu();
        
        // Update URL hash without scrolling (we'll scroll manually)
        history.pushState(null, null, targetId);
        
        // Smooth scroll to section
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ===== ACTIVE NAVIGATION LINK =====
const sections = document.querySelectorAll('section[id]');

// Track if user is actively scrolling (not from click)
let isScrolling = false;
let scrollTimeout;

// Use IntersectionObserver for better performance than scroll event
const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('id');
            const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
            if (navLink) {
                navLinks.forEach(link => link.classList.remove('active'));
                navLink.classList.add('active');
                
                // Update URL hash when scrolling (debounced)
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    if (window.location.hash !== `#${sectionId}`) {
                        history.replaceState(null, null, `#${sectionId}`);
                    }
                }, 100);
            }
        }
    });
}, {
    threshold: 0.15,
    rootMargin: '-80px 0px -40% 0px'
});

sections.forEach(section => navObserver.observe(section));

// ===== MENU TABS =====
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.menu-tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons and contents
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Show corresponding content
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
    });
});

// ===== TESTIMONIALS SLIDER =====
const testimonialTrack = document.querySelector('.testimonial-track');
const testimonialCards = document.querySelectorAll('.testimonial-card');
const prevBtn = document.querySelector('.slider-btn.prev');
const nextBtn = document.querySelector('.slider-btn.next');
const dots = document.querySelectorAll('.dot');
let currentSlide = 0;
const totalSlides = testimonialCards.length;

function updateSlider() {
    requestAnimationFrame(() => {
        testimonialTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    updateSlider();
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    updateSlider();
}

if (nextBtn && prevBtn) {
    nextBtn.addEventListener('click', nextSlide);
    prevBtn.addEventListener('click', prevSlide);
}

dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        currentSlide = index;
        updateSlider();
    });
});

// Auto slide with visibility check
let autoSlide;
const testimonialSlider = document.querySelector('.testimonials-slider');

function startAutoSlide() {
    if (autoSlide) clearInterval(autoSlide);
    autoSlide = setInterval(nextSlide, 5000);
}

function stopAutoSlide() {
    if (autoSlide) clearInterval(autoSlide);
}

// Only auto-slide when visible and not hovered
if (testimonialSlider) {
    const sliderVisibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                startAutoSlide();
            } else {
                stopAutoSlide();
            }
        });
    }, { threshold: 0.3 });
    
    sliderVisibilityObserver.observe(testimonialSlider);
    testimonialSlider.addEventListener('mouseenter', stopAutoSlide);
    testimonialSlider.addEventListener('mouseleave', startAutoSlide);
}

// ===== SMOOTH SCROLL =====
// Use event delegation for better performance (single listener)
document.body.addEventListener('click', function(e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;
    
    const href = anchor.getAttribute('href');
    // Skip if href is just "#" or empty
    if (!href || href === '#' || href.length <= 1) return;
    // Skip external links
    if (href.includes('://')) return;
    
    e.preventDefault();
    try {
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            closeMobileMenu();
        }
    } catch (err) {
        // Invalid selector, ignore
    }
});

// ===== PARALLAX EFFECT (Disabled for performance) =====
// Parallax removed to improve scroll performance
// The visual effect was minimal but caused significant jank

// ===== COUNTER ANIMATION =====
function animateCounter(el, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    
    function updateCounter() {
        start += increment;
        if (start < target) {
            el.textContent = Math.floor(start);
            requestAnimationFrame(updateCounter);
        } else {
            el.textContent = target;
        }
    }
    
    updateCounter();
}

// ===== INTERSECTION OBSERVER FOR ANIMATIONS =====
// Simplified - AOS handles most animation needs
// Only keep counter animation observer
const counterObserverOptions = {
    threshold: 0.5,
    rootMargin: '0px'
};

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll('[data-count]');
            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-count'));
                animateCounter(counter, target);
            });
            counterObserver.unobserve(entry.target);
        }
    });
}, counterObserverOptions);

// Only observe elements with counters
document.querySelectorAll('[data-count]').forEach(el => {
    const parent = el.closest('section');
    if (parent) counterObserver.observe(parent);
});

// ===== IMAGE LAZY LOADING =====
// Using native loading="lazy" attribute in HTML
// Only use JS observer as fallback for data-src images
const lazyImages = document.querySelectorAll('img[data-src]');

if (lazyImages.length > 0 && 'IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '50px' });

    lazyImages.forEach(img => imageObserver.observe(img));
}

// ===== MOUSE CURSOR EFFECT (Disabled for performance) =====
// Custom cursor removed to improve INP and animation performance
// This feature caused significant overhead on mouse move events

// ===== MENU ITEM HOVER EFFECT =====
// Removed JS hover - using CSS :hover for better performance
// CSS transform is hardware-accelerated and more efficient

// ===== SPECIALTY CARDS HOVER =====
// Removed JS hover - using CSS :hover for better performance

// ===== REVEAL ON SCROLL =====
// Removed - AOS library handles this more efficiently

// ===== FORM INPUT ANIMATION =====
const formInputs = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');

formInputs.forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
        if (!this.value) {
            this.parentElement.classList.remove('focused');
        }
    });
});

// ===== SET MINIMUM DATE FOR RESERVATION =====
const dateInput = document.getElementById('date');
if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
}

// ===== LIGHTBOX GALLERY =====
let galleryImages = [
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1553621042-f6e147245754?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&h=800&fit=crop'
];

let currentLightboxIndex = 0;

function openLightbox(index) {
    currentLightboxIndex = index;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    
    lightboxImg.src = galleryImages[index];
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

function changeLightbox(direction) {
    currentLightboxIndex += direction;
    
    if (currentLightboxIndex >= galleryImages.length) {
        currentLightboxIndex = 0;
    } else if (currentLightboxIndex < 0) {
        currentLightboxIndex = galleryImages.length - 1;
    }
    
    const lightboxImg = document.getElementById('lightboxImg');
    lightboxImg.style.opacity = '0';
    
    setTimeout(() => {
        lightboxImg.src = galleryImages[currentLightboxIndex];
        lightboxImg.style.opacity = '1';
    }, 200);
}

// Close lightbox on escape key
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || !lightbox.classList.contains('active')) return;
    
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeLightbox(-1);
    if (e.key === 'ArrowRight') changeLightbox(1);
});

// Close lightbox on background click
document.getElementById('lightbox')?.addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') {
        closeLightbox();
    }
});

// ===== LOAD CONTENT FROM API =====
const API_URL = 'https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev';

async function loadDynamicContent() {
    try {
        const response = await fetch(`${API_URL}/api/content`);
        const result = await response.json();
        
        if (result.success && result.content) {
            const content = result.content;
            
            // ===== HERO SECTION =====
            if (content.hero) {
                // Badge
                const badge = document.querySelector('.hero-badge span:last-child');
                if (badge && content.hero.badge) {
                    badge.textContent = content.hero.badge;
                }
                
                // Title (before typed text)
                const heroTitleLine = document.querySelector('.hero-title .line:first-child');
                if (heroTitleLine && content.hero.title) {
                    heroTitleLine.textContent = content.hero.title;
                }
                
                // Typed words - update the words array (may be JSON string or array)
                if (content.hero.typed_words) {
                    let typedWords = content.hero.typed_words;
                    // Parse if it's a JSON string
                    if (typeof typedWords === 'string') {
                        try {
                            typedWords = JSON.parse(typedWords);
                        } catch (e) {
                            // If not valid JSON, split by comma
                            typedWords = typedWords.split(',').map(w => w.trim());
                        }
                    }
                    if (Array.isArray(typedWords) && typedWords.length > 0) {
                        words.length = 0;
                        typedWords.forEach(word => words.push(word));
                    }
                }
                
                // Subtitle
                const heroSubtitle = document.querySelector('.hero-subtitle');
                if (heroSubtitle && content.hero.subtitle) {
                    heroSubtitle.textContent = content.hero.subtitle;
                }
            }
            
            // ===== ABOUT SECTION =====
            if (content.about) {
                const aboutSubtitle = document.querySelector('#about .section-subtitle');
                if (aboutSubtitle && content.about.subtitle) {
                    aboutSubtitle.innerHTML = `<span class="line"></span>${content.about.subtitle}<span class="line"></span>`;
                }
                
                const aboutTitle = document.querySelector('#about .section-title');
                if (aboutTitle && content.about.title) {
                    aboutTitle.innerHTML = content.about.title.replace(/\n/g, '<br>');
                }
                
                // About paragraph 1 (lead)
                const aboutLead = document.querySelector('#about .about-text .lead');
                if (aboutLead && content.about.description) {
                    aboutLead.textContent = content.about.description;
                }
                
                // About paragraphs 2 and 3 (after lead)
                const aboutParagraphs = document.querySelectorAll('#about .about-text > p:not(.lead)');
                if (aboutParagraphs.length >= 1 && content.about.description2) {
                    aboutParagraphs[0].textContent = content.about.description2;
                }
                if (aboutParagraphs.length >= 2 && content.about.description3) {
                    aboutParagraphs[1].textContent = content.about.description3;
                }
                
                // About image (use direct URL if pre-resized, otherwise resize)
                const aboutMainImg = document.querySelector('.about-img-main img');
                if (aboutMainImg && content.about.image) {
                    aboutMainImg.src = getOptimizedImageUrl(content.about.image, IMAGE_SIZES.about.w, IMAGE_SIZES.about.h, IMAGE_SIZES.about.q);
                    aboutMainImg.classList.remove('img-skeleton');
                }
            }
            
            // ===== CONTACT INFO =====
            if (content.contact) {
                // Phone - update all phone links and displays
                if (content.contact.phone) {
                    const phoneClean = content.contact.phone.replace(/\s/g, '');
                    
                    // All phone links
                    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
                        link.href = `tel:${phoneClean}`;
                    });
                    
                    // Phone text displays
                    document.querySelectorAll('.footer-contact a[href^="tel:"]').forEach(el => {
                        el.textContent = content.contact.phone;
                    });
                    
                    // btn-call strong
                    document.querySelectorAll('.btn-call strong').forEach(el => {
                        el.textContent = content.contact.phone;
                    });
                }
                
                // Email
                if (content.contact.email) {
                    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
                        link.href = `mailto:${content.contact.email}`;
                        if (link.textContent.includes('@')) {
                            link.textContent = content.contact.email;
                        }
                    });
                }
                
                // Address
                if (content.contact.address) {
                    const addressSpan = document.querySelector('.footer-contact li:first-child span');
                    if (addressSpan) {
                        addressSpan.innerHTML = content.contact.address.replace(', ', '<br>');
                    }
                }
            }
            
            // ===== SOCIAL LINKS =====
            if (content.social) {
                // Facebook
                const fbLinks = document.querySelectorAll('a[aria-label="Facebook"]');
                fbLinks.forEach(link => {
                    if (content.social.facebook && content.social.facebook.trim()) {
                        link.href = content.social.facebook;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    } else {
                        link.style.display = 'none'; // Hide if no link
                    }
                });
                
                // Instagram
                const igLinks = document.querySelectorAll('a[aria-label="Instagram"]');
                igLinks.forEach(link => {
                    if (content.social.instagram && content.social.instagram.trim()) {
                        link.href = content.social.instagram;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    } else {
                        link.style.display = 'none';
                    }
                });
                
                // TripAdvisor
                const taLinks = document.querySelectorAll('a[aria-label="Tripadvisor"]');
                taLinks.forEach(link => {
                    if (content.social.tripadvisor && content.social.tripadvisor.trim()) {
                        link.href = content.social.tripadvisor;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    } else {
                        link.style.display = 'none';
                    }
                });
                
                // Google
                const googleLinks = document.querySelectorAll('a[aria-label="Google"]');
                googleLinks.forEach(link => {
                    if (content.social.google && content.social.google.trim()) {
                        link.href = content.social.google;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    } else {
                        link.style.display = 'none';
                    }
                });
            }
            
            // ===== HOURS =====
            // Build hours object from individual content items
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const dayNames = {
                monday: 'Lundi',
                tuesday: 'Mardi',
                wednesday: 'Mercredi',
                thursday: 'Jeudi',
                friday: 'Vendredi',
                saturday: 'Samedi',
                sunday: 'Dimanche'
            };
            
            let hoursData = {};
            let hasHours = false;
            
            days.forEach(day => {
                // Handle both formats: content.hours.monday.lunch OR content.hours.monday_lunch
                let lunch, dinner;
                if (content.hours?.[day]) {
                    // Format: {monday: {lunch: "...", dinner: "..."}}
                    lunch = content.hours[day].lunch;
                    dinner = content.hours[day].dinner;
                } else {
                    // Format: {monday_lunch: "...", monday_dinner: "..."}
                    lunch = content.hours?.[`${day}_lunch`];
                    dinner = content.hours?.[`${day}_dinner`];
                }
                
                if (lunch || dinner) {
                    hasHours = true;
                    hoursData[day] = { lunch, dinner };
                }
            });
            
            if (hasHours) {
                // Update contact section hours
                const hoursCard = document.getElementById('contact-hours-card');
                if (hoursCard) {
                    const hoursContent = hoursCard.querySelector('.hours-content');
                    if (hoursContent) {
                        let html = '<ul class="hours-list-contact">';
                        days.forEach(day => {
                            const lunch = hoursData[day]?.lunch || '';
                            const dinner = hoursData[day]?.dinner || '';
                            
                            let timeText = 'Fermé';
                            if (lunch && dinner) {
                                timeText = `${lunch} / ${dinner}`;
                            } else if (lunch) {
                                timeText = lunch;
                            } else if (dinner) {
                                timeText = `Fermé / ${dinner}`;
                            }
                            
                            html += `<li><span>${dayNames[day]}</span><span>${timeText}</span></li>`;
                        });
                        html += '</ul>';
                        hoursContent.innerHTML = html;
                    }
                }
                
                // Update footer hours
                const footerHoursList = document.querySelector('.footer-hours .hours-list');
                if (footerHoursList) {
                    let html = '';
                    days.forEach(day => {
                        const lunch = hoursData[day]?.lunch || '';
                        const dinner = hoursData[day]?.dinner || '';
                        
                        let timeText = 'Fermé';
                        if (lunch && dinner) {
                            timeText = `${lunch} / ${dinner}`;
                        } else if (lunch) {
                            timeText = lunch;
                        } else if (dinner) {
                            timeText = dinner;
                        }
                        
                        html += `<li><span>${dayNames[day]}</span><span>${timeText}</span></li>`;
                    });
                    footerHoursList.innerHTML = html;
                }
            }
            
            // ===== FOOTER DESCRIPTION =====
            if (content.footer && content.footer.description) {
                const footerDesc = document.querySelector('.footer-brand > p');
                if (footerDesc) {
                    footerDesc.textContent = content.footer.description;
                }
            }
            
            // ===== MENU CATEGORIES =====
            if (content.menu && content.menu.categories) {
                try {
                    const categories = typeof content.menu.categories === 'string' 
                        ? JSON.parse(content.menu.categories) 
                        : content.menu.categories;
                    
                    if (Array.isArray(categories) && categories.length > 0) {
                        // Load menu items from API
                        await loadMenuFromAPI(categories);
                    }
                } catch (e) {
                    console.log('ℹ️ Using default menu categories');
                }
            }
            
            // ===== ABOUT EXTENDED (2nd image + experience badge) =====
            if (content.about) {
                // Second image (use direct URL if pre-resized)
                const aboutSecondImg = document.querySelector('.about-img-secondary img');
                if (aboutSecondImg && content.about.image2) {
                    aboutSecondImg.src = getOptimizedImageUrl(content.about.image2, IMAGE_SIZES.aboutSmall.w, IMAGE_SIZES.aboutSmall.h, IMAGE_SIZES.aboutSmall.q);
                    aboutSecondImg.classList.remove('img-skeleton');
                }
                
                // Experience badge
                if (content.about.experience_number) {
                    const expNumber = document.querySelector('.experience-badge .number');
                    if (expNumber) expNumber.textContent = content.about.experience_number;
                }
                if (content.about.experience_text) {
                    const expText = document.querySelector('.experience-badge .text');
                    if (expText) expText.innerHTML = content.about.experience_text.replace(' ', '<br>');
                }
            }
            
            // ===== PLAT SIGNATURE =====
            if (content.signature) {
                const signatureImg = document.querySelector('.special-image img');
                if (signatureImg && content.signature.image) {
                    signatureImg.src = getOptimizedImageUrl(content.signature.image, IMAGE_SIZES.signature.w, IMAGE_SIZES.signature.h, IMAGE_SIZES.signature.q);
                    signatureImg.classList.remove('img-skeleton');
                }
                
                const signatureName = document.querySelector('.special-title');
                if (signatureName && content.signature.name) {
                    signatureName.textContent = content.signature.name;
                }
                
                const signatureDesc = document.querySelector('.special-desc');
                if (signatureDesc && content.signature.description) {
                    signatureDesc.textContent = content.signature.description;
                }
                
                const oldPrice = document.querySelector('.special-price .old-price');
                if (oldPrice && content.signature.old_price) {
                    oldPrice.textContent = content.signature.old_price;
                }
                
                const newPrice = document.querySelector('.special-price .new-price');
                if (newPrice && content.signature.new_price) {
                    newPrice.textContent = content.signature.new_price;
                }
            }
            
            // ===== SPECIALTIES (3 cards) =====
            const specialtyCards = document.querySelectorAll('.specialty-card');
            for (let i = 1; i <= 3; i++) {
                const key = `specialty${i}`;
                if (content[key]) {
                    const card = specialtyCards[i - 1];
                    const isLarge = card?.classList.contains('large');
                    const size = isLarge ? IMAGE_SIZES.specialtyLarge : IMAGE_SIZES.specialty;
                    
                    if (card) {
                        const img = card.querySelector('.specialty-image img');
                        if (img && content[key].image) {
                            img.src = getOptimizedImageUrl(content[key].image, size.w, size.h, size.q);
                            img.classList.remove('img-skeleton');
                        }
                        
                        const tag = card.querySelector('.specialty-tag');
                        if (tag && content[key].tag) tag.textContent = content[key].tag;
                        
                        const name = card.querySelector('h3');
                        if (name && content[key].name) name.textContent = content[key].name;
                        
                        const desc = card.querySelector('.specialty-overlay p');
                        if (desc && content[key].description) desc.textContent = content[key].description;
                    }
                }
            }
            
            // ===== GALLERY (6 images) =====
            const galleryItems = document.querySelectorAll('.gallery-item');
            const galleryUrls = [];
            for (let i = 1; i <= 6; i++) {
                const key = `gallery${i}`;
                if (content[key]) {
                    // Handle both formats: content.gallery1 = "url" OR content.gallery1 = {gallery1: "url"}
                    let imageUrl = content[key];
                    if (typeof content[key] === 'object' && content[key][key]) {
                        imageUrl = content[key][key];
                    }
                    
                    // Use optimized URL (direct for pre-resized, resize params for legacy)
                    const optimizedUrl = getOptimizedImageUrl(imageUrl, IMAGE_SIZES.gallery.w, IMAGE_SIZES.gallery.h, IMAGE_SIZES.gallery.q);
                    if (imageUrl) galleryUrls.push(optimizedUrl);
                    
                    const item = galleryItems[i - 1];
                    if (item && imageUrl) {
                        const img = item.querySelector('img');
                        if (img) {
                            img.src = optimizedUrl;
                            img.classList.remove('img-skeleton');
                        }
                    }
                    // Also update lightbox galleryImages array (full size for lightbox)
                    if (imageUrl) galleryImages[i - 1] = imageUrl;
                }
            }
            // Preload gallery images
            if (galleryUrls.length > 0) preloadImages(galleryUrls);
            
            // ===== MAP EMBED =====
            if (content.contact && content.contact.map_embed) {
                const mapIframe = document.querySelector('.map-wrapper iframe');
                // Only accept valid Google Maps embed URLs
                if (mapIframe && content.contact.map_embed.includes('google.com/maps/embed')) {
                    mapIframe.src = content.contact.map_embed;
                }
            }
            
            // ===== TESTIMONIALS (3 cards) - Load from database =====
            const testimonialCards = document.querySelectorAll('.testimonial-card');
            for (let i = 1; i <= 3; i++) {
                const key = `testimonial${i}`;
                if (content[key]) {
                    const card = testimonialCards[i - 1];
                    if (card) {
                        const photo = card.querySelector('.testimonial-author img');
                        if (photo && content[key].photo) photo.src = content[key].photo;
                        
                        const name = card.querySelector('.author-info h4');
                        if (name && content[key].name) name.textContent = content[key].name;
                        
                        const text = card.querySelector('.testimonial-text');
                        if (text && content[key].text) text.textContent = content[key].text;
                        
                        // Rating stars
                        if (content[key].rating) {
                            const starsContainer = card.querySelector('.stars');
                            if (starsContainer) {
                                const rating = parseInt(content[key].rating) || 5;
                                let starsHTML = '';
                                for (let s = 1; s <= 5; s++) {
                                    if (s <= rating) {
                                        starsHTML += '<i class="fas fa-star"></i>';
                                    } else if (s - 0.5 <= rating) {
                                        starsHTML += '<i class="fas fa-star-half-alt"></i>';
                                    } else {
                                        starsHTML += '<i class="far fa-star"></i>';
                                    }
                                }
                                starsContainer.innerHTML = starsHTML;
                            }
                        }
                    }
                }
            }
            
            // NOTE: Services and Features are kept as static content for better performance
            
            // ===== RESERVATION SECTION =====
            if (content.reservation) {
                // Image (use direct URL if pre-resized)
                const reservationImg = document.querySelector('.reservation-image img');
                if (reservationImg && content.reservation.image) {
                    reservationImg.src = getOptimizedImageUrl(content.reservation.image, IMAGE_SIZES.reservation.w, IMAGE_SIZES.reservation.h, IMAGE_SIZES.reservation.q);
                    reservationImg.classList.remove('img-skeleton');
                }
                
                // Badge text
                const badgeSpans = document.querySelectorAll('.badge-reservation span');
                if (badgeSpans.length >= 2) {
                    if (content.reservation.badge1) badgeSpans[0].textContent = content.reservation.badge1;
                    if (content.reservation.badge2) badgeSpans[1].textContent = content.reservation.badge2;
                }
                
                // Title
                const reservationTitle = document.querySelector('.reservation-title');
                if (reservationTitle && content.reservation.title) {
                    reservationTitle.textContent = content.reservation.title;
                }
                
                // Description
                const reservationDesc = document.querySelector('.reservation-desc');
                if (reservationDesc && content.reservation.description) {
                    reservationDesc.textContent = content.reservation.description;
                }
                
                // Features (3)
                const features = document.querySelectorAll('.reservation-feature span');
                if (features.length >= 1 && content.reservation.feature1) features[0].textContent = content.reservation.feature1;
                if (features.length >= 2 && content.reservation.feature2) features[1].textContent = content.reservation.feature2;
                if (features.length >= 3 && content.reservation.feature3) features[2].textContent = content.reservation.feature3;
            }
            
            console.log('✅ Dynamic content loaded from database');
        }
    } catch (error) {
        console.log('ℹ️ Using static content (API unavailable):', error.message);
    }
}

// Load menu items from API and render (optimized for INP)
async function loadMenuFromAPI(categories) {
    try {
        // Wait for initial preload to complete first
        await preloadPromise;
        
        const response = await fetch(`${API_URL}/api/menu`);
        const result = await response.json();
        
        // API returns {success: true, items: [...]}
        if (!result.success || !result.items || result.items.length === 0) {
            console.log('ℹ️ No menu items from API, keeping static content');
            return;
        }
        
        const menuItems = result.items;
        
        // All images should already be cached from preloadCriticalImages
        // But preload any missing ones just in case
        const uncachedUrls = menuItems
            .map(item => item.image)
            .filter(url => url && !imageCache.has(url));
        
        if (uncachedUrls.length > 0) {
            console.log('⏳ Loading', uncachedUrls.length, 'additional images...');
            await preloadImages(uncachedUrls);
        }
        
        const menuTabs = document.querySelector('.menu-tabs');
        const menuContent = document.querySelector('.menu-content');
        
        if (!menuTabs || !menuContent) return;
        
        // Use DocumentFragment for batch DOM updates (better INP)
        const tabsFragment = document.createDocumentFragment();
        const contentFragment = document.createDocumentFragment();
        
        const defaultImage = 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop';
        
        // Build all HTML at once for better performance
        categories.forEach((cat, index) => {
            const tabId = cat.toLowerCase().replace(/[^a-z0-9àáâãäåçèéêëìíîïñòóôõöùúûü]/g, '').replace(/\s+/g, '-');
            
            // Create tab button (no individual event listeners - use delegation)
            const btn = document.createElement('button');
            btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
            btn.dataset.tab = tabId;
            btn.textContent = cat;
            tabsFragment.appendChild(btn);
            
            // Create tab content
            const tabContent = document.createElement('div');
            tabContent.className = 'menu-tab-content' + (index === 0 ? ' active' : '');
            tabContent.id = tabId;
            
            // Filter items for this category
            const categoryItems = menuItems.filter(item => 
                item.category && item.category.toLowerCase() === cat.toLowerCase()
            );
            
            // Build menu grid HTML string (faster than createElement for many items)
            let gridHTML = '<div class="menu-grid">';
            
            if (categoryItems.length === 0) {
                gridHTML += `
                    <div class="empty-category" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #888;">
                        <i class="fas fa-utensils" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Aucun plat dans cette catégorie</p>
                    </div>
                `;
            } else {
                categoryItems.forEach((item, i) => {
                    // Use thumbnail if available, otherwise fallback to full image
                    const thumbnailUrl = item.thumbnail || item.image || defaultImage;
                    const fullImageUrl = item.image || defaultImage;
                    const delay = Math.min((i + 1) * 50, 300); // Cap delay for faster perceived load
                    const isCached = imageCache.has(thumbnailUrl);
                    
                    gridHTML += `
                        <div class="menu-item" data-aos="fade-up" data-aos-delay="${delay}" data-full-image="${fullImageUrl}">
                            <div class="menu-item-image ${!isCached ? 'img-skeleton' : ''}">
                                <img src="${thumbnailUrl}" alt="${item.name}" 
                                    ${isCached ? '' : 'loading="lazy"'} 
                                    decoding="async" 
                                    data-loaded="${isCached}"
                                    onload="this.dataset.loaded='true'; this.parentElement.classList.remove('img-skeleton')"
                                    onerror="this.src='${defaultImage}'; this.dataset.loaded='true'; this.parentElement.classList.remove('img-skeleton')">
                                ${item.badge ? `<span class="menu-badge">${item.badge}</span>` : ''}
                            </div>
                            <div class="menu-item-info">
                                <div class="menu-item-header">
                                    <h3>${item.name}</h3>
                                    <span class="menu-price">${parseFloat(item.price).toFixed(2)}€</span>
                                </div>
                                <p>${item.description || ''}</p>
                            </div>
                        </div>
                    `;
                });
            }
            gridHTML += '</div>';
            tabContent.innerHTML = gridHTML;
            contentFragment.appendChild(tabContent);
        });
        
        // Single DOM update (much better for INP)
        menuTabs.innerHTML = '';
        menuContent.innerHTML = '';
        menuTabs.appendChild(tabsFragment);
        menuContent.appendChild(contentFragment);
        
        // Use event delegation for tabs (1 listener instead of N)
        menuTabs.addEventListener('click', function(e) {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            
            // Use requestAnimationFrame for smooth UI update
            requestAnimationFrame(() => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.menu-tab-content').forEach(c => c.classList.remove('active'));
                const target = document.getElementById(btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });
        
        // Defer AOS refresh to not block main thread
        requestIdleCallback ? requestIdleCallback(() => {
            if (typeof AOS !== 'undefined') AOS.refresh();
        }) : setTimeout(() => {
            if (typeof AOS !== 'undefined') AOS.refresh();
        }, 100);
        
        console.log('✅ Menu items loaded from database:', menuItems.length, 'items');
        
    } catch (error) {
        console.log('ℹ️ Error loading menu from API:', error.message);
    }
}

// Load content when DOM is ready
document.addEventListener('DOMContentLoaded', loadDynamicContent);

// ===== CONSOLE GREETING =====
console.log('%c🍣 HIKARI Sushi & Roll', 'font-size: 24px; color: #c9a962; font-weight: bold;');
console.log('%cBienvenue sur notre site !', 'font-size: 14px; color: #888;');
console.log('%c17 allée des Soupirs, 31000 Toulouse', 'font-size: 12px; color: #666;');
console.log('%c📞 05 61 55 50 77', 'font-size: 12px; color: #c9a962;');
