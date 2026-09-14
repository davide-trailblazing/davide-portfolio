/* sitesearch.js - one search box for a single-page site.
   No dependencies, no build step, no index file. It reads the page itself at
   load, so it can never drift out of date with the content.

   Drop in:  <script src="/sitesearch.js" defer></script>
   Nothing else is required. Everything below is optional.

   Optional per-site config, set BEFORE the script tag:
     window.SITE_SEARCH = {
       item:   '.pt',                        // selector for one searchable record
       title:  '.pt-title',                  // its title, inside the record
       tag:    '.badge',                     // its type or kind label
       label:  'Search the 72 points',       // placeholder text
       starts: ['pushback','apology','ask'], // Start here chips
       mount:  '#somewhere'                  // where to put the bar
     }
   Or mark records in the HTML with data-search-item / data-search-title.
*/
(function () {
  'use strict';
  var CFG = window.SITE_SEARCH || {};
  var MINQ = 2;                    // NN/g: the mean query is 2.0 words, so match early
  var MAXR = 40;

  /* Every visible string, so an Italian page is Italian all the way through.
     Override with t:{...} in the config; anything left out keeps the English. */
  var T = {
    label: 'Search', button: 'Search', start: 'Start here',
    result: 'result', results: 'results',
    placeholder: 'Search all N items',
    zero: 'Nothing here matches',
    hint: 'Try one word instead of three, or a word that would appear in the text itself.'
  };
  if (CFG.t) { for (var k in CFG.t) { if (CFG.t[k]) T[k] = CFG.t[k]; } }

  /* ---------------------------------------------------------- find records --- */
  /* A record is the smallest useful unit, never the whole page. Henikoff indexes
     the second of a video; on a one-page site that is the card or the point. */
  function words(el) { return (el.textContent || '').trim().split(/\s+/).length; }

  function detect() {
    var explicit = document.querySelectorAll('[data-search-item]');
    if (explicit.length) return [].slice.call(explicit);
    if (CFG.item) {
      var picked = document.querySelectorAll(CFG.item);
      if (picked.length) return [].slice.call(picked);
    }
    // Score every repeated class as a candidate group. Best group wins:
    // many members, each with real text, none nested inside another member.
    var groups = {}, all = document.querySelectorAll('body *');
    [].forEach.call(all, function (el) {
      if (!el.className || typeof el.className !== 'string') return;
      el.className.trim().split(/\s+/).forEach(function (c) {
        if (!c) return;
        (groups[c] = groups[c] || []).push(el);
      });
    });
    var best = null, bestScore = 0;
    Object.keys(groups).forEach(function (c) {
      var m = groups[c];
      if (m.length < 4 || m.length > 2000) return;
      var nested = m.some(function (a) {
        return m.some(function (b) { return a !== b && b.contains(a); });
      });
      if (nested) return;
      var w = m.map(words).sort(function (a, b) { return a - b; });
      var median = w[Math.floor(w.length / 2)];
      if (median < 8) return;
      var score = m.length * Math.min(median, 120);
      if (score > bestScore) { bestScore = score; best = m; }
    });
    /* A repeated group is only trustworthy if it covers most of the page.
       On a mixed page the best group can be a sidebar of cards, leaving the
       main prose unreachable, which reads as "search is broken". Measure it. */
    if (best && coverage(best) >= 0.6) return best;
    var heads = headingBlocks();
    if (heads.length >= 3) return heads;
    if (best) return best;
    var secs = document.querySelectorAll('main section, article, section');
    if (secs.length >= 3) return [].slice.call(secs);
    return [].slice.call(document.querySelectorAll('h2, h3'));
  }

  function textLen(el) {
    var clone = el.cloneNode(true);
    [].forEach.call(clone.querySelectorAll('script,style,noscript'), function (n) {
      n.parentNode.removeChild(n);
    });
    return (clone.textContent || '').replace(/\s+/g, ' ').trim().length;
  }

  function coverage(group) {
    var total = textLen(document.body) || 1;
    var got = 0;
    group.forEach(function (el) { got += textLen(el); });
    return got / total;
  }

  /* Every heading plus the content that follows it, stopping at the next heading
     of ANY level. Stopping at any level rather than a deeper one is what keeps
     blocks from nesting: an h2 block that swallowed its h3s would return the
     same text twice, once as the parent and once as the child. Together the
     blocks still cover the whole page, which is why this is the safe fallback. */
  function headingBlocks() {
    var hs = [].slice.call(document.querySelectorAll('h1,h2,h3,h4'));
    if (!hs.length) return [];
    /* Walk the text in DOCUMENT order and give each run to the heading that
       most recently preceded it. A nextElementSibling walk cannot do this:
       measured on a real page, an h3 sat outside the cards that held the h4s,
       so the sibling walk stepped over whole cards and swallowed them. */
    var parts = [], index = [];
    hs.forEach(function (hEl, i) { if (!hEl.id) hEl.id = 'ss-h' + i; index.push(hEl); parts.push([]); });
    var cur = -1;
    var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = tw.nextNode())) {
      var p = n.parentNode;
      if (!p || !p.tagName || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
      var hAnc = p.closest ? p.closest('h1,h2,h3,h4') : null;
      var at = hAnc ? index.indexOf(hAnc) : -1;
      if (at >= 0) { cur = at; continue; }   // the heading's own text is the title
      if (cur >= 0) parts[cur].push(n.nodeValue);
    }
    return index.map(function (hEl, i) {
      return { virtual: true, anchor: hEl, title: hEl.textContent.trim(),
               text: parts[i].join(' ') };
    });
  }

  /* Return the ELEMENT, not just its text, so build() can lift the title and the
     badge out of the snippet. Otherwise every snippet opens by repeating the
     title with the badge number glued to it: "3Thanking someone for the...". */
  function pickEl(el, sels) {
    for (var i = 0; i < sels.length; i++) {
      if (!sels[i] || !sels[i].trim()) continue;
      var f;
      try { f = el.querySelector(sels[i]); } catch (e) { continue; }
      if (f && f.textContent.trim()) return f;
    }
    return null;
  }

  function titleElOf(el) {
    return pickEl(el, [CFG.title, 'h1,h2,h3,h4,h5,h6',
      '[class*="title"]', '[class*="name"]', '[class*="head"]', 'strong', 'b']);
  }
  function tagElOf(el) {
    if (CFG.tag === false) return null;   // also stops bodyOf stripping a chip
    return pickEl(el, [CFG.tag, '[class*="badge"]', '[class*="tag"]',
      '[class*="chip"]', '[class*="kind"]', '[class*="type"]']);
  }

  function titleOf(el) {
    if (el.getAttribute('data-search-title')) return el.getAttribute('data-search-title');
    var t = titleElOf(el);
    if (t) return t.textContent.trim();
    var txt = (el.textContent || '').trim().split(/\s+/).slice(0, 9).join(' ');
    return txt || 'Untitled';
  }

  function tagOf(el) {
    /* tag:false turns the badge off. Needed where the page has chips or pills
       that are content rather than a category: on the portfolio, the guess
       promoted his job title and a client name into badges. */
    if (CFG.tag === false) return '';
    if (el.getAttribute('data-search-tag')) return el.getAttribute('data-search-tag');
    var g = tagElOf(el);
    return g ? g.textContent.trim() : '';
  }

  /* Body text with the title and badge removed, so the snippet adds something
     the reader cannot already see in the result row. */
  function bodyOf(el) {
    var marks = [titleElOf(el), tagElOf(el)].filter(Boolean);
    marks.forEach(function (n) { n.setAttribute('data-ss-strip', '1'); });
    var clone = el.cloneNode(true);
    marks.forEach(function (n) { n.removeAttribute('data-ss-strip'); });
    [].forEach.call(clone.querySelectorAll('script,style,noscript,[data-ss-strip]'),
      function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    var body = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    // If lifting them left almost nothing, the record was title-only. Keep it all.
    return body.length > 20 ? body : (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  var records = [];
  function build() {
    records = detect().map(function (el, i) {
      var title, tag, body, anchor;
      if (el && el.virtual) {                 // heading block, see headingBlocks()
        anchor = el.anchor; title = el.title; tag = '';
        body = el.text.replace(/\s+/g, ' ').trim();
      } else {
        anchor = el;
        if (!el.id) el.id = 'ss-' + i;
        title = titleOf(el); tag = tagOf(el);
        body = bodyOf(el);
      }
      return {
        el: anchor, id: anchor.id, title: title, tag: tag, body: body,
        t: title.toLowerCase(), g: (tag || '').toLowerCase(), b: body.toLowerCase()
      };
    }).filter(function (r) { return r.body.length > 12 && r.id; });
  }

  /* ----------------------------------------------------------------- search --- */
  /* AND across tokens, prefix match, title weighted heavily. Small and boring
     on purpose: the corpus is one page, so ranking beats recall. */
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function search(q) {
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    var out = [];
    records.forEach(function (r) {
      var score = 0, ok = true;
      for (var i = 0; i < toks.length; i++) {
        var k = toks[i], s = 0;
        if (r.t.indexOf(k) >= 0) s += 8;
        if (new RegExp('\\b' + esc(k)).test(r.t)) s += 6;
        if (r.g.indexOf(k) >= 0) s += 4;
        var n = r.b.split(k).length - 1;
        if (n) s += Math.min(n, 5);
        if (!s) { ok = false; break; }
        score += s;
      }
      if (ok) out.push({ r: r, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, MAXR);
  }

  function h(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* The highlight is built from escaped text only, so page content can never
     inject markup through the results panel. */
  function mark(text, toks) {
    var safe = h(text);
    toks.forEach(function (k) {
      safe = safe.replace(new RegExp('(' + esc(h(k)) + ')', 'ig'), '$1');
    });
    return safe.split('').join('<mark>').split('').join('</mark>');
  }
  function snip(r, toks) {
    var low = r.b, at = -1;
    for (var i = 0; i < toks.length; i++) {
      var p = low.indexOf(toks[i]);
      if (p >= 0 && (at < 0 || p < at)) at = p;
    }
    if (at < 0) at = 0;
    var from = Math.max(0, at - 80), to = Math.min(r.body.length, at + 160);
    return (from ? '… ' : '') + r.body.slice(from, to) + (to < r.body.length ? ' …' : '');
  }

  /* --------------------------------------------------------------------- UI --- */
  var CSS = [
    '.ssbar{position:sticky;top:0;z-index:9999;display:flex;gap:10px;align-items:center;',
    'padding:10px 16px;background:var(--ss-bg,#fff);border-bottom:1px solid var(--ss-line,#e2e2e2);',
    'font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;flex-wrap:wrap}',
    '.ssbar form{display:flex;gap:8px;align-items:center;flex:1 1 320px;min-width:0}',
    '.ssbar label{font-weight:600;white-space:nowrap;color:var(--ss-fg,#1a1a1a)}',
    '.ssbar input{flex:1;min-width:0;font:inherit;padding:9px 12px;border-radius:8px;',
    'border:1.5px solid var(--ss-line,#c9c9c9);background:var(--ss-field,#fff);color:var(--ss-fg,#111)}',
    '.ssbar input:focus{outline:3px solid var(--ss-focus,#b45309);outline-offset:1px}',
    '.ssbar button[type=submit]{font:inherit;font-weight:600;padding:9px 14px;border-radius:8px;',
    'border:0;background:var(--ss-accent,#b45309);color:#fff;cursor:pointer;white-space:nowrap}',
    '.sscount{font-size:13px;color:var(--ss-mute,#666);white-space:nowrap}',
    '.sschips{display:flex;gap:6px;flex-wrap:wrap;width:100%;align-items:center}',
    '.sschip{font:inherit;font-size:13px;padding:5px 11px;border-radius:999px;cursor:pointer;',
    'border:1px solid var(--ss-line,#d4d4d4);background:transparent;color:var(--ss-fg,#333)}',
    '.sschip:hover{border-color:var(--ss-accent,#b45309)}',
    '.sspanel{position:absolute;left:0;right:0;max-height:70vh;overflow:auto;z-index:9998;',
    'background:var(--ss-bg,#fff);border-bottom:1px solid var(--ss-line,#e2e2e2);',
    'box-shadow:0 12px 28px rgba(0,0,0,.16)}',
    '.ssres{list-style:none;margin:0;padding:6px 0}',
    '.ssres li a{display:block;padding:11px 18px;text-decoration:none;color:inherit;',
    'border-bottom:1px solid var(--ss-line,#efefef)}',
    '.ssres li a:hover,.ssres li a.sel{background:var(--ss-hover,#f5f1ea)}',
    '.sstop{display:flex;gap:8px;align-items:center;margin-bottom:3px}',
    '.sstag{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;',
    'padding:2px 7px;border-radius:4px;background:var(--ss-accent,#b45309);color:#fff}',
    '.sstitle{font-weight:600;font-size:15px;color:var(--ss-fg,#111)}',
    '.sssnip{font-size:13.5px;color:var(--ss-mute,#555);margin-top:3px;line-height:1.5}',
    '.sspanel mark{background:var(--ss-mark,#ffe08a);color:#111;border-radius:3px;padding:0 1px}',
    '.sszero{padding:18px 18px 22px;font-size:14.5px;color:var(--ss-fg,#111)}',
    '.sszero b{display:block;font-size:16px;margin-bottom:6px}',
    '.ssflash{animation:ssflash 1.6s ease-out}',
    '@keyframes ssflash{0%,55%{background:var(--ss-mark,#ffe08a)}100%{background:transparent}}',
    '@media print{.ssbar,.sspanel{display:none}}'
  ].join('');

  function start() {
    build();
    if (records.length < 3) return;          // nothing worth searching

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'ssbar';
    var ph = CFG.label || T.placeholder.replace('N', records.length);
    bar.innerHTML =
      '<form role="search" autocomplete="off">' +
      '<label for="ss-q">🔎 ' + h(T.label) + '</label>' +
      '<input type="search" id="ss-q" name="q" spellcheck="false" placeholder="' + h(ph) + '">' +
      '<button type="submit">' + h(T.button) + '</button></form>' +
      '<span class="sscount" id="ss-count" role="status" aria-live="polite"></span>';

    var starts = CFG.starts || [];
    if (starts.length) {
      var chips = document.createElement('div');
      chips.className = 'sschips';
      chips.innerHTML = '<span class="sscount">' + h(T.start) + '</span>' + starts.map(function (s) {
        return '<button class="sschip" type="button" data-q="' + h(s) + '">' + h(s) + '</button>';
      }).join('');
      bar.appendChild(chips);
    }

    /* padRight reserves space at the right end of the bar for a button the site
       already pins there. The portfolio has a fixed "Get in touch" button that
       otherwise sits on top of the search field. */
    if (CFG.padRight) bar.style.paddingRight = (+CFG.padRight) + 'px';

    var mount = null;
    try { mount = CFG.mount ? document.querySelector(CFG.mount) : null; } catch (e) { mount = null; }
    if (mount) mount.insertBefore(bar, mount.firstChild);
    else document.body.insertBefore(bar, document.body.firstChild);

    // Native section links need the same clearance as search-result links.
    function searchClearance() {
      var navigation = document.querySelector('.site-nav');
      return (navigation ? navigation.offsetHeight : bar.offsetHeight) + 14;
    }
    function reserveSearchHeight() {
      document.documentElement.style.scrollPaddingTop = searchClearance() + 'px';
    }
    reserveSearchHeight();
    var sizing = new ResizeObserver(reserveSearchHeight);
    sizing.observe(bar);
    var navigation = document.querySelector('.site-nav');
    if (navigation) sizing.observe(navigation);

    function reveal(target) {
      for (var parent = target; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
      // A legacy section URL opens its body as well as any enclosing category.
      var sectionBody = target.querySelector(':scope > .container > .section-fold');
      if (sectionBody) sectionBody.open = true;
    }
    function revealHash() {
      var id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; }
      var target = document.getElementById(id);
      if (target) {
        reveal(target);
        requestAnimationFrame(function () { target.scrollIntoView({block:'start',behavior:'instant'}); });
      }
    }
    revealHash();
    window.addEventListener('hashchange', revealHash);
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (link && link.hash === location.hash) revealHash();
    });

    var panel = document.createElement('div');
    panel.className = 'sspanel';
    panel.hidden = true;
    bar.parentNode.insertBefore(panel, bar.nextSibling);

    var input = bar.querySelector('#ss-q');
    var count = bar.querySelector('#ss-count');
    var form = bar.querySelector('form');
    var items = [], sel = -1;

    function close() { panel.hidden = true; panel.innerHTML = ''; items = []; sel = -1; }

    function chipRow() {
      return starts.length ? '<div class="sschips" style="margin-top:12px">' + starts.map(function (s) {
        return '<button class="sschip" type="button" data-q="' + h(s) + '">' + h(s) + '</button>';
      }).join('') + '</div>' : '';
    }

    function run(q) {
      q = (q || '').trim();
      if (q.length < MINQ) { close(); count.textContent = ''; return; }
      var toks = q.toLowerCase().split(/\s+/).filter(Boolean);
      var hits = search(q);
      count.textContent = hits.length + ' ' + (hits.length === 1 ? T.result : T.results);

      if (!hits.length) {
        /* NN/g no-results rules: say it plainly, keep the query, offer a way on. */
        panel.innerHTML = '<div class="sszero"><b>' + h(T.zero) + ' “' + h(q) + '”.</b>' +
          h(T.hint) +
          chipRow() + '</div>';
        panel.hidden = false;
        return;
      }

      panel.innerHTML = '<ol class="ssres">' + hits.map(function (x) {
        return '<li><a href="#' + h(x.r.id) + '"><div class="sstop">' +
          (x.r.tag ? '<span class="sstag">' + h(x.r.tag) + '</span>' : '') +
          '<span class="sstitle">' + mark(x.r.title, toks) + '</span></div>' +
          '<div class="sssnip">' + mark(snip(x.r, toks), toks) + '</div></a></li>';
      }).join('') + '</ol>';
      panel.hidden = false;
      items = [].slice.call(panel.querySelectorAll('.ssres a'));
      sel = -1;
    }

    function jump(a) {
      var t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (!t) return;
      close();
      var disclosure = bar.closest('details');
      if (disclosure) disclosure.open = false;
      reveal(t);
      /* Deliberately instant, and deliberately not scrollIntoView. Measured on a
         real page: scrollIntoView and behavior:"smooth" both silently do nothing
         when the site's own CSS sets scroll-behavior:smooth, and on a 29,000px
         page a slow glide is worse than arriving. The flash below is what tells
         the eye where it landed. */
      var top = t.getBoundingClientRect().top + (window.pageYOffset || 0)
                - searchClearance();
      if (top < 0) top = 0;
      /* The page's own CSS scroll-behavior wins over the two-argument scrollTo,
         so neutralise it for this one call, then put it back. Measured: without
         both of these the jump silently does nothing. */
      var root = document.documentElement, prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      try { window.scrollTo({ top: top, behavior: 'instant' }); }
      catch (e) { window.scrollTo(0, top); }
      root.style.scrollBehavior = prev;
      t.tabIndex = -1;
      t.focus({ preventScroll: true });
      if (window.history && history.replaceState) {
        try { history.replaceState(null, '', '#' + t.id); } catch (e) {}
      }
      t.classList.remove('ssflash');
      void t.offsetWidth;
      t.classList.add('ssflash');
    }

    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { run(input.value); }, 120);
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); run(input.value); });

    function chipClick(e) {
      var c = e.target.closest ? e.target.closest('.sschip') : null;
      if (!c) return false;
      input.value = c.getAttribute('data-q');
      run(input.value);
      input.focus();
      return true;
    }
    panel.addEventListener('click', function (e) {
      if (chipClick(e)) return;
      var a = e.target.closest('.ssres a');
      if (a) { e.preventDefault(); jump(a); }
    });
    bar.addEventListener('click', chipClick);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; close(); count.textContent = ''; return; }
      if (panel.hidden || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (sel >= 0) items[sel].classList.remove('sel');
        sel += (e.key === 'ArrowDown' ? 1 : -1);
        if (sel < 0) sel = items.length - 1;
        if (sel >= items.length) sel = 0;
        items[sel].classList.add('sel');
        items[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); jump(items[sel]); }
    });

    document.addEventListener('keydown', function (e) {
      var el = document.activeElement, typing = el && (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) ||
          ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
        e.preventDefault(); reveal(input); input.focus(); input.select();
      }
    });
    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && !bar.contains(e.target)) close();
    });

    /* ?q= makes a search shareable and the back button work, like a real page. */
    var q0 = null;
    try { q0 = new URLSearchParams(location.search).get('q'); } catch (e) {}
    if (q0) { reveal(input); input.value = q0; run(q0); }
    window.SiteSearch = { records: records, run: run, search: search };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})();
