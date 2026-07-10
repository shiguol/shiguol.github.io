/**
 * 1) before_post_render: stash $ / $$ math so marked does not parse _ * as emphasis
 * 2) after_post_render: restore, converting $$...$$ -> \[...\] for MathJax display
 */
'use strict';

const PLACEHOLDER = (i) => `HEXOMATHPLACEHOLDER${i}END`;

hexo.extend.filter.register('before_post_render', function (data) {
  if (!data.content || data.content.indexOf('$') === -1) return data;

  const store = [];
  let s = data.content;

  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    store.push(m);
    return PLACEHOLDER(store.length - 1);
  });

  s = s.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (m) => {
    store.push(m);
    return PLACEHOLDER(store.length - 1);
  });

  if (store.length) {
    data.content = s;
    data._mathStore = store;
  }
  return data;
}, 1);

hexo.extend.filter.register('after_post_render', function (data) {
  const store = data._mathStore;
  if (!store || !store.length || !data.content) return data;

  let html = data.content;
  for (let i = 0; i < store.length; i++) {
    let tex = store[i];
    // $$ display -> \[ \] (MathJax default displayMath)
    if (tex.startsWith('$$') && tex.endsWith('$$')) {
      const inner = tex.slice(2, -2).trim();
      tex = `\\[${inner}\\]`;
    }
    html = html.split(PLACEHOLDER(i)).join(tex);
  }
  data.content = html;
  return data;
}, 10);
