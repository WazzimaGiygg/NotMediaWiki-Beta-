import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  limit,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  firebaseConfig,
  FIRESTORE_DATABASE_ID,
  FIREBASE_PROJECT_ID,
  getFirebaseConnectionInfo,
} from './firebaseConfig';
import {
  Article,
  Revision,
  WikiEvent,
  UserSession,
  UserRole,
  SystemLog,
  LogLevel,
  HomePageMetadata,
  WikiExtension,
  AllowedDomain,
  ArbitrationCase,
  CheckUserInvestigation,
  UnblockRequest,
  DataRemovalRequest,
  EmergencyContactReport,
  UserPage,
  VpnDetectionLog,
  BlpEthicsCase,
  DirectChat,
  ChatMessage,
  UserBoxItem,
  UserPageTalkPost,
  UserDailyChecklist,
  UserMonthlyPointsLedger,
  ArticleRating,
} from './types';
import { DEFAULT_EXTENSIONS } from './data/defaultExtensions';
import { api } from './api';

// Initialize Firebase App and Firestore with the unified databaseId
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export const auth = getAuth(app);

// Export unified connection metadata
export { firebaseConfig, FIRESTORE_DATABASE_ID, FIREBASE_PROJECT_ID, getFirebaseConnectionInfo, onAuthStateChanged };
export type { FirebaseUser };

// Google Auth Provider configured for popup sign-in
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore at startup
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'sync_status', 'connection_test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is running in offline mode.');
      return false;
    }
    return true;
  }
}
testFirestoreConnection();

/**
 * Logs in with Google using popup, preserves role/ban state from Firestore,
 * and synchronizes user profile to Firestore
 */
export async function loginWithGoogle(): Promise<UserSession> {
  const pathUsers = 'users';
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;

    const userRef = doc(db, pathUsers, fbUser.uid);
    let role: UserRole = 'editor';
    let editCount = 1;
    let isBanned = false;
    let banReason = '';
    let bannedAt = '';

    let userTag = '';
    let discriminator = '';
    let userPageSlug = '';

    const userEmailLower = (fbUser.email || '').toLowerCase().trim();
    const isBureaucrat =
      userEmailLower === 'mafersao1100@gmail.com' ||
      userEmailLower === 'pedrohenriquecardonaperes@gmail.com' ||
      userEmailLower === 'pedrohenriquecaronaperes@gmail.com';

    try {
      const existingSnap = await getDoc(userRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        // Somente administradores determinados pelo Google recebem o cargo de burocrata/admin
        role = isBureaucrat ? 'bureaucrat' : 'editor';
        editCount = existingData.editCount || 1;
        isBanned = !!existingData.isBanned;
        banReason = existingData.banReason || '';
        bannedAt = existingData.bannedAt || '';
        userTag = existingData.userTag || '';
        discriminator = existingData.discriminator || '';
        userPageSlug = existingData.userPageSlug || '';
      } else {
        role = isBureaucrat ? 'bureaucrat' : 'editor';
      }
    } catch (e) {
      console.warn('Could not read existing user doc from Firestore:', e);
      role = isBureaucrat ? 'bureaucrat' : 'editor';
    }

    // Determine deterministic tag if not yet assigned
    if (!userTag) {
      if (fbUser.email?.includes('mafersao1100')) {
        userTag = '#1100';
      } else {
        const numPart = fbUser.email?.match(/\d+/g)?.join('') || '';
        if (numPart.length >= 2) {
          userTag = `#${numPart.substring(0, 4).padStart(4, '0')}`;
        } else {
          const hashVal = Math.abs(fbUser.uid.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0)) % 9999 + 1;
          userTag = `#${hashVal.toString().padStart(4, '0')}`;
        }
      }
      discriminator = userTag.replace('#', '');
    }

    const username = fbUser.displayName || fbUser.email?.split('@')[0] || 'Wikipedian';
    userPageSlug = `Usuário:${username}${userTag}`;

    const userProfile: UserSession = {
      id: fbUser.uid,
      username,
      userTag,
      discriminator,
      userPageSlug,
      role,
      editCount,
      avatar: (fbUser.displayName || fbUser.email?.split('@')[0] || 'G').substring(0, 2).toUpperCase(),
      email: fbUser.email || undefined,
      isBanned,
      banReason: banReason || undefined,
      bannedAt: bannedAt || undefined,
      isGoogleUser: true,
      photoURL: fbUser.photoURL || undefined,
      provider: 'google.com',
      lastLoginAt: new Date().toISOString(),
      syncedToCloudAt: new Date().toISOString(),
    };

    // Sync/persist user profile to Firestore /users/{uid}
    try {
      await setDoc(userRef, {
        uid: fbUser.uid,
        displayName: userProfile.username,
        userTag: userProfile.userTag,
        discriminator: userProfile.discriminator,
        userPageSlug: userProfile.userPageSlug,
        email: fbUser.email || '',
        photoURL: fbUser.photoURL || '',
        role: userProfile.role,
        editCount: userProfile.editCount,
        isBanned: userProfile.isBanned,
        banReason: userProfile.banReason || '',
        bannedAt: userProfile.bannedAt || '',
        provider: 'google.com',
        isGoogleUser: true,
        lastLoginAt: userProfile.lastLoginAt,
        syncedToCloudAt: userProfile.syncedToCloudAt,
      }, { merge: true });
    } catch (dbErr) {
      console.warn('User profile sync to Firestore error:', dbErr);
    }

    // Automatically verify and create the personal user page in Firestore if not present
    try {
      await ensureUserPageInFirestore(userProfile);
    } catch (pageErr) {
      console.warn('Could not auto-create personal user page:', pageErr);
    }

    return userProfile;
  } catch (err) {
    console.error('Google Sign-In Error:', err);
    throw err;
  }
}

/**
 * Fetches all user accounts stored in Firestore /users
 */
export async function fetchUsersFromFirestore(): Promise<UserSession[]> {
  const pathUsers = 'users';
  try {
    const querySnap = await getDocs(collection(db, pathUsers));
    const users: UserSession[] = [];
    querySnap.forEach(docSnap => {
      const data = docSnap.data();
      const isGoogle = data.provider === 'google.com' || !!data.isGoogleUser || (!!data.email && data.email.includes('@'));
      const username = data.displayName || data.username || docSnap.id;
      const userTag = data.userTag || `#${Math.abs(docSnap.id.split('').reduce((acc: number, c: string) => acc * 31 + c.charCodeAt(0), 0) % 9999 + 1).toString().padStart(4, '0')}`;
      users.push({
        id: data.uid || docSnap.id,
        username,
        userTag,
        discriminator: data.discriminator || userTag.replace('#', ''),
        userPageSlug: data.userPageSlug || `Usuário:${username}${userTag}`,
        role: (data.role as UserRole) || 'editor',
        editCount: data.editCount || 0,
        avatar: (data.displayName || data.username || 'U').substring(0, 2).toUpperCase(),
        email: data.email || undefined,
        bio: data.bio || undefined,
        location: data.location || undefined,
        isBanned: !!data.isBanned,
        banReason: data.banReason || undefined,
        bannedAt: data.bannedAt || undefined,
        isGoogleUser: isGoogle,
        photoURL: data.photoURL || undefined,
        provider: data.provider || (isGoogle ? 'google.com' : undefined),
        lastLoginAt: data.lastLoginAt || undefined,
        syncedToCloudAt: data.syncedToCloudAt || undefined,
      });
    });
    return users;
  } catch (err) {
    console.warn('Notice: Error fetching users from Firestore:', err);
    return [];
  }
}

/**
 * Deletes a user profile document directly from Firestore
 */
export async function deleteUserFromFirestore(userId: string): Promise<boolean> {
  const pathUsers = 'users';
  try {
    await deleteDoc(doc(db, pathUsers, userId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${pathUsers}/${userId}`);
  }
}

/**
 * Synchronizes users strictly with Firebase Firestore as the Single Source of Truth:
 * Pulls all genuine registered users from Firestore /users and keeps CentralAuth in sync.
 * Non-registered users are not propagated to the database.
 */
export async function syncAllUsersWithFirestore(): Promise<{
  pushed: number;
  pulled: number;
  users: UserSession[];
}> {
  // 1. Pull all genuinely registered users from Firestore
  const cloudUsers = await fetchUsersFromFirestore();

  // 2. Synchronize all Firestore users with local server session
  let pulledCount = 0;
  for (const cloudUser of cloudUsers) {
    try {
      await api.upsertUser(cloudUser);
      pulledCount++;
    } catch (err) {
      console.warn(`Error upserting cloud user ${cloudUser.id} locally:`, err);
    }
  }

  return {
    pushed: 0,
    pulled: pulledCount,
    users: cloudUsers,
  };
}

/**
 * Logs out the current Google user
 */
export async function logoutGoogle(): Promise<void> {
  await signOut(auth);
}

/**
 * Synchronizes local MediaWiki articles, revisions, users, and general metadata to Firebase Firestore
 */
export async function syncMediaWikiToFirestore(data: {
  articles: Article[];
  revisions: Revision[];
  events: WikiEvent[];
  users?: UserSession[];
  username?: string;
}): Promise<{
  syncedArticles: number;
  syncedRevisions: number;
  syncedEvents: number;
  syncedUsers: number;
  syncedAt: string;
}> {
  const pathArticles = 'articles';
  const pathRevisions = 'revisions';
  const pathEvents = 'wiki_events';
  const pathUsers = 'users';
  const pathMetadata = 'wiki_metadata';
  const pathSync = 'sync_status';
  const syncedAt = new Date().toISOString();

  let articleCount = 0;
  let revisionCount = 0;
  let eventCount = 0;
  let userCount = 0;

  // 1. Sync Articles to /articles/{articleSlug}
  for (const article of data.articles) {
    try {
      const articleRef = doc(db, pathArticles, article.slug);
      await setDoc(articleRef, {
        slug: article.slug,
        title: article.title,
        namespace: article.namespace,
        wikitext: article.wikitext,
        summary: article.summary,
        latestRevisionId: article.latestRevisionId,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        categories: article.categories || [],
        views: article.views || 0,
        isProtected: !!article.isProtected,
        syncedToCloudAt: syncedAt,
      }, { merge: true });
      articleCount++;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${pathArticles}/${article.slug}`);
    }
  }

  // 2. Sync Revisions to /revisions/{revisionId}
  for (const rev of data.revisions) {
    try {
      const revRef = doc(db, pathRevisions, rev.id);
      await setDoc(revRef, {
        id: rev.id,
        articleSlug: rev.articleSlug,
        parentRevisionId: rev.parentRevisionId || null,
        wikitext: rev.wikitext,
        comment: rev.comment || '',
        author: rev.author,
        timestamp: rev.timestamp,
        sha256: rev.sha256,
        byteSize: rev.byteSize,
        isMinor: !!rev.isMinor,
        syncedToCloudAt: syncedAt,
      }, { merge: true });
      revisionCount++;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${pathRevisions}/${rev.id}`);
    }
  }

  // 3. Sync Events to /wiki_events/{eventId}
  for (const evt of data.events) {
    try {
      const evtRef = doc(db, pathEvents, evt.id);
      await setDoc(evtRef, {
        id: evt.id,
        page_title: evt.page_title,
        page_namespace: evt.page_namespace,
        rev_id: evt.rev_id,
        rev_timestamp: evt.rev_timestamp,
        rev_sha1: evt.rev_sha1,
        rev_minor_edit: !!evt.rev_minor_edit,
        rev_len: evt.rev_len,
        user_text: evt.user_text,
        comment: evt.comment || '',
        type: evt.type,
        database: evt.database || 'enwiki',
        syncedToCloudAt: syncedAt,
      }, { merge: true });
      eventCount++;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${pathEvents}/${evt.id}`);
    }
  }

  // 4. Sync Users to /users/{userId}
  if (data.users && data.users.length > 0) {
    for (const usr of data.users) {
      try {
        const usrRef = doc(db, pathUsers, usr.id);
        await setDoc(usrRef, {
          uid: usr.id,
          displayName: usr.username,
          role: usr.role,
          editCount: usr.editCount,
          isBanned: !!usr.isBanned,
          banReason: usr.banReason || '',
          bannedAt: usr.bannedAt || '',
          email: usr.email || '',
          syncedToCloudAt: syncedAt,
        }, { merge: true });
        userCount++;
      } catch (err) {
        console.warn(`Error syncing user ${usr.id}:`, err);
      }
    }
  }

  // 5. Sync General Information & Metadata to /wiki_metadata/general_info
  try {
    const metaRef = doc(db, pathMetadata, 'general_info');
    await setDoc(metaRef, {
      id: 'general_info',
      platform: 'MediaWiki Node.js Microservices Platform',
      totalArticles: articleCount,
      totalRevisions: revisionCount,
      totalEdits: revisionCount,
      activeUsers: userCount > 0 ? userCount : 5,
      engineVersion: 'MediaWiki-Node-v2.0 (Vector 2026)',
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      projectId: FIREBASE_PROJECT_ID,
      updatedAt: syncedAt,
    });
  } catch (err) {
    console.warn('Error syncing wiki_metadata to Firestore:', err);
  }

  // 6. Update Sync Status Metadata Document
  try {
    const statusRef = doc(db, pathSync, 'current');
    await setDoc(statusRef, {
      status: 'synchronized',
      lastSyncedAt: syncedAt,
      articlesCount: articleCount,
      revisionsCount: revisionCount,
      eventsCount: eventCount,
      usersCount: userCount,
      syncedBy: data.username || 'SystemSyncService',
      databaseId: FIRESTORE_DATABASE_ID,
      projectId: FIREBASE_PROJECT_ID,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${pathSync}/current`);
  }

  return {
    syncedArticles: articleCount,
    syncedRevisions: revisionCount,
    syncedEvents: eventCount,
    syncedUsers: userCount,
    syncedAt,
  };
}

/**
 * Fetches current sync stats and cloud document counts directly from Firestore
 */
export async function getFirestoreSyncInfo(): Promise<{
  connected: boolean;
  statusDoc: any | null;
  generalInfo: any | null;
  articlesCount: number;
  revisionsCount: number;
  eventsCount: number;
  usersCount: number;
  arbitrationCount: number;
  checkUserCount: number;
  unblockCount: number;
  dataRemovalCount: number;
  emergencyCount: number;
  complianceCount: number;
  domainsCount: number;
  extensionsCount: number;
  logsCount: number;
}> {
  const pathArticles = 'articles';
  const pathRevisions = 'revisions';
  const pathEvents = 'wiki_events';
  const pathUsers = 'users';
  const pathMetadata = 'wiki_metadata';
  const pathSync = 'sync_status';
  const pathArb = 'arbitration_cases';
  const pathCU = 'checkuser_investigations';
  const pathUnblock = 'unblock_requests';
  const pathRemovals = 'data_removals';
  const pathEmergency = 'emergency_reports';
  const pathCompliance = 'compliance_records';
  const pathDomains = 'allowed_domains';
  const pathExtensions = 'extensions';
  const pathLogs = 'system_logs';

  try {
    const [
      statusRes,
      metaRes,
      articlesRes,
      revisionsRes,
      eventsRes,
      usersRes,
      arbRes,
      cuRes,
      unblockRes,
      removalsRes,
      emergencyRes,
      complianceRes,
      domainsRes,
      extensionsRes,
      logsRes,
    ] = await Promise.allSettled([
      getDoc(doc(db, pathSync, 'current')),
      getDoc(doc(db, pathMetadata, 'general_info')),
      getDocs(query(collection(db, pathArticles), limit(100))),
      getDocs(query(collection(db, pathRevisions), limit(100))),
      getDocs(query(collection(db, pathEvents), limit(100))),
      getDocs(query(collection(db, pathUsers), limit(100))),
      getDocs(query(collection(db, pathArb), limit(100))),
      getDocs(query(collection(db, pathCU), limit(100))),
      getDocs(query(collection(db, pathUnblock), limit(100))),
      getDocs(query(collection(db, pathRemovals), limit(100))),
      getDocs(query(collection(db, pathEmergency), limit(100))),
      getDocs(query(collection(db, pathCompliance), limit(100))),
      getDocs(query(collection(db, pathDomains), limit(100))),
      getDocs(query(collection(db, pathExtensions), limit(100))),
      getDocs(query(collection(db, pathLogs), limit(100))),
    ]);

    const statusSnap = statusRes.status === 'fulfilled' ? statusRes.value : null;
    const metaSnap = metaRes.status === 'fulfilled' ? metaRes.value : null;
    const articlesSnap = articlesRes.status === 'fulfilled' ? articlesRes.value : null;
    const revisionsSnap = revisionsRes.status === 'fulfilled' ? revisionsRes.value : null;
    const eventsSnap = eventsRes.status === 'fulfilled' ? eventsRes.value : null;
    const usersSnap = usersRes.status === 'fulfilled' ? usersRes.value : null;
    const arbSnap = arbRes.status === 'fulfilled' ? arbRes.value : null;
    const cuSnap = cuRes.status === 'fulfilled' ? cuRes.value : null;
    const unblockSnap = unblockRes.status === 'fulfilled' ? unblockRes.value : null;
    const removalsSnap = removalsRes.status === 'fulfilled' ? removalsRes.value : null;
    const emergencySnap = emergencyRes.status === 'fulfilled' ? emergencyRes.value : null;
    const complianceSnap = complianceRes.status === 'fulfilled' ? complianceRes.value : null;
    const domainsSnap = domainsRes.status === 'fulfilled' ? domainsRes.value : null;
    const extensionsSnap = extensionsRes.status === 'fulfilled' ? extensionsRes.value : null;
    const logsSnap = logsRes.status === 'fulfilled' ? logsRes.value : null;

    return {
      connected: true,
      statusDoc: statusSnap?.exists() ? statusSnap.data() : null,
      generalInfo: metaSnap?.exists() ? metaSnap.data() : null,
      articlesCount: articlesSnap ? articlesSnap.size : 0,
      revisionsCount: revisionsSnap ? revisionsSnap.size : 0,
      eventsCount: eventsSnap ? eventsSnap.size : 0,
      usersCount: usersSnap ? usersSnap.size : 0,
      arbitrationCount: arbSnap ? arbSnap.size : 0,
      checkUserCount: cuSnap ? cuSnap.size : 0,
      unblockCount: unblockSnap ? unblockSnap.size : 0,
      dataRemovalCount: removalsSnap ? removalsSnap.size : 0,
      emergencyCount: emergencySnap ? emergencySnap.size : 0,
      complianceCount: complianceSnap ? complianceSnap.size : 0,
      domainsCount: domainsSnap ? domainsSnap.size : 0,
      extensionsCount: extensionsSnap ? extensionsSnap.size : 0,
      logsCount: logsSnap ? logsSnap.size : 0,
    };
  } catch (error) {
    console.warn('Notice: Firestore sync info read:', error);
    return {
      connected: false,
      statusDoc: null,
      generalInfo: null,
      articlesCount: 0,
      revisionsCount: 0,
      eventsCount: 0,
      usersCount: 0,
      arbitrationCount: 0,
      checkUserCount: 0,
      unblockCount: 0,
      dataRemovalCount: 0,
      emergencyCount: 0,
      complianceCount: 0,
      domainsCount: 0,
      extensionsCount: 0,
      logsCount: 0,
    };
  }
}

/**
 * Sets up a live real-time snapshot listener on Firestore articles
 */
export function subscribeToFirestoreArticles(
  onUpdate: (articles: Article[]) => void,
  onError?: (err: any) => void
) {
  const path = 'articles';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const articles: Article[] = [];
      snapshot.forEach(docSnap => {
        articles.push(docSnap.data() as Article);
      });
      onUpdate(articles);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Helper to compute SHA-256 for revisions
 */
async function computeHash(content: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback below
  }
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(16, '0') + Date.now().toString(16);
}

/**
 * Fetches all synchronized articles directly from Firestore
 */
export async function fetchArticlesFromFirestore(namespace?: number): Promise<Article[]> {
  const path = 'articles';
  try {
    const snap = await getDocs(collection(db, path));
    const articles: Article[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as Article;
      if (namespace === undefined || data.namespace === namespace) {
        articles.push(data);
      }
    });
    return articles;
  } catch (err) {
    console.warn('Error fetching articles from Firestore:', err);
    return [];
  }
}

/**
 * Fetches a single article by canonical slug directly from Firestore
 */
export async function fetchArticleFromFirestore(slug: string): Promise<Article | null> {
  const path = 'articles';
  try {
    const snap = await getDoc(doc(db, path, slug));
    if (snap.exists()) {
      return snap.data() as Article;
    }
    return null;
  } catch (err) {
    console.warn(`Error fetching article ${slug} from Firestore:`, err);
    return null;
  }
}

/**
 * Fetches revisions for an article directly from Firestore
 */
export async function fetchRevisionsFromFirestore(slug: string): Promise<Revision[]> {
  const path = 'revisions';
  try {
    const q = query(collection(db, path), where('articleSlug', '==', slug), limit(50));
    const snap = await getDocs(q);
    const revs: Revision[] = [];
    snap.forEach(docSnap => {
      revs.push(docSnap.data() as Revision);
    });
    // Sort descending by timestamp
    return revs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn(`Error fetching revisions for ${slug} from Firestore:`, err);
    return [];
  }
}

/**
 * Subscribes to real-time recent changes events in Firestore
 */
export function subscribeToFirestoreEvents(
  onUpdate: (events: WikiEvent[]) => void,
  onError?: (err: any) => void
) {
  const path = 'wiki_events';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const events: WikiEvent[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        events.push({
          id: d.id || docSnap.id,
          meta: {
            uri: `https://en.wikipedia.org/wiki/${encodeURIComponent(d.page_title || '')}`,
            request_id: `req-${docSnap.id}`,
            id: docSnap.id,
            dt: d.rev_timestamp || new Date().toISOString(),
            domain: 'en.wikipedia.org',
            stream: 'mediawiki.recentchange',
          },
          database: d.database || 'enwiki',
          page_title: d.page_title || 'Untitled',
          page_namespace: d.page_namespace ?? 0,
          rev_id: d.rev_id || '0',
          rev_timestamp: d.rev_timestamp || new Date().toISOString(),
          rev_sha1: d.rev_sha1 || '',
          rev_minor_edit: !!d.rev_minor_edit,
          rev_len: d.rev_len || 0,
          user_text: d.user_text || 'Anonymous',
          comment: d.comment || '',
          type: (d.type as any) || 'edit',
        });
      });
      // Sort newest first
      events.sort((a, b) => new Date(b.rev_timestamp).getTime() - new Date(a.rev_timestamp).getTime());
      onUpdate(events);
    },
    error => {
      if (onError) onError(error);
    }
  );
}

/**
 * Subscribes to real-time system and microservice logs in Firestore
 */
export function subscribeToFirestoreLogs(
  onUpdate: (logs: SystemLog[]) => void,
  onError?: (err: any) => void
) {
  const path = 'system_logs';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const logs: SystemLog[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        logs.push({
          id: data.id || docSnap.id,
          level: (data.level as LogLevel) || 'INFO',
          service: data.service || 'SystemMesh',
          message: data.message || '',
          timestamp: data.timestamp || new Date().toISOString(),
          traceId: data.traceId || undefined,
          details: data.details || undefined,
        });
      });
      // Sort newest first
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(logs);
    },
    error => {
      if (onError) onError(error);
    }
  );
}

/**
 * Appends a new system log entry to Firestore
 */
export async function writeSystemLog(log: {
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  details?: Record<string, any>;
}): Promise<SystemLog> {
  const path = 'system_logs';
  const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  const entry: SystemLog = {
    id,
    level: log.level,
    service: log.service,
    message: log.message,
    timestamp,
    traceId: log.traceId || `tr-${Date.now().toString(36)}`,
    details: log.details || {},
  };

  try {
    await setDoc(doc(db, path, id), entry);
  } catch (err) {
    console.warn('Could not write system log to Firestore:', err);
  }
  return entry;
}

/**
 * Saves an article directly into Firebase Firestore, atomically creating
 * the revision, EventStream event, and audit log.
 */
export async function saveArticleToFirestore(payload: {
  slug: string;
  title: string;
  wikitext: string;
  summary?: string;
  comment: string;
  isMinor?: boolean;
  categories?: string[];
  namespace?: number;
  authorUser?: UserSession | null;
}): Promise<{ article: Article; revision: Revision; event: WikiEvent }> {
  const pathArticles = 'articles';
  const pathRevisions = 'revisions';
  const pathEvents = 'wiki_events';
  const pathUsers = 'users';

  const cleanSlug = payload.slug.trim().replace(/\s+/g, '_');
  const timestamp = new Date().toISOString();
  const revId = `rev-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
  const eventId = `evt-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const sha256 = await computeHash(payload.wikitext);
  const byteSize = new TextEncoder().encode(payload.wikitext).length;

  const authorName = payload.authorUser?.username || 'Wikipedian';
  const authorId = payload.authorUser?.id || 'anon-user';

  // 1. Fetch current article if exists to get previous revision
  let existingArticle: Article | null = null;
  try {
    const existingSnap = await getDoc(doc(db, pathArticles, cleanSlug));
    if (existingSnap.exists()) {
      existingArticle = existingSnap.data() as Article;
    }
  } catch {
    // Continue
  }

  const isNew = !existingArticle;
  const parentRevisionId = existingArticle?.latestRevisionId || null;

  // 2. Build revision document
  const revision: Revision = {
    id: revId,
    articleSlug: cleanSlug,
    parentRevisionId,
    wikitext: payload.wikitext,
    comment: payload.comment || 'Updated wikitext via Node.js Parsoid editor',
    author: {
      id: authorId,
      name: authorName,
      username: authorName,
      isBot: false,
      role: payload.authorUser?.role || 'editor',
      avatar: payload.authorUser?.avatar || authorName.substring(0, 2).toUpperCase(),
    },
    timestamp,
    sha256,
    byteSize,
    isMinor: !!payload.isMinor,
  };

  // Extract categories from wikitext: [[Category:Foo]]
  const extractedCategories: string[] = [];
  const catMatches = Array.from(payload.wikitext.matchAll(/\[\[Category:([^\]]+)\]\]/gi));
  for (const m of catMatches) {
    const clean = m[1].trim();
    if (clean && !extractedCategories.includes(clean)) {
      extractedCategories.push(clean);
    }
  }
  const finalCategories = extractedCategories.length > 0
    ? extractedCategories
    : (payload.categories || existingArticle?.categories || []);

  // Check authentication prior to Firestore writes
  if (!auth.currentUser) {
    throw new Error('Você precisa fazer login com sua conta Google para criar ou editar artigos.');
  }

  // 3. Build article document
  const articleDocData = {
    id: existingArticle?.id || `art-${cleanSlug.toLowerCase()}`,
    slug: cleanSlug,
    title: payload.title.trim(),
    namespace: payload.namespace !== undefined ? payload.namespace : (cleanSlug.startsWith('Talk:') ? 1 : 0),
    summary: payload.summary || payload.comment || 'Updated content',
    latestRevisionId: revId,
    createdAt: existingArticle?.createdAt || timestamp,
    updatedAt: timestamp,
    categories: finalCategories,
    views: Math.max(1, Number(existingArticle?.views || 0) + 1),
    isProtected: existingArticle?.isProtected || false,
    wikitext: payload.wikitext || '',
    lastEditedBy: authorName,
    authorUid: (existingArticle as any)?.authorUid || auth.currentUser?.uid || authorId,
    syncedToCloudAt: timestamp,
  };

  const article: Article = {
    ...articleDocData,
  };

  // 4. Build wiki event document
  const event: WikiEvent = {
    id: eventId,
    meta: {
      uri: `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanSlug)}`,
      request_id: `req-${revId}`,
      id: eventId,
      dt: timestamp,
      domain: 'en.wikipedia.org',
      stream: 'mediawiki.recentchange',
    },
    database: 'enwiki',
    page_title: cleanSlug,
    page_namespace: article.namespace,
    rev_id: revId,
    rev_timestamp: timestamp,
    rev_sha1: sha256.substring(0, 16),
    rev_minor_edit: !!payload.isMinor,
    rev_len: byteSize,
    user_text: authorName,
    comment: payload.comment || 'Updated wikitext',
    type: isNew ? 'new' : 'edit',
  };

  // 5. Persist to Firestore: Article, Revision, Event
  try {
    await setDoc(doc(db, pathArticles, cleanSlug), articleDocData);
    await setDoc(doc(db, pathRevisions, revId), {
      ...revision,
      syncedToCloudAt: timestamp,
    });
    await setDoc(doc(db, pathEvents, eventId), {
      id: event.id,
      page_title: event.page_title,
      page_namespace: event.page_namespace,
      rev_id: event.rev_id,
      rev_timestamp: event.rev_timestamp,
      rev_sha1: event.rev_sha1,
      rev_minor_edit: event.rev_minor_edit,
      rev_len: event.rev_len,
      user_text: event.user_text,
      comment: event.comment,
      type: event.type,
      database: event.database,
      syncedToCloudAt: timestamp,
    });
  } catch (err: any) {
    console.error('Firestore article save error:', err);
    if (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission'))) {
      throw new Error('Permissão negada pelo Firebase Firestore: certifique-se de estar conectado com sua conta Google e que a página não esteja protegida.');
    }
    throw new Error(`Erro ao salvar no Firestore: ${err.message || 'Falha de comunicação com o banco'}`);
  }

  // 6. Update user's editCount and profile in Firestore
  if (payload.authorUser && payload.authorUser.id) {
    try {
      const userRef = doc(db, pathUsers, payload.authorUser.id);
      const userSnap = await getDoc(userRef);
      const prevCount = userSnap.exists()
        ? (userSnap.data().editCount || 0)
        : (payload.authorUser.editCount || 0);

      await setDoc(userRef, {
        uid: payload.authorUser.id,
        displayName: payload.authorUser.username,
        role: payload.authorUser.role || 'editor',
        editCount: prevCount + 1,
        avatar: payload.authorUser.avatar || payload.authorUser.username.substring(0, 2).toUpperCase(),
        email: payload.authorUser.email || '',
        isGoogleUser: !!payload.authorUser.isGoogleUser,
        provider: payload.authorUser.provider || (payload.authorUser.isGoogleUser ? 'google.com' : 'local'),
        syncedToCloudAt: timestamp,
      }, { merge: true });
    } catch (err) {
      console.warn('Could not increment user edit count:', err);
    }
  }

  // 7. Write system audit log
  await writeSystemLog({
    level: 'INFO',
    service: 'ContentService',
    message: `Article "${cleanSlug}" [${article.title}] commit ${revId} saved directly to Firebase Firestore`,
    traceId: `tr-${revId}`,
    details: {
      slug: cleanSlug,
      author: authorName,
      isMinor: !!payload.isMinor,
      byteSize,
      revId,
    },
  });

  return { article, revision, event };
}

/**
 * Default HTML template designed for the MediaWiki portal.
 * Bureaucrats can modify and save customized versions into Firebase Firestore.
 */
export const DEFAULT_HOMEPAGE_HTML = `<div class="wiki-portal-container space-y-6">
  <!-- Welcome Banner -->
  <div class="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl p-8 shadow-lg border border-blue-800/50">
    <div class="max-w-3xl">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <span class="inline-block px-3 py-1 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded-full text-xs font-semibold uppercase tracking-wider">
          Portal Oficial da Comunidade
        </span>
        <span class="inline-block px-3 py-1 bg-purple-500/20 text-purple-200 border border-purple-400/30 rounded-full text-xs font-semibold">
          Projetos WazzimaGiygg
        </span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-serif font-bold tracking-tight mb-3">
        Bem-vindo(a) ao NotMediaWiki
      </h1>
      <p class="text-blue-100/90 text-sm sm:text-base leading-relaxed mb-4 font-sans">
        Este site faz parte do desenvolvimento de projetos <strong>WazzimaGiygg</strong>, do site 
        <a href="https://wazzimagiygg.com/rv/?uid=https://wazzimagiygg.com" target="_blank" rel="noopener noreferrer" class="text-cyan-300 underline font-semibold hover:text-cyan-200 ml-1">
          wazzimagiygg.com
        </a>.
      </p>
      <p class="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 font-sans">
        Uma enciclopédia livre e colaborativa com sincronização em tempo real via Cloud Firestore, parsing Parsoid e arquitetura resiliente.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <a href="#/wiki/MediaWiki" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
          Explorar Artigo Principal
        </a>
        <a href="#/wiki/Talk:MediaWiki" class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors">
          Página de Discussão
        </a>
        <a href="https://wazzimagiygg.com/rv/?uid=https://wazzimagiygg.com" target="_blank" rel="noopener noreferrer" class="px-4 py-2 bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 text-xs font-semibold rounded-lg border border-purple-400/30 transition-colors">
          Visitar wazzimagiygg.com ↗
        </a>
      </div>
    </div>
  </div>

  <!-- Featured Highlights Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-blue-300 transition-all">
      <div class="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3 font-bold text-lg">
        📖
      </div>
      <h3 class="font-serif font-bold text-slate-900 text-base mb-1">Enciclopédia NotMediaWiki</h3>
      <p class="text-xs text-slate-600 leading-relaxed">
        Milhares de verbetes estruturados em Wikitext, convertidos instantaneamente para HTML5 semântico pelo parser Parsoid.
      </p>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-emerald-300 transition-all">
      <div class="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3 font-bold text-lg">
        ⚡
      </div>
      <h3 class="font-serif font-bold text-slate-900 text-base mb-1">Ecossistema WazzimaGiygg</h3>
      <p class="text-xs text-slate-600 leading-relaxed">
        Integrado aos projetos desenvolvidos no portal <a href="https://wazzimagiygg.com/rv/?uid=https://wazzimagiygg.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">wazzimagiygg.com</a> com alta resiliência e concorrência.
      </p>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-purple-300 transition-all">
      <div class="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-3 font-bold text-lg">
        🛡️
      </div>
      <h3 class="font-serif font-bold text-slate-900 text-base mb-1">Governança Burocrata</h3>
      <p class="text-xs text-slate-600 leading-relaxed">
        Moderação transparente com controle de acesso RBAC, auditoria de integridade e personalização contínua da página inicial.
      </p>
    </div>
  </div>

  <!-- Guidelines and Community Box -->
  <div class="bg-slate-50 border border-slate-200 rounded-xl p-6">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 font-mono">
      Diretrizes da Comunidade & Normas de Edição
    </h3>
    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
      <li class="flex items-start gap-2">
        <span class="text-blue-600 font-bold">✓</span>
        <span><strong>Ponto de vista neutro:</strong> Todos os artigos devem ser escritos sob uma perspectiva imparcial e fundamentada.</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-blue-600 font-bold">✓</span>
        <span><strong>Verificabilidade:</strong> As informações devem ser atribuíveis a fontes confiáveis e documentadas.</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-blue-600 font-bold">✓</span>
        <span><strong>Sem pesquisa inédita:</strong> Artigos devem sintetizar o conhecimento existente e revisado por pares.</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-blue-600 font-bold">✓</span>
        <span><strong>Respeito comunitário:</strong> Colaboração cortês em todas as páginas de discussão e resumos de edição.</span>
      </li>
    </ul>
  </div>
</div>`;

/**
 * Fetches the bureaucrat-customized home page HTML from Firestore
 */
export async function fetchHomePageMetadata(): Promise<HomePageMetadata> {
  const path = 'wiki_metadata';
  const docId = 'home_page';

  try {
    const snap = await getDoc(doc(db, path, docId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: docId,
        htmlContent: data.htmlContent || DEFAULT_HOMEPAGE_HTML,
        title: data.title || 'Portal da Comunidade NotMediaWiki',
        updatedBy: data.updatedBy || 'Burocrata do Sistema',
        updatedByRole: data.updatedByRole || 'bureaucrat',
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Notice: Error fetching home page metadata from Firestore:', err);
  }

  // Fallback to default
  return {
    id: docId,
    htmlContent: DEFAULT_HOMEPAGE_HTML,
    title: 'Portal da Comunidade NotMediaWiki',
    updatedBy: 'NodeArchitect (Burocrata Padrão)',
    updatedByRole: 'bureaucrat',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Saves or updates the home page HTML in Firestore (customized by bureaucrat)
 */
export async function saveHomePageMetadata(data: {
  htmlContent: string;
  title?: string;
  updatedBy?: string;
  updatedByRole?: string;
}): Promise<HomePageMetadata> {
  const path = 'wiki_metadata';
  const docId = 'home_page';
  const timestamp = new Date().toISOString();

  const record: HomePageMetadata = {
    id: docId,
    htmlContent: data.htmlContent,
    title: data.title || 'Portal da Comunidade NotMediaWiki',
    updatedBy: data.updatedBy || 'Burocrata',
    updatedByRole: data.updatedByRole || 'bureaucrat',
    updatedAt: timestamp,
  };

  try {
    await setDoc(doc(db, path, docId), record, { merge: true });
    
    // Log change to Firebase system logs
    await writeSystemLog({
      level: 'INFO',
      service: 'BureaucratPortal',
      message: `Página inicial HTML atualizada pelo burocrata "${record.updatedBy}" [${record.updatedByRole}]`,
      traceId: `tr-home-${Date.now().toString(36)}`,
      details: {
        docId,
        length: record.htmlContent.length,
        updatedBy: record.updatedBy,
        updatedAt: timestamp,
      },
    });
  } catch (err) {
    console.error('Error saving home page metadata to Firestore:', err);
    throw err;
  }

  return record;
}

/**
 * Subscribes to real-time updates for the home page HTML
 */
export function subscribeToHomePageMetadata(
  onUpdate: (data: HomePageMetadata) => void,
  onError?: (err: any) => void
) {
  const path = 'wiki_metadata';
  const docId = 'home_page';

  return onSnapshot(
    doc(db, path, docId),
    snap => {
      if (snap.exists()) {
        const d = snap.data();
        onUpdate({
          id: docId,
          htmlContent: d.htmlContent || DEFAULT_HOMEPAGE_HTML,
          title: d.title || 'Portal da Comunidade NotMediaWiki',
          updatedBy: d.updatedBy || 'Burocrata do Sistema',
          updatedByRole: d.updatedByRole || 'bureaucrat',
          updatedAt: d.updatedAt || new Date().toISOString(),
        });
      } else {
        onUpdate({
          id: docId,
          htmlContent: DEFAULT_HOMEPAGE_HTML,
          title: 'Portal da Comunidade NotMediaWiki',
          updatedBy: 'NodeArchitect (Burocrata Padrão)',
          updatedByRole: 'bureaucrat',
          updatedAt: new Date().toISOString(),
        });
      }
    },
    err => {
      if (onError) onError(err);
    }
  );
}

/**
 * Fetches top editors from Firestore sorted by editCount descending
 */
export async function fetchTopEditorsFromFirestore(limitCount: number = 10): Promise<UserSession[]> {
  try {
    const users = await fetchUsersFromFirestore();
    return users
      .sort((a, b) => (b.editCount || 0) - (a.editCount || 0))
      .slice(0, limitCount);
  } catch (err) {
    console.warn('Error fetching top editors:', err);
    return [];
  }
}

/**
 * Sets up a live real-time snapshot listener on Firestore users
 */
export function subscribeToFirestoreUsers(
  onUpdate: (users: UserSession[]) => void,
  onError?: (err: any) => void
) {
  const pathUsers = 'users';
  return onSnapshot(
    collection(db, pathUsers),
    snapshot => {
      const users: UserSession[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const isGoogle = data.provider === 'google.com' || !!data.isGoogleUser || (!!data.email && data.email.includes('@'));
        users.push({
          id: data.uid || docSnap.id,
          username: data.displayName || data.username || docSnap.id,
          role: (data.role as UserRole) || 'editor',
          editCount: data.editCount || 0,
          avatar: (data.displayName || data.username || 'U').substring(0, 2).toUpperCase(),
          email: data.email || undefined,
          isBanned: !!data.isBanned,
          banReason: data.banReason || undefined,
          bannedAt: data.bannedAt || undefined,
          isGoogleUser: isGoogle,
          photoURL: data.photoURL || undefined,
          provider: data.provider || (isGoogle ? 'google.com' : undefined),
          lastLoginAt: data.lastLoginAt || undefined,
          syncedToCloudAt: data.syncedToCloudAt || undefined,
        });
      });
      onUpdate(users);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, pathUsers);
    }
  );
}

/**
 * Real-time listener specifically for top active editors in Firestore
 */
export function subscribeToTopEditorsFromFirestore(
  onUpdate: (topEditors: UserSession[]) => void,
  limitCount: number = 10,
  onError?: (err: any) => void
) {
  return subscribeToFirestoreUsers(users => {
    const sorted = [...users]
      .sort((a, b) => (b.editCount || 0) - (a.editCount || 0))
      .slice(0, limitCount);
    onUpdate(sorted);
  }, onError);
}

/**
 * Fully synchronizes articles, revisions, events, and users into Firebase Firestore.
 * Ensures Firestore is populated and remains the Single Source of Truth,
 * ignoring any un-synchronized predefined local data.
 */
export async function syncArticlesAndEditorsToFirebase(username?: string): Promise<{
  articles: number;
  users: number;
  revisions: number;
  events: number;
}> {
  let localArticles: Article[] = [];
  let localRevisions: Revision[] = [];
  let localEvents: WikiEvent[] = [];
  let localUsers: UserSession[] = [];

  try {
    const artRes = await fetch('/api/v1/content/articles');
    if (artRes.ok) {
      const data = await artRes.json();
      localArticles = data.articles || [];
    }
  } catch (e) {
    console.warn('Notice: Could not read /api/v1/content/articles for sync:', e);
  }

  try {
    const revRes = await fetch('/api/v1/revisions/recent?limit=50');
    if (revRes.ok) {
      const data = await revRes.json();
      localRevisions = data.revisions || [];
    }
  } catch (e) {
    console.warn('Notice: Could not read /api/v1/revisions/recent for sync:', e);
  }

  try {
    const evtRes = await fetch('/api/v1/events/history?limit=50');
    if (evtRes.ok) {
      const data = await evtRes.json();
      localEvents = data.events || [];
    }
  } catch (e) {
    console.warn('Notice: Could not read /api/v1/events/history for sync:', e);
  }

  try {
    const usrRes = await fetch('/api/v1/auth/users');
    if (usrRes.ok) {
      const data = await usrRes.json();
      localUsers = data.users || [];
    }
  } catch (e) {
    console.warn('Notice: Could not read /api/v1/auth/users for sync:', e);
  }

  const syncResult = await syncMediaWikiToFirestore({
    articles: localArticles,
    revisions: localRevisions,
    events: localEvents,
    users: localUsers,
    username: username || 'FirebaseSynchronizer',
  });

  return {
    articles: syncResult.syncedArticles,
    users: syncResult.syncedUsers,
    revisions: syncResult.syncedRevisions,
    events: syncResult.syncedEvents,
  };
}

/**
 * ---------------------------------------------------------------------------
 * Bureaucrat Extensions Firestore Cloud Synchronization
 * ---------------------------------------------------------------------------
 */

/**
 * Fetches all system extensions stored in Firestore /extensions
 */
export async function fetchExtensionsFromFirestore(): Promise<WikiExtension[]> {
  const path = 'extensions';
  try {
    const snap = await getDocs(collection(db, path));
    const list: WikiExtension[] = [];
    snap.forEach(d => {
      list.push(d.data() as WikiExtension);
    });
    return list;
  } catch (err) {
    console.warn('Notice: Error fetching extensions from Firestore:', err);
    return [];
  }
}

/**
 * Saves or updates a single extension in Firestore /extensions/{ext.id}
 * Executed when activated or deactivated by the bureaucrat
 */
export async function saveExtensionToFirestore(
  ext: WikiExtension,
  user?: UserSession | null
): Promise<WikiExtension> {
  const path = 'extensions';
  const timestamp = new Date().toISOString();
  const bureaucratName = user?.username || 'Burocrata';
  const bureaucratRole = user?.role || 'bureaucrat';

  const updatedRecord: WikiExtension = {
    ...ext,
    lastUpdated: timestamp.split('T')[0],
  };

  const payload: any = {
    ...updatedRecord,
    updatedBy: bureaucratName,
    updatedByRole: bureaucratRole,
    updatedAt: timestamp,
  };

  try {
    await setDoc(doc(db, path, ext.id), payload, { merge: true });

    // Write audit log to Firestore system_logs
    await writeSystemLog({
      level: 'INFO',
      service: 'ExtensionRegistry',
      message: `Extensão "${ext.name}" [${ext.version}] ${ext.enabled ? 'ATIVADA' : 'DESATIVADA'} pelo burocrata "${bureaucratName}" (${bureaucratRole})`,
      traceId: `tr-ext-${Date.now().toString(36)}`,
      details: {
        extensionId: ext.id,
        name: ext.name,
        enabled: ext.enabled,
        category: ext.category,
        updatedBy: bureaucratName,
        updatedByRole: bureaucratRole,
        timestamp,
      },
    });
  } catch (err) {
    console.error(`Error saving extension ${ext.id} to Firestore:`, err);
    throw err;
  }

  return updatedRecord;
}

/**
 * Pushes all provided extensions to Firestore /extensions
 */
export async function syncAllExtensionsToFirestore(
  extensionsList: WikiExtension[],
  user?: UserSession | null
): Promise<{ saved: number }> {
  let count = 0;
  for (const ext of extensionsList) {
    try {
      await saveExtensionToFirestore(ext, user);
      count++;
    } catch (e) {
      console.warn(`Error syncing extension ${ext.id}:`, e);
    }
  }
  return { saved: count };
}

/**
 * Subscribes to real-time changes to the extensions collection in Firestore
 */
export function subscribeToExtensionsFromFirestore(
  onUpdate: (extensions: WikiExtension[]) => void,
  onError?: (err: any) => void
) {
  const path = 'extensions';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const list: WikiExtension[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as WikiExtension);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

/**
 * Initializes or synchronizes extensions when accessing the Wiki
 * Fetches from Firestore; if empty, seeds DEFAULT_EXTENSIONS into Firestore.
 */
export async function initOrSyncExtensionsOnWikiAccess(
  user?: UserSession | null
): Promise<WikiExtension[]> {
  try {
    const cloudExts = await fetchExtensionsFromFirestore();
    if (cloudExts && cloudExts.length > 0) {
      // Merge with default list to ensure any new defaults are present,
      // while keeping the cloud enabled/disabled states intact
      const cloudMap = new Map(cloudExts.map(e => [e.id, e]));
      const merged: WikiExtension[] = DEFAULT_EXTENSIONS.map(def => {
        const cloud = cloudMap.get(def.id);
        if (cloud) {
          return {
            ...def,
            ...cloud,
            enabled: cloud.enabled,
            config: cloud.config || def.config,
          };
        }
        return def;
      });

      // Also append any custom extensions created in Firestore that aren't in DEFAULT_EXTENSIONS
      cloudExts.forEach(c => {
        if (!merged.some(m => m.id === c.id)) {
          merged.push(c);
        }
      });

      try {
        localStorage.setItem('notmediawiki_extensions', JSON.stringify(merged));
      } catch {}

      return merged;
    } else {
      // Firestore has no extensions yet: seed DEFAULT_EXTENSIONS to Firestore
      console.log('Inicializando coleção /extensions no Firestore ao acessar o Wiki...');
      await syncAllExtensionsToFirestore(DEFAULT_EXTENSIONS, user);
      try {
        localStorage.setItem('notmediawiki_extensions', JSON.stringify(DEFAULT_EXTENSIONS));
      } catch {}
      return DEFAULT_EXTENSIONS;
    }
  } catch (err) {
    console.warn('Notice: Fallback to local extensions on Wiki access:', err);
    return DEFAULT_EXTENSIONS;
  }
}

// =============================================================================
// ALLOWED DOMAINS SERVICE (MANAGED IN FIREBASE FIRESTORE BY BUREAUCRAT)
// =============================================================================

export const DEFAULT_ALLOWED_DOMAINS: AllowedDomain[] = [
  {
    id: 'wazzimagiygg-com',
    domain: 'wazzimagiygg.com',
    description: 'Portal principal e ecossistema de projetos WazzimaGiygg',
    status: 'trusted',
    addedBy: 'NodeArchitect (Burocrata)',
    addedByRole: 'bureaucrat',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wikipedia-org',
    domain: 'wikipedia.org',
    description: 'Enciclopédia livre global e repositório de conhecimento',
    status: 'allowed',
    addedBy: 'Burocrata do Sistema',
    addedByRole: 'bureaucrat',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mediawiki-org',
    domain: 'mediawiki.org',
    description: 'Documentação oficial de arquitetura, Parsoid e ganchos do MediaWiki',
    status: 'trusted',
    addedBy: 'Burocrata do Sistema',
    addedByRole: 'bureaucrat',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wikimedia-org',
    domain: 'wikimedia.org',
    description: 'Fundação Wikimedia e projetos colaborativos de código aberto',
    status: 'allowed',
    addedBy: 'Burocrata do Sistema',
    addedByRole: 'bureaucrat',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'github-com',
    domain: 'github.com',
    description: 'Repositórios de código, automações e distribuição de extensões',
    status: 'allowed',
    addedBy: 'Burocrata do Sistema',
    addedByRole: 'bureaucrat',
    createdAt: new Date().toISOString(),
  },
];

/**
 * Fetches all allowed domains from /allowed_domains in Firestore
 */
export async function fetchAllowedDomainsFromFirestore(): Promise<AllowedDomain[]> {
  const path = 'allowed_domains';
  try {
    const snap = await getDocs(collection(db, path));
    const domains: AllowedDomain[] = [];
    snap.forEach(d => {
      domains.push(d.data() as AllowedDomain);
    });

    if (domains.length === 0) {
      // Seed default allowed domains into Firestore
      for (const d of DEFAULT_ALLOWED_DOMAINS) {
        await setDoc(doc(db, path, d.id), d);
      }
      return DEFAULT_ALLOWED_DOMAINS;
    }

    return domains;
  } catch (error) {
    console.warn('Notice: Failed to fetch allowed domains from Firestore, using defaults:', error);
    return DEFAULT_ALLOWED_DOMAINS;
  }
}

/**
 * Saves or updates an allowed domain in /allowed_domains/{domain.id} in Firebase Firestore
 * Called directly by the Bureaucrat in the management interface
 */
export async function saveAllowedDomainToFirestore(
  domainData: {
    domain: string;
    description?: string;
    status?: 'allowed' | 'trusted' | 'blocked';
    id?: string;
  },
  user?: UserSession | null
): Promise<AllowedDomain> {
  const path = 'allowed_domains';
  const cleanDomain = domainData.domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  const docId = domainData.id || cleanDomain.replace(/[^a-z0-9]/g, '-');
  const timestamp = new Date().toISOString();
  const bureaucratName = user?.username || 'Burocrata';
  const bureaucratRole = user?.role || 'bureaucrat';

  const record: AllowedDomain = {
    id: docId,
    domain: cleanDomain,
    description: domainData.description?.trim() || `Domínio permitido registrado pelo burocrata ${bureaucratName}`,
    status: domainData.status || 'allowed',
    addedBy: bureaucratName,
    addedByRole: bureaucratRole,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    await setDoc(doc(db, path, docId), record, { merge: true });

    // Write audit log to Firestore system_logs
    await writeSystemLog({
      level: 'INFO',
      service: 'DomainWhitelist',
      message: `Domínio permitido "${cleanDomain}" gravado diretamente no Firebase Firestore pelo burocrata "${bureaucratName}" [${bureaucratRole}]`,
      traceId: `tr-dom-${Date.now().toString(36)}`,
      details: {
        domainId: docId,
        domain: cleanDomain,
        status: record.status,
        addedBy: bureaucratName,
        addedByRole: bureaucratRole,
        timestamp,
      },
    });

    return record;
  } catch (err) {
    console.error(`Error saving allowed domain ${cleanDomain} to Firestore:`, err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/${docId}`);
  }
}

/**
 * Removes an allowed domain directly from Firebase Firestore
 */
export async function deleteAllowedDomainFromFirestore(
  domainId: string,
  user?: UserSession | null
): Promise<void> {
  const path = 'allowed_domains';
  const bureaucratName = user?.username || 'Burocrata';
  const bureaucratRole = user?.role || 'bureaucrat';

  try {
    await deleteDoc(doc(db, path, domainId));

    // Write audit log to Firestore system_logs
    await writeSystemLog({
      level: 'WARN',
      service: 'DomainWhitelist',
      message: `Domínio permitido "${domainId}" removido do Firebase Firestore pelo burocrata "${bureaucratName}" [${bureaucratRole}]`,
      traceId: `tr-domdel-${Date.now().toString(36)}`,
      details: {
        domainId,
        removedBy: bureaucratName,
        removedByRole: bureaucratRole,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(`Error deleting allowed domain ${domainId} from Firestore:`, err);
    handleFirestoreError(err, OperationType.DELETE, `${path}/${domainId}`);
  }
}

/**
 * Subscribes to real-time updates for allowed domains in Firestore
 */
export function subscribeToAllowedDomainsFromFirestore(
  onUpdate: (domains: AllowedDomain[]) => void,
  onError?: (err: any) => void
) {
  const path = 'allowed_domains';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const list: AllowedDomain[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as AllowedDomain);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// =============================================================================
// CONSELHO DE ARBITRAGEM (ARBCOM) - FIRESTORE SYNC
// =============================================================================

export async function fetchArbitrationCasesFromFirestore(): Promise<ArbitrationCase[]> {
  const path = 'arbitration_cases';
  try {
    const snap = await getDocs(collection(db, path));
    const list: ArbitrationCase[] = [];
    snap.forEach(d => list.push(d.data() as ArbitrationCase));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn(`Firestore arbitration_cases fetch notice:`, err);
    return [];
  }
}

export async function saveArbitrationCaseToFirestore(caseItem: ArbitrationCase): Promise<void> {
  const path = 'arbitration_cases';
  try {
    await setDoc(doc(db, path, caseItem.id), caseItem, { merge: true });
    await writeSystemLog({
      level: 'INFO',
      service: 'ArbCom',
      message: `Processo arbitral ${caseItem.caseNumber} ("${caseItem.title}") sincronizado no Firestore`,
      details: { caseId: caseItem.id, status: caseItem.status, votesCount: caseItem.votes?.length || 0 },
    });
  } catch (err) {
    console.error('Error saving arbitration case to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/${caseItem.id}`);
  }
}

export function subscribeToArbitrationCasesFromFirestore(
  onUpdate: (cases: ArbitrationCase[]) => void,
  onError?: (err: any) => void
) {
  const path = 'arbitration_cases';
  return onSnapshot(
    collection(db, path),
    snap => {
      const list: ArbitrationCase[] = [];
      snap.forEach(d => list.push(d.data() as ArbitrationCase));
      onUpdate(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// =============================================================================
// VERIFICAÇÃO DE CONTAS (CHECKUSER / FANTOCHES) - FIRESTORE SYNC
// =============================================================================

export async function fetchCheckUserInvestigationsFromFirestore(): Promise<CheckUserInvestigation[]> {
  const path = 'checkuser_investigations';
  try {
    const snap = await getDocs(collection(db, path));
    const list: CheckUserInvestigation[] = [];
    snap.forEach(d => list.push(d.data() as CheckUserInvestigation));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn(`Firestore checkuser_investigations fetch notice:`, err);
    return [];
  }
}

export async function saveCheckUserInvestigationToFirestore(item: CheckUserInvestigation): Promise<void> {
  const path = 'checkuser_investigations';
  try {
    await setDoc(doc(db, path, item.id), item, { merge: true });
    await writeSystemLog({
      level: 'WARN',
      service: 'CheckUser',
      message: `Investigação telemática de fantoches ${item.caseCode} (${item.primaryUser}) registrada no Firestore`,
      details: { caseId: item.id, status: item.status, confidenceScore: item.confidenceScore },
    });
  } catch (err) {
    console.error('Error saving checkuser investigation to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/${item.id}`);
  }
}

export function subscribeToCheckUserInvestigationsFromFirestore(
  onUpdate: (items: CheckUserInvestigation[]) => void,
  onError?: (err: any) => void
) {
  const path = 'checkuser_investigations';
  return onSnapshot(
    collection(db, path),
    snap => {
      const list: CheckUserInvestigation[] = [];
      snap.forEach(d => list.push(d.data() as CheckUserInvestigation));
      onUpdate(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// =============================================================================
// AVALIAÇÃO DE DESBLOQUEIO - FIRESTORE SYNC
// =============================================================================

export async function fetchUnblockRequestsFromFirestore(): Promise<UnblockRequest[]> {
  const path = 'unblock_requests';
  try {
    const snap = await getDocs(collection(db, path));
    const list: UnblockRequest[] = [];
    snap.forEach(d => list.push(d.data() as UnblockRequest));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn(`Firestore unblock_requests fetch notice:`, err);
    return [];
  }
}

export async function saveUnblockRequestToFirestore(item: UnblockRequest): Promise<void> {
  const path = 'unblock_requests';
  try {
    await setDoc(doc(db, path, item.id), item, { merge: true });
    await writeSystemLog({
      level: 'INFO',
      service: 'UnblockReview',
      message: `Pedido de revisão de bloqueio do usuário "${item.username}" sincronizado no Firestore (${item.status})`,
      details: { requestId: item.id, status: item.status, resolvedBy: item.resolvedBy },
    });
  } catch (err) {
    console.error('Error saving unblock request to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/${item.id}`);
  }
}

export function subscribeToUnblockRequestsFromFirestore(
  onUpdate: (items: UnblockRequest[]) => void,
  onError?: (err: any) => void
) {
  const path = 'unblock_requests';
  return onSnapshot(
    collection(db, path),
    snap => {
      const list: UnblockRequest[] = [];
      snap.forEach(d => list.push(d.data() as UnblockRequest));
      onUpdate(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// =============================================================================
// PEDIDO DE REMOÇÃO DE DADOS (OVERSIGHT / LGPD ART. 18) - FIRESTORE SYNC
// =============================================================================

export async function fetchDataRemovalsFromFirestore(): Promise<DataRemovalRequest[]> {
  const path = 'data_removals';
  try {
    const snap = await getDocs(collection(db, path));
    const list: DataRemovalRequest[] = [];
    snap.forEach(d => list.push(d.data() as DataRemovalRequest));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn(`Firestore data_removals fetch notice:`, err);
    return [];
  }
}

export async function saveDataRemovalToFirestore(item: DataRemovalRequest): Promise<void> {
  const path = 'data_removals';
  try {
    await setDoc(doc(db, path, item.id), item, { merge: true });
    await writeSystemLog({
      level: 'WARN',
      service: 'DataRemovalLGPD',
      message: `Requerimento de supressão/LGPD ${item.protocolNumber} (${item.targetSlug}) sincronizado no Firestore`,
      details: { protocol: item.protocolNumber, legalBasis: item.legalBasis, status: item.status },
    });
  } catch (err) {
    console.error('Error saving data removal to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/${item.id}`);
  }
}

export function subscribeToDataRemovalsFromFirestore(
  onUpdate: (items: DataRemovalRequest[]) => void,
  onError?: (err: any) => void
) {
  const path = 'data_removals';
  return onSnapshot(
    collection(db, path),
    snap => {
      const list: DataRemovalRequest[] = [];
      snap.forEach(d => list.push(d.data() as DataRemovalRequest));
      onUpdate(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// =============================================================================
// CONTATO DE EMERGÊNCIA 24/7 - FIRESTORE SYNC
// =============================================================================

export async function fetchEmergencyReportsFromFirestore(): Promise<EmergencyContactReport[]> {
  const path = 'emergency_reports';
  try {
    const snap = await getDocs(collection(db, path));
    const list: EmergencyContactReport[] = [];
    snap.forEach(d => list.push(d.data() as EmergencyContactReport));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn(`Firestore emergency_reports fetch notice:`, err);
    return [];
  }
}

export async function saveEmergencyReportToFirestore(item: EmergencyContactReport): Promise<void> {
  const path = 'emergency_reports';
  try {
    await setDoc(doc(db, path, item.id), item, { merge: true });
    await writeSystemLog({
      level: 'FATAL',
      service: 'EmergencySOS',
      message: `ALERTA DE EMERGÊNCIA 24/7 PROTOCOLO ${item.protocol} DISPARADO NO FIRESTORE`,
      details: { protocol: item.protocol, category: item.category, urgency: item.urgency },
    });
  } catch (err) {
    console.error('Error saving emergency report to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/${item.id}`);
  }
}

export function subscribeToEmergencyReportsFromFirestore(
  onUpdate: (items: EmergencyContactReport[]) => void,
  onError?: (err: any) => void
) {
  const path = 'emergency_reports';
  return onSnapshot(
    collection(db, path),
    snap => {
      const list: EmergencyContactReport[] = [];
      snap.forEach(d => list.push(d.data() as EmergencyContactReport));
      onUpdate(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// =============================================================================
// CONFORMIDADE LGPD & MARCO CIVIL - FIRESTORE SYNC
// =============================================================================

export async function fetchComplianceRecordFromFirestore(): Promise<any> {
  const path = 'compliance_records';
  try {
    const snap = await getDoc(doc(db, path, 'active_audit'));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn(`Firestore compliance_records fetch notice:`, err);
    return null;
  }
}

export async function saveComplianceRecordToFirestore(record: any): Promise<void> {
  const path = 'compliance_records';
  try {
    await setDoc(doc(db, path, 'active_audit'), record, { merge: true });
    await writeSystemLog({
      level: 'INFO',
      service: 'ComplianceAudit',
      message: `Auditoria de conformidade LGPD e Marco Civil atualizada no Firestore`,
      details: { status: record.status, updatedAt: record.updatedAt },
    });
  } catch (err) {
    console.error('Error saving compliance record to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/active_audit`);
  }
}

export function subscribeToComplianceRecordFromFirestore(
  onUpdate: (record: any) => void,
  onError?: (err: any) => void
) {
  const path = 'compliance_records';
  return onSnapshot(
    doc(db, path, 'active_audit'),
    snap => {
      if (snap.exists()) {
        onUpdate(snap.data());
      } else {
        onUpdate(null);
      }
    },
    err => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, `${path}/active_audit`);
    }
  );
}

export async function deleteArbitrationCaseFromFirestore(caseId: string): Promise<void> {
  const path = 'arbitration_cases';
  try {
    await deleteDoc(doc(db, path, caseId));
    await writeSystemLog({
      level: 'WARN',
      service: 'ArbCom',
      message: `Processo arbitral ${caseId} removido do Firestore`,
      details: { caseId },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${caseId}`);
  }
}

export async function deleteCheckUserInvestigationFromFirestore(id: string): Promise<void> {
  const path = 'checkuser_investigations';
  try {
    await deleteDoc(doc(db, path, id));
    await writeSystemLog({
      level: 'WARN',
      service: 'CheckUser',
      message: `Investigação telemática ${id} removida do Firestore`,
      details: { id },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
  }
}

export async function deleteUnblockRequestFromFirestore(id: string): Promise<void> {
  const path = 'unblock_requests';
  try {
    await deleteDoc(doc(db, path, id));
    await writeSystemLog({
      level: 'INFO',
      service: 'UnblockReview',
      message: `Solicitação de desbloqueio ${id} removida do Firestore`,
      details: { id },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
  }
}

export async function deleteDataRemovalFromFirestore(id: string): Promise<void> {
  const path = 'data_removals';
  try {
    await deleteDoc(doc(db, path, id));
    await writeSystemLog({
      level: 'WARN',
      service: 'DataRemovalLGPD',
      message: `Registro de exclusão/LGPD ${id} expurgado do Firestore`,
      details: { id },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
  }
}

export async function deleteEmergencyReportFromFirestore(id: string): Promise<void> {
  const path = 'emergency_reports';
  try {
    await deleteDoc(doc(db, path, id));
    await writeSystemLog({
      level: 'WARN',
      service: 'EmergencySOS',
      message: `Alerta de emergência ${id} arquivado e removido do Firestore`,
      details: { id },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
  }
}

// =============================================================================
// USER PAGES (Páginas Pessoais de Usuários com Tags e Prevenção de Duplicatas)
// =============================================================================

export async function ensureUserPageInFirestore(user: UserSession): Promise<{ user: UserSession; userPage: UserPage }> {
  const allUsers = await fetchUsersFromFirestore();
  const sameNameUsers = allUsers.filter(u => u.username.toLowerCase() === user.username.toLowerCase() && u.id !== user.id);

  let tag = user.userTag;
  if (!tag || tag === '') {
    if (user.email && user.email.includes('mafersao1100')) {
      tag = '#1100';
    } else if (sameNameUsers.length > 0) {
      let num = 1;
      const existingTags = new Set(sameNameUsers.map(u => u.userTag).filter(Boolean));
      while (existingTags.has(`#${num.toString().padStart(4, '0')}`)) {
        num++;
      }
      tag = `#${num.toString().padStart(4, '0')}`;
    } else {
      const numPart = user.email ? (user.email.match(/\d+/g)?.join('') || '') : '';
      if (numPart.length >= 2) {
        tag = `#${numPart.substring(0, 4).padStart(4, '0')}`;
      } else {
        const hashVal = Math.abs(user.id.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0)) % 9999 + 1;
        tag = `#${hashVal.toString().padStart(4, '0')}`;
      }
    }
  }

  const slug = `Usuário:${user.username}${tag}`;
  const userPageDocId = `userpage_${user.id}`;
  const pageRef = doc(db, 'user_pages', userPageDocId);
  const snap = await getDoc(pageRef);

  let userPage: UserPage;
  const roleTitle = user.role === 'bureaucrat' ? 'Burocrata' : user.role === 'sysop' ? 'Administrador' : user.role === 'moderator' ? 'Moderador' : 'Editor Comunitário';

  if (snap.exists()) {
    userPage = snap.data() as UserPage;
    // ensure slug/tag matches
    if (!userPage.userTag || userPage.userTag !== tag) {
      userPage.userTag = tag;
      userPage.slug = slug;
      userPage.displayName = `${user.username}${tag}`;
      await setDoc(pageRef, userPage, { merge: true });
    }
  } else {
    const initialWikitext = `== Apresentação ==\nOlá! Bem-vindo(a) à página oficial de usuário de '''${user.username}''' (${tag}) no NotMediaWiki.\n\n=== Sobre Mim ===\n* Membro da comunidade do NotMediaWiki com privilégios de '''${roleTitle}'''.\n* Dedicado à expansão e curadoria de conhecimento enciclopédico livre e transparente.\n\n=== Interesses Enciclopédicos ===\n# Tecnologia e Sistemas Distribuídos\n# Governança de Software Livre e Mídia Digital\n# Conformidade com LGPD e Marco Civil da Internet\n\n=== Contato ===\nPara entrar em contato, deixe uma mensagem na minha seção de discussão abaixo ou inicie um Chat em Tempo Real.`;

    const userboxes: UserBoxItem[] = [
      { id: 'ub-role', label: user.role.toUpperCase(), text: `Este usuário é ${roleTitle} da enciclopédia`, bgClass: 'bg-purple-100 dark:bg-purple-950/70', textClass: 'text-purple-800 dark:text-purple-300' },
      { id: 'ub-wiki', label: 'WIKI', text: 'Contribuidor ativo da plataforma NotMediaWiki', bgClass: 'bg-blue-100 dark:bg-blue-950/70', textClass: 'text-blue-800 dark:text-blue-300' },
      { id: 'ub-sec', label: 'SEC', text: 'Conexão monitorada com verificação de integridade e VPN', bgClass: 'bg-emerald-100 dark:bg-emerald-950/70', textClass: 'text-emerald-800 dark:text-emerald-300' },
    ];

    userPage = {
      id: userPageDocId,
      userId: user.id,
      username: user.username,
      userTag: tag,
      displayName: `${user.username}${tag}`,
      slug,
      wikitext: initialWikitext,
      role: user.role,
      avatar: user.avatar || user.username.substring(0, 2).toUpperCase(),
      email: user.email,
      photoURL: user.photoURL,
      location: 'Brasil',
      badges: [roleTitle, 'Conta Verificada', 'Membro da Comunidade'],
      userboxes,
      talkPosts: [
        {
          id: `talk-welcome-${Date.now()}`,
          authorId: 'system',
          authorUsername: 'NotMediaWiki Boas-Vindas',
          authorTag: '#0001',
          authorRole: 'bureaucrat',
          text: `Olá ${user.username}! Seja muito bem-vindo(a) ao NotMediaWiki. Sua página de usuário pessoal foi criada automaticamente com sua tag exclusiva ${tag} para evitar duplicidades de nickname. Sinta-se à vontade para editar sua página e personalizar seus userboxes!`,
          timestamp: new Date().toISOString(),
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(pageRef, userPage);
  }

  const updatedUser: UserSession = {
    ...user,
    userTag: tag,
    discriminator: tag.replace('#', ''),
    userPageSlug: slug,
  };

  try {
    await setDoc(doc(db, 'users', user.id), {
      userTag: tag,
      discriminator: tag.replace('#', ''),
      userPageSlug: slug,
    }, { merge: true });
  } catch (e) {
    console.warn('Silent notice: could not write userTag to users doc:', e);
  }

  return { user: updatedUser, userPage };
}

export async function fetchUserPageFromFirestore(userIdOrSlug: string): Promise<UserPage | null> {
  const path = 'user_pages';
  try {
    // 1. Try directly by user page doc id
    const docId = userIdOrSlug.startsWith('userpage_') ? userIdOrSlug : `userpage_${userIdOrSlug}`;
    const snap = await getDoc(doc(db, path, docId));
    if (snap.exists()) {
      return snap.data() as UserPage;
    }

    // 2. Try by slug (e.g. Usuário:Nome#tag)
    const qSlug = query(collection(db, path), where('slug', '==', userIdOrSlug), limit(1));
    const slugSnap = await getDocs(qSlug);
    if (!slugSnap.empty) {
      return slugSnap.docs[0].data() as UserPage;
    }

    // 3. Try by displayName or username
    const qUser = query(collection(db, path), where('username', '==', userIdOrSlug), limit(1));
    const userSnap = await getDocs(qUser);
    if (!userSnap.empty) {
      return userSnap.docs[0].data() as UserPage;
    }

    return null;
  } catch (err) {
    console.warn('Error fetching user page from Firestore:', err);
    return null;
  }
}

export async function saveUserPageToFirestore(page: UserPage): Promise<void> {
  const path = 'user_pages';
  try {
    page.updatedAt = new Date().toISOString();
    await setDoc(doc(db, path, page.id), page, { merge: true });
    await writeSystemLog({
      level: 'INFO',
      service: 'UserPages',
      message: `Página pessoal do usuário ${page.displayName} (${page.slug}) atualizada no Firestore`,
      details: { pageId: page.id, slug: page.slug },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${page.id}`);
  }
}

export function subscribeToUserPage(pageIdOrSlug: string, callback: (page: UserPage | null) => void) {
  const path = 'user_pages';
  const docId = pageIdOrSlug.startsWith('userpage_') ? pageIdOrSlug : `userpage_${pageIdOrSlug}`;
  return onSnapshot(
    doc(db, path, docId),
    snap => {
      if (snap.exists()) {
        callback(snap.data() as UserPage);
      } else {
        callback(null);
      }
    },
    err => {
      console.warn('Notice: Real-time user page subscription error:', err);
      callback(null);
    }
  );
}

export async function addUserPageTalkPost(pageId: string, post: UserPageTalkPost): Promise<void> {
  const path = 'user_pages';
  try {
    const pageSnap = await getDoc(doc(db, path, pageId));
    if (pageSnap.exists()) {
      const pageData = pageSnap.data() as UserPage;
      const talkPosts = pageData.talkPosts || [];
      talkPosts.push(post);
      await setDoc(doc(db, path, pageId), { talkPosts, updatedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${pageId}`);
  }
}

// =============================================================================
// VPN & PROXY AUDIT RECORDS (Verificador de VPN no Login e Administração)
// =============================================================================

export async function saveVpnDetectionToFirestore(detection: VpnDetectionLog): Promise<void> {
  const path = 'vpn_detections';
  try {
    await setDoc(doc(db, path, detection.id), detection);
  } catch (err) {
    console.warn('Could not save VPN detection to Firestore:', err);
  }
}

export async function fetchVpnDetectionsFromFirestore(): Promise<VpnDetectionLog[]> {
  const path = 'vpn_detections';
  try {
    const q = query(collection(db, path), orderBy('detectedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const list: VpnDetectionLog[] = [];
    snap.forEach(d => list.push(d.data() as VpnDetectionLog));
    return list;
  } catch (err) {
    console.warn('Notice: Error fetching VPN detections:', err);
    return [];
  }
}

export function subscribeToVpnDetectionsFromFirestore(callback: (detections: VpnDetectionLog[]) => void) {
  const path = 'vpn_detections';
  const q = query(collection(db, path), orderBy('detectedAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    snap => {
      const list: VpnDetectionLog[] = [];
      snap.forEach(d => list.push(d.data() as VpnDetectionLog));
      callback(list);
    },
    err => {
      console.warn('Notice: VPN detections subscription error:', err);
      callback([]);
    }
  );
}

export async function deleteVpnDetectionFromFirestore(id: string): Promise<void> {
  const path = 'vpn_detections';
  try {
    await deleteDoc(doc(db, path, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
  }
}

// =============================================================================
// CONSELHO DE ÉTICA: PESSOAS VIVAS E DERIVADOS (WP:BLP)
// =============================================================================

export async function fetchBlpEthicsCasesFromFirestore(): Promise<BlpEthicsCase[]> {
  const path = 'blp_ethics_cases';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const list: BlpEthicsCase[] = [];
    snap.forEach(d => list.push(d.data() as BlpEthicsCase));
    return list;
  } catch (err) {
    console.warn('Notice: Error fetching BLP ethics cases from Firestore:', err);
    return [];
  }
}

export async function saveBlpEthicsCaseToFirestore(caseItem: BlpEthicsCase): Promise<void> {
  const path = 'blp_ethics_cases';
  try {
    await setDoc(doc(db, path, caseItem.id), caseItem, { merge: true });
    await writeSystemLog({
      level: 'WARN',
      service: 'BLPEthicsCouncil',
      message: `Caso ético de pessoa viva ${caseItem.caseNumber} ("${caseItem.targetPerson}") salvo no Firestore`,
      details: { caseId: caseItem.id, target: caseItem.targetPerson, status: caseItem.status },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${caseItem.id}`);
  }
}

export async function deleteBlpEthicsCaseFromFirestore(caseId: string): Promise<void> {
  const path = 'blp_ethics_cases';
  try {
    await deleteDoc(doc(db, path, caseId));
    await writeSystemLog({
      level: 'INFO',
      service: 'BLPEthicsCouncil',
      message: `Caso ético ${caseId} removido do Firestore`,
      details: { caseId },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${caseId}`);
  }
}

export function subscribeToBlpEthicsCasesFromFirestore(callback: (cases: BlpEthicsCase[]) => void) {
  const path = 'blp_ethics_cases';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    snap => {
      const list: BlpEthicsCase[] = [];
      snap.forEach(d => list.push(d.data() as BlpEthicsCase));
      callback(list);
    },
    err => {
      console.warn('Notice: BLP ethics subscription error:', err);
      callback([]);
    }
  );
}

// =============================================================================
// REAL-TIME CHAT (Mensagens instantâneas e busca de usuários para chat)
// =============================================================================

export async function fetchUserChatsFromFirestore(userId: string): Promise<DirectChat[]> {
  const path = 'direct_chats';
  try {
    const q = query(collection(db, path), where('participants', 'array-contains', userId), limit(50));
    const snap = await getDocs(q);
    const list: DirectChat[] = [];
    snap.forEach(d => list.push(d.data() as DirectChat));
    return list.sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
  } catch (err) {
    console.warn('Error fetching user chats from Firestore:', err);
    return [];
  }
}

export function subscribeToUserChats(userId: string, callback: (chats: DirectChat[]) => void) {
  const path = 'direct_chats';
  const q = query(collection(db, path), where('participants', 'array-contains', userId), limit(50));
  return onSnapshot(
    q,
    snap => {
      const list: DirectChat[] = [];
      snap.forEach(d => list.push(d.data() as DirectChat));
      callback(list.sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()));
    },
    err => {
      console.warn('Notice: User chats subscription error:', err);
      callback([]);
    }
  );
}

export async function createOrGetDirectChat(currentUser: UserSession, targetUser: UserSession): Promise<DirectChat> {
  const path = 'direct_chats';
  const sortedIds = [currentUser.id, targetUser.id].sort();
  const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
  const chatRef = doc(db, path, chatId);
  const snap = await getDoc(chatRef);

  if (snap.exists()) {
    return snap.data() as DirectChat;
  }

  const newChat: DirectChat = {
    id: chatId,
    participants: [currentUser.id, targetUser.id],
    participantNames: {
      [currentUser.id]: `${currentUser.username}${currentUser.userTag || ''}`,
      [targetUser.id]: `${targetUser.username}${targetUser.userTag || ''}`,
    },
    participantAvatars: {
      [currentUser.id]: currentUser.avatar,
      [targetUser.id]: targetUser.avatar,
    },
    participantTags: {
      [currentUser.id]: currentUser.userTag || '',
      [targetUser.id]: targetUser.userTag || '',
    },
    lastMessage: 'Chat iniciado.',
    lastMessageAt: new Date().toISOString(),
    lastMessageSenderId: currentUser.id,
    unreadCount: {
      [currentUser.id]: 0,
      [targetUser.id]: 0,
    },
    createdAt: new Date().toISOString(),
  };

  await setDoc(chatRef, newChat);
  return newChat;
}

export async function fetchChatMessagesFromFirestore(chatId: string): Promise<ChatMessage[]> {
  const path = `direct_chats/${chatId}/messages`;
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(150));
    const snap = await getDocs(q);
    const messages: ChatMessage[] = [];
    snap.forEach(d => messages.push(d.data() as ChatMessage));
    return messages;
  } catch (err) {
    console.warn('Error fetching chat messages:', err);
    return [];
  }
}

export function subscribeToChatMessages(chatId: string, callback: (messages: ChatMessage[]) => void) {
  const path = `direct_chats/${chatId}/messages`;
  const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(150));
  return onSnapshot(
    q,
    snap => {
      const messages: ChatMessage[] = [];
      snap.forEach(d => messages.push(d.data() as ChatMessage));
      callback(messages);
    },
    err => {
      console.warn('Notice: Chat messages subscription error:', err);
      callback([]);
    }
  );
}

export async function sendChatMessageToFirestore(
  chatId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<ChatMessage> {
  const path = `direct_chats/${chatId}/messages`;
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const fullMessage: ChatMessage = {
    ...message,
    id: messageId,
    timestamp: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, path, messageId), fullMessage);
    // Update direct chat metadata
    await setDoc(
      doc(db, 'direct_chats', chatId),
      {
        lastMessage: message.text,
        lastMessageAt: fullMessage.timestamp,
        lastMessageSenderId: message.senderId,
      },
      { merge: true }
    );
    return fullMessage;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${messageId}`);
    return fullMessage;
  }
}

// ============================================================================
// 3.05.3.af & 3.05.8.b - DAILY CHECKLIST & MONTHLY POINTS GAMIFICATION SYSTEM
// 3.05.8.b.a - Fazer login no Wiki-Site (1 ponto)
// 3.05.8.b.b - Fazer uma contribuição (0.20 pontos)
// 3.05.8.b.c - Fazer avaliação de um artigo (1 ponto)
// ============================================================================

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`; // YYYY-MM
}

export function createDefaultDailyChecklist(userId: string, username: string, dateStr: string): UserDailyChecklist {
  const monthStr = dateStr.substring(0, 7);
  return {
    id: `${userId}_${dateStr}`,
    userId,
    username,
    date: dateStr,
    month: monthStr,
    items: {
      login: { completed: false, points: 1.0 },
      contribution: { completed: false, points: 0.2, count: 0 },
      rating: { completed: false, points: 1.0 },
    },
    dailyPointsEarned: 0,
    maxPossibleDailyPoints: 2.2,
    completedAll: false,
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultMonthlyLedger(userId: string, username: string, monthStr: string): UserMonthlyPointsLedger {
  return {
    id: `${userId}_${monthStr}`,
    userId,
    username,
    month: monthStr,
    totalMonthlyPoints: 0,
    totalDaysActive: 0,
    loginPointsTotal: 0,
    contributionPointsTotal: 0,
    ratingPointsTotal: 0,
    lastActiveDate: getTodayDateString(),
    streakDays: 0,
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fetches the daily checklist for a given user and date from Firestore
 */
export async function fetchDailyChecklistFromFirestore(
  userId: string,
  dateStr = getTodayDateString()
): Promise<UserDailyChecklist | null> {
  const docId = `${userId}_${dateStr}`;
  const path = `user_daily_checklists/${docId}`;
  try {
    const snap = await getDoc(doc(db, 'user_daily_checklists', docId));
    if (snap.exists()) {
      return snap.data() as UserDailyChecklist;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

/**
 * Fetches the monthly points ledger for a user and month from Firestore
 */
export async function fetchMonthlyPointsFromFirestore(
  userId: string,
  monthStr = getCurrentMonthString()
): Promise<UserMonthlyPointsLedger | null> {
  const docId = `${userId}_${monthStr}`;
  const path = `user_monthly_points/${docId}`;
  try {
    const snap = await getDoc(doc(db, 'user_monthly_points', docId));
    if (snap.exists()) {
      return snap.data() as UserMonthlyPointsLedger;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

/**
 * Records a checklist activity (login = 1 pt, contribution = 0.20 pt, rating = 1 pt)
 * Calculates daily points earned (up to 2.20) and updates the monthly points ledger
 */
export async function recordDailyChecklistAction(
  userId: string,
  username: string,
  action: 'login' | 'contribution' | 'rating',
  meta?: { articleSlug?: string; ratingStars?: number }
): Promise<{ checklist: UserDailyChecklist; pointsAdded: number; newTotalDaily: number; newMonthlyTotal: number }> {
  const dateStr = getTodayDateString();
  const monthStr = getCurrentMonthString();
  const checklistDocId = `${userId}_${dateStr}`;
  const ledgerDocId = `${userId}_${monthStr}`;

  // 1. Load or initialize daily checklist
  let checklist = await fetchDailyChecklistFromFirestore(userId, dateStr);
  if (!checklist) {
    checklist = createDefaultDailyChecklist(userId, username, dateStr);
  }

  let pointsAdded = 0;
  const nowIso = new Date().toISOString();

  if (action === 'login') {
    if (!checklist.items.login.completed) {
      checklist.items.login.completed = true;
      checklist.items.login.completedAt = nowIso;
      pointsAdded += 1.0;
    }
  } else if (action === 'contribution') {
    const currentCount = checklist.items.contribution.count || 0;
    checklist.items.contribution.count = currentCount + 1;
    if (meta?.articleSlug) {
      checklist.items.contribution.lastArticleSlug = meta.articleSlug;
    }
    if (!checklist.items.contribution.completed) {
      checklist.items.contribution.completed = true;
      checklist.items.contribution.completedAt = nowIso;
      pointsAdded += 0.2;
    }
  } else if (action === 'rating') {
    if (meta?.articleSlug) {
      checklist.items.rating.lastArticleSlug = meta.articleSlug;
    }
    if (meta?.ratingStars) {
      checklist.items.rating.stars = meta.ratingStars;
    }
    if (!checklist.items.rating.completed) {
      checklist.items.rating.completed = true;
      checklist.items.rating.completedAt = nowIso;
      pointsAdded += 1.0;
    }
  }

  // Recalculate daily total points
  let dailyTotal = 0;
  if (checklist.items.login.completed) dailyTotal += 1.0;
  if (checklist.items.contribution.completed) dailyTotal += 0.2;
  if (checklist.items.rating.completed) dailyTotal += 1.0;

  checklist.dailyPointsEarned = Math.round(dailyTotal * 100) / 100;
  checklist.completedAll =
    checklist.items.login.completed &&
    checklist.items.contribution.completed &&
    checklist.items.rating.completed;
  checklist.updatedAt = nowIso;

  // Persist updated daily checklist in Firestore
  try {
    await setDoc(doc(db, 'user_daily_checklists', checklistDocId), checklist);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `user_daily_checklists/${checklistDocId}`);
  }

  // 2. Load or initialize monthly ledger
  let ledger = await fetchMonthlyPointsFromFirestore(userId, monthStr);
  if (!ledger) {
    ledger = createDefaultMonthlyLedger(userId, username, monthStr);
  }

  if (pointsAdded > 0) {
    ledger.totalMonthlyPoints = Math.round((ledger.totalMonthlyPoints + pointsAdded) * 100) / 100;

    if (action === 'login') ledger.loginPointsTotal = Math.round((ledger.loginPointsTotal + 1.0) * 100) / 100;
    if (action === 'contribution') ledger.contributionPointsTotal = Math.round((ledger.contributionPointsTotal + 0.2) * 100) / 100;
    if (action === 'rating') ledger.ratingPointsTotal = Math.round((ledger.ratingPointsTotal + 1.0) * 100) / 100;

    // Update history list
    const existingHistIdx = ledger.history.findIndex(h => h.date === dateStr);
    const completedItemsList: string[] = [];
    if (checklist.items.login.completed) completedItemsList.push('Login (3.05.8.b.a)');
    if (checklist.items.contribution.completed) completedItemsList.push('Contribuição (3.05.8.b.b)');
    if (checklist.items.rating.completed) completedItemsList.push('Avaliação (3.05.8.b.c)');

    if (existingHistIdx >= 0) {
      ledger.history[existingHistIdx].points = checklist.dailyPointsEarned;
      ledger.history[existingHistIdx].itemsCompleted = completedItemsList;
    } else {
      ledger.history.push({
        date: dateStr,
        points: checklist.dailyPointsEarned,
        itemsCompleted: completedItemsList,
      });
      ledger.totalDaysActive += 1;
    }

    // Check streak
    if (ledger.lastActiveDate !== dateStr) {
      ledger.streakDays = (ledger.streakDays || 0) + 1;
      ledger.lastActiveDate = dateStr;
    }

    ledger.updatedAt = nowIso;

    // Persist ledger in Firestore
    try {
      await setDoc(doc(db, 'user_monthly_points', ledgerDocId), ledger);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `user_monthly_points/${ledgerDocId}`);
    }
  }

  return {
    checklist,
    pointsAdded,
    newTotalDaily: checklist.dailyPointsEarned,
    newMonthlyTotal: ledger.totalMonthlyPoints,
  };
}

/**
 * Real-time subscription to a user's daily checklist
 */
export function subscribeToDailyChecklist(
  userId: string,
  callback: (checklist: UserDailyChecklist | null) => void,
  dateStr = getTodayDateString()
): () => void {
  const docId = `${userId}_${dateStr}`;
  const docRef = doc(db, 'user_daily_checklists', docId);

  return onSnapshot(
    docRef,
    snap => {
      if (snap.exists()) {
        callback(snap.data() as UserDailyChecklist);
      } else {
        callback(null);
      }
    },
    error => {
      console.warn(`[Firestore] Daily checklist subscription error for ${docId}:`, error);
      callback(null);
    }
  );
}

/**
 * Real-time subscription to a user's monthly points ledger
 */
export function subscribeToMonthlyPoints(
  userId: string,
  callback: (ledger: UserMonthlyPointsLedger | null) => void,
  monthStr = getCurrentMonthString()
): () => void {
  const docId = `${userId}_${monthStr}`;
  const docRef = doc(db, 'user_monthly_points', docId);

  return onSnapshot(
    docRef,
    snap => {
      if (snap.exists()) {
        callback(snap.data() as UserMonthlyPointsLedger);
      } else {
        callback(null);
      }
    },
    error => {
      console.warn(`[Firestore] Monthly points subscription error for ${docId}:`, error);
      callback(null);
    }
  );
}

/**
 * Fetches all monthly ledgers for the leaderboard in the current month
 */
export async function fetchMonthlyLeaderboard(monthStr = getCurrentMonthString()): Promise<UserMonthlyPointsLedger[]> {
  const path = 'user_monthly_points';
  try {
    const q = query(collection(db, path), where('month', '==', monthStr), orderBy('totalMonthlyPoints', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserMonthlyPointsLedger);
  } catch (err) {
    // If composite index is pending, fallback without orderBy
    try {
      const qFallback = query(collection(db, path), where('month', '==', monthStr));
      const snapFallback = await getDocs(qFallback);
      const items = snapFallback.docs.map(d => d.data() as UserMonthlyPointsLedger);
      return items.sort((a, b) => b.totalMonthlyPoints - a.totalMonthlyPoints);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  }
}

// ============================================================================
// 3.05.8.b.c - ARTICLE RATINGS & EVALUATIONS SYSTEM
// ============================================================================

/**
 * Submits an evaluation / rating for an article and awards daily checklist points
 */
export async function submitArticleRatingToFirestore(
  ratingData: Omit<ArticleRating, 'id' | 'createdAt'>
): Promise<ArticleRating> {
  const ratingId = `rate-${ratingData.articleSlug}-${ratingData.userId}-${Date.now()}`;
  const fullRating: ArticleRating = {
    ...ratingData,
    id: ratingId,
    createdAt: new Date().toISOString(),
  };

  const path = 'article_ratings';
  try {
    await setDoc(doc(db, path, ratingId), fullRating);

    // Also trigger daily checklist rating point (1 pt)
    await recordDailyChecklistAction(ratingData.userId, ratingData.username, 'rating', {
      articleSlug: ratingData.articleSlug,
      ratingStars: ratingData.rating,
    });

    await writeSystemLog({
      level: 'INFO',
      service: 'ArticleRating',
      message: `Usuário ${ratingData.username} avaliou artigo "${ratingData.articleSlug}" com nota ${ratingData.rating}/5 (+1 pt no checklist)`,
      details: { action: 'SUBMIT_EVALUATION', articleSlug: ratingData.articleSlug, rating: ratingData.rating },
    });

    return fullRating;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${ratingId}`);
    return fullRating;
  }
}

/**
 * Fetches ratings for an article
 */
export async function fetchArticleRatingsFromFirestore(articleSlug: string): Promise<ArticleRating[]> {
  const path = 'article_ratings';
  try {
    const q = query(collection(db, path), where('articleSlug', '==', articleSlug), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ArticleRating);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

/**
 * Real-time subscription to ratings for an article
 */
export function subscribeToArticleRatings(
  articleSlug: string,
  callback: (ratings: ArticleRating[]) => void
): () => void {
  const path = 'article_ratings';
  const q = query(collection(db, path), where('articleSlug', '==', articleSlug), limit(50));

  return onSnapshot(
    q,
    snap => {
      const ratings = snap.docs.map(d => d.data() as ArticleRating);
      callback(ratings);
    },
    err => {
      console.warn(`[Firestore] Ratings subscription error for ${articleSlug}:`, err);
      callback([]);
    }
  );
}



