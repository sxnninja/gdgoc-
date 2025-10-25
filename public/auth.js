// Simple Firebase Auth helper using modular SDK (via CDN).
// This script expects the Firebase SDKs to be loaded in the page via <script> tags
// và window._firebaseConfig được thiết lập trong firebase.js.
(function(){
  function ensureFirebase(){
    if(window._fbInitialized) return true;
    if(!window._firebaseConfig){
      console.warn('firebase config not found on window._firebaseConfig');
      return false;
    }
    try{
      if(firebase.apps && firebase.apps.length){
        window._fbApp = firebase.app();
      } else if(firebase.initializeApp){
        window._fbApp = firebase.initializeApp(window._firebaseConfig);
      }
      window._fbInitialized = true;
      return true;
    }catch(err){
      if(err && err.code === 'app/duplicate-app'){
        try{ window._fbApp = firebase.app(); window._fbInitialized = true; return true; }
        catch(e){ console.warn('Failed to reuse existing firebase app', e); return false; }
      }
      console.error('Firebase initialization error', err);
      return false;
    }
  }

  async function signup(email,password,role){
    if(!ensureFirebase()){
      throw new Error('Firebase chưa được cấu hình hoặc khởi tạo. Vui lòng kiểm tra firebase.js');
    }
    try{
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      localStorage.setItem('role', role || 'candidate');
      try{
        if(firebase.firestore){
          const db = firebase.firestore();
          await db.collection('users').doc(user.uid).set({
            email: user.email,
            role: role || 'candidate',
            createdAt: new Date()
          }, { merge: true });
        }
      }catch(e){ console.warn('Firestore not available or write failed', e); }
      return {user};
    }catch(err){ throw err; }
  }

  async function login(email,password){
    if(!ensureFirebase()){
      throw new Error('Firebase chưa được cấu hình hoặc khởi tạo. Vui lòng kiểm tra firebase.js');
    }
    try{
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      try{
        if(firebase.firestore){
          const db = firebase.firestore();
          const doc = await db.collection('users').doc(user.uid).get();
          if(doc.exists){
            const data = doc.data();
            if(data && data.role) localStorage.setItem('role', data.role);
          }
        }
      }catch(e){ /* ignore */ }
      return {user};
    }catch(err){ throw err; }
  }

  async function logout(){
    try{
      if(window._firebaseConfig && firebase && firebase.auth){
        await firebase.auth().signOut();
      }
    }catch(e){ console.warn('Firebase signOut failed or not available', e); }
    localStorage.removeItem('role');
    return true;
  }

  async function loginWithGoogle(){
    ensureFirebase();
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      try{
        if(firebase.firestore){
          const db = firebase.firestore();
          const doc = await db.collection('users').doc(user.uid).get();
          if(doc.exists){
            const data = doc.data();
            if(data && data.role) localStorage.setItem('role', data.role);
          } else {
            await db.collection('users').doc(user.uid).set({
              email: user.email,
              role: 'candidate',
              createdAt: new Date(),
              displayName: user.displayName || ''
            });
            localStorage.setItem('role', 'candidate');
          }
        }
      }catch(e){ /* ignore */ }
      return {user};
    }catch(err){ throw err; }
  }

  async function loginWithFacebook(){
    ensureFirebase();
    try{
      const provider = new firebase.auth.FacebookAuthProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      try{
        if(firebase.firestore){
          const db = firebase.firestore();
          const doc = await db.collection('users').doc(user.uid).get();
          if(doc.exists){
            const data = doc.data();
            if(data && data.role) localStorage.setItem('role', data.role);
          } else {
            await db.collection('users').doc(user.uid).set({
              email: user.email,
              role: 'candidate',
              createdAt: new Date(),
              displayName: user.displayName || ''
            });
            localStorage.setItem('role', 'candidate');
          }
        }
      }catch(e){ /* ignore */ }
      return {user};
    }catch(err){ throw err; }
  }

  window.authApi = { signup, login, logout, loginWithGoogle, loginWithFacebook };
})();