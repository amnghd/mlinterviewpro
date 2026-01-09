/**
 * Firebase Authentication UI Module for MLInterviewPro
 *
 * This module provides UI components and utilities for managing
 * authentication state in the user interface. It works in conjunction
 * with the auth.js module.
 *
 * Features:
 * - Show/hide login modal
 * - Update UI based on authentication state
 * - Protect content that requires authentication
 * - User profile dropdown component
 *
 * @module auth-ui
 * @version 1.0.0
 * @requires auth.js
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default configuration for auth UI
 * These can be overridden by calling AuthUI.configure()
 */
const AUTH_UI_CONFIG = {
    // Selectors for UI elements
    selectors: {
        loginButton: '[data-auth="login-button"]',
        logoutButton: '[data-auth="logout-button"]',
        userProfile: '[data-auth="user-profile"]',
        userName: '[data-auth="user-name"]',
        userEmail: '[data-auth="user-email"]',
        userAvatar: '[data-auth="user-avatar"]',
        protectedContent: '[data-auth="protected"]',
        guestContent: '[data-auth="guest-only"]',
        authRequired: '[data-auth-required]'
    },

    // CSS classes for states
    classes: {
        hidden: 'auth-hidden',
        visible: 'auth-visible',
        loading: 'auth-loading',
        authenticated: 'auth-authenticated',
        unauthenticated: 'auth-unauthenticated'
    },

    // Default avatar for users without a photo
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSIyMCIgZmlsbD0iIzY0NzQ4YiIvPjxwYXRoIGQ9Ik0yMCAxMGM1LjUyMyAwIDEwIDQuNDc3IDEwIDEwcy00LjQ3NyAxMC0xMCAxMC0xMC00LjQ3Ny0xMC0xMCA0LjQ3Ny0xMCAxMC0xMHptMCAyYy00LjQxMSAwLTggMy41ODktOCA4czMuNTg5IDggOCA4IDgtMy41ODkgOC04LTMuNTg5LTgtOC04em0wIDNjMS42NTcgMCAzIDEuMzQzIDMgM3MtMS4zNDMgMy0zIDMtMy0xLjM0My0zLTMgMS4zNDMtMyAzLTN6bTAgOGMtMi4yMSAwLTQgLjkwMi00IDJoOGMwLTEuMDk4LTEuNzktMi00LTJ6IiBmaWxsPSIjZmZmIi8+PC9zdmc+',

    // URLs
    urls: {
        loginRedirect: null,  // URL to redirect after login (null = stay on current page)
        logoutRedirect: null, // URL to redirect after logout (null = stay on current page)
        protectedRedirect: null // URL to redirect when accessing protected content while logged out
    }
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Current authentication state
 */
let authState = {
    initialized: false,
    loading: true,
    user: null
};

/**
 * Registered content protection rules
 */
const protectionRules = [];

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================

/**
 * Update all UI elements based on authentication state
 * This is the main function that updates the entire UI
 *
 * @param {Object|null} user - The current user object or null if signed out
 */
function updateUIForAuthState(user) {
    authState.user = user;
    authState.loading = false;
    authState.initialized = true;

    // Update body class for global styling
    if (user) {
        document.body.classList.add(AUTH_UI_CONFIG.classes.authenticated);
        document.body.classList.remove(AUTH_UI_CONFIG.classes.unauthenticated);
    } else {
        document.body.classList.add(AUTH_UI_CONFIG.classes.unauthenticated);
        document.body.classList.remove(AUTH_UI_CONFIG.classes.authenticated);
    }

    // Remove loading state
    document.body.classList.remove(AUTH_UI_CONFIG.classes.loading);

    // Update all UI components
    updateLoginButtons(user);
    updateLogoutButtons(user);
    updateUserProfiles(user);
    updateProtectedContent(user);
    updateGuestContent(user);

    // Dispatch custom event for other scripts to listen to
    const event = new CustomEvent('authStateChanged', {
        detail: { user: user, isAuthenticated: !!user }
    });
    document.dispatchEvent(event);
}

/**
 * Update login button visibility
 * Shows login buttons when user is NOT authenticated
 *
 * @param {Object|null} user - The current user
 */
function updateLoginButtons(user) {
    const buttons = document.querySelectorAll(AUTH_UI_CONFIG.selectors.loginButton);

    buttons.forEach(button => {
        if (user) {
            button.style.display = 'none';
            button.setAttribute('aria-hidden', 'true');
        } else {
            button.style.display = '';
            button.removeAttribute('aria-hidden');
        }
    });
}

/**
 * Update logout button visibility
 * Shows logout buttons when user IS authenticated
 *
 * @param {Object|null} user - The current user
 */
function updateLogoutButtons(user) {
    const buttons = document.querySelectorAll(AUTH_UI_CONFIG.selectors.logoutButton);

    buttons.forEach(button => {
        if (user) {
            button.style.display = '';
            button.removeAttribute('aria-hidden');
        } else {
            button.style.display = 'none';
            button.setAttribute('aria-hidden', 'true');
        }
    });
}

/**
 * Update user profile displays
 * Populates user info when authenticated
 *
 * @param {Object|null} user - The current user
 */
function updateUserProfiles(user) {
    // Update profile containers
    const profiles = document.querySelectorAll(AUTH_UI_CONFIG.selectors.userProfile);
    profiles.forEach(profile => {
        if (user) {
            profile.style.display = '';
            profile.removeAttribute('aria-hidden');
        } else {
            profile.style.display = 'none';
            profile.setAttribute('aria-hidden', 'true');
        }
    });

    // Update user names
    const names = document.querySelectorAll(AUTH_UI_CONFIG.selectors.userName);
    names.forEach(name => {
        name.textContent = user ? (user.displayName || 'User') : '';
    });

    // Update user emails
    const emails = document.querySelectorAll(AUTH_UI_CONFIG.selectors.userEmail);
    emails.forEach(email => {
        email.textContent = user ? (user.email || '') : '';
    });

    // Update user avatars
    const avatars = document.querySelectorAll(AUTH_UI_CONFIG.selectors.userAvatar);
    avatars.forEach(avatar => {
        const photoURL = user?.photoURL || AUTH_UI_CONFIG.defaultAvatar;

        if (avatar.tagName === 'IMG') {
            avatar.src = photoURL;
            avatar.alt = user ? (user.displayName || 'User') : '';
        } else {
            // For non-img elements, set as background
            avatar.style.backgroundImage = `url(${photoURL})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
        }
    });
}

/**
 * Update protected content visibility
 * Shows content only when user is authenticated
 *
 * @param {Object|null} user - The current user
 */
function updateProtectedContent(user) {
    const protectedElements = document.querySelectorAll(AUTH_UI_CONFIG.selectors.protectedContent);

    protectedElements.forEach(element => {
        if (user) {
            element.classList.remove(AUTH_UI_CONFIG.classes.hidden);
            element.classList.add(AUTH_UI_CONFIG.classes.visible);
            element.setAttribute('aria-hidden', 'false');
        } else {
            element.classList.add(AUTH_UI_CONFIG.classes.hidden);
            element.classList.remove(AUTH_UI_CONFIG.classes.visible);
            element.setAttribute('aria-hidden', 'true');
        }
    });
}

/**
 * Update guest-only content visibility
 * Shows content only when user is NOT authenticated
 *
 * @param {Object|null} user - The current user
 */
function updateGuestContent(user) {
    const guestElements = document.querySelectorAll(AUTH_UI_CONFIG.selectors.guestContent);

    guestElements.forEach(element => {
        if (user) {
            element.classList.add(AUTH_UI_CONFIG.classes.hidden);
            element.classList.remove(AUTH_UI_CONFIG.classes.visible);
            element.setAttribute('aria-hidden', 'true');
        } else {
            element.classList.remove(AUTH_UI_CONFIG.classes.hidden);
            element.classList.add(AUTH_UI_CONFIG.classes.visible);
            element.setAttribute('aria-hidden', 'false');
        }
    });
}

// ============================================================================
// LOGIN MODAL FUNCTIONS
// ============================================================================

/**
 * Show the login modal
 * Wrapper function that delegates to MLInterviewAuth
 */
function showLoginModal() {
    if (typeof window.MLInterviewAuth !== 'undefined' && window.MLInterviewAuth.showLoginModal) {
        window.MLInterviewAuth.showLoginModal();
    } else {
        console.error('Auth module not loaded. Make sure auth.js is included before auth-ui.js');
    }
}

/**
 * Hide the login modal
 * Wrapper function that delegates to MLInterviewAuth
 */
function hideLoginModal() {
    if (typeof window.MLInterviewAuth !== 'undefined' && window.MLInterviewAuth.hideLoginModal) {
        window.MLInterviewAuth.hideLoginModal();
    } else {
        console.error('Auth module not loaded. Make sure auth.js is included before auth-ui.js');
    }
}

/**
 * Toggle the login modal visibility
 */
function toggleLoginModal() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay && overlay.classList.contains('active')) {
        hideLoginModal();
    } else {
        showLoginModal();
    }
}

// ============================================================================
// CONTENT PROTECTION
// ============================================================================

/**
 * Check if user is authenticated
 * If not, optionally show login modal or redirect
 *
 * @param {Object} options - Options for the check
 * @param {boolean} options.showModal - Whether to show login modal if not authenticated
 * @param {string} options.redirectTo - URL to redirect if not authenticated
 * @param {string} options.message - Message to show in the modal
 * @returns {boolean} True if user is authenticated
 */
function requireAuth(options = {}) {
    const { showModal = true, redirectTo = null, message = null } = options;

    // Check if user is authenticated
    const user = window.MLInterviewAuth?.getCurrentUser?.();

    if (user) {
        return true;
    }

    // User is not authenticated
    if (redirectTo) {
        // Redirect to specified URL
        window.location.href = redirectTo;
    } else if (showModal) {
        // Show login modal
        showLoginModal();

        // Show custom message if provided
        if (message && window.MLInterviewAuth?.showAuthError) {
            // Use a slight delay to ensure modal is visible
            setTimeout(() => {
                const errorDiv = document.getElementById('auth-error-message');
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                    errorDiv.style.background = 'rgba(168, 85, 247, 0.1)';
                    errorDiv.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                    errorDiv.style.color = '#c4b5fd';
                }
            }, 100);
        }
    }

    return false;
}

/**
 * Protect a specific element or section
 * Returns a function to check access when the element is interacted with
 *
 * @param {string|Element} selector - CSS selector or DOM element
 * @param {Object} options - Protection options
 * @returns {Function} Function that returns true if access is granted
 */
function protectContent(selector, options = {}) {
    const elements = typeof selector === 'string'
        ? document.querySelectorAll(selector)
        : [selector];

    elements.forEach(element => {
        // Store original click handlers
        const originalOnClick = element.onclick;

        // Replace with protected handler
        element.onclick = function(event) {
            if (!requireAuth(options)) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }

            // User is authenticated, call original handler if exists
            if (originalOnClick) {
                return originalOnClick.call(this, event);
            }
        };

        // Add data attribute for styling
        element.setAttribute('data-protected', 'true');
    });

    // Return unprotect function
    return () => {
        elements.forEach(element => {
            element.removeAttribute('data-protected');
        });
    };
}

/**
 * Create a content gate overlay for a section
 * Shows an overlay with sign-in prompt over protected content
 *
 * @param {string|Element} containerSelector - The container to gate
 * @param {Object} options - Gate options
 */
function createContentGate(containerSelector, options = {}) {
    const {
        title = 'Sign in to access this content',
        description = 'Create a free account to unlock all features',
        buttonText = 'Sign In',
        blurAmount = '8px',
        overlayClass = 'auth-content-gate'
    } = options;

    const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;

    if (!container) {
        console.warn('Container not found for content gate:', containerSelector);
        return;
    }

    // Check if user is already authenticated
    const user = window.MLInterviewAuth?.getCurrentUser?.();
    if (user) {
        return; // Don't create gate if already logged in
    }

    // Make container relative for positioning
    container.style.position = 'relative';

    // Blur the content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'auth-gated-content';
    contentWrapper.style.cssText = `
        filter: blur(${blurAmount});
        pointer-events: none;
        user-select: none;
    `;

    // Move all children to wrapper
    while (container.firstChild) {
        contentWrapper.appendChild(container.firstChild);
    }
    container.appendChild(contentWrapper);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = overlayClass;
    overlay.innerHTML = `
        <div class="auth-gate-content">
            <div class="auth-gate-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <h3 class="auth-gate-title">${title}</h3>
            <p class="auth-gate-description">${description}</p>
            <button class="auth-gate-button" onclick="AuthUI.showLoginModal()">
                ${buttonText}
            </button>
        </div>
    `;

    // Add overlay styles if not present
    if (!document.getElementById('auth-gate-styles')) {
        const styles = document.createElement('style');
        styles.id = 'auth-gate-styles';
        styles.textContent = `
            .auth-content-gate {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(4px);
                z-index: 10;
                border-radius: inherit;
            }

            .auth-gate-content {
                text-align: center;
                padding: 32px;
                max-width: 320px;
            }

            .auth-gate-icon {
                color: #a855f7;
                margin-bottom: 16px;
            }

            .auth-gate-title {
                color: white;
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 8px 0;
            }

            .auth-gate-description {
                color: #94a3b8;
                font-size: 14px;
                margin: 0 0 24px 0;
            }

            .auth-gate-button {
                background: linear-gradient(135deg, #a855f7, #ec4899);
                color: white;
                border: none;
                padding: 12px 32px;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .auth-gate-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(168, 85, 247, 0.3);
            }

            .auth-hidden {
                display: none !important;
            }

            .auth-visible {
                display: block !important;
            }

            /* Utility classes for flex/inline display */
            .auth-visible-flex {
                display: flex !important;
            }

            .auth-visible-inline {
                display: inline !important;
            }

            .auth-visible-inline-flex {
                display: inline-flex !important;
            }
        `;
        document.head.appendChild(styles);
    }

    container.appendChild(overlay);

    // Store reference for later removal
    container._authGate = {
        overlay,
        contentWrapper
    };

    // Listen for auth state changes to remove gate
    if (window.MLInterviewAuth?.onAuthStateChanged) {
        window.MLInterviewAuth.onAuthStateChanged((user) => {
            if (user && container._authGate) {
                removeContentGate(container);
            }
        });
    }

    return () => removeContentGate(container);
}

/**
 * Remove content gate from a container
 *
 * @param {Element} container - The gated container
 */
function removeContentGate(container) {
    if (!container._authGate) return;

    const { overlay, contentWrapper } = container._authGate;

    // Remove overlay
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }

    // Restore content
    if (contentWrapper) {
        contentWrapper.style.cssText = '';
        while (contentWrapper.firstChild) {
            container.appendChild(contentWrapper.firstChild);
        }
        if (contentWrapper.parentNode) {
            contentWrapper.parentNode.removeChild(contentWrapper);
        }
    }

    delete container._authGate;
}

// ============================================================================
// USER PROFILE DROPDOWN COMPONENT
// ============================================================================

/**
 * Generate HTML for a user profile dropdown component
 *
 * @param {Object} options - Dropdown options
 * @returns {string} HTML string for the dropdown
 */
function getUserProfileDropdownHTML(options = {}) {
    const {
        position = 'bottom-right',
        showEmail = true,
        menuItems = []
    } = options;

    const defaultMenuItems = [
        { label: 'My Profile', icon: 'user', href: '#profile' },
        { label: 'Settings', icon: 'cog', href: '#settings' },
        { type: 'divider' },
        { label: 'Sign Out', icon: 'sign-out-alt', action: 'signOut' }
    ];

    const items = menuItems.length > 0 ? menuItems : defaultMenuItems;

    const menuItemsHTML = items.map(item => {
        if (item.type === 'divider') {
            return '<div class="auth-dropdown-divider"></div>';
        }

        const iconHTML = item.icon ? `<i class="fas fa-${item.icon}"></i>` : '';
        const actionAttr = item.action === 'signOut' ? 'onclick="AuthUI.handleSignOut()"' : '';
        const hrefAttr = item.href ? `href="${item.href}"` : 'href="#"';

        return `
            <a ${hrefAttr} class="auth-dropdown-item" ${actionAttr}>
                ${iconHTML}
                <span>${item.label}</span>
            </a>
        `;
    }).join('');

    return `
        <div class="auth-profile-dropdown" data-position="${position}">
            <button class="auth-profile-trigger" onclick="AuthUI.toggleProfileDropdown(this)" aria-label="User menu">
                <img data-auth="user-avatar" src="${AUTH_UI_CONFIG.defaultAvatar}" alt="User" class="auth-profile-avatar">
                <span data-auth="user-name" class="auth-profile-name"></span>
                <svg class="auth-dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
            </button>
            <div class="auth-dropdown-menu">
                <div class="auth-dropdown-header">
                    <img data-auth="user-avatar" src="${AUTH_UI_CONFIG.defaultAvatar}" alt="User" class="auth-dropdown-avatar">
                    <div class="auth-dropdown-user-info">
                        <div data-auth="user-name" class="auth-dropdown-name"></div>
                        ${showEmail ? '<div data-auth="user-email" class="auth-dropdown-email"></div>' : ''}
                    </div>
                </div>
                <div class="auth-dropdown-items">
                    ${menuItemsHTML}
                </div>
            </div>
        </div>
    `;
}

/**
 * Toggle profile dropdown visibility
 *
 * @param {Element} trigger - The trigger button element
 */
function toggleProfileDropdown(trigger) {
    const dropdown = trigger.closest('.auth-profile-dropdown');
    const menu = dropdown.querySelector('.auth-dropdown-menu');

    // Close other open dropdowns
    document.querySelectorAll('.auth-dropdown-menu.open').forEach(openMenu => {
        if (openMenu !== menu) {
            openMenu.classList.remove('open');
        }
    });

    menu.classList.toggle('open');

    // Add click outside listener
    if (menu.classList.contains('open')) {
        setTimeout(() => {
            document.addEventListener('click', closeDropdownOnClickOutside);
        }, 0);
    }
}

/**
 * Close dropdown when clicking outside
 *
 * @param {Event} event - Click event
 */
function closeDropdownOnClickOutside(event) {
    const dropdown = event.target.closest('.auth-profile-dropdown');

    if (!dropdown) {
        document.querySelectorAll('.auth-dropdown-menu.open').forEach(menu => {
            menu.classList.remove('open');
        });
        document.removeEventListener('click', closeDropdownOnClickOutside);
    }
}

/**
 * Handle sign out from the dropdown
 */
async function handleSignOut() {
    try {
        // Close dropdown first
        document.querySelectorAll('.auth-dropdown-menu.open').forEach(menu => {
            menu.classList.remove('open');
        });

        // Sign out
        if (window.MLInterviewAuth?.signOut) {
            await window.MLInterviewAuth.signOut();
        }

        // Redirect if configured
        if (AUTH_UI_CONFIG.urls.logoutRedirect) {
            window.location.href = AUTH_UI_CONFIG.urls.logoutRedirect;
        }
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

/**
 * Inject profile dropdown styles
 */
function injectProfileDropdownStyles() {
    if (document.getElementById('auth-profile-dropdown-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'auth-profile-dropdown-styles';
    styles.textContent = `
        .auth-profile-dropdown {
            position: relative;
            display: inline-block;
        }

        .auth-profile-trigger {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 50px;
            padding: 6px 12px 6px 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: white;
        }

        .auth-profile-trigger:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .auth-profile-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
        }

        .auth-profile-name {
            font-size: 14px;
            font-weight: 500;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .auth-dropdown-arrow {
            transition: transform 0.2s ease;
        }

        .auth-dropdown-menu.open + .auth-profile-trigger .auth-dropdown-arrow,
        .auth-profile-trigger[aria-expanded="true"] .auth-dropdown-arrow {
            transform: rotate(180deg);
        }

        .auth-dropdown-menu {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            min-width: 240px;
            background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
            border: 1px solid rgba(168, 85, 247, 0.2);
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all 0.2s ease;
            z-index: 1000;
            overflow: hidden;
        }

        .auth-dropdown-menu.open {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }

        .auth-dropdown-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .auth-dropdown-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }

        .auth-dropdown-user-info {
            flex: 1;
            min-width: 0;
        }

        .auth-dropdown-name {
            font-size: 14px;
            font-weight: 600;
            color: white;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .auth-dropdown-email {
            font-size: 12px;
            color: #94a3b8;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .auth-dropdown-items {
            padding: 8px;
        }

        .auth-dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 8px;
            color: #e2e8f0;
            text-decoration: none;
            font-size: 14px;
            transition: all 0.15s ease;
        }

        .auth-dropdown-item:hover {
            background: rgba(168, 85, 247, 0.15);
            color: white;
        }

        .auth-dropdown-item i {
            width: 16px;
            text-align: center;
            color: #94a3b8;
        }

        .auth-dropdown-item:hover i {
            color: #a855f7;
        }

        .auth-dropdown-divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.1);
            margin: 8px 0;
        }

        /* Position variants */
        .auth-profile-dropdown[data-position="bottom-left"] .auth-dropdown-menu {
            right: auto;
            left: 0;
        }

        .auth-profile-dropdown[data-position="top-right"] .auth-dropdown-menu {
            top: auto;
            bottom: calc(100% + 8px);
        }

        .auth-profile-dropdown[data-position="top-left"] .auth-dropdown-menu {
            top: auto;
            bottom: calc(100% + 8px);
            right: auto;
            left: 0;
        }

        /* Light theme variant */
        .auth-profile-dropdown.light .auth-profile-trigger {
            background: white;
            border-color: #e5e7eb;
            color: #1f2937;
        }

        .auth-profile-dropdown.light .auth-dropdown-menu {
            background: white;
            border-color: #e5e7eb;
        }

        .auth-profile-dropdown.light .auth-dropdown-name {
            color: #1f2937;
        }

        .auth-profile-dropdown.light .auth-dropdown-item {
            color: #4b5563;
        }

        .auth-profile-dropdown.light .auth-dropdown-item:hover {
            background: #f3f4f6;
            color: #1f2937;
        }
    `;
    document.head.appendChild(styles);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the Auth UI module
 * Sets up event listeners and registers with the auth module
 */
function initializeAuthUI() {
    // Add loading class while initializing
    document.body.classList.add(AUTH_UI_CONFIG.classes.loading);

    // Inject dropdown styles
    injectProfileDropdownStyles();

    // Set up click handlers for login buttons
    document.addEventListener('click', (event) => {
        const loginButton = event.target.closest(AUTH_UI_CONFIG.selectors.loginButton);
        if (loginButton) {
            event.preventDefault();
            showLoginModal();
        }

        const logoutButton = event.target.closest(AUTH_UI_CONFIG.selectors.logoutButton);
        if (logoutButton) {
            event.preventDefault();
            handleSignOut();
        }
    });

    // Wait for auth module to be ready
    if (typeof window.MLInterviewAuth !== 'undefined') {
        // Register for auth state changes
        window.MLInterviewAuth.onAuthStateChanged(updateUIForAuthState);

        // Check for stored session for quick initial render
        const storedSession = window.MLInterviewAuth.getStoredUserSession?.();
        if (storedSession) {
            // Temporarily update UI with stored data while Firebase initializes
            updateUIForAuthState(storedSession);
        }
    } else {
        // Auth module not loaded yet, wait for it
        window.addEventListener('load', () => {
            if (typeof window.MLInterviewAuth !== 'undefined') {
                window.MLInterviewAuth.onAuthStateChanged(updateUIForAuthState);
            } else {
                console.warn('Auth module not found. Make sure auth.js is loaded.');
                document.body.classList.remove(AUTH_UI_CONFIG.classes.loading);
            }
        });
    }

    // Handle elements with data-auth-required attribute
    document.querySelectorAll(AUTH_UI_CONFIG.selectors.authRequired).forEach(element => {
        const message = element.getAttribute('data-auth-message');
        protectContent(element, { message });
    });
}

/**
 * Configure the Auth UI module
 *
 * @param {Object} config - Configuration options to merge
 */
function configure(config) {
    if (config.selectors) {
        Object.assign(AUTH_UI_CONFIG.selectors, config.selectors);
    }
    if (config.classes) {
        Object.assign(AUTH_UI_CONFIG.classes, config.classes);
    }
    if (config.urls) {
        Object.assign(AUTH_UI_CONFIG.urls, config.urls);
    }
    if (config.defaultAvatar) {
        AUTH_UI_CONFIG.defaultAvatar = config.defaultAvatar;
    }
}

// ============================================================================
// AUTO-INITIALIZATION
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthUI);
} else {
    initializeAuthUI();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Export public API as a global object
 */
window.AuthUI = {
    // Modal controls
    showLoginModal,
    hideLoginModal,
    toggleLoginModal,

    // UI updates
    updateUIForAuthState,

    // Content protection
    requireAuth,
    protectContent,
    createContentGate,
    removeContentGate,

    // Profile dropdown
    getUserProfileDropdownHTML,
    toggleProfileDropdown,
    handleSignOut,

    // Configuration
    configure,

    // State access
    getState: () => ({ ...authState }),
    isInitialized: () => authState.initialized,
    isLoading: () => authState.loading
};

// Also export for ES6 module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.AuthUI;
}
