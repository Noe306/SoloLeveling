/* ==========================================================================
   auth.js: optional accounts (Supabase) + cloud saves.

   - Guest play always works (save stays in this browser).
   - Create account: email + username + password. Log in: username + password
     (through the "login-with-username" Edge Function, so emails stay private).
   - When logged in, every local save is also pushed to the cloud (debounced),
     so the same progress follows you on every device.
   - Sync on login / page load (3-way, so you are only asked when needed):
       cloud unchanged + this device changed  -> upload this device
       cloud changed   + this device unchanged -> load the cloud save
       both changed (or another account/guest progress) -> ask which to keep
   - Login only works on http(s) (the website), not when index.html is opened
     from disk; the app then simply stays in guest mode.
   Supabase setup (tables, security rules, function) lives in /supabase.
   ========================================================================== */

var USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
var PASSWORD_MIN = 8;
var SYNC_KEY = 'dragonQuestSync_v1';     // { userId, lastSyncedAt, dirty, localChangedAt }
var PUSH_DELAY_MS = 2500;

var AUTH = {
  client: null,          // Supabase client (null when unavailable)
  user: null,            // logged-in Supabase user
  username: '',
  status: 'guest',       // guest | synced | saving | error | offline
  pushTimer: null,
  applying: false,       // true while a cloud save is being loaded (don't push it back)
  localVersion: 0        // bumps on every local save; detects changes made during a push
};

/* ---------- Small helpers ---------- */
function authAvailable() {
  return /^https?:$/.test(location.protocol) && !!window.supabase && typeof SUPABASE_URL === 'string';
}
function readSync() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; } }
function writeSync(s) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ } }
function setSyncStatus(s) { AUTH.status = s; renderAccount(); }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleString() : 'unknown'; }

// A brand-new, untouched save (nothing worth protecting).
function isPristine(state) {
  var s = state || gameState;
  return s.player.level === 1 && s.player.currentXP === 0 && s.stats.totalTasksCompleted === 0 &&
         s.daily.classes.length === 0 && s.tasks.every(function (t) { return t.daily && !t.completed; });
}
function saveSummary(data) {
  var p = data.player || {}, st = data.stats || {};
  return 'Lv ' + (p.level || 1) + ' · ' + (p.gold || 0) + ' G · ' + (st.totalTasksCompleted || 0) + ' quests done';
}

/* ---------- Called by saveState() (state.js) after every local save ---------- */
function onLocalSaved() {
  if (AUTH.applying) return;
  AUTH.localVersion++;
  var s = readSync();
  s.dirty = true; s.localChangedAt = new Date().toISOString();   // guest progress counts too
  writeSync(s);
  if (AUTH.user) schedulePush();
}

/* ---------- Cloud save: push ---------- */
function schedulePush() {
  clearTimeout(AUTH.pushTimer);
  AUTH.pushTimer = setTimeout(pushSave, PUSH_DELAY_MS);
  if (AUTH.status !== 'saving') setSyncStatus('saving');
}
function pushSave() {
  clearTimeout(AUTH.pushTimer);
  if (!AUTH.user || !AUTH.client) return Promise.resolve();
  var uid = AUTH.user.id, version = AUTH.localVersion;
  setSyncStatus('saving');
  return AUTH.client.from('saves')
    .upsert({ user_id: uid, data: gameState, updated_at: new Date().toISOString() })
    .select('updated_at').single()
    .then(function (r) {
      if (r.error) throw r.error;
      var s = readSync();
      writeSync({ userId: uid, lastSyncedAt: r.data.updated_at, dirty: AUTH.localVersion !== version, localChangedAt: s.localChangedAt });
      setSyncStatus(AUTH.localVersion !== version ? 'saving' : 'synced');
      if (AUTH.localVersion !== version) schedulePush();             // changes happened during the push
    })
    .catch(function (e) { console.warn('Cloud save failed', e); setSyncStatus(navigator.onLine ? 'error' : 'offline'); });
}
// Upload now if anything is waiting (pending timer, save in progress, or a change not yet uploaded).
function flushPush() {
  return AUTH.pushTimer || AUTH.status === 'saving' || AUTH.status === 'error' || AUTH.status === 'offline' || readSync().dirty
    ? pushSave() : Promise.resolve();
}

/* ---------- Cloud save: load ---------- */
function applyCloud(cloud) {
  AUTH.applying = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud.data));
    gameState = loadState();                                          // validates + merges with defaults
    if (typeof lastDragonKey !== 'undefined') lastDragonKey = '';
    var rolled = checkDailyRollover();                                // a new day may have started since
    saveState(); renderAll();
    writeSync({ userId: AUTH.user.id, lastSyncedAt: cloud.updated_at, dirty: false, localChangedAt: null });
    AUTH.applying = false;
    if (rolled) onLocalSaved(); else setSyncStatus('synced');
  } finally { AUTH.applying = false; }
  systemNotify({ title: 'Progress Loaded', lines: ['Your account save was loaded: ' + esc(saveSummary(cloud.data)) + '.'] });
}

function askWhichSave(cloud) {
  var s = readSync();
  showModal({
    title: 'Choose your save',
    className: 'system',
    html: '<div class="sys-tag">[ SYSTEM ]</div><p>This device and your account have <b>different progress</b>. Which one do you keep?</p>' +
      '<div class="save-choice"><div><b>Account (cloud)</b><span>' + esc(saveSummary(cloud.data)) + '</span><small>Saved ' + esc(fmtDate(cloud.updated_at)) + '</small></div>' +
      '<div><b>This device</b><span>' + esc(saveSummary(gameState)) + '</span><small>Changed ' + esc(fmtDate(s.localChangedAt)) + '</small></div></div>' +
      '<p class="muted">The other one will be replaced.</p>',
    buttons: [
      { label: 'Keep this device', onClick: function () { pushSave(); } },
      { label: 'Keep account save', primary: true, onClick: function () { applyCloud(cloud); } }
    ]
  });
}

function syncOnLogin() {
  if (!AUTH.user) return;
  var uid = AUTH.user.id;
  setSyncStatus('saving');
  AUTH.client.from('saves').select('data, updated_at').eq('user_id', uid).maybeSingle().then(function (r) {
    if (r.error) throw r.error;
    var cloud = r.data, s = readSync();
    if (!cloud) return pushSave();                                    // account has no save yet: upload this one
    var sameAccount = s.userId === uid;
    var cloudChanged = !sameAccount || cloud.updated_at !== s.lastSyncedAt;
    var localChanged = sameAccount ? !!s.dirty : !isPristine();
    if (JSON.stringify(cloud.data) === JSON.stringify(gameState)) {   // identical: just record it
      writeSync({ userId: uid, lastSyncedAt: cloud.updated_at, dirty: false, localChangedAt: s.localChangedAt });
      return setSyncStatus('synced');
    }
    if (!cloudChanged && !localChanged) return setSyncStatus('synced');
    if (!cloudChanged) return pushSave();
    if (!localChanged) return applyCloud(cloud);
    setSyncStatus('synced');
    askWhichSave(cloud);
  }).catch(function (e) { console.warn('Sync failed', e); setSyncStatus(navigator.onLine ? 'error' : 'offline'); });
}

/* ---------- Account actions ---------- */
function friendlyError(e) {
  var m = (e && (e.message || e.error_description || e.error)) || String(e);
  if (/already registered|already been registered/i.test(m)) return 'An account with this email already exists.';
  if (/Database error saving new user/i.test(m)) return 'This username is already taken.';
  if (/valid email|invalid email|Unable to validate email/i.test(m)) return 'Please enter a valid email address.';
  if (/Password should be/i.test(m)) return 'Password too weak: use at least ' + PASSWORD_MIN + ' characters.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection to the server. Check your internet and try again.';
  return m;
}

function signUp(email, username, password) {
  return AUTH.client.rpc('username_available', { name: username }).then(function (r) {
    if (r.error) throw r.error;
    if (!r.data) throw new Error('This username is already taken.');
    return AUTH.client.auth.signUp({ email: email, password: password, options: { data: { username: username } } });
  }).then(function (r) {
    if (r.error) throw r.error;
    if (!r.data.session) return 'confirm';                            // email confirmation is switched on in Supabase
    return 'ok';
  });
}

function logIn(username, password) {
  return fetch(SUPABASE_URL + '/functions/v1/' + LOGIN_FUNCTION_SLUG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ username: username, password: password })
  }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (body) {
      if (res.status === 404) throw new Error('Login service not found (the "login-with-username" function is not deployed).');
      if (!res.ok || !body.access_token) throw new Error(body.error || 'Wrong username or password.');
      return AUTH.client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
    });
  }).then(function (r) { if (r.error) throw r.error; });
}

// Log Out = upload the latest progress, sign out, then CLEAR THIS DEVICE back to a
// fresh guest save (nothing of the account stays visible). The progress is safe in
// the account and comes back on the next log in.
// If the upload fails (e.g. offline), ask first so unsaved progress is never lost silently.
function logOut(force) {
  return flushPush().then(function () {
    if (!force && AUTH.status !== 'synced') {
      confirmDialog('Log out?', 'Your latest progress could not be saved to your account (you may be offline). ' +
        'Logging out clears this device, so that unsaved progress would be lost.', 'Log out anyway', function () { logOut(true); });
      return;
    }
    return AUTH.client.auth.signOut().then(function () {
      clearDevice();
      systemNotify({ title: 'Logged Out', lines: ['Your progress is safe in your account.', 'This device was cleared. Log in again to continue.'] });
    });
  });
}

// Reset this device to a brand-new guest save (used after Log Out).
function clearDevice() {
  AUTH.applying = true;                                               // not a player change: don't mark it for upload
  try {
    gameState = defaultState();
    if (typeof lastDragonKey !== 'undefined') lastDragonKey = '';
    checkDailyRollover();
    saveState();
    try { localStorage.removeItem(SYNC_KEY); } catch (e) { /* storage blocked */ }
  } finally { AUTH.applying = false; }
  $('modalRoot').innerHTML = '';
  renderAll();
}

/* ---------- UI: header account button ---------- */
function renderAccount() {
  var btn = $('accountBtn');
  if (!btn) return;
  var label, title;
  if (!authAvailable()) { label = 'GUEST'; title = 'Accounts work on the website version of the app'; }
  else if (!AUTH.user) { label = 'LOG IN'; title = 'Log in or create an account to save your progress in the cloud'; }
  else {
    var icon = { synced: '☁', saving: '⟳', error: '⚠', offline: '⚠' }[AUTH.status] || '☁';
    label = icon + ' ' + (AUTH.username || 'Account');
    title = { synced: 'Progress saved to your account', saving: 'Saving to your account…', error: 'Cloud save failed, will retry on next change', offline: 'Offline: changes will upload when you reconnect' }[AUTH.status] || '';
  }
  btn.textContent = label; btn.title = title;
  btn.classList.toggle('logged', !!AUTH.user);
  btn.classList.toggle('warn', AUTH.status === 'error' || AUTH.status === 'offline');
}

function openAccountMenu() {
  if (!authAvailable()) {
    showModal({ title: 'Guest mode', html: '<p>Accounts and cloud saves work on the website version of the app:</p><p><b>noe306.github.io/SoloLeveling</b></p><p class="muted">Opened from a file on this computer, progress is saved in this browser only.</p>' });
    return;
  }
  if (!AUTH.user) { openAuthForm('login'); return; }
  showModal({
    title: 'Hunter account',
    html: '<div class="sys-tag">[ SYSTEM ]</div><p>Logged in as <b>' + esc(AUTH.username) + '</b></p>' +
      '<p class="muted">' + esc(AUTH.user.email || '') + '</p><p>' + esc($('accountBtn').title) + '</p>',
    buttons: [
      { label: 'Close' },
      { label: 'Sync now', onClick: function () { pushSave(); } },
      { label: 'Log out', danger: true, onClick: logOut }
    ]
  });
}

/* ---------- UI: log in / create account window ---------- */
function openAuthForm(mode) {
  var root = $('modalRoot'), overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal system auth-modal" role="dialog" aria-modal="true">' +
    '<div class="sys-tag">[ SYSTEM ]</div><h2>Hunter Identification</h2>' +
    '<div class="auth-tabs"><button type="button" class="chip" data-mode="login">Log in</button><button type="button" class="chip" data-mode="signup">Create account</button></div>' +
    '<form class="auth-form" autocomplete="on" novalidate>' +
      '<label class="f-email">Email<input name="email" type="email" autocomplete="email" maxlength="200"></label>' +
      '<label class="f-username">Username<input name="username" type="text" autocomplete="username" maxlength="20" spellcheck="false"></label>' +
      '<label class="f-password">Password<input name="password" type="password" autocomplete="current-password" maxlength="200"></label>' +
      '<label class="f-confirm">Confirm password<input name="confirm" type="password" autocomplete="new-password" maxlength="200"></label>' +
      '<p class="auth-hint muted"></p><p class="auth-msg" role="alert"></p>' +
      '<div class="modal-actions"><button type="button" class="btn auth-cancel">Cancel</button><button type="submit" class="btn primary auth-submit"></button></div>' +
      '<button type="button" class="auth-link auth-forgot">Forgot password?</button>' +
    '</form></div>';
  root.appendChild(overlay);
  var form = overlay.querySelector('form'), msg = overlay.querySelector('.auth-msg'), hint = overlay.querySelector('.auth-hint');
  var submit = overlay.querySelector('.auth-submit');

  function setMode(m) {
    mode = m;
    overlay.querySelectorAll('.auth-tabs .chip').forEach(function (c) { c.classList.toggle('active', c.dataset.mode === m); });
    overlay.querySelector('.auth-tabs').style.display = m === 'forgot' ? 'none' : '';
    overlay.querySelector('.f-email').style.display = m === 'login' ? 'none' : '';
    overlay.querySelector('.f-username').style.display = m === 'forgot' ? 'none' : '';
    overlay.querySelector('.f-password').style.display = m === 'forgot' ? 'none' : '';
    overlay.querySelector('.f-confirm').style.display = m === 'signup' ? '' : 'none';
    overlay.querySelector('.auth-forgot').style.display = m === 'login' ? '' : 'none';
    form.password.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    submit.textContent = { login: 'Log in', signup: 'Create account', forgot: 'Send reset link' }[m];
    hint.textContent = { login: 'Log in with your username and password.',
      signup: 'Username: 3-20 letters, digits or _ (cannot be changed later). Password: at least ' + PASSWORD_MIN + ' characters.',
      forgot: 'Enter the email of your account. We will send you a link to choose a new password.' }[m];
    msg.textContent = ''; msg.className = 'auth-msg';
    var first = m === 'login' ? form.username : form.email; setTimeout(function () { first.focus(); }, 0);
  }
  function close() { overlay.remove(); }
  function fail(text) { msg.textContent = text; msg.className = 'auth-msg bad'; submit.disabled = false; }

  overlay.querySelectorAll('.auth-tabs .chip').forEach(function (c) { c.addEventListener('click', function () { setMode(c.dataset.mode); }); });
  overlay.querySelector('.auth-cancel').addEventListener('click', function () { mode === 'forgot' ? setMode('login') : close(); });
  overlay.querySelector('.auth-forgot').addEventListener('click', function () { setMode('forgot'); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim(), username = form.username.value.trim(), pw = form.password.value;
    if (mode !== 'forgot' && !USERNAME_RE.test(username)) return fail('Username: 3-20 characters, only letters, digits and _.');
    if (mode !== 'login' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.');
    if (mode === 'signup' && pw.length < PASSWORD_MIN) return fail('Password: at least ' + PASSWORD_MIN + ' characters.');
    if (mode === 'signup' && pw !== form.confirm.value) return fail('The two passwords are different.');
    if (mode === 'login' && !pw) return fail('Please enter your password.');
    submit.disabled = true; msg.textContent = 'Connecting…'; msg.className = 'auth-msg';

    var job = mode === 'login' ? logIn(username, pw).then(function () { return 'ok'; })
            : mode === 'signup' ? signUp(email, username, pw)
            : AUTH.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
                .then(function (r) { if (r.error) throw r.error; return 'reset'; });
    job.then(function (result) {
      if (result === 'reset') { msg.textContent = 'If an account uses this email, a reset link is on its way.'; msg.className = 'auth-msg good'; submit.disabled = false; return; }
      if (result === 'confirm') { msg.textContent = 'Account created. Check your email to confirm it, then log in.'; msg.className = 'auth-msg good'; setMode('login'); return; }
      close();
      if (mode === 'signup' && gameState.player.name === 'Hero') { gameState.player.name = username; commit(); }
      playSound('system');
      systemNotify({ title: mode === 'signup' ? 'Account Created' : 'Welcome Back', lines: ['Hunter <b>' + esc(username) + '</b> identified. Cloud save is on.'] });
    }).catch(function (err) { fail(friendlyError(err)); });
  });
  setMode(mode || 'login');
}

// After clicking the link in a "reset password" email.
function openNewPasswordForm() {
  var root = $('modalRoot'), overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal system auth-modal" role="dialog" aria-modal="true"><div class="sys-tag">[ SYSTEM ]</div><h2>New password</h2>' +
    '<form class="auth-form"><label>New password<input name="pw" type="password" autocomplete="new-password" maxlength="200"></label>' +
    '<label>Confirm password<input name="confirm" type="password" autocomplete="new-password" maxlength="200"></label>' +
    '<p class="auth-msg" role="alert"></p><div class="modal-actions"><button type="submit" class="btn primary">Save password</button></div></form></div>';
  root.appendChild(overlay);
  var form = overlay.querySelector('form'), msg = overlay.querySelector('.auth-msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.pw.value.length < PASSWORD_MIN) { msg.textContent = 'At least ' + PASSWORD_MIN + ' characters.'; msg.className = 'auth-msg bad'; return; }
    if (form.pw.value !== form.confirm.value) { msg.textContent = 'The two passwords are different.'; msg.className = 'auth-msg bad'; return; }
    AUTH.client.auth.updateUser({ password: form.pw.value }).then(function (r) {
      if (r.error) throw r.error;
      overlay.remove();
      systemNotify({ title: 'Password Changed', lines: ['Your new password is saved.'] });
    }).catch(function (err) { msg.textContent = friendlyError(err); msg.className = 'auth-msg bad'; });
  });
}

/* ---------- Start ---------- */
function initAuth() {
  $('accountBtn').addEventListener('click', openAccountMenu);
  renderAccount();
  if (!authAvailable()) return;                                       // guest only (opened from disk)
  AUTH.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'dragonQuestAuth_v1' }
  });
  AUTH.client.auth.onAuthStateChange(function (event, session) {
    var u = session ? session.user : null;
    var changed = (u && u.id) !== (AUTH.user && AUTH.user.id);
    AUTH.user = u;
    AUTH.username = u ? ((u.user_metadata && u.user_metadata.username) || '') : '';
    if (!u) AUTH.status = 'guest';
    renderAccount();
    // Supabase advises not to call it from inside this callback: defer.
    if (event === 'PASSWORD_RECOVERY') setTimeout(openNewPasswordForm, 0);
    if (u && changed) setTimeout(syncOnLogin, 0);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && AUTH.user) flushPush(); });
  addEventListener('online', function () { if (AUTH.user && readSync().dirty) pushSave(); });
}
