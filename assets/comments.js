(function () {
  const API_BASE = "https://zshyang-comments-git-main-george-yang-s-projects.vercel.app";

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function ce(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    if (children) for (const c of children) el.appendChild(c);
    return el;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      const pad = (n) => (n < 10 ? "0" + n : "" + n);
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
        " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    } catch (_) { return iso; }
  }

  function getAdminToken() {
    try {
      const qp = new URLSearchParams(location.search).get("admin");
      if (qp) {
        localStorage.setItem("zshyang_admin_token", qp);
        const url = new URL(location.href);
        url.searchParams.delete("admin");
        history.replaceState({}, "", url.toString());
      }
      return localStorage.getItem("zshyang_admin_token") || "";
    } catch (_) { return ""; }
  }

  async function apiFetch(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    const token = getAdminToken();
    if (token) opts.headers["X-Admin-Token"] = token;
    const resp = await fetch(API_BASE + path, opts);
    return resp;
  }

  function render(container, state) {
    container.innerHTML = "";

    const title = ce("h2", { text: state.admin ? "Comments (admin)" : "Comments" });
    container.appendChild(title);

    const list = ce("div", { class: "comments-list" });
    if (!state.comments.length) {
      list.appendChild(ce("p", { class: "comments-empty", text: "还没有留言。" }));
    }
    for (const c of state.comments) {
      const item = ce("div", { class: "comment-item" + (c.deleted ? " comment-deleted" : "") });
      const header = ce("div", { class: "comment-header" });
      const who = ce("span", { class: "comment-author", text: c.author });
      const when = ce("span", { class: "comment-time", text: fmtTime(c.createdAt) });
      header.appendChild(who);
      header.appendChild(when);
      if (state.admin && !c.deleted) {
        const delBtn = ce("button", { class: "comment-del", type: "button", text: "删除" });
        delBtn.addEventListener("click", async () => {
          if (!confirm("确认删除这条留言？（软删除，游客不再可见，你仍可查看）")) return;
          const r = await apiFetch(
            "/api/comments/" + encodeURIComponent(c.id) +
            "?pageId=" + encodeURIComponent(state.pageId),
            { method: "DELETE" }
          );
          if (r.ok) load(container, state.pageId);
          else alert("删除失败: " + r.status);
        });
        header.appendChild(delBtn);
      }
      if (state.admin && c.deleted) {
        const restoreBtn = ce("button", { class: "comment-restore", type: "button", text: "恢复" });
        restoreBtn.addEventListener("click", async () => {
          const r = await apiFetch(
            "/api/comments/" + encodeURIComponent(c.id) +
            "?pageId=" + encodeURIComponent(state.pageId) + "&action=restore",
            { method: "POST" }
          );
          if (r.ok) load(container, state.pageId);
          else alert("恢复失败: " + r.status);
        });
        header.appendChild(restoreBtn);
      }
      item.appendChild(header);
      const body = ce("div", { class: "comment-body" });
      body.textContent = c.text;
      item.appendChild(body);
      if (state.admin && c.deleted) {
        const tag = ce("div", { class: "comment-deleted-tag", text: "[已删除 · 仅管理员可见]" });
        item.appendChild(tag);
      }
      list.appendChild(item);
    }
    container.appendChild(list);

    const form = ce("div", { class: "comment-form" });
    const ta = ce("textarea", { class: "comment-input", rows: "4", maxlength: "1000", placeholder: "写点什么吧…" });
    const submit = ce("button", { class: "comment-submit", type: "button", text: "留言" });
    form.appendChild(ta);
    form.appendChild(submit);
    submit.addEventListener("click", async () => {
      const text = ta.value.trim();
      if (!text) return;
      submit.disabled = true;
      submit.textContent = "提交中…";
      try {
        const r = await fetch(API_BASE + "/api/comments?pageId=" + encodeURIComponent(state.pageId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });
        if (r.status === 429) {
          alert("留言太频繁，请一小时后再试。");
        } else if (!r.ok) {
          alert("留言失败: " + r.status);
        } else {
          ta.value = "";
          load(container, state.pageId);
        }
      } catch (e) {
        alert("网络错误: " + e.message);
      } finally {
        submit.disabled = false;
        submit.textContent = "留言";
      }
    });
    container.appendChild(form);
  }

  async function load(container, pageId) {
    container.innerHTML = "<p class='comments-loading'>加载中…</p>";
    try {
      const r = await apiFetch("/api/comments?pageId=" + encodeURIComponent(pageId));
      if (!r.ok) {
        container.innerHTML = "<p class='comments-error'>留言加载失败 (" + r.status + ")</p>";
        return;
      }
      const data = await r.json();
      render(container, { comments: data.comments, admin: data.admin, pageId });
    } catch (e) {
      container.innerHTML = "<p class='comments-error'>网络错误: " + escapeHtml(e.message) + "</p>";
    }
  }

  window.ZshyangComments = {
    mount: function (selector, pageId) {
      const el = typeof selector === "string" ? qs(selector) : selector;
      if (!el) return;
      load(el, pageId);
    }
  };
})();
