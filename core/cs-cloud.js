// КЭШ.СТРИМ — облачный сейв через Supabase (Auth + player_saves)
// Без тяжёлого SDK: только fetch к Auth API и PostgREST.
var CS = window.CS || (window.CS = {});

CS.CLOUD_SESSION_KEY = 'csCloudSession';

CS.Cloud = {
  _session: null, // { access_token, refresh_token, expires_at, user: { id, email } }
  _configured: function () {
    var c = CS.CLOUD || {};
    return !!(c.url && c.anonKey && c.anonKey.indexOf((CS.t ? CS.t('m.aaae4e82d8') : 'ВСТАВЬТЕ')) === -1 && c.anonKey.length > 20);
  },

  /** Понятный статус для UI (почему «не работает»). */
  configStatus: function () {
    var c = CS.CLOUD || {};
    if (!c.url) return { ok: false, text: (CS.t ? CS.t('m.a57531e814') : 'Не задан CS.CLOUD.url') };
    if (!c.anonKey || c.anonKey.indexOf((CS.t ? CS.t('m.aaae4e82d8') : 'ВСТАВЬТЕ')) !== -1 || c.anonKey.length < 20) {
      return {
        ok: false,
        text: 'Не задан Publishable/anon key в core/cs-config.js → CS.CLOUD.anonKey. Без ключа регистрация и сейвы не ходят в Supabase.'
      };
    }
    return { ok: true, text: (CS.t ? CS.t('m.2a2d9f1f8f') : 'Ключ задан · ') + String(c.url).replace(/^https?:\/\//, '').slice(0, 40) };
  },

  /** Человекочитаемая ошибка PostgREST / Auth */
  _friendlyError: function (raw) {
    var s = String(raw || '');
    var low = s.toLowerCase();
    if (low.indexOf('relation') >= 0 && low.indexOf('player_saves') >= 0) {
      return 'Нет таблицы player_saves в Supabase. Создайте её (SQL в README) и RLS-политики.';
    }
    if (low.indexOf('permission denied') >= 0 || low.indexOf('rls') >= 0 || low.indexOf('policy') >= 0) {
      return 'RLS блокирует запись. Нужны политики SELECT/INSERT/UPDATE для auth.uid() = user_id.';
    }
    if (low.indexOf('jwt') >= 0 || low.indexOf('unauthorized') >= 0) {
      return 'Сессия устарела или неверный anon key. Выйдите и войдите снова; проверьте CS.CLOUD.anonKey.';
    }
    if (low.indexOf('failed to fetch') >= 0 || low.indexOf('network') >= 0) {
      return 'Сеть/CORS: откройте игру как расширение или с разрешённого origin; проверьте host_permissions.';
    }
    return s.slice(0, 280);
  },

  _headers: function (useUserJwt) {
    var c = CS.CLOUD || {};
    var h = {
      apikey: c.anonKey,
      'Content-Type': 'application/json'
    };
    if (useUserJwt && CS.Cloud._session && CS.Cloud._session.access_token) {
      h.Authorization = 'Bearer ' + CS.Cloud._session.access_token;
    } else {
      h.Authorization = 'Bearer ' + c.anonKey;
    }
    return h;
  },

  _authUrl: function (path) {
    return (CS.CLOUD.url || '').replace(/\/$/, '') + '/auth/v1' + path;
  },

  _restUrl: function (path) {
    return (CS.CLOUD.url || '').replace(/\/$/, '') + '/rest/v1' + path;
  },

  loadSession: function () {
    return new Promise(function (resolve) {
      if (CS._hasChromeStorage) {
        chrome.storage.local.get(CS.CLOUD_SESSION_KEY, function (res) {
          CS.Cloud._session = res[CS.CLOUD_SESSION_KEY] || null;
          resolve(CS.Cloud._session);
        });
      } else {
        try {
          var raw = localStorage.getItem(CS.CLOUD_SESSION_KEY);
          CS.Cloud._session = raw ? JSON.parse(raw) : null;
        } catch (e) {
          CS.Cloud._session = null;
        }
        resolve(CS.Cloud._session);
      }
    });
  },

  saveSession: function (session) {
    CS.Cloud._session = session;
    return new Promise(function (resolve) {
      if (CS._hasChromeStorage) {
        if (session) {
          chrome.storage.local.set({ [CS.CLOUD_SESSION_KEY]: session }, resolve);
        } else {
          chrome.storage.local.remove(CS.CLOUD_SESSION_KEY, resolve);
        }
      } else {
        try {
          if (session) localStorage.setItem(CS.CLOUD_SESSION_KEY, JSON.stringify(session));
          else localStorage.removeItem(CS.CLOUD_SESSION_KEY);
        } catch (e) { /* ignore */ }
        resolve();
      }
    });
  },

  isLoggedIn: function () {
    return !!(CS.Cloud._session && CS.Cloud._session.access_token && CS.Cloud._session.user);
  },

  currentEmail: function () {
    return (CS.Cloud._session && CS.Cloud._session.user && CS.Cloud._session.user.email) || '';
  },

  currentUserId: function () {
    return (CS.Cloud._session && CS.Cloud._session.user && CS.Cloud._session.user.id) || null;
  },

  /** Регистрация email + пароль */
  signUp: async function (email, password) {
    if (!CS.Cloud._configured()) {
      return { success: false, error: 'Облако не настроено: укажите anonKey в CS.CLOUD' };
    }
    try {
      var res = await fetch(CS.Cloud._authUrl('/signup'), {
        method: 'POST',
        headers: CS.Cloud._headers(false),
        body: JSON.stringify({ email: email, password: password })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        return { success: false, error: (data.error_description || data.msg || data.error || res.statusText || (CS.t ? CS.t('m.b9f2cacc6f') : 'Ошибка регистрации')) };
      }
      // Иногда signup не возвращает session (confirm email) — тогда просим войти
      if (data.access_token && data.user) {
        await CS.Cloud._applySession(data);
        return { success: true, session: CS.Cloud._session, needsConfirm: false };
      }
      return {
        success: true,
        needsConfirm: true,
        message: (CS.t ? CS.t('m.0706b6e169') : 'Проверьте почту для подтверждения (если включено в Supabase), затем войдите.')
      };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  },

  /** Вход email + пароль */
  signIn: async function (email, password) {
    if (!CS.Cloud._configured()) {
      return { success: false, error: (CS.t ? CS.t('m.3c1807a453') : 'Облако не настроено: укажите Publishable key в CS.CLOUD.anonKey') };
    }
    try {
      var res = await fetch(CS.Cloud._authUrl('/token?grant_type=password'), {
        method: 'POST',
        headers: CS.Cloud._headers(false),
        body: JSON.stringify({ email: email, password: password })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        return { success: false, error: (data.error_description || data.msg || data.error || (CS.t ? CS.t('m.2fac86a3de') : 'Неверный email или пароль')) };
      }
      await CS.Cloud._applySession(data);
      return { success: true, session: CS.Cloud._session };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  },

  /**
   * Вход через Google (OAuth).
   * В расширении: chrome.identity.launchWebAuthFlow → redirect на *.chromiumapp.org
   * Вне расширения (обычная вкладка): window.open + postMessage / hash — упрощённо открываем authorize URL.
   *
   * Требуется в Supabase: Auth → Providers → Google (Client ID/Secret из Google Cloud)
   * и Redirect URLs: chrome.identity.getRedirectURL() + https://<project>.supabase.co/auth/v1/callback
   */
  signInWithGoogle: async function () {
    if (!CS.Cloud._configured()) {
      return { success: false, error: (CS.t ? CS.t('m.bf75597de7') : 'Облако не настроено') };
    }

    var redirectTo;
    var useChromeIdentity = typeof chrome !== 'undefined'
      && chrome.identity
      && typeof chrome.identity.launchWebAuthFlow === 'function'
      && typeof chrome.identity.getRedirectURL === 'function';

    if (useChromeIdentity) {
      redirectTo = chrome.identity.getRedirectURL('supabase');
    } else {
      // fullpage не из расширения — callback на текущую страницу
      redirectTo = (window.location && window.location.origin)
        ? window.location.href.split('#')[0]
        : 'http://localhost';
    }

    var authUrl = CS.Cloud._authUrl('/authorize')
      + '?provider=google'
      + '&redirect_to=' + encodeURIComponent(redirectTo);

    try {
      var responseUrl;
      if (useChromeIdentity) {
        responseUrl = await new Promise(function (resolve, reject) {
          chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            function (redirectUrl) {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message || (CS.t ? CS.t('m.488661ec04') : 'OAuth отменён')));
                return;
              }
              if (!redirectUrl) {
                reject(new Error((CS.t ? CS.t('m.a9834011a0') : 'Пустой ответ OAuth')));
                return;
              }
              resolve(redirectUrl);
            }
          );
        });
      } else {
        // Fallback: popup-окно, пользователь копирует не сможет — пробуем ждать hash через storage event
        // Для надёжности вне расширения рекомендуем email. Здесь открываем вкладку.
        window.open(authUrl, 'cs_google_auth', 'width=480,height=640');
        return {
          success: false,
          error: 'Google-вход из обычной вкладки: откройте игру как расширение Chrome (identity API). Или войдите по email.'
        };
      }

      var tokens = CS.Cloud._parseOAuthRedirect(responseUrl);
      if (!tokens.access_token) {
        return {
          success: false,
          error: tokens.error || 'Не удалось получить токен из ответа Google/Supabase'
        };
      }
      await CS.Cloud._applySession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in ? Number(tokens.expires_in) : 3600,
        expires_at: tokens.expires_at
      });
      return { success: true, session: CS.Cloud._session };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  },

  /** Разобрать access_token / refresh_token из URL после OAuth redirect */
  _parseOAuthRedirect: function (url) {
    var out = {};
    try {
      var hash = '';
      var query = '';
      var hashIdx = url.indexOf('#');
      var queryIdx = url.indexOf('?');
      if (hashIdx >= 0) hash = url.slice(hashIdx + 1);
      if (queryIdx >= 0) {
        query = url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined);
      }
      function parsePairs(str) {
        str.split('&').forEach(function (pair) {
          var p = pair.split('=');
          if (p.length >= 2) {
            out[decodeURIComponent(p[0])] = decodeURIComponent(p.slice(1).join('='));
          }
        });
      }
      if (query) parsePairs(query);
      if (hash) parsePairs(hash);
    } catch (e) {
      out.error = e.message;
    }
    return out;
  },

  signOut: async function () {
    try {
      if (CS.Cloud._session && CS.Cloud._session.access_token) {
        await fetch(CS.Cloud._authUrl('/logout'), {
          method: 'POST',
          headers: CS.Cloud._headers(true)
        });
      }
    } catch (e) { /* ignore */ }
    await CS.Cloud.saveSession(null);
    return { success: true };
  },

  _applySession: async function (data) {
    var user = data.user || (data.user_id ? { id: data.user_id, email: data.email } : null);
    if (!user && data.access_token) {
      // подтянуть профиль
      try {
        var ur = await fetch(CS.Cloud._authUrl('/user'), {
          headers: {
            apikey: CS.CLOUD.anonKey,
            Authorization: 'Bearer ' + data.access_token
          }
        });
        if (ur.ok) user = await ur.json();
      } catch (e) { /* ignore */ }
    }
    var session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_at: data.expires_at || (Date.now() / 1000 + (data.expires_in || 3600)),
      user: user ? { id: user.id, email: user.email } : null
    };
    await CS.Cloud.saveSession(session);
  },

  /** Обновить access_token при необходимости */
  ensureFreshToken: async function () {
    if (!CS.Cloud.isLoggedIn()) return false;
    var exp = CS.Cloud._session.expires_at || 0;
    var now = Date.now() / 1000;
    if (exp > now + 60) return true;
    if (!CS.Cloud._session.refresh_token) return true; // пробуем как есть
    try {
      var res = await fetch(CS.Cloud._authUrl('/token?grant_type=refresh_token'), {
        method: 'POST',
        headers: CS.Cloud._headers(false),
        body: JSON.stringify({ refresh_token: CS.Cloud._session.refresh_token })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        await CS.Cloud.saveSession(null);
        return false;
      }
      await CS.Cloud._applySession(data);
      return true;
    } catch (e) {
      return false;
    }
  },

  /** Загрузить сейв из облака (или null) */
  pullSave: async function () {
    if (!CS.Cloud.isLoggedIn()) return { success: false, error: 'not_logged_in' };
    if (!(await CS.Cloud.ensureFreshToken())) return { success: false, error: 'session_expired' };
    var uid = CS.Cloud.currentUserId();
    try {
      var res = await fetch(
        CS.Cloud._restUrl('/player_saves?user_id=eq.' + encodeURIComponent(uid) + '&select=state,updated_at'),
        { headers: CS.Cloud._headers(true) }
      );
      if (!res.ok) {
        var err = await res.text();
        return { success: false, error: CS.Cloud._friendlyError(err || res.statusText) };
      }
      var rows = await res.json();
      if (!rows || !rows.length) return { success: true, state: null, updated_at: null };
      return {
        success: true,
        state: rows[0].state,
        updated_at: rows[0].updated_at
      };
    } catch (e) {
      return { success: false, error: CS.Cloud._friendlyError(e.message || String(e)) };
    }
  },

  /** Сохранить текущий state в облако (upsert по user_id) */
  pushSave: async function (state) {
    if (!CS.Cloud.isLoggedIn()) return { success: false, error: 'Сначала войдите в аккаунт' };
    if (!(await CS.Cloud.ensureFreshToken())) return { success: false, error: (CS.t ? CS.t('m.2a5592a6f4') : 'Сессия истекла — войдите снова') };
    var uid = CS.Cloud.currentUserId();
    if (!uid) return { success: false, error: (CS.t ? CS.t('m.a7e7a2b2a1') : 'Нет user id в сессии — войдите снова') };
    var payload = {
      user_id: uid,
      state: state,
      updated_at: new Date().toISOString()
    };
    try {
      // PostgREST upsert: POST + on_conflict=user_id + Prefer merge-duplicates
      var res = await fetch(
        CS.Cloud._restUrl('/player_saves?on_conflict=user_id'),
        {
          method: 'POST',
          headers: Object.assign({}, CS.Cloud._headers(true), {
            Prefer: 'resolution=merge-duplicates,return=minimal'
          }),
          body: JSON.stringify(payload)
        }
      );
      if (res.ok || res.status === 201) {
        return { success: true, updated_at: payload.updated_at };
      }
      // fallback: PATCH, затем INSERT
      var patch = await fetch(
        CS.Cloud._restUrl('/player_saves?user_id=eq.' + encodeURIComponent(uid)),
        {
          method: 'PATCH',
          headers: CS.Cloud._headers(true),
          body: JSON.stringify({ state: state, updated_at: payload.updated_at })
        }
      );
      if (patch.ok) return { success: true, updated_at: payload.updated_at };
      var ins = await fetch(CS.Cloud._restUrl('/player_saves'), {
        method: 'POST',
        headers: CS.Cloud._headers(true),
        body: JSON.stringify(payload)
      });
      if (!ins.ok) {
        var errText = await ins.text();
        return { success: false, error: CS.Cloud._friendlyError(errText || ins.statusText) };
      }
      return { success: true, updated_at: payload.updated_at };
    } catch (e) {
      return { success: false, error: CS.Cloud._friendlyError(e.message || String(e)) };
    }
  },

  /** Грубая «ценность» сейва, чтобы не затирать живой локальный прогресс старым облаком */
  _progressScore: function (st) {
    if (!st || typeof st !== 'object') return 0;
    var life = st.lifetime || {};
    return (Number(st.level) || 0) * 1000
      + (Number(life.cashEarned) || 0)
      + (Number(life.taps) || 0)
      + (Number(st.cash) || 0) * 0.01;
  },

  /**
   * После логина: если облако пусто → push локального.
   * Если локальный прогресс заметно богаче облака → push.
   * Если облако свежее по времени и не слабее по прогрессу → pull.
   * Иначе → push локального (не затираем текущую игру).
   */
  syncAfterLogin: async function (localState) {
    var pull = await CS.Cloud.pullSave();
    if (!pull.success) return { success: false, error: pull.error, action: 'none' };

    if (!pull.state) {
      var push = await CS.Cloud.pushSave(localState);
      return {
        success: push.success,
        action: 'pushed_local',
        error: push.error,
        state: localState
      };
    }

    var cloudTime = pull.updated_at ? Date.parse(pull.updated_at) : 0;
    var localTime = (localState && localState.cloudMeta && localState.cloudMeta.updatedAt)
      ? Date.parse(localState.cloudMeta.updatedAt)
      : 0;
    var localScore = CS.Cloud._progressScore(localState);
    var cloudScore = CS.Cloud._progressScore(pull.state);

    // Локальный сильно впереди по прогрессу — сохраняем его в облако
    if (localScore > cloudScore * 1.05 + 10) {
      var pushBetter = await CS.Cloud.pushSave(localState);
      return {
        success: pushBetter.success,
        action: 'pushed_local_richer',
        error: pushBetter.error,
        state: localState
      };
    }

    // Облако заметно новее по времени и не хуже по прогрессу — берём облако
    if (cloudTime > localTime + 2000 && cloudScore >= localScore * 0.95) {
      var normalized = CS.normalizeState(pull.state);
      if (!normalized.cloudMeta) normalized.cloudMeta = {};
      normalized.cloudMeta.updatedAt = pull.updated_at;
      return {
        success: true,
        action: 'pulled_cloud',
        state: normalized
      };
    }

    // По умолчанию не затираем текущую сессию — пушим локальное
    var push2 = await CS.Cloud.pushSave(localState);
    return {
      success: push2.success,
      action: 'pushed_local_default',
      error: push2.error,
      state: localState
    };
  }
};
