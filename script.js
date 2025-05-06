const container = document.querySelector('.container');
const logo = document.querySelector('.logo');
const shadows = document.querySelectorAll('.logo-shadow');
const logoContainer = document.querySelector('.logo-container');

const baseShadowDistance = 0; // Initial shadow distance
const shadowDistanceMultiplier = 0.09; // How much distance affects shadow offset
const maxSkewAmount = 30; // Max degrees the shadow can skew based on distance
const skewDistanceMultiplier = 0.08; // How much distance affects skew amount
const shadowScale = 15.0; // Add constant for shadow scale (1.0 = 100%)

let lastMouseEvent = null;
let animationFrameId = null;
let isMouseMoving = false;
let blurTimeoutId = null;
let mouseEffectsEnabled = true; // Enable effects immediately

const movingBlurBase = 1; // Lower blur while moving
const movingBlurStep = 3;
const stillBlurBase = 1; // Higher blur when still
const stillBlurStep = 3;
const blurTransitionDelay = 80; // ms after mouse stops to increase blur

const resetDelay = 3000; // 3 seconds
let resetTimeoutId = null;
let resettingShadows = false;
let oscillationFrameId = null;

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

    // Remove the .clicked check so shadows always update
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

function parseTransform(transform) {
    // If transform is a matrix, parse it
    if (transform && transform.startsWith('matrix')) {
        // matrix(a, b, c, d, tx, ty)
        const match = /matrix\(([^)]+)\)/.exec(transform);
        if (match) {
            const parts = match[1].split(',').map(Number);
            // Approximate skew and scale from matrix
            const a = parts[0], b = parts[1], c = parts[2], d = parts[3], tx = parts[4], ty = parts[5];
            const scale = Math.sqrt(a * a + b * b);
            const skewX = Math.atan2(c, d) * (180 / Math.PI);
            const skewY = Math.atan2(b, a) * (180 / Math.PI);
            return {
                tx,
                ty,
                skewX,
                skewY,
                scale
            };
        }
    }
    // Otherwise, parse as string
    const translateMatch = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
    const skewMatch = /skew\(([-\d.]+)deg,\s*([-\d.]+)deg\)/.exec(transform);
    const scaleMatch = /scale\(([\d.]+)\)/.exec(transform);
    return {
        tx: translateMatch ? parseFloat(translateMatch[1]) : 0,
        ty: translateMatch ? parseFloat(translateMatch[2]) : 0,
        skewX: skewMatch ? parseFloat(skewMatch[1]) : 0,
        skewY: skewMatch ? parseFloat(skewMatch[2]) : 0,
        scale: scaleMatch ? parseFloat(scaleMatch[1]) : shadowScale
    };
}

function animateShadowsToInitial(duration = 3000) {
    resettingShadows = true;
    const startTime = performance.now();

    // Always get the transform from style if present, else from computed style
    const initialStates = Array.from(shadows).map(shadow => {
        let t = shadow.style.transform;
        if (!t || t === "none") {
            t = window.getComputedStyle(shadow).transform;
        }
        return parseTransform(t);
    });

    // Set transition for filter only (not transform, since we animate it)
    shadows.forEach((shadow, index) => {
        shadow.style.transition = `filter ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease-out`;
        shadow.style.filter = `blur(${movingBlurBase + index * movingBlurStep}px)`;
    });

    function easeInOutCubic(x) {
        return x < 0.5
            ? 4 * x * x * x
            : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function oscillate(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const smoothT = easeInOutCubic(t); // Use easing for smoother transition
        // Oscillation parameters
        const oscAmount = 7; // px
        const oscSkew = 6; // deg
        const oscSpeed = 2 * Math.PI * 0.25; // 0.25 Hz
        const baseTranslate = { x: 5, y: 5 };
        const baseSkew = { x: 10, y: 5 };

        shadows.forEach((shadow, index) => {
            // Phase offset for each shadow
            const phase = index * Math.PI / 3;
            // Sine/cosine oscillation
            const oscX = Math.sin(oscSpeed * elapsed / 2100 + phase) * oscAmount;
            const oscY = Math.cos(oscSpeed * elapsed / 1612 + phase + 19) * oscAmount * 4.7;
            const oscSkewX = Math.sin(oscSpeed * elapsed / 1776 + phase + 12) * oscSkew;
            const oscSkewY = Math.cos(oscSpeed * elapsed / 1932 + phase + 5435) * oscSkew * 3.5;

            // Target (oscillating) state for this frame
            const targetTx = baseTranslate.x + oscX;
            const targetTy = baseTranslate.y + oscY;
            const targetSkewX = baseSkew.x + oscSkewX;
            const targetSkewY = baseSkew.y + oscSkewY;
            const targetScale = shadowScale;

            // Interpolate from initial to target (oscillating) state
            const init = initialStates[index];
            const tx = init.tx + (targetTx - init.tx) * smoothT;
            const ty = init.ty + (targetTy - init.ty) * smoothT;
            const skewX = init.skewX + (targetSkewX - init.skewX) * smoothT;
            const skewY = init.skewY + (targetSkewY - init.skewY) * smoothT;
            const scale = init.scale + (targetScale - init.scale) * smoothT;

            shadow.style.transform = `translate(${tx}px, ${ty}px) skew(${skewX}deg, ${skewY}deg) scale(${scale})`;
        });

        if (t < 1 && resettingShadows) {
            oscillationFrameId = requestAnimationFrame(oscillate);
        } else {
            // Hold oscillation at end state, but keep animating if still resetting
            if (resettingShadows) {
                oscillationFrameId = requestAnimationFrame(oscillate);
            } else {
                // Clear transform transition for instant response
                shadows.forEach((shadow) => {
                    shadow.style.transition = '';
                });
            }
        }
    }

    if (oscillationFrameId) cancelAnimationFrame(oscillationFrameId);
    oscillationFrameId = requestAnimationFrame(oscillate);

    setTimeout(() => {
        // After duration, keep oscillating until user moves mouse
        // (resettingShadows is set to false on user input)
    }, duration);
}

function cancelShadowResetAnimation() {
    if (resettingShadows) {
        if (oscillationFrameId) {
            cancelAnimationFrame(oscillationFrameId);
            oscillationFrameId = null;
        }
        // Remove transition so interactive update is instant
        shadows.forEach((shadow) => {
            shadow.style.transition = '';
        });
        resettingShadows = false;
    }
}

function scheduleShadowReset() {
    if (resetTimeoutId) clearTimeout(resetTimeoutId);
    resetTimeoutId = setTimeout(() => {
        animateShadowsToInitial();
    }, resetDelay);
}

function onMouseMove(e) {
    lastMouseEvent = e;
    isMouseMoving = true;
    if (blurTimeoutId) {
        clearTimeout(blurTimeoutId);
        blurTimeoutId = null;
    }
    if (resetTimeoutId) {
        clearTimeout(resetTimeoutId);
        resetTimeoutId = null;
    }
    cancelShadowResetAnimation();
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
        scheduleShadowReset();
    }, blurTransitionDelay);
}

container.addEventListener('mousemove', onMouseMove);
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
        onMouseMove;
    }, { once: true }); // Ensure the listener runs only once
});

window.addEventListener('DOMContentLoaded', () => {
    // Use a fake event at the logo center for initial shadow
    const logoRect = logo.getBoundingClientRect();
    const centerEvent = {
        clientX: logoRect.left + logoRect.width / 2,
        clientY: logoRect.top + logoRect.height / 2
    };
    updateShadows(centerEvent, movingBlurBase, movingBlurStep, false);
    scheduleShadowReset();
});
