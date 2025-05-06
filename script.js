const container = document.querySelector('.container');
const logo = document.querySelector('.logo');
// Select all shadow elements
const shadows = document.querySelectorAll('.logo-shadow');
const logoContainer = document.querySelector('.logo-container');

const baseShadowDistance = 0; // Initial shadow distance
const shadowDistanceMultiplier = 0.09; // How much distance affects shadow offset
// const maxSkew = 15; // Max degrees the shadow will skew - REMOVED, now dynamic
const maxSkewAmount = 30; // Max degrees the shadow can skew based on distance
const skewDistanceMultiplier = 0.08; // How much distance affects skew amount
const shadowScale = 15.0; // Add constant for shadow scale (1.0 = 100%)

let lastMouseEvent = null;
let animationFrameId = null;
let isMouseMoving = false;
let blurTimeoutId = null;
let mouseEffectsEnabled = false;

const movingBlurBase = 1; // Lower blur while moving
const movingBlurStep = 3;
const stillBlurBase = 1; // Higher blur when still
const stillBlurStep = 3;
const blurTransitionDelay = 80; // ms after mouse stops to increase blur

function updateShadows(e, blurBase, blurStep, allowMoveAndScale = true) {
    const containerRect = container.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    const logoCenterX = logoRect.left + logoRect.width / 2;
    const logoCenterY = logoRect.top + logoRect.height / 2;
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const vecX = mouseX - logoCenterX;
    const vecY = mouseY - logoCenterY;
    const distance = Math.sqrt(vecX * vecX + vecY * vecY);
    const dirX = distance === 0 ? 0 : vecX / distance;
    const dirY = distance === 0 ? 0 : vecY / distance;
    const shadowOffset = baseShadowDistance + distance * shadowDistanceMultiplier;
    const shadowOffsetX = -dirX * shadowOffset;
    const shadowOffsetY = -dirY * shadowOffset;
    let skewAmount = Math.min(distance * skewDistanceMultiplier, maxSkewAmount);
    if (!allowMoveAndScale) {
        skewAmount *= 0.17;
        // Ensure shadow is behind the logo before first hover
        shadows.forEach(shadow => {
            shadow.style.zIndex = "0";
        });
    } else {
        // Bring shadow above background (but still below logo) after first hover
        shadows.forEach(shadow => {
            shadow.style.zIndex = "1";
        });
    }

    if (!logo.classList.contains('clicked')) {
        shadows.forEach((shadow, index) => {
            let transform;
            if (allowMoveAndScale) {
                // Full effect: move, skew, scale
                const shadowMoveX = shadowOffsetX * (1 + index * 0.82);
                const shadowMoveY = shadowOffsetY * (1 + index * 0.82);
                const currentSkewX = -dirX * skewAmount * (1 + index * 0.2);
                const currentSkewY = -dirY * skewAmount * (1 + index * 0.2);
                transform = `translate(${shadowMoveX}px, ${shadowMoveY}px) skew(${currentSkewX}deg, ${currentSkewY}deg) scale(${shadowScale})`;
            } else {
                // Only skew, no move/scale
                const currentSkewX = -dirX * skewAmount * (1 + index * 0.2);
                const currentSkewY = -dirY * skewAmount * (1 + index * 0.2);
                transform = `translate(5px, 5px) skew(${currentSkewX}deg, ${currentSkewY}deg)`;
            }
            shadow.style.transform = transform;
            const blurAmount = blurBase + index * blurStep;
            shadow.style.filter = `blur(${blurAmount}px)`;
        });
    }
}

function onMouseMove(e) {
    lastMouseEvent = e;
    isMouseMoving = true;
    if (blurTimeoutId) {
        clearTimeout(blurTimeoutId);
        blurTimeoutId = null;
    }
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(() => {
            updateShadows(
                lastMouseEvent,
                movingBlurBase,
                movingBlurStep,
                mouseEffectsEnabled // allowMoveAndScale only if enabled
            );
            animationFrameId = null;
        });
    }
    // After mouse stops, increase blur for refinement
    blurTimeoutId = setTimeout(() => {
        if (lastMouseEvent) {
            updateShadows(
                lastMouseEvent,
                stillBlurBase,
                stillBlurStep,
                mouseEffectsEnabled
            );
        }
        isMouseMoving = false;
    }, blurTransitionDelay);
}

// Always listen for mousemove, but only allow full effect after hover
container.addEventListener('mousemove', onMouseMove);

function enableMouseEffects() {
    if (mouseEffectsEnabled) return;
    mouseEffectsEnabled = true;
    container.addEventListener('mouseleave', onMouseLeave);
}

function onMouseLeave() {
    // Only reset if logo hasn't been clicked
    if (!logo.classList.contains('clicked')) {
        shadows.forEach((shadow, index) => {
            const initialBlur = movingBlurBase + index * movingBlurStep;
            shadow.style.transform = `translate(5px, 5px) skew(10deg, 5deg)`;
            shadow.style.filter = `blur(${initialBlur}px)`;
        });
    }
}

logo.addEventListener('mouseenter', enableMouseEffects);

// --- Logo Click Animation ---
logo.addEventListener('click', () => {
    // Prevent multiple clicks
    if (logo.classList.contains('clicked')) {
        return;
    }

    // Add class to trigger animation and hide shadows via CSS
    logo.classList.add('clicked');

    // Remove the logo element after the animation completes
    logo.addEventListener('animationend', () => {
        logo.remove();
        // Shadows are hidden by CSS, but could be removed explicitly if needed
        // shadows.forEach(shadow => shadow.remove());
    }, { once: true }); // Ensure the listener runs only once
});

// Update shadow on page load with default values
window.addEventListener('DOMContentLoaded', () => {
    // Use a fake event at the logo center for initial shadow
    const logoRect = logo.getBoundingClientRect();
    const centerEvent = {
        clientX: logoRect.left + logoRect.width / 2,
        clientY: logoRect.top + logoRect.height / 2
    };
    updateShadows(centerEvent, movingBlurBase, movingBlurStep, false);
});
