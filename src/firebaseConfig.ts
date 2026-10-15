import rawConfig from '../firebase-applet-config.json';

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

/**
 * ============================================================================
 * UNIFIED FIREBASE DATABASE CONNECTION CONFIGURATION
 * ============================================================================
 * Este é o arquivo unificado e canônico que determina a conexão com o Firebase
 * e define expressamente a qual banco de dados Firestore a aplicação se conecta.
 *
 * Todas as partes da aplicação (instâncias de banco Firestore, serviços de
 * sincronização, relatórios PDF oficiais, painéis de burocrata e telemetria)
 * importam e utilizam esta configuração como FONTE ÚNICA DA VERDADE.
 * ============================================================================
 */

export const firebaseConfig: FirebaseAppletConfig = {
  ...rawConfig,
  projectId:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) ||
    rawConfig.projectId,
  firestoreDatabaseId:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIRESTORE_DATABASE_ID) ||
    rawConfig.firestoreDatabaseId,
};

/**
 * Constante unificada do ID do Banco de Dados Firestore.
 * Ponto central de conexão do NotMediaWiki com o Google Cloud Firestore.
 */
export const FIRESTORE_DATABASE_ID: string = firebaseConfig.firestoreDatabaseId;

/**
 * Constante unificada do ID do Projeto Firebase.
 */
export const FIREBASE_PROJECT_ID: string = firebaseConfig.projectId;

/**
 * Retorna as credenciais de conexão validadas.
 */
export function getFirebaseConnectionInfo() {
  return {
    projectId: FIREBASE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    isConfigured: Boolean(FIRESTORE_DATABASE_ID && FIREBASE_PROJECT_ID),
  };
}

export default firebaseConfig;
