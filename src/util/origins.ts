const project = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

/** Our own origins: codes may have been made on either Firebase Hosting domain. */
export const APP_ORIGINS = [window.location.origin, ...(project ? [`https://${project}.web.app`, `https://${project}.firebaseapp.com`] : [])];
