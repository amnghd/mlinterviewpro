/**
 * Firebase Firestore Database Module for MLInterviewPro
 *
 * This module provides database functionality for:
 * - User profile storage (email, name, provider, etc.)
 * - Login tracking with device/browser info
 * - Problem progress tracking (solved, accessed, time spent)
 * - Analytics and statistics aggregation
 *
 * SETUP INSTRUCTIONS:
 * 1. Enable Firestore in Firebase Console
 * 2. Set up security rules (see bottom of this file)
 * 3. Include Firestore SDK in your HTML before this script
 *
 * @module database
 * @version 1.0.0
 */

// ============================================================================
// FIRESTORE INITIALIZATION
// ============================================================================

/**
 * Firestore database instance
 * @type {Object|null}
 */
let db = null;

/**
 * Initialize Firestore database
 * Must be called after Firebase is initialized
 *
 * @returns {boolean} True if initialization successful
 */
function initializeFirestore() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.error('Firebase not initialized. Call initializeFirebase() first.');
        return false;
    }

    try {
        db = firebase.firestore();

        // Enable offline persistence for better UX
        db.enablePersistence({ synchronizeTabs: true })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('Firestore persistence unavailable: multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('Firestore persistence not supported in this browser');
                }
            });

        console.log('Firestore initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firestore:', error);
        return false;
    }
}

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

/**
 * Create or update user profile on login
 * Called automatically when user signs in
 *
 * @param {Object} user - Firebase Auth user object
 * @returns {Promise<Object>} The user profile document
 */
async function createOrUpdateUserProfile(user) {
    if (!db || !user) return null;

    const userRef = db.collection('users').doc(user.uid);
    const now = firebase.firestore.FieldValue.serverTimestamp();

    try {
        const doc = await userRef.get();

        if (doc.exists) {
            // Update existing user - increment login count and update last login
            await userRef.update({
                lastLoginAt: now,
                totalLogins: firebase.firestore.FieldValue.increment(1),
                // Update profile info in case it changed
                displayName: user.displayName || doc.data().displayName,
                photoURL: user.photoURL || doc.data().photoURL,
                emailVerified: user.emailVerified
            });
            console.log('User profile updated');
        } else {
            // Create new user profile
            await userRef.set({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                emailVerified: user.emailVerified,
                provider: user.providerData[0]?.providerId || 'unknown',
                createdAt: now,
                lastLoginAt: now,
                totalLogins: 1,
                stats: {
                    problemsSolved: 0,
                    problemsAccessed: 0,
                    totalTimeSpent: 0, // in seconds
                    lastActivityAt: now
                }
            });
            console.log('New user profile created');
        }

        return (await userRef.get()).data();
    } catch (error) {
        console.error('Error creating/updating user profile:', error);
        return null;
    }
}

/**
 * Get user profile from Firestore
 *
 * @param {string} userId - The user's UID
 * @returns {Promise<Object|null>} The user profile or null
 */
async function getUserProfile(userId) {
    if (!db || !userId) return null;

    try {
        const doc = await db.collection('users').doc(userId).get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

// ============================================================================
// LOGIN TRACKING
// ============================================================================

/**
 * Get device and browser information
 *
 * @returns {Object} Device info object
 */
function getDeviceInfo() {
    const ua = navigator.userAgent;

    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

    // Detect device type
    let deviceType = 'Desktop';
    if (/Mobi|Android/i.test(ua)) deviceType = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';

    // Detect OS
    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return {
        browser,
        deviceType,
        os,
        userAgent: ua,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
}

/**
 * Record a login event with detailed information
 *
 * @param {string} userId - The user's UID
 * @returns {Promise<string|null>} The login document ID or null
 */
async function recordLogin(userId) {
    if (!db || !userId) return null;

    try {
        const deviceInfo = getDeviceInfo();
        const loginRef = await db.collection('users').doc(userId)
            .collection('logins').add({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                ...deviceInfo,
                referrer: document.referrer || 'direct',
                page: window.location.pathname
            });

        console.log('Login recorded:', loginRef.id);
        return loginRef.id;
    } catch (error) {
        console.error('Error recording login:', error);
        return null;
    }
}

// ============================================================================
// PROBLEM PROGRESS TRACKING
// ============================================================================

/**
 * Problem categories and their prefixes
 */
const PROBLEM_CATEGORIES = {
    'lc': 'LeetCode',
    'mlsd': 'ML System Design',
    'mlcoding': 'ML Coding',
    'behavioral': 'Behavioral'
};

/**
 * Update problem progress status
 *
 * @param {string} userId - The user's UID
 * @param {string} problemId - The problem ID (e.g., 'lc_1', 'mlsd_netflix')
 * @param {string} status - Status: 'notstarted', 'working', 'help', 'solved'
 * @returns {Promise<boolean>} True if successful
 */
async function updateProblemProgress(userId, problemId, status) {
    if (!db || !userId || !problemId) return false;

    try {
        const progressRef = db.collection('users').doc(userId)
            .collection('progress').doc(problemId);

        const now = firebase.firestore.FieldValue.serverTimestamp();
        const doc = await progressRef.get();

        // Extract category from problemId
        const category = problemId.split('_')[0];
        const categoryName = PROBLEM_CATEGORIES[category] || 'Unknown';

        if (doc.exists) {
            const data = doc.data();
            const updates = {
                status,
                lastUpdatedAt: now
            };

            // Track when problem was solved
            if (status === 'solved' && data.status !== 'solved') {
                updates.solvedAt = now;
                // Update user stats
                await updateUserStats(userId, { problemsSolved: 1 });
            }

            await progressRef.update(updates);
        } else {
            // First time accessing this problem
            await progressRef.set({
                problemId,
                category: categoryName,
                status,
                firstAccessedAt: now,
                lastUpdatedAt: now,
                solvedAt: status === 'solved' ? now : null,
                timeSpent: 0, // in seconds
                viewCount: 1
            });

            // Update user stats for new problem accessed
            const statsUpdate = { problemsAccessed: 1 };
            if (status === 'solved') {
                statsUpdate.problemsSolved = 1;
            }
            await updateUserStats(userId, statsUpdate);
        }

        console.log(`Progress updated: ${problemId} -> ${status}`);
        return true;
    } catch (error) {
        console.error('Error updating problem progress:', error);
        return false;
    }
}

/**
 * Record problem view/access
 * Called when user opens a problem
 *
 * @param {string} userId - The user's UID
 * @param {string} problemId - The problem ID
 * @returns {Promise<boolean>} True if successful
 */
async function recordProblemView(userId, problemId) {
    if (!db || !userId || !problemId) return false;

    try {
        const progressRef = db.collection('users').doc(userId)
            .collection('progress').doc(problemId);

        const doc = await progressRef.get();
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const category = problemId.split('_')[0];
        const categoryName = PROBLEM_CATEGORIES[category] || 'Unknown';

        if (doc.exists) {
            await progressRef.update({
                viewCount: firebase.firestore.FieldValue.increment(1),
                lastViewedAt: now
            });
        } else {
            await progressRef.set({
                problemId,
                category: categoryName,
                status: 'notstarted',
                firstAccessedAt: now,
                lastUpdatedAt: now,
                lastViewedAt: now,
                solvedAt: null,
                timeSpent: 0,
                viewCount: 1
            });
            await updateUserStats(userId, { problemsAccessed: 1 });
        }

        return true;
    } catch (error) {
        console.error('Error recording problem view:', error);
        return false;
    }
}

/**
 * Update time spent on a problem
 * Call this periodically while user is on a problem page
 *
 * @param {string} userId - The user's UID
 * @param {string} problemId - The problem ID
 * @param {number} seconds - Additional seconds spent
 * @returns {Promise<boolean>} True if successful
 */
async function updateTimeSpent(userId, problemId, seconds) {
    if (!db || !userId || !problemId || seconds <= 0) return false;

    try {
        const progressRef = db.collection('users').doc(userId)
            .collection('progress').doc(problemId);

        await progressRef.update({
            timeSpent: firebase.firestore.FieldValue.increment(seconds),
            lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Also update total time in user stats
        await updateUserStats(userId, { totalTimeSpent: seconds });

        return true;
    } catch (error) {
        console.error('Error updating time spent:', error);
        return false;
    }
}

// ============================================================================
// USER STATISTICS
// ============================================================================

/**
 * Update user statistics
 *
 * @param {string} userId - The user's UID
 * @param {Object} stats - Stats to increment: { problemsSolved, problemsAccessed, totalTimeSpent }
 * @returns {Promise<boolean>} True if successful
 */
async function updateUserStats(userId, stats) {
    if (!db || !userId) return false;

    try {
        const userRef = db.collection('users').doc(userId);
        const updates = {
            'stats.lastActivityAt': firebase.firestore.FieldValue.serverTimestamp()
        };

        if (stats.problemsSolved) {
            updates['stats.problemsSolved'] = firebase.firestore.FieldValue.increment(stats.problemsSolved);
        }
        if (stats.problemsAccessed) {
            updates['stats.problemsAccessed'] = firebase.firestore.FieldValue.increment(stats.problemsAccessed);
        }
        if (stats.totalTimeSpent) {
            updates['stats.totalTimeSpent'] = firebase.firestore.FieldValue.increment(stats.totalTimeSpent);
        }

        await userRef.update(updates);
        return true;
    } catch (error) {
        console.error('Error updating user stats:', error);
        return false;
    }
}

/**
 * Get user statistics
 *
 * @param {string} userId - The user's UID
 * @returns {Promise<Object|null>} User stats object
 */
async function getUserStats(userId) {
    if (!db || !userId) return null;

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return null;

        const userData = userDoc.data();

        // Get progress breakdown by category
        const progressSnapshot = await db.collection('users').doc(userId)
            .collection('progress').get();

        const categoryStats = {};
        let totalSolved = 0;
        let totalAccessed = 0;

        progressSnapshot.forEach(doc => {
            const data = doc.data();
            const category = data.category || 'Unknown';

            if (!categoryStats[category]) {
                categoryStats[category] = {
                    accessed: 0,
                    solved: 0,
                    working: 0,
                    needHelp: 0,
                    timeSpent: 0
                };
            }

            categoryStats[category].accessed++;
            totalAccessed++;
            categoryStats[category].timeSpent += data.timeSpent || 0;

            if (data.status === 'solved') {
                categoryStats[category].solved++;
                totalSolved++;
            } else if (data.status === 'working') {
                categoryStats[category].working++;
            } else if (data.status === 'help') {
                categoryStats[category].needHelp++;
            }
        });

        return {
            user: {
                email: userData.email,
                displayName: userData.displayName,
                createdAt: userData.createdAt,
                lastLoginAt: userData.lastLoginAt,
                totalLogins: userData.totalLogins
            },
            overall: {
                problemsAccessed: totalAccessed,
                problemsSolved: totalSolved,
                totalTimeSpent: userData.stats?.totalTimeSpent || 0,
                lastActivityAt: userData.stats?.lastActivityAt
            },
            byCategory: categoryStats
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return null;
    }
}

// ============================================================================
// ANALYTICS TRACKING
// ============================================================================

/**
 * Track a custom analytics event
 *
 * @param {string} userId - The user's UID
 * @param {string} eventName - Name of the event
 * @param {Object} eventData - Additional event data
 * @returns {Promise<boolean>} True if successful
 */
async function trackEvent(userId, eventName, eventData = {}) {
    if (!db || !userId) return false;

    try {
        await db.collection('users').doc(userId)
            .collection('events').add({
                eventName,
                ...eventData,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                page: window.location.pathname,
                referrer: document.referrer || 'direct'
            });

        return true;
    } catch (error) {
        console.error('Error tracking event:', error);
        return false;
    }
}

/**
 * Track page view
 *
 * @param {string} userId - The user's UID
 * @returns {Promise<boolean>} True if successful
 */
async function trackPageView(userId) {
    if (!userId) return false;

    return trackEvent(userId, 'page_view', {
        path: window.location.pathname,
        title: document.title
    });
}

// ============================================================================
// TIME TRACKING UTILITIES
// ============================================================================

let activeTimeTracker = null;
let currentProblemId = null;
let sessionStartTime = null;

/**
 * Start tracking time spent on a problem
 *
 * @param {string} userId - The user's UID
 * @param {string} problemId - The problem ID
 */
function startTimeTracking(userId, problemId) {
    // Stop any existing tracking
    stopTimeTracking();

    if (!userId || !problemId) return;

    currentProblemId = problemId;
    sessionStartTime = Date.now();

    // Save time every 30 seconds
    activeTimeTracker = setInterval(async () => {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        if (elapsed > 0) {
            await updateTimeSpent(userId, problemId, elapsed);
            sessionStartTime = Date.now(); // Reset for next interval
        }
    }, 30000);

    // Also save on page visibility change (user switches tabs)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Save on page unload
    window.addEventListener('beforeunload', saveTimeBeforeUnload);
}

/**
 * Stop tracking time
 */
function stopTimeTracking() {
    if (activeTimeTracker) {
        clearInterval(activeTimeTracker);
        activeTimeTracker = null;
    }

    // Save remaining time
    if (sessionStartTime && currentProblemId) {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        if (elapsed > 0) {
            const userId = window.MLInterviewAuth?.getCurrentUser()?.uid;
            if (userId) {
                updateTimeSpent(userId, currentProblemId, elapsed);
            }
        }
    }

    currentProblemId = null;
    sessionStartTime = null;

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', saveTimeBeforeUnload);
}

/**
 * Handle tab visibility changes
 */
function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
        // Save time when user leaves tab
        if (sessionStartTime && currentProblemId) {
            const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
            if (elapsed > 0) {
                const userId = window.MLInterviewAuth?.getCurrentUser()?.uid;
                if (userId) {
                    updateTimeSpent(userId, currentProblemId, elapsed);
                    sessionStartTime = Date.now();
                }
            }
        }
    }
}

/**
 * Save time before page unload
 */
function saveTimeBeforeUnload() {
    if (sessionStartTime && currentProblemId) {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        if (elapsed > 0) {
            const userId = window.MLInterviewAuth?.getCurrentUser()?.uid;
            if (userId) {
                // Use sendBeacon for reliable delivery
                const data = JSON.stringify({
                    userId,
                    problemId: currentProblemId,
                    seconds: elapsed
                });
                navigator.sendBeacon?.('/api/time-spent', data);
            }
        }
    }
}

// ============================================================================
// GET LOGIN HISTORY
// ============================================================================

/**
 * Get user's login history
 *
 * @param {string} userId - The user's UID
 * @param {number} limit - Maximum records to return (default 50)
 * @returns {Promise<Array>} Array of login records
 */
async function getLoginHistory(userId, limit = 50) {
    if (!db || !userId) return [];

    try {
        const snapshot = await db.collection('users').doc(userId)
            .collection('logins')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting login history:', error);
        return [];
    }
}

/**
 * Get all problem progress for a user
 *
 * @param {string} userId - The user's UID
 * @returns {Promise<Array>} Array of progress records
 */
async function getAllProgress(userId) {
    if (!db || !userId) return [];

    try {
        const snapshot = await db.collection('users').doc(userId)
            .collection('progress')
            .orderBy('lastUpdatedAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting progress:', error);
        return [];
    }
}

// ============================================================================
// SYNC LOCAL STORAGE TO FIRESTORE
// ============================================================================

/**
 * Sync localStorage progress to Firestore
 * Call this when user first signs in to migrate existing progress
 *
 * @param {string} userId - The user's UID
 * @returns {Promise<number>} Number of items synced
 */
async function syncLocalStorageToFirestore(userId) {
    if (!db || !userId) return 0;

    let syncedCount = 0;

    try {
        const keys = Object.keys(localStorage);
        const progressKeys = keys.filter(k => k.startsWith('progress_'));

        for (const key of progressKeys) {
            const status = localStorage.getItem(key);
            // Extract problem ID from key (e.g., 'progress_lc_1' -> 'lc_1')
            const problemId = key.replace('progress_', '');

            if (status && problemId) {
                await updateProblemProgress(userId, problemId, status);
                syncedCount++;
            }
        }

        console.log(`Synced ${syncedCount} progress items to Firestore`);
        return syncedCount;
    } catch (error) {
        console.error('Error syncing localStorage to Firestore:', error);
        return syncedCount;
    }
}

/**
 * Sync Firestore progress to localStorage
 * Call this to ensure localStorage is up to date with cloud data
 *
 * @param {string} userId - The user's UID
 * @returns {Promise<number>} Number of items synced
 */
async function syncFirestoreToLocalStorage(userId) {
    if (!db || !userId) return 0;

    let syncedCount = 0;

    try {
        const progressData = await getAllProgress(userId);

        for (const item of progressData) {
            const key = `progress_${item.problemId}`;
            localStorage.setItem(key, item.status);
            syncedCount++;
        }

        console.log(`Synced ${syncedCount} progress items from Firestore`);
        return syncedCount;
    } catch (error) {
        console.error('Error syncing Firestore to localStorage:', error);
        return syncedCount;
    }
}

// ============================================================================
// INITIALIZATION & PUBLIC API
// ============================================================================

/**
 * Initialize database when Firebase is ready
 */
function initializeDatabase() {
    // Wait for Firebase to be initialized
    const checkFirebase = () => {
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            initializeFirestore();
        } else {
            setTimeout(checkFirebase, 100);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkFirebase);
    } else {
        checkFirebase();
    }
}

// Auto-initialize
initializeDatabase();

/**
 * Export public API as a global object
 */
window.MLInterviewDB = {
    // User profile
    createOrUpdateUserProfile,
    getUserProfile,

    // Login tracking
    recordLogin,
    getLoginHistory,
    getDeviceInfo,

    // Problem progress
    updateProblemProgress,
    recordProblemView,
    getAllProgress,

    // Time tracking
    updateTimeSpent,
    startTimeTracking,
    stopTimeTracking,

    // Statistics
    updateUserStats,
    getUserStats,

    // Analytics
    trackEvent,
    trackPageView,

    // Sync
    syncLocalStorageToFirestore,
    syncFirestoreToLocalStorage,

    // Categories
    PROBLEM_CATEGORIES,

    // Re-initialize if needed
    initialize: initializeFirestore
};

// Also export for ES6 module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MLInterviewDB;
}

// ============================================================================
// FIRESTORE SECURITY RULES (Copy to Firebase Console)
// ============================================================================
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Subcollections (logins, progress, events)
      match /{subcollection}/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Admin-only aggregate analytics (optional)
    match /analytics/{docId} {
      allow read: if request.auth != null && request.auth.token.admin == true;
      allow write: if false; // Only via Cloud Functions
    }
  }
}
*/
