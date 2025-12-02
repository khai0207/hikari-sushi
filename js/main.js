// ===== PRELOADER =====
window.addEventListener('load', () => {
    const preloader = document.querySelector('.preloader');
    document.body.classList.add('loading');
    
    setTimeout(() => {
        preloader.classList.add('hidden');
        document.body.classList.remove('loading');
    }, 1500);
});

// ===== HERO SLIDESHOW =====
const heroSlides = document.querySelectorAll('.hero-slide');
let heroCurrentSlide = 0;
const heroSlideInterval = 5000; // Change slide every 5 seconds

function nextHeroSlide() {
    heroSlides[heroCurrentSlide].classList.remove('active');
    heroCurrentSlide = (heroCurrentSlide + 1) % heroSlides.length;
    heroSlides[heroCurrentSlide].classList.add('active');
}

if (heroSlides.length > 1) {
    setInterval(nextHeroSlide, heroSlideInterval);
}

// ===== INITIALIZE AOS =====
AOS.init({
    duration: 800,
    easing: 'ease-out',
    once: true,
    offset: 100
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

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    
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
});

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
    link.addEventListener('click', closeMobileMenu);
});

// ===== ACTIVE NAVIGATION LINK =====
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    
    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 150;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        
        if (navLink) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLinks.forEach(link => link.classList.remove('active'));
                navLink.classList.add('active');
            }
        }
    });
});

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
    testimonialTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
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

nextBtn.addEventListener('click', nextSlide);
prevBtn.addEventListener('click', prevSlide);

dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        currentSlide = index;
        updateSlider();
    });
});

// Auto slide
let autoSlide = setInterval(nextSlide, 5000);

// Pause on hover
const testimonialSlider = document.querySelector('.testimonials-slider');
testimonialSlider.addEventListener('mouseenter', () => clearInterval(autoSlide));
testimonialSlider.addEventListener('mouseleave', () => {
    autoSlide = setInterval(nextSlide, 5000);
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        // Skip if href is just "#" or empty, or if it's an external link
        if (!href || href === '#' || href.length <= 1) return;
        // Skip if href contains "http" (external links)
        if (href.includes('http') || href.includes('://')) return;
        // Skip if href doesn't start with #
        if (!href.startsWith('#')) return;
        
        e.preventDefault();
        try {
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Close mobile menu if open
                if (typeof closeMobileMenu === 'function') {
                    closeMobileMenu();
                }
            }
        } catch (err) {
            // Invalid selector, ignore
            console.log('Invalid scroll target:', href);
        }
    });
});

// ===== PARALLAX EFFECT =====
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    
    // Hero parallax
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg) {
        heroBg.style.transform = `translateY(${scrolled * 0.5}px) scale(1.1)`;
    }
    
    // Floating elements parallax
    const floatingElements = document.querySelectorAll('.floating-img, .floating-shape');
    floatingElements.forEach((el, index) => {
        const speed = (index + 1) * 0.1;
        el.style.transform = `translateY(${scrolled * speed}px)`;
    });
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
const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animated');
            
            // Animate counters if present
            const counters = entry.target.querySelectorAll('[data-count]');
            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-count'));
                animateCounter(counter, target);
            });
        }
    });
}, observerOptions);

// Observe sections
document.querySelectorAll('section').forEach(section => {
    observer.observe(section);
});

// ===== IMAGE LAZY LOADING =====
const lazyImages = document.querySelectorAll('img[data-src]');

const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.add('loaded');
            observer.unobserve(img);
        }
    });
});

lazyImages.forEach(img => imageObserver.observe(img));

// ===== MOUSE CURSOR EFFECT (Optional - for desktop) =====
if (window.innerWidth > 992) {
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    document.body.appendChild(cursor);
    
    const cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    document.body.appendChild(cursorDot);
    
    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        
        setTimeout(() => {
            cursorDot.style.left = e.clientX + 'px';
            cursorDot.style.top = e.clientY + 'px';
        }, 100);
    });
    
    // Add cursor styles
    const cursorStyles = document.createElement('style');
    cursorStyles.textContent = `
        .custom-cursor {
            width: 40px;
            height: 40px;
            border: 1px solid var(--primary);
            border-radius: 50%;
            position: fixed;
            pointer-events: none;
            transform: translate(-50%, -50%);
            z-index: 9999;
            transition: transform 0.15s ease, width 0.15s ease, height 0.15s ease;
            mix-blend-mode: difference;
        }
        
        .cursor-dot {
            width: 8px;
            height: 8px;
            background: var(--primary);
            border-radius: 50%;
            position: fixed;
            pointer-events: none;
            transform: translate(-50%, -50%);
            z-index: 9999;
        }
        
        a:hover ~ .custom-cursor,
        button:hover ~ .custom-cursor {
            transform: translate(-50%, -50%) scale(1.5);
        }
    `;
    document.head.appendChild(cursorStyles);
}

// ===== MENU ITEM HOVER EFFECT =====
const menuItems = document.querySelectorAll('.menu-item');

menuItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px)';
    });
    
    item.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// ===== SPECIALTY CARDS HOVER =====
const specialtyCards = document.querySelectorAll('.specialty-card');

specialtyCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        const overlay = this.querySelector('.specialty-overlay');
        overlay.style.opacity = '1';
    });
    
    card.addEventListener('mouseleave', function() {
        const overlay = this.querySelector('.specialty-overlay');
        overlay.style.opacity = '0';
    });
});

// ===== REVEAL ON SCROLL =====
function reveal() {
    const reveals = document.querySelectorAll('.reveal');
    
    reveals.forEach(el => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;
        const elementVisible = 150;
        
        if (elementTop < windowHeight - elementVisible) {
            el.classList.add('active');
        }
    });
}

window.addEventListener('scroll', reveal);

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
const galleryImages = [
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
                
                // Typed words - update the words array
                if (content.hero.typed_words && Array.isArray(content.hero.typed_words)) {
                    words.length = 0;
                    content.hero.typed_words.forEach(word => words.push(word));
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
                
                const aboutLead = document.querySelector('#about .about-text .lead');
                if (aboutLead && content.about.description) {
                    aboutLead.textContent = content.about.description;
                }
                
                // About image
                const aboutMainImg = document.querySelector('.about-img-main img');
                if (aboutMainImg && content.about.image) {
                    aboutMainImg.src = content.about.image;
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
                const lunch = content.hours?.[`${day}_lunch`];
                const dinner = content.hours?.[`${day}_dinner`];
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
                        let html = '';
                        days.forEach(day => {
                            const lunch = hoursData[day]?.lunch || '';
                            const dinner = hoursData[day]?.dinner || '';
                            
                            if (lunch || dinner) {
                                if (lunch && dinner) {
                                    html += `<p><strong>${dayNames[day]}</strong>: ${lunch} / ${dinner}</p>`;
                                } else if (lunch) {
                                    html += `<p><strong>${dayNames[day]}</strong>: ${lunch}</p>`;
                                } else if (dinner) {
                                    html += `<p><strong>${dayNames[day]}</strong>: ${dinner}</p>`;
                                }
                            } else {
                                html += `<p><strong>${dayNames[day]}</strong>: Fermé</p>`;
                            }
                        });
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
            
            console.log('✅ Dynamic content loaded from database');
        }
    } catch (error) {
        console.log('ℹ️ Using static content (API unavailable):', error.message);
    }
}

// Load menu items from API and render
async function loadMenuFromAPI(categories) {
    try {
        const response = await fetch(`${API_URL}/api/menu`);
        const result = await response.json();
        
        // API returns {success: true, items: [...]}
        if (!result.success || !result.items || result.items.length === 0) {
            console.log('ℹ️ No menu items from API, keeping static content');
            return;
        }
        
        const menuItems = result.items;
        const menuTabs = document.querySelector('.menu-tabs');
        const menuContent = document.querySelector('.menu-content');
        
        if (!menuTabs || !menuContent) return;
        
        // Clear existing tabs and content
        menuTabs.innerHTML = '';
        menuContent.innerHTML = '';
        
        // Create tabs and content for each category
        categories.forEach((cat, index) => {
            const tabId = cat.toLowerCase().replace(/[^a-z0-9àáâãäåçèéêëìíîïñòóôõöùúûü]/g, '').replace(/\s+/g, '-');
            
            // Create tab button
            const btn = document.createElement('button');
            btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
            btn.dataset.tab = tabId;
            btn.textContent = cat;
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.menu-tab-content').forEach(c => c.classList.remove('active'));
                const target = document.getElementById(tabId);
                if (target) target.classList.add('active');
            });
            menuTabs.appendChild(btn);
            
            // Create tab content
            const tabContent = document.createElement('div');
            tabContent.className = 'menu-tab-content' + (index === 0 ? ' active' : '');
            tabContent.id = tabId;
            
            // Filter items for this category
            const categoryItems = menuItems.filter(item => 
                item.category && item.category.toLowerCase() === cat.toLowerCase()
            );
            
            // Create menu grid
            const menuGrid = document.createElement('div');
            menuGrid.className = 'menu-grid';
            
            if (categoryItems.length === 0) {
                menuGrid.innerHTML = `
                    <div class="empty-category" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #888;">
                        <i class="fas fa-utensils" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Aucun plat dans cette catégorie</p>
                    </div>
                `;
            } else {
                categoryItems.forEach((item, i) => {
                    const menuItem = document.createElement('div');
                    menuItem.className = 'menu-item';
                    menuItem.setAttribute('data-aos', 'fade-up');
                    menuItem.setAttribute('data-aos-delay', String((i + 1) * 100));
                    
                    const defaultImage = 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop';
                    const imageUrl = item.image || defaultImage;
                    
                    menuItem.innerHTML = `
                        <div class="menu-item-image">
                            <img src="${imageUrl}" alt="${item.name}" loading="lazy" onerror="this.src='${defaultImage}'">
                            ${item.badge ? `<span class="menu-badge">${item.badge}</span>` : ''}
                        </div>
                        <div class="menu-item-info">
                            <div class="menu-item-header">
                                <h3>${item.name}</h3>
                                <span class="menu-price">${parseFloat(item.price).toFixed(2)}€</span>
                            </div>
                            <p>${item.description || ''}</p>
                        </div>
                    `;
                    menuGrid.appendChild(menuItem);
                });
            }
            
            tabContent.appendChild(menuGrid);
            menuContent.appendChild(tabContent);
        });
        
        // Refresh AOS for new elements
        if (typeof AOS !== 'undefined') {
            AOS.refresh();
        }
        
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
