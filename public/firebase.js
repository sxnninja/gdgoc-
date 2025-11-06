// Firebase initialization (modular SDK)
// Đảm bảo cấu hình được gắn lên window để các script khác sử dụng.
const firebaseConfig = {
  apiKey: "AIzaSyBtujO6aH4yteli9h-vdE68JafbNvbhUX4",
  authDomain: "gdgoc-projecthub.firebaseapp.com",
  projectId: "gdgoc-projecthub",
  storageBucket: "gdgoc-projecthub.firebasestorage.app",
  messagingSenderId: "147068825087",
  appId: "1:147068825087:web:b633d1a452aecd80618bca",
  measurementId: "G-15MPG6ZNZ7"
};

window._firebaseConfig = firebaseConfig;

try{
  if(typeof firebase !== 'undefined'){
    if(!firebase.apps || !firebase.apps.length){
      firebase.initializeApp(window._firebaseConfig);
      console.log('firebase.js: initialized firebase app');
    } else {
      console.log('firebase.js: firebase app already initialized');
    }
    try{
      if(firebase.firestore){
        window._db = firebase.firestore();
        console.log('firebase.js: firestore ready');
      }
    }catch(e){ console.warn('firebase.js: firestore init failed', e); }
  } else {
    console.warn('firebase.js: firebase SDK not loaded yet');
  }
}catch(e){
  console.error('firebase.js init error', e);
}
