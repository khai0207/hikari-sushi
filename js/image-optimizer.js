/**
 * HIKARI Image Optimizer - Ultra Performance Image Loading
 * Giữ nguyên chất lượng ảnh gốc, chỉ tối ưu cách tải
 */

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Khoảng cách từ viewport để bắt đầu tải (px)
        rootMargin: '200px 0px 400px 0px',
        // Ngưỡng visibility để trigger load
        threshold: 0.01,
        // Thời gian fade-in (ms)
        fadeInDuration: 400,
        // Số ảnh tải đồng thời tối đa
        maxConcurrentLoads: 4,
        // Delay giữa các batch load (ms)
        batchDelay: 50,
        // Enable blur placeholder
        enableBlurPlaceholder: true,
        // Placeholder color
        placeholderColor: '#1a1a1a'
    };

    // ===== STATE =====
    let loadingQueue = [];
    let currentlyLoading = 0;
    let observer = null;
    let isLowBandwidth = false;

    // ===== DETECT CONNECTION SPEED =====
    function detectConnection() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            isLowBandwidth = connection.saveData || 
                            connection.effectiveType === 'slow-2g' || 
                            connection.effectiveType === '2g';
            
            // Listen for connection changes
            connection.addEventListener('change', () => {
                isLowBandwidth = connection.saveData || 
                                connection.effectiveType === 'slow-2g' || 
                                connection.effectiveType === '2g';
            });
        }
    }

    // ===== CREATE BLUR PLACEHOLDER =====
    function createPlaceholder(img) {
        if (!CONFIG.enableBlurPlaceholder) return;
        
        const wrapper = img.closest('.menu-item-image, .gallery-item, .specialty-image, .about-img-main, .about-img-secondary, .special-image');
        
        if (wrapper && !wrapper.classList.contains('img-optimized')) {
            wrapper.classList.add('img-optimized');
            wrapper.style.backgroundColor = CONFIG.placeholderColor;
        }
    }

    // ===== OPTIMIZED IMAGE LOADING =====
    function loadImage(img) {
        return new Promise((resolve, reject) => {
            const src = img.dataset.src || img.src;
            if (!src || src === 'data:,' || img.classList.contains('loaded')) {
                resolve();
                return;
            }

            // Create new image for preloading
            const tempImg = new Image();
            
            // Use decode() API for non-blocking decode
            tempImg.onload = async () => {
                try {
                    // Decode image off main thread
                    if (tempImg.decode) {
                        await tempImg.decode();
                    }
                    
                    // Apply to actual image with fade effect
                    requestAnimationFrame(() => {
                        img.src = src;
                        img.classList.add('loaded');
                        img.style.opacity = '1';
                        
                        // Mark parent as loaded
                        const parent = img.closest('.menu-item-image, .gallery-item, .specialty-image');
                        if (parent) {
                            parent.classList.add('image-loaded');
                        }
                        
                        resolve();
                    });
                } catch (e) {
                    // Fallback if decode fails
                    img.src = src;
                    img.classList.add('loaded');
                    resolve();
                }
            };

            tempImg.onerror = () => {
                console.warn('Failed to load image:', src);
                img.classList.add('load-error');
                reject();
            };

            // Set crossorigin for external images
            if (src.startsWith('http') && !src.includes(window.location.hostname)) {
                tempImg.crossOrigin = 'anonymous';
            }

            tempImg.src = src;
        });
    }

    // ===== QUEUE PROCESSOR =====
    function processQueue() {
        while (loadingQueue.length > 0 && currentlyLoading < CONFIG.maxConcurrentLoads) {
            const img = loadingQueue.shift();
            if (img && !img.classList.contains('loaded')) {
                currentlyLoading++;
                
                loadImage(img)
                    .finally(() => {
                        currentlyLoading--;
                        // Small delay to prevent blocking
                        setTimeout(processQueue, CONFIG.batchDelay);
                    });
            }
        }
    }

    // ===== ADD TO QUEUE =====
    function queueImage(img) {
        if (!loadingQueue.includes(img) && !img.classList.contains('loaded')) {
            loadingQueue.push(img);
            processQueue();
        }
    }

    // ===== INTERSECTION OBSERVER CALLBACK =====
    function onIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                
                // Priority loading for visible images
                if (entry.intersectionRatio > 0.5) {
                    // High priority - load immediately
                    loadingQueue.unshift(img);
                } else {
                    // Normal priority
                    queueImage(img);
                }
                
                processQueue();
                observer.unobserve(img);
            }
        });
    }

    // ===== SETUP LAZY LOADING =====
    function setupLazyLoading() {
        // Create observer
        observer = new IntersectionObserver(onIntersection, {
            rootMargin: CONFIG.rootMargin,
            threshold: [0.01, 0.5, 1]
        });

        // Find all images
        const images = document.querySelectorAll(`
            .menu-item-image img,
            .gallery-item img,
            .specialty-image img,
            .about-img-main img,
            .about-img-secondary img,
            .special-image img,
            .testimonial-author img,
            .service-icon img
        `);

        images.forEach(img => {
            // Skip already loaded images
            if (img.complete && img.naturalHeight !== 0) {
                img.classList.add('loaded');
                return;
            }

            // Prepare for lazy load
            createPlaceholder(img);
            
            // Store original src and use placeholder
            if (img.src && !img.dataset.src) {
                img.dataset.src = img.src;
                // Don't clear src - let browser handle naturally
            }
            
            // Set initial styles for fade effect
            if (!img.classList.contains('loaded')) {
                img.style.opacity = '0';
                img.style.transition = `opacity ${CONFIG.fadeInDuration}ms ease`;
            }
            
            // Observe
            observer.observe(img);
        });

        console.log(`🖼️ Image optimizer: ${images.length} images optimized`);
    }

    // ===== PRELOAD CRITICAL IMAGES =====
    function preloadCriticalImages() {
        // Preload hero background and above-fold images
        const criticalImages = document.querySelectorAll(`
            .hero-slide,
            .about-img-main img,
            .loader-logo
        `);

        criticalImages.forEach(el => {
            if (el.tagName === 'IMG') {
                el.loading = 'eager';
                el.decoding = 'async';
                el.fetchPriority = 'high';
            } else if (el.style.backgroundImage) {
                // Preload background images
                const url = el.style.backgroundImage.match(/url\(['"]?(.+?)['"]?\)/);
                if (url && url[1]) {
                    const link = document.createElement('link');
                    link.rel = 'preload';
                    link.as = 'image';
                    link.href = url[1];
                    document.head.appendChild(link);
                }
            }
        });
    }

    // ===== OPTIMIZE DYNAMIC IMAGES =====
    function optimizeDynamicImages() {
        // MutationObserver for dynamically added images
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        const images = node.querySelectorAll ? 
                            node.querySelectorAll('img:not(.loaded)') : [];
                        
                        if (node.tagName === 'IMG' && !node.classList.contains('loaded')) {
                            createPlaceholder(node);
                            observer.observe(node);
                        }
                        
                        images.forEach(img => {
                            createPlaceholder(img);
                            observer.observe(img);
                        });
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ===== INJECT OPTIMIZATION STYLES =====
    function injectStyles() {
        const style = document.createElement('style');
        style.id = 'hikari-image-optimizer';
        style.textContent = `
            /* Image container optimization */
            .menu-item-image,
            .gallery-item,
            .specialty-image,
            .about-img-main,
            .about-img-secondary,
            .special-image {
                contain: layout style paint;
                content-visibility: auto;
                contain-intrinsic-size: auto 200px;
            }

            /* Optimized image rendering */
            .menu-item-image img,
            .gallery-item img,
            .specialty-image img,
            .about-img-main img,
            .about-img-secondary img,
            .special-image img {
                will-change: opacity;
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
                transform: translateZ(0);
                image-rendering: -webkit-optimize-contrast;
            }

            /* Placeholder background */
            .img-optimized {
                background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
                position: relative;
                overflow: hidden;
            }

            /* Loading shimmer effect */
            .img-optimized::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(201, 169, 98, 0.05),
                    transparent
                );
                animation: shimmer 1.5s infinite;
                z-index: 1;
            }

            .img-optimized.image-loaded::before {
                display: none;
            }

            @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }

            /* Fade in loaded images */
            .img-optimized img.loaded {
                opacity: 1 !important;
            }

            /* Error state */
            .img-optimized img.load-error {
                opacity: 0.3;
            }

            /* Menu grid performance */
            .menu-grid {
                contain: layout style;
            }

            .menu-item {
                contain: layout style paint;
                content-visibility: auto;
                contain-intrinsic-size: auto 300px;
            }

            /* Gallery performance */
            .gallery-grid {
                contain: layout style;
            }

            /* Reduce motion for performance */
            @media (prefers-reduced-motion: reduce) {
                .img-optimized::before {
                    animation: none;
                }
                
                .menu-item-image img,
                .gallery-item img {
                    transition: none !important;
                }
            }

            /* Low bandwidth mode */
            .low-bandwidth .img-optimized::before {
                animation: none;
            }
        `;
        document.head.appendChild(style);
    }

    // ===== OPTIMIZE SCROLL PERFORMANCE =====
    function optimizeScroll() {
        let ticking = false;
        let lastScrollY = 0;

        // Passive scroll listener
        window.addEventListener('scroll', () => {
            lastScrollY = window.scrollY;

            if (!ticking) {
                requestAnimationFrame(() => {
                    // Pause animations when scrolling fast
                    if (Math.abs(lastScrollY - (window._lastScrollY || 0)) > 100) {
                        document.body.classList.add('fast-scroll');
                    } else {
                        document.body.classList.remove('fast-scroll');
                    }
                    window._lastScrollY = lastScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Add fast-scroll styles
        const scrollStyle = document.createElement('style');
        scrollStyle.textContent = `
            .fast-scroll .menu-item,
            .fast-scroll .gallery-item,
            .fast-scroll .specialty-card {
                will-change: auto;
            }
            
            .fast-scroll .img-optimized::before {
                animation-play-state: paused;
            }
        `;
        document.head.appendChild(scrollStyle);
    }

    // ===== INITIALIZE =====
    function init() {
        // Detect connection speed
        detectConnection();
        
        // Add low-bandwidth class if needed
        if (isLowBandwidth) {
            document.body.classList.add('low-bandwidth');
        }

        // Inject optimization styles
        injectStyles();

        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                preloadCriticalImages();
                setupLazyLoading();
                optimizeDynamicImages();
                optimizeScroll();
            });
        } else {
            preloadCriticalImages();
            setupLazyLoading();
            optimizeDynamicImages();
            optimizeScroll();
        }

        console.log('🚀 HIKARI Image Optimizer initialized');
    }

    // ===== PUBLIC API =====
    window.HikariImageOptimizer = {
        init: init,
        refreshImages: setupLazyLoading,
        preloadImage: (url) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = url;
            });
        },
        getStats: () => ({
            queueLength: loadingQueue.length,
            currentlyLoading: currentlyLoading,
            isLowBandwidth: isLowBandwidth
        })
    };

    // Auto-initialize
    init();

})();
