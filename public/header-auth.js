// Updates header UI based on Firebase Auth state và hiển thị dropdown thông báo cạnh tên người dùng.
(function(){
  const LOCAL_NOTIFICATION_PREFIX = 'ph_notifications_';
  let notificationController = null;

  function toDateSafe(value){
    if(!value) return null;
    try{
      if(value.toDate) return value.toDate();
      if(typeof value === 'number') return new Date(value);
      if(typeof value === 'string'){
        const parsed = Date.parse(value);
        if(!Number.isNaN(parsed)) return new Date(parsed);
      }
      return new Date(value);
    }catch(e){
      return null;
    }
  }

  function formatDateTime(date){
    if(!date) return '';
    try{
      return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    }catch(e){
      return '' + date;
    }
  }

  function getLocalNotifications(uid){
    if(!uid) return [];
    try{
      const raw = localStorage.getItem(LOCAL_NOTIFICATION_PREFIX + uid);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){
      return [];
    }
  }

  function setLocalNotifications(uid, items){
    if(!uid) return;
    try{
      localStorage.setItem(LOCAL_NOTIFICATION_PREFIX + uid, JSON.stringify(items || []));
    }catch(e){
      // ignore quota errors
    }
  }

  function normalizeCollectionNotification(id, data){
    const payload = data || {};
    const createdAt = toDateSafe(payload.createdAt) || new Date(payload.createdAtISO || Date.now());
    return {
      id: id || payload.id || ('col-' + Date.now()),
      title: payload.title ? String(payload.title) : 'Thông báo',
      message: payload.message ? String(payload.message) : '',
      status: payload.status ? String(payload.status).toUpperCase() : '',
      type: payload.type ? String(payload.type) : (payload.status ? String(payload.status).toLowerCase() : 'general'),
      read: !!payload.read,
      url: payload.url ? String(payload.url) : '',
      createdAt: createdAt.getTime(),
      createdAtISO: createdAt.toISOString(),
      meta: payload.meta || {}
    };
  }

  function normalizeUserDocNotification(entry){
    if(!entry) return null;
    const iso = entry.createdAtISO || entry.createdAt || new Date().toISOString();
    const millis = entry.createdAtMillis || (function(){
      const parsed = Date.parse(iso);
      return Number.isNaN(parsed) ? Date.now() : parsed;
    })();
    return {
      id: entry.id || ('userdoc-' + millis),
      title: entry.title || 'Thông báo',
      message: entry.message || '',
      status: entry.status ? String(entry.status).toUpperCase() : (entry.type ? String(entry.type).toUpperCase() : ''),
      type: entry.type || 'general',
      read: !!entry.read,
      url: entry.url || '',
      createdAt: millis,
      createdAtISO: iso,
      meta: entry.meta || {}
    };
  }

  function mergeNotificationSources(collectionItems, userDocItems){
    const mergedMap = new Map();
    const pushItem = item => {
      if(!item) return;
      const key = item.id || item.createdAtISO || String(item.createdAt);
      if(!mergedMap.has(key)){
        mergedMap.set(key, Object.assign({}, item));
      }else{
        const existing = mergedMap.get(key);
        if(existing.read && !item.read) existing.read = false;
        if(!existing.message && item.message) existing.message = item.message;
        if(item.createdAt > existing.createdAt){
          existing.createdAt = item.createdAt;
          existing.createdAtISO = item.createdAtISO || existing.createdAtISO;
        }
      }
    };
    (userDocItems || []).forEach(pushItem);
    (collectionItems || []).forEach(pushItem);
    return Array.from(mergedMap.values())
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 25);
  }

  function isIndexError(error){
    if(!error) return false;
    return error.code === 'failed-precondition'
      || error.code === 'invalid-argument'
      || (error.message && error.message.toLowerCase().indexOf('index') !== -1);
  }

  function createNotificationUI(){
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-notifications';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-notifications__toggle';
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-expanded', 'false');

    const icon = document.createElement('span');
    icon.className = 'nav-notifications__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔔';

    const label = document.createElement('span');
    label.className = 'nav-notifications__label';
    label.textContent = 'Thông báo';

    toggle.appendChild(icon);
    toggle.appendChild(label);

    const panel = document.createElement('div');
    panel.className = 'nav-notifications__panel';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'nav-notifications__panel-head';
    panelHeader.textContent = 'Thông báo gần đây';

    const list = document.createElement('div');
    list.className = 'nav-notifications__list';

    const empty = document.createElement('p');
    empty.className = 'nav-notifications__empty';
    empty.textContent = 'Đang tải thông báo...';

    panel.appendChild(panelHeader);
    panel.appendChild(list);
    panel.appendChild(empty);

    wrapper.appendChild(toggle);
    wrapper.appendChild(panel);

    function closePanel(){
      wrapper.classList.remove('nav-notifications--open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function openPanel(){
      wrapper.classList.add('nav-notifications--open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function handleToggle(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if(wrapper.classList.contains('nav-notifications--open')){
        closePanel();
      }else{
        openPanel();
      }
    }

    function handleOutside(ev){
      if(!wrapper.contains(ev.target)){
        closePanel();
      }
    }

    toggle.addEventListener('click', handleToggle);
    document.addEventListener('click', handleOutside);

    function render(items){
      const listItems = Array.isArray(items) ? items.slice(0, 15) : [];
      list.innerHTML = '';

      if(!listItems.length){
        empty.textContent = 'Chưa có thông báo mới.';
        empty.style.display = 'block';
        list.style.display = 'none';
        return;
      }

      empty.style.display = 'none';
      list.style.display = 'flex';

      listItems.forEach(item => {
        const node = document.createElement('article');
        node.className = 'nav-notifications__item' + (item.read ? '' : ' nav-notifications__item--unread');

        const titleEl = document.createElement('h4');
        titleEl.className = 'nav-notifications__title';
        titleEl.textContent = item.title || 'Thông báo';

        const messageEl = document.createElement('p');
        messageEl.className = 'nav-notifications__message';
        messageEl.textContent = item.message || '';

        const meta = document.createElement('div');
        meta.className = 'nav-notifications__meta';

        const time = document.createElement('time');
        time.className = 'nav-notifications__time';
        time.dateTime = item.createdAtISO || '';
        time.textContent = formatDateTime(toDateSafe(item.createdAt || item.createdAtISO));
        meta.appendChild(time);

        if(item.status){
          const statusEl = document.createElement('span');
          statusEl.className = 'nav-notifications__status';
          statusEl.textContent = item.status;
          meta.appendChild(statusEl);
        }

        node.appendChild(titleEl);
        if(item.message) node.appendChild(messageEl);
        node.appendChild(meta);

        if(item.url){
          node.addEventListener('click', function(){ window.location.href = item.url; });
          node.classList.add('nav-notifications__item--link');
        }

        list.appendChild(node);
      });
    }

    function setLoading(isLoading){
      if(isLoading){
        empty.textContent = 'Đang tải thông báo...';
        empty.style.display = 'block';
        list.style.display = 'none';
      }
    }

    return {
      wrapper,
      render,
      setLoading,
      destroy(){
        document.removeEventListener('click', handleOutside);
        toggle.removeEventListener('click', handleToggle);
        if(wrapper.parentNode){ wrapper.parentNode.removeChild(wrapper); }
      }
    };
  }

  function teardownNotifications(){
    if(!notificationController) return;
    if(notificationController.unsubCollection){
      try{ notificationController.unsubCollection(); }catch(e){ /* ignore */ }
      notificationController.unsubCollection = null;
    }
    if(notificationController.unsubFallback){
      try{ notificationController.unsubFallback(); }catch(e){ /* ignore */ }
      notificationController.unsubFallback = null;
    }
    if(notificationController.unsubUserDoc){
      try{ notificationController.unsubUserDoc(); }catch(e){ /* ignore */ }
      notificationController.unsubUserDoc = null;
    }
    if(notificationController.ui && notificationController.ui.destroy){
      notificationController.ui.destroy();
    }
    notificationController = null;
  }

  function renderMergedForUid(uid){
    if(!notificationController || !notificationController.ui) return;
    const state = notificationController.state || { collection: [], userDoc: [] };
    const merged = mergeNotificationSources(state.collection, state.userDoc);
    notificationController.ui.render(merged);
    setLocalNotifications(uid, merged);
  }

  function subscribeNotifications(user){
    if(!user || !notificationController || !notificationController.ui) return;
    const uid = user.uid;
    notificationController.state = { collection: [], userDoc: [] };
    notificationController.ui.setLoading(true);

    const hasFirestore = typeof firebase !== 'undefined' && firebase.firestore;
    if(!hasFirestore){
      notificationController.state.collection = getLocalNotifications(uid);
      renderMergedForUid(uid);
      return;
    }

    const db = firebase.firestore();

    function attachOrderedListener(){
      const query = db.collection('notifications')
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(25);

      const unsubscribe = query.onSnapshot(function(snapshot){
        const items = [];
        snapshot.forEach(doc => items.push(normalizeCollectionNotification(doc.id, doc.data() || {})));
        notificationController.state.collection = items;
        renderMergedForUid(uid);
      }, function(error){
        console.warn('Notifications listener error', error);
        if(isIndexError(error)){
          attachFallbackListener();
        }else{
          notificationController.state.collection = getLocalNotifications(uid);
          renderMergedForUid(uid);
        }
      });

      notificationController.unsubCollection = function(){
        try{ unsubscribe(); }catch(e){ /* ignore */ }
      };
    }

    function attachFallbackListener(){
      if(notificationController.unsubCollection){
        notificationController.unsubCollection();
        notificationController.unsubCollection = null;
      }
      if(notificationController.unsubFallback){
        try{ notificationController.unsubFallback(); }catch(e){ /* ignore */ }
      }

      const query = db.collection('notifications').where('userId', '==', uid);
      const unsubscribe = query.onSnapshot(function(snapshot){
        const items = [];
        snapshot.forEach(doc => items.push(normalizeCollectionNotification(doc.id, doc.data() || {})));
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        notificationController.state.collection = items.slice(0, 25);
        renderMergedForUid(uid);
      }, function(error){
        console.warn('Fallback notifications listener error', error);
        notificationController.state.collection = getLocalNotifications(uid);
        renderMergedForUid(uid);
      });

      notificationController.unsubFallback = function(){
        try{ unsubscribe(); }catch(e){ /* ignore */ }
      };
    }

    function attachUserDocListener(){
      if(notificationController.unsubUserDoc){
        notificationController.unsubUserDoc();
        notificationController.unsubUserDoc = null;
      }
      const docRef = db.collection('users').doc(uid);
      const unsubscribe = docRef.onSnapshot(function(snapshot){
        if(!snapshot.exists){
          notificationController.state.userDoc = [];
        }else{
          const data = snapshot.data() || {};
          const feed = Array.isArray(data.notificationsFeed) ? data.notificationsFeed : [];
          notificationController.state.userDoc = feed.map(normalizeUserDocNotification).filter(Boolean);
        }
        renderMergedForUid(uid);
      }, function(error){
        console.warn('User doc notifications listener error', error);
      });

      notificationController.unsubUserDoc = function(){
        try{ unsubscribe(); }catch(e){ /* ignore */ }
      };
    }

    attachOrderedListener();
    attachUserDocListener();
  }

  function ensure(){
    if(!window._firebaseConfig) return false;
    try{
      if(typeof firebase === 'undefined') return false;
      if(!firebase.apps || !firebase.apps.length){
        if(window._firebaseConfig && firebase.initializeApp){
          try{ firebase.initializeApp(window._firebaseConfig); }catch(e){ /* ignore duplicate */ }
        }else{
          return false;
        }
      }
      return true;
    }catch(e){
      console.error('Firebase init error', e);
      return false;
    }
  }

  function updateHeader(user){
    const navRight = document.querySelector('.nav-right');
    if(!navRight) return;
    navRight.innerHTML = '';
    teardownNotifications();

    if(user){
      const aProfile = document.createElement('a');
      aProfile.href = 'profile.html';
      aProfile.className = 'nav-user';
      aProfile.style.marginRight = '8px';
      aProfile.textContent = user.email || 'User';
      navRight.appendChild(aProfile);

      try{
        if(window._lastDisplayName){
          aProfile.textContent = window._lastDisplayName;
        }else if(user.displayName){
          aProfile.textContent = user.displayName;
        }else if(typeof firebase !== 'undefined' && firebase.firestore){
          firebase.firestore().collection('users').doc(user.uid).get().then(function(doc){
            if(doc.exists){
              const data = doc.data();
              if(data && data.displayName){
                aProfile.textContent = data.displayName;
                window._lastDisplayName = data.displayName;
              }
            }
          }).catch(function(){ /* ignore */ });
        }
      }catch(e){ /* ignore */ }

      const notificationUI = createNotificationUI();
      // Remove any existing badge elements that might be injected elsewhere
      try{
        const possibleBadges = notificationUI.wrapper.querySelectorAll('[class*="badge"], [class*="Badge"], .nav-notifications__badge');
        possibleBadges.forEach(el => { if(el && el.parentNode) el.parentNode.removeChild(el); });
      }catch(e){ /* ignore */ }
      navRight.appendChild(notificationUI.wrapper);
        // Also scrub any leftover badge nodes directly under navRight
        try{
          function scrubBadgeNodes(container){
            if(!container) return;
            // remove elements with 'badge' in class or attribute
            const byClass = container.querySelectorAll('[class*="badge"], [class*="Badge"], [data-notification-count]');
            byClass.forEach(el => { if(el && el.parentNode) el.parentNode.removeChild(el); });

            // remove small circular elements that contain only digits and have red-like background
            const all = container.querySelectorAll('*');
            all.forEach(el => {
              try{
                const txt = (el.textContent || '').trim();
                if(/^\d{1,3}$/.test(txt)){
                  const cs = window.getComputedStyle(el);
                  const bg = (cs && cs.backgroundColor) ? cs.backgroundColor : '';
                  const br = (cs && cs.borderRadius) ? cs.borderRadius : '';
                  // detect red-ish background and round shape
                  if(bg.indexOf('rgb(239') !== -1 || bg.indexOf('rgb(255') !== -1 || bg.indexOf('#ef4444') !== -1 || (br && parseFloat(br) >= 8)){
                    if(el.parentNode) el.parentNode.removeChild(el);
                  }
                }
              }catch(e){ /* ignore individual errors */ }
            });
          }

          scrubBadgeNodes(notificationUI.wrapper);
          scrubBadgeNodes(navRight);
          // run once more slightly later in case styles/DOM mutate after append
          setTimeout(function(){ try{ scrubBadgeNodes(navRight); }catch(e){} }, 120);
        }catch(e){ /* ignore */ }
      notificationController = {
        ui: notificationUI,
        state: { collection: [], userDoc: [] },
        unsubCollection: null,
        unsubFallback: null,
        unsubUserDoc: null
      };
      subscribeNotifications(user);

      const aLogout = document.createElement('a');
      aLogout.href = '#';
      aLogout.className = 'btn-signup';
      aLogout.textContent = 'Logout';
      aLogout.addEventListener('click', async function(evt){
        evt.preventDefault();
        try{
          await authApi.logout();
          window.location.href = 'index.html';
        }catch(e){
          console.error('Logout failed', e);
          alert('Đăng xuất không thành công, vui lòng thử lại.');
        }
      });
      navRight.appendChild(aLogout);
    }else{
      const aLogin = document.createElement('a');
      aLogin.href = 'login.html';
      aLogin.textContent = 'Login';
      aLogin.style.marginRight = '8px';

      const aSign = document.createElement('a');
      aSign.href = 'signup.html';
      aSign.className = 'btn-signup';
      aSign.textContent = 'Sign Up';

      navRight.appendChild(aLogin);
      navRight.appendChild(aSign);
    }
  }

  window.refreshHeader = function(){
    try{
      if(!ensure()) return;
      const user = firebase && firebase.auth ? firebase.auth().currentUser : null;
      updateHeader(user);
    }catch(e){
      console.warn('refreshHeader failed', e);
    }
  };

  document.addEventListener('profile-updated', function(ev){
    try{
      const name = ev && ev.detail && ev.detail.displayName;
      if(name){
        window._lastDisplayName = name;
        const navUser = document.querySelector('.nav-user');
        if(navUser) navUser.textContent = name;
      }
    }catch(e){ /* ignore */ }
    window.refreshHeader();
  });

  document.addEventListener('DOMContentLoaded', function(){
    if(!ensure()) return;
    firebase.auth().onAuthStateChanged(function(user){
      updateHeader(user);
    });
  });
})();