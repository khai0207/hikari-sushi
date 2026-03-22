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
           url.includes('/assets/gallery/') ||
           url.includes('/assets/content/');
}

// Get image URL - use direct URL for pre-resized content or large images, resize for menu thumbnails
function getOptimizedImageUrl(url, width, height, quality = 85, forceOriginal = false) {
    if (!url || url.startsWith('data:')) return url;
    // Pre-resized content images or forced original - use directly
    if (forceOriginal || isPreResizedContentImage(url)) {
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

document.querySelectorAll('[data-count]').forEach(el => {
    const parent = el.closest('section');
    if (parent) counterObserver.observe(parent);
});

// ===== IMAGE LAZY LOADING =====
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
                const badge = document.querySelector('.hero-badge span:last-child');
                if (badge && content.hero.badge) badge.textContent = content.hero.badge;
                
                const heroTitleLine = document.querySelector('.hero-title .line:first-child');
                if (heroTitleLine && content.hero.title) heroTitleLine.textContent = content.hero.title;
                
                if (content.hero.typed_words) {
                    let typedWords = content.hero.typed_words;
                    if (typeof typedWords === 'string') {
                        try {
                            typedWords = JSON.parse(typedWords);
                        } catch (e) {
                            typedWords = typedWords.split(',').map(w => w.trim());
                        }
                    }
                    if (Array.isArray(typedWords) && typedWords.length > 0) {
                        words.length = 0;
                        typedWords.forEach(word => words.push(word));
                    }
                }
                
                const heroSubtitle = document.querySelector('.hero-subtitle');
                if (heroSubtitle && content.hero.subtitle) heroSubtitle.textContent = content.hero.subtitle;
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
                
                const aboutLead = document.querySelector('#about .about-text .lead');
                if (aboutLead && content.about.description) aboutLead.textContent = content.about.description;
                
                const aboutParagraphs = document.querySelectorAll('#about .about-text > p:not(.lead)');
                if (aboutParagraphs.length >= 1 && content.about.description2) aboutParagraphs[0].textContent = content.about.description2;
                if (aboutParagraphs.length >= 2 && content.about.description3) aboutParagraphs[1].textContent = content.about.description3;
                
                const aboutMainImg = document.querySelector('.about-img-main img');
                if (aboutMainImg && content.about.image) {
                    aboutMainImg.src = content.about.image;
                    aboutMainImg.classList.remove('img-skeleton');
                }
            }
            
            // ===== CONTACT INFO (WITH TRANSPORTS) =====
            if (content.contact) {
                // Helper to convert multiline text into paragraphs
                const textToParagraphs = (text) => {
                    return text.split('\n')
                               .filter(line => line.trim() !== '')
                               .map(line => `<p>${line}</p>`)
                               .join('');
                };

                // Parking
                if (content.contact.parking) {
                    const parkingEl = document.getElementById('display_parking');
                    if (parkingEl) parkingEl.innerHTML = textToParagraphs(content.contact.parking);
                }
                
                // Metro
                if (content.contact.metro) {
                    const metroEl = document.getElementById('display_metro');
                    if (metroEl) metroEl.innerHTML = textToParagraphs(content.contact.metro);
                }
                
                // Velo & Bus
                if (content.contact.velo_bus) {
                    const veloEl = document.getElementById('display_velo_bus');
                    if (veloEl) veloEl.innerHTML = textToParagraphs(content.contact.velo_bus);
                }

                // Phone
                if (content.contact.phone) {
                    const phoneClean = content.contact.phone.replace(/\s/g, '');
                    document.querySelectorAll('a[href^="tel:"]').forEach(link => link.href = `tel:${phoneClean}`);
                    document.querySelectorAll('.footer-contact a[href^="tel:"], .top-info a[href^="tel:"]').forEach(el => el.textContent = content.contact.phone);
                    document.querySelectorAll('.btn-call strong').forEach(el => el.textContent = content.contact.phone);
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
                    const addressLink = document.querySelector('.footer-contact li:first-child a');
                    if (addressLink) {
                        addressLink.innerHTML = content.contact.address.replace(', ', '<br>');
                    }
                }

                // Map Embed
                if (content.contact.map_embed) {
                    const mapIframe = document.querySelector('.map-wrapper iframe');
                    if (mapIframe && content.contact.map_embed.includes('google')) {
                        mapIframe.src = content.contact.map_embed;
                    }
                }
            }
            
            // ===== SOCIAL LINKS =====
            if (content.social) {
                const updateSocial = (selector, url) => {
                    const links = document.querySelectorAll(selector);
                    links.forEach(link => {
                        if (url && url.trim()) {
                            link.href = url;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                        } else {
                            link.style.display = 'none';
                        }
                    });
                };

                updateSocial('a[aria-label="Facebook"]', content.social.facebook);
                updateSocial('a[aria-label="Instagram"]', content.social.instagram);
                updateSocial('a[aria-label="Tripadvisor"]', content.social.tripadvisor);
                updateSocial('a[aria-label="Google"]', content.social.google);
            }
            
            // ===== HOURS =====
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const dayNames = {
                monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
                thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche'
            };
            
            let hoursData = {};
            let hasHours = false;
            
            days.forEach(day => {
                let lunch, dinner;
                if (content.hours?.[day]) {
                    lunch = content.hours[day].lunch;
                    dinner = content.hours[day].dinner;
                } else {
                    lunch = content.hours?.[`${day}_lunch`];
                    dinner = content.hours?.[`${day}_dinner`];
                }
                
                if (lunch || dinner) {
                    hasHours = true;
                    hoursData[day] = { lunch, dinner };
                }
            });
            
            if (hasHours) {
                const hoursCard = document.getElementById('contact-hours-card');
                if (hoursCard) {
                    const hoursContent = hoursCard.querySelector('.hours-content');
                    if (hoursContent) {
                        let html = '<ul class="hours-list-contact">';
                        days.forEach(day => {
                            const lunch = hoursData[day]?.lunch || '';
                            const dinner = hoursData[day]?.dinner || '';
                            
                            let timeText = 'Fermé';
                            if (lunch && dinner) timeText = `${lunch} / ${dinner}`;
                            else if (lunch) timeText = lunch;
                            else if (dinner) timeText = `Fermé / ${dinner}`;
                            
                            html += `<li><span>${dayNames[day]}</span><span>${timeText}</span></li>`;
                        });
                        html += '</ul>';
                        hoursContent.innerHTML = html;
                    }
                }
                
                const footerHoursList = document.querySelector('.footer-hours .hours-list');
                if (footerHoursList) {
                    let html = '';
                    days.forEach(day => {
                        const lunch = hoursData[day]?.lunch || '';
                        const dinner = hoursData[day]?.dinner || '';
                        
                        let timeText = 'Fermé';
                        if (lunch && dinner) timeText = `${lunch} / ${dinner}`;
                        else if (lunch) timeText = lunch;
                        else if (dinner) timeText = dinner;
                        
                        html += `<li><span>${dayNames[day]}</span><span>${timeText}</span></li>`;
                    });
                    footerHoursList.innerHTML = html;
                }
            }
            
            // ===== FOOTER DESCRIPTION =====
            if (content.footer && content.footer.description) {
                const footerDesc = document.querySelector('.footer-brand > p');
                if (footerDesc) footerDesc.textContent = content.footer.description;
            }
            
            // ===== MENU CATEGORIES =====
            if (content.menu && content.menu.categories) {
                try {
                    const categories = typeof content.menu.categories === 'string' 
                        ? JSON.parse(content.menu.categories) 
                        : content.menu.categories;
                    
                    if (Array.isArray(categories) && categories.length > 0) {
                        await loadMenuFromAPI(categories);
                    }
                } catch (e) {
                    console.log('ℹ️ Using default menu categories');
                }
            }
            
            // ===== PLAT SIGNATURE =====
            if (content.signature) {
                const signatureImg = document.querySelector('.special-image img');
                if (signatureImg && content.signature.image) {
                    signatureImg.src = content.signature.image;
                    signatureImg.classList.remove('img-skeleton');
                }
                
                if (content.signature.background) {
                    const specialBg = document.querySelector('.special-bg');
                    if (specialBg) specialBg.style.backgroundImage = `url('${content.signature.background}')`;
                }
                
                const signatureName = document.querySelector('.special-title');
                if (signatureName && content.signature.name) signatureName.textContent = content.signature.name;
                
                const signatureDesc = document.querySelector('.special-desc');
                if (signatureDesc && content.signature.description) signatureDesc.textContent = content.signature.description;
                
                const oldPrice = document.querySelector('.special-price .old-price');
                if (oldPrice && content.signature.old_price) oldPrice.textContent = content.signature.old_price;
                
                const newPrice = document.querySelector('.special-price .new-price');
                if (newPrice && content.signature.new_price) newPrice.textContent = content.signature.new_price;
            }
            
            // ===== SPECIALTIES (3 cards) =====
            const specialtyCards = document.querySelectorAll('.specialty-card');
            for (let i = 1; i <= 3; i++) {
                const key = `specialty${i}`;
                if (content[key]) {
                    const card = specialtyCards[i - 1];
                    if (card) {
                        const img = card.querySelector('.specialty-image img');
                        if (img && content[key].image) {
                            img.src = content[key].image;
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
                    let imageUrl = content[key];
                    if (typeof content[key] === 'object' && content[key][key]) {
                        imageUrl = content[key][key];
                    }
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
                    if (imageUrl) galleryImages[i - 1] = imageUrl;
                }
            }
            if (galleryUrls.length > 0) preloadImages(galleryUrls);
            
            // ===== TESTIMONIALS (3 cards) =====
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
                        
                        if (content[key].rating) {
                            const starsContainer = card.querySelector('.stars');
                            if (starsContainer) {
                                const rating = parseInt(content[key].rating) || 5;
                                let starsHTML = '';
                                for (let s = 1; s <= 5; s++) {
                                    if (s <= rating) starsHTML += '<i class="fas fa-star"></i>';
                                    else if (s - 0.5 <= rating) starsHTML += '<i class="fas fa-star-half-alt"></i>';
                                    else starsHTML += '<i class="far fa-star"></i>';
                                }
                                starsContainer.innerHTML = starsHTML;
                            }
                        }
                    }
                }
            }
            
            // ===== RESERVATION SECTION =====
            if (content.reservation) {
                const reservationImg = document.querySelector('.reservation-image img');
                if (reservationImg && content.reservation.image) {
                    reservationImg.src = content.reservation.image;
                    reservationImg.classList.remove('img-skeleton');
                }
                
                if (content.reservation.background) {
                    const reservationBg = document.querySelector('.reservation-bg');
                    if (reservationBg) reservationBg.style.backgroundImage = `url('${content.reservation.background}')`;
                }
                
                const badgeSpans = document.querySelectorAll('.badge-reservation span');
                if (badgeSpans.length >= 2) {
                    if (content.reservation.badge1) badgeSpans[0].textContent = content.reservation.badge1;
                    if (content.reservation.badge2) badgeSpans[1].textContent = content.reservation.badge2;
                }
                
                const reservationTitle = document.querySelector('.reservation-title');
                if (reservationTitle && content.reservation.title) reservationTitle.textContent = content.reservation.title;
                
                const reservationDesc = document.querySelector('.reservation-desc');
                if (reservationDesc && content.reservation.description) reservationDesc.textContent = content.reservation.description;
                
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

// Load menu items from API and render
async function loadMenuFromAPI(categories) {
    try {
        await preloadPromise;
        const response = await fetch(`${API_URL}/api/menu`);
        const result = await response.json();
        
        if (!result.success || !result.items || result.items.length === 0) {
            console.log('ℹ️ No menu items from API, keeping static content');
            return;
        }
        
        const menuItems = result.items;
        
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
        
        const tabsFragment = document.createDocumentFragment();
        const contentFragment = document.createDocumentFragment();
        const defaultImage = 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop';
        
        categories.forEach((cat, index) => {
            const tabId = cat.toLowerCase().replace(/[^a-z0-9àáâãäåçèéêëìíîïñòóôõöùúûü]/g, '').replace(/\s+/g, '-');
            
            const btn = document.createElement('button');
            btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
            btn.dataset.tab = tabId;
            btn.textContent = cat;
            tabsFragment.appendChild(btn);
            
            const tabContent = document.createElement('div');
            tabContent.className = 'menu-tab-content' + (index === 0 ? ' active' : '');
            tabContent.id = tabId;
            
            const categoryItems = menuItems.filter(item => 
                item.category && item.category.toLowerCase() === cat.toLowerCase()
            );
            
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
                    const thumbnailUrl = item.thumbnail || item.image || defaultImage;
                    const fullImageUrl = item.image || defaultImage;
                    const delay = Math.min((i + 1) * 50, 300);
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
        
        menuTabs.innerHTML = '';
        menuContent.innerHTML = '';
        menuTabs.appendChild(tabsFragment);
        menuContent.appendChild(contentFragment);
        
        menuTabs.addEventListener('click', function(e) {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            
            requestAnimationFrame(() => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.menu-tab-content').forEach(c => c.classList.remove('active'));
                const target = document.getElementById(btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });
        
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