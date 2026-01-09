/**
 * Firebase Authentication Module for MLInterviewPro
 *
 * This module provides authentication functionality using Firebase Auth.
 * It supports multiple sign-in providers: Google, Apple, Microsoft (Azure AD), and Facebook.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a Firebase project at https://console.firebase.google.com/
 * 2. Enable Authentication and the desired sign-in providers
 * 3. Replace the firebaseConfig values below with your project's configuration
 * 4. Add your domain to the authorized domains in Firebase Console
 *
 * For provider-specific setup:
 * - Google: Enable in Firebase Console > Authentication > Sign-in method
 * - Apple: Requires Apple Developer account and Service ID configuration
 * - Microsoft: Requires Azure AD app registration
 * - Facebook: Requires Facebook Developer app setup
 *
 * @module auth
 * @version 1.0.0
 */

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

/**
 * Firebase configuration object
 * IMPORTANT: Replace these placeholder values with your actual Firebase config
 * You can find these values in Firebase Console > Project Settings > Your apps
 */
const firebaseConfig = {
    apiKey: "AIzaSyCXkZ7pQH2tW4k4cEzL3zGHblBs2sNL_LE",
    authDomain: "website-c83ef.firebaseapp.com",
    projectId: "website-c83ef",
    storageBucket: "website-c83ef.firebasestorage.app",
    messagingSenderId: "308454153628",
    appId: "1:308454153628:web:cd1130a8780e3a645f7c59",
    measurementId: "G-WY3KXQ1KC6"
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

/**
 * Firebase app instance
 * @type {Object|null}
 */
let firebaseApp = null;

/**
 * Firebase Auth instance
 * @type {Object|null}
 */
let auth = null;

/**
 * Current authenticated user
 * @type {Object|null}
 */
let currentUser = null;

/**
 * Array of auth state change listeners
 * @type {Function[]}
 */
const authStateListeners = [];

/**
 * Initialize Firebase and Auth
 * This function is called automatically when the module loads
 * It checks if Firebase SDK is available before initializing
 */
function initializeFirebase() {
    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded. Please include Firebase scripts in your HTML.');
        return false;
    }

    try {
        // Initialize Firebase app (only if not already initialized)
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.app();
        }

        // Get Auth instance
        auth = firebase.auth();

        // Set up auth state listener
        auth.onAuthStateChanged(handleAuthStateChange);

        // Set persistence to LOCAL (survives browser restarts)
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch((error) => {
                console.error('Error setting auth persistence:', error);
            });

        console.log('Firebase Auth initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// ============================================================================
// AUTH STATE MANAGEMENT
// ============================================================================

/**
 * Handle authentication state changes
 * This is called by Firebase whenever the auth state changes
 * It updates the currentUser and notifies all registered listeners
 *
 * @param {Object|null} user - The Firebase user object or null if signed out
 */
function handleAuthStateChange(user) {
    currentUser = user;

    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);

        // Store user session info in localStorage for quick access
        storeUserSession(user);

        // === DATABASE INTEGRATION ===
        // Create/update user profile and record login in Firestore
        if (window.MLInterviewDB) {
            // Update user profile
            window.MLInterviewDB.createOrUpdateUserProfile(user)
                .then(() => {
                    // Record this login with device info
                    return window.MLInterviewDB.recordLogin(user.uid);
                })
                .then(() => {
                    // Sync localStorage progress to Firestore (for first-time users)
                    return window.MLInterviewDB.syncLocalStorageToFirestore(user.uid);
                })
                .then(() => {
                    // Sync Firestore progress back to localStorage (for returning users on new device)
                    return window.MLInterviewDB.syncFirestoreToLocalStorage(user.uid);
                })
                .then(() => {
                    // Track page view
                    return window.MLInterviewDB.trackPageView(user.uid);
                })
                .catch(err => console.error('Database sync error:', err));
        }
        // === END DATABASE INTEGRATION ===
    } else {
        // User is signed out
        console.log('User signed out');

        // Clear stored session
        clearUserSession();
    }

    // Notify all registered listeners
    authStateListeners.forEach(listener => {
        try {
            listener(user);
        } catch (error) {
            console.error('Error in auth state listener:', error);
        }
    });
}

/**
 * Store user session information in localStorage
 * This allows quick access to basic user info without querying Firebase
 *
 * @param {Object} user - The Firebase user object
 */
function storeUserSession(user) {
    const sessionData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        providerId: user.providerData[0]?.providerId || 'unknown',
        lastLoginAt: new Date().toISOString()
    };

    try {
        localStorage.setItem('mlinterviewpro_user_session', JSON.stringify(sessionData));
    } catch (error) {
        console.error('Error storing user session:', error);
    }
}

/**
 * Clear user session from localStorage
 */
function clearUserSession() {
    try {
        localStorage.removeItem('mlinterviewpro_user_session');
    } catch (error) {
        console.error('Error clearing user session:', error);
    }
}

/**
 * Get stored user session from localStorage
 * Useful for quick UI updates before Firebase Auth initializes
 *
 * @returns {Object|null} The stored session data or null
 */
function getStoredUserSession() {
    try {
        const sessionData = localStorage.getItem('mlinterviewpro_user_session');
        return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
        console.error('Error retrieving user session:', error);
        return null;
    }
}

// ============================================================================
// SIGN IN METHODS
// ============================================================================

/**
 * Sign in with Google using popup
 *
 * @returns {Promise<Object>} Promise resolving to the user credential
 * @throws {Error} If sign in fails
 */
async function signInWithGoogle() {
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }

    const provider = new firebase.auth.GoogleAuthProvider();

    // Add scopes for additional user info
    provider.addScope('profile');
    provider.addScope('email');

    // Set custom parameters (optional)
    provider.setCustomParameters({
        prompt: 'select_account'  // Always show account selection
    });

    try {
        const result = await auth.signInWithPopup(provider);
        console.log('Google sign-in successful');
        return result;
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw handleAuthError(error);
    }
}

/**
 * Sign in with Apple using popup
 * Note: Requires Apple Developer account and proper configuration
 *
 * @returns {Promise<Object>} Promise resolving to the user credential
 * @throws {Error} If sign in fails
 */
async function signInWithApple() {
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }

    const provider = new firebase.auth.OAuthProvider('apple.com');

    // Request email and name scopes
    provider.addScope('email');
    provider.addScope('name');

    try {
        const result = await auth.signInWithPopup(provider);
        console.log('Apple sign-in successful');
        return result;
    } catch (error) {
        console.error('Apple sign-in error:', error);
        throw handleAuthError(error);
    }
}

/**
 * Sign in with Microsoft (Azure AD) using popup
 * Note: Requires Azure AD app registration
 *
 * @returns {Promise<Object>} Promise resolving to the user credential
 * @throws {Error} If sign in fails
 */
async function signInWithMicrosoft() {
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }

    const provider = new firebase.auth.OAuthProvider('microsoft.com');

    // Add scopes for user info
    provider.addScope('user.read');
    provider.addScope('openid');
    provider.addScope('profile');
    provider.addScope('email');

    // Optional: Set tenant for single-tenant apps
    // provider.setCustomParameters({
    //     tenant: 'YOUR_TENANT_ID'
    // });

    try {
        const result = await auth.signInWithPopup(provider);
        console.log('Microsoft sign-in successful');
        return result;
    } catch (error) {
        console.error('Microsoft sign-in error:', error);
        throw handleAuthError(error);
    }
}

/**
 * Sign in with Facebook using popup
 * Note: Requires Facebook Developer app setup
 *
 * @returns {Promise<Object>} Promise resolving to the user credential
 * @throws {Error} If sign in fails
 */
async function signInWithFacebook() {
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }

    const provider = new firebase.auth.FacebookAuthProvider();

    // Add scopes for user info
    provider.addScope('email');
    provider.addScope('public_profile');

    try {
        const result = await auth.signInWithPopup(provider);
        console.log('Facebook sign-in successful');
        return result;
    } catch (error) {
        console.error('Facebook sign-in error:', error);
        throw handleAuthError(error);
    }
}

/**
 * Sign out the current user
 *
 * @returns {Promise<void>}
 * @throws {Error} If sign out fails
 */
async function signOut() {
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }

    try {
        await auth.signOut();
        console.log('User signed out successfully');
    } catch (error) {
        console.error('Sign-out error:', error);
        throw handleAuthError(error);
    }
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get the current authenticated user
 *
 * @returns {Object|null} The current user or null if not signed in
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Check if a user is currently signed in
 *
 * @returns {boolean} True if user is signed in
 */
function isSignedIn() {
    return currentUser !== null;
}

/**
 * Get the current user's ID token
 * Useful for authenticating requests to your backend
 *
 * @param {boolean} forceRefresh - Whether to force refresh the token
 * @returns {Promise<string|null>} The ID token or null
 */
async function getIdToken(forceRefresh = false) {
    if (!currentUser) {
        return null;
    }

    try {
        return await currentUser.getIdToken(forceRefresh);
    } catch (error) {
        console.error('Error getting ID token:', error);
        return null;
    }
}

/**
 * Register a callback to be called when auth state changes
 *
 * @param {Function} callback - Function to call with the user object (or null)
 * @returns {Function} Unsubscribe function to remove the listener
 */
function onAuthStateChanged(callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback must be a function');
    }

    authStateListeners.push(callback);

    // If we already have a user, call the callback immediately
    if (currentUser !== undefined) {
        callback(currentUser);
    }

    // Return unsubscribe function
    return () => {
        const index = authStateListeners.indexOf(callback);
        if (index > -1) {
            authStateListeners.splice(index, 1);
        }
    };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle Firebase Auth errors and return user-friendly messages
 *
 * @param {Error} error - The Firebase error object
 * @returns {Error} Error with user-friendly message
 */
function handleAuthError(error) {
    const errorCode = error.code;
    let userMessage = 'An error occurred during authentication.';

    // Map Firebase error codes to user-friendly messages
    const errorMessages = {
        'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
        'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site.',
        'auth/cancelled-popup-request': 'Sign-in was cancelled.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/account-exists-with-different-credential': 'An account already exists with the same email but different sign-in credentials.',
        'auth/auth-domain-config-required': 'Authentication domain not configured.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled.',
        'auth/unauthorized-domain': 'This domain is not authorized for sign-in.',
        'auth/invalid-api-key': 'Invalid API key. Please check Firebase configuration.'
    };

    if (errorMessages[errorCode]) {
        userMessage = errorMessages[errorCode];
    }

    const enhancedError = new Error(userMessage);
    enhancedError.code = errorCode;
    enhancedError.originalError = error;

    return enhancedError;
}

// ============================================================================
// LOGIN MODAL HTML TEMPLATE
// ============================================================================

/**
 * Generate the login modal HTML
 * This creates a styled modal with all sign-in provider buttons
 *
 * @returns {string} HTML string for the login modal
 */
function getLoginModalHTML() {
    return `
    <div id="auth-modal-overlay" class="auth-modal-overlay" onclick="MLInterviewAuth.hideLoginModal()">
        <div class="auth-modal" onclick="event.stopPropagation()">
            <!-- Close Button -->
            <button class="auth-modal-close" onclick="MLInterviewAuth.hideLoginModal()" aria-label="Close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            <!-- Modal Header -->
            <div class="auth-modal-header">
                <div class="auth-modal-logo">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <rect width="40" height="40" rx="10" fill="url(#logo-gradient)"/>
                        <path d="M20 10C14.477 10 10 14.477 10 20s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" fill="white"/>
                        <circle cx="20" cy="20" r="4" fill="white"/>
                        <defs>
                            <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40">
                                <stop stop-color="#a855f7"/>
                                <stop offset="1" stop-color="#ec4899"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <h2 class="auth-modal-title">Welcome to MLInterviewPro</h2>
                <p class="auth-modal-subtitle">Sign in to save your progress and access premium features</p>
            </div>

            <!-- Sign In Buttons -->
            <div class="auth-modal-buttons">
                <!-- Google Sign In -->
                <button class="auth-btn auth-btn-google" onclick="MLInterviewAuth.signInWithGoogle()">
                    <svg class="auth-btn-icon" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                </button>

                <!-- Apple Sign In -->
                <button class="auth-btn auth-btn-apple" onclick="MLInterviewAuth.signInWithApple()">
                    <svg class="auth-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <span>Continue with Apple</span>
                </button>

                <!-- Microsoft Sign In -->
                <button class="auth-btn auth-btn-microsoft" onclick="MLInterviewAuth.signInWithMicrosoft()">
                    <svg class="auth-btn-icon" viewBox="0 0 24 24">
                        <path fill="#F25022" d="M1 1h10v10H1z"/>
                        <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                        <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                        <path fill="#FFB900" d="M13 13h10v10H13z"/>
                    </svg>
                    <span>Continue with Microsoft</span>
                </button>

                <!-- Facebook Sign In -->
                <button class="auth-btn auth-btn-facebook" onclick="MLInterviewAuth.signInWithFacebook()">
                    <svg class="auth-btn-icon" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Continue with Facebook</span>
                </button>
            </div>

            <!-- Error Message Container -->
            <div id="auth-error-message" class="auth-error-message" style="display: none;"></div>

            <!-- Terms -->
            <p class="auth-modal-terms">
                By continuing, you agree to our
                <a href="#" target="_blank">Terms of Service</a> and
                <a href="#" target="_blank">Privacy Policy</a>
            </p>
        </div>
    </div>
    `;
}

/**
 * Get the CSS styles for the login modal
 * This returns the styles as a string that can be injected into the page
 *
 * @returns {string} CSS styles for the auth modal
 */
function getLoginModalStyles() {
    return `
    <style id="auth-modal-styles">
        /* Modal Overlay */
        .auth-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }

        .auth-modal-overlay.active {
            opacity: 1;
            visibility: visible;
        }

        /* Modal Container */
        .auth-modal {
            background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
            border-radius: 24px;
            padding: 40px;
            max-width: 420px;
            width: 90%;
            position: relative;
            border: 1px solid rgba(168, 85, 247, 0.2);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            transform: scale(0.9) translateY(20px);
            transition: all 0.3s ease;
        }

        .auth-modal-overlay.active .auth-modal {
            transform: scale(1) translateY(0);
        }

        /* Close Button */
        .auth-modal-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #94a3b8;
            transition: all 0.2s ease;
        }

        .auth-modal-close:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }

        /* Modal Header */
        .auth-modal-header {
            text-align: center;
            margin-bottom: 32px;
        }

        .auth-modal-logo {
            margin-bottom: 16px;
            display: flex;
            justify-content: center;
        }

        .auth-modal-title {
            font-size: 24px;
            font-weight: 700;
            color: white;
            margin: 0 0 8px 0;
            font-family: 'Space Grotesk', system-ui, sans-serif;
        }

        .auth-modal-subtitle {
            font-size: 14px;
            color: #94a3b8;
            margin: 0;
        }

        /* Auth Buttons Container */
        .auth-modal-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        /* Auth Button Base Styles */
        .auth-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            width: 100%;
            padding: 14px 20px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid transparent;
        }

        .auth-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .auth-btn-icon {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }

        /* Google Button */
        .auth-btn-google {
            background: white;
            color: #1f2937;
            border-color: #e5e7eb;
        }

        .auth-btn-google:hover:not(:disabled) {
            background: #f9fafb;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Apple Button */
        .auth-btn-apple {
            background: #000000;
            color: white;
        }

        .auth-btn-apple:hover:not(:disabled) {
            background: #1a1a1a;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        /* Microsoft Button */
        .auth-btn-microsoft {
            background: #f3f4f6;
            color: #1f2937;
        }

        .auth-btn-microsoft:hover:not(:disabled) {
            background: #e5e7eb;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Facebook Button */
        .auth-btn-facebook {
            background: #1877F2;
            color: white;
        }

        .auth-btn-facebook:hover:not(:disabled) {
            background: #166fe5;
            box-shadow: 0 4px 12px rgba(24, 119, 242, 0.3);
        }

        /* Error Message */
        .auth-error-message {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            margin-top: 16px;
            text-align: center;
        }

        /* Terms Text */
        .auth-modal-terms {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            margin-top: 24px;
        }

        .auth-modal-terms a {
            color: #a855f7;
            text-decoration: none;
        }

        .auth-modal-terms a:hover {
            text-decoration: underline;
        }

        /* Loading State */
        .auth-btn.loading {
            position: relative;
            color: transparent !important;
        }

        .auth-btn.loading::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: auth-spinner 0.8s linear infinite;
        }

        .auth-btn-google.loading::after {
            border-top-color: #1f2937;
        }

        .auth-btn-apple.loading::after,
        .auth-btn-facebook.loading::after {
            border-top-color: white;
        }

        .auth-btn-microsoft.loading::after {
            border-top-color: #1f2937;
        }

        @keyframes auth-spinner {
            to {
                transform: rotate(360deg);
            }
        }

        /* Responsive */
        @media (max-width: 480px) {
            .auth-modal {
                padding: 24px;
                margin: 16px;
            }

            .auth-modal-title {
                font-size: 20px;
            }

            .auth-btn {
                padding: 12px 16px;
                font-size: 14px;
            }
        }
    </style>
    `;
}

// ============================================================================
// MODAL INJECTION
// ============================================================================

/**
 * Inject the login modal HTML and styles into the page
 * This should be called once when the page loads
 */
function injectLoginModal() {
    // Check if modal already exists
    if (document.getElementById('auth-modal-overlay')) {
        return;
    }

    // Inject styles if not already present
    if (!document.getElementById('auth-modal-styles')) {
        document.head.insertAdjacentHTML('beforeend', getLoginModalStyles());
    }

    // Inject modal HTML
    document.body.insertAdjacentHTML('beforeend', getLoginModalHTML());
}

/**
 * Show the login modal
 */
function showLoginModal() {
    // Ensure modal is injected
    injectLoginModal();

    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) {
        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Show modal with animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }
}

/**
 * Hide the login modal
 */
function hideLoginModal() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');

        // Restore body scroll
        document.body.style.overflow = '';

        // Clear any error messages
        const errorDiv = document.getElementById('auth-error-message');
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
    }
}

/**
 * Show an error message in the modal
 *
 * @param {string} message - The error message to display
 */
function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

/**
 * Clear the error message in the modal
 */
function clearAuthError() {
    const errorDiv = document.getElementById('auth-error-message');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
}

// ============================================================================
// WRAPPED SIGN-IN FUNCTIONS WITH UI FEEDBACK
// ============================================================================

/**
 * Wrap sign-in functions to provide loading states and error handling
 *
 * @param {Function} signInFn - The sign-in function to wrap
 * @param {string} buttonClass - The button class selector
 * @returns {Function} Wrapped function with UI handling
 */
function createWrappedSignIn(signInFn, buttonClass) {
    return async function() {
        const button = document.querySelector(buttonClass);

        try {
            // Show loading state
            if (button) {
                button.classList.add('loading');
                button.disabled = true;
            }
            clearAuthError();

            // Attempt sign in
            await signInFn();

            // Success - hide modal
            hideLoginModal();
        } catch (error) {
            // Show error
            showAuthError(error.message);
        } finally {
            // Remove loading state
            if (button) {
                button.classList.remove('loading');
                button.disabled = false;
            }
        }
    };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize the auth module when DOM is ready
 */
function initializeAuth() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFirebase);
    } else {
        initializeFirebase();
    }
}

// Auto-initialize
initializeAuth();

/**
 * Export public API as a global object
 * This makes the auth functions accessible from other scripts and HTML
 */
window.MLInterviewAuth = {
    // Sign-in methods (wrapped with UI handling)
    signInWithGoogle: createWrappedSignIn(signInWithGoogle, '.auth-btn-google'),
    signInWithApple: createWrappedSignIn(signInWithApple, '.auth-btn-apple'),
    signInWithMicrosoft: createWrappedSignIn(signInWithMicrosoft, '.auth-btn-microsoft'),
    signInWithFacebook: createWrappedSignIn(signInWithFacebook, '.auth-btn-facebook'),

    // Sign-out
    signOut: signOut,

    // User management
    getCurrentUser: getCurrentUser,
    isSignedIn: isSignedIn,
    getIdToken: getIdToken,
    getStoredUserSession: getStoredUserSession,

    // Auth state listener
    onAuthStateChanged: onAuthStateChanged,

    // Modal controls
    showLoginModal: showLoginModal,
    hideLoginModal: hideLoginModal,
    injectLoginModal: injectLoginModal,

    // Error handling
    showAuthError: showAuthError,
    clearAuthError: clearAuthError,

    // Configuration (for updating at runtime)
    updateConfig: function(newConfig) {
        Object.assign(firebaseConfig, newConfig);
    }
};

// Also export for ES6 module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MLInterviewAuth;
}
