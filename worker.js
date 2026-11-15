// conteudos.kapota.com.br: os materiais e o cadastro pra liberar (desde 15/11/2026).
//
// Página de material (/<pasta>/): quem ainda não se cadastrou naquele aparelho recebe só a
// primeira etapa com o formulário (<html data-mt-trancado>); quem já se cadastrou recebe o
// material inteiro sem o formulário (<html data-mt-ar>). O aparelho liberado é um cookie com
// token aleatório; quem guarda e confere é o Worker da newsletter (binding AUDIENCIA,
// entrypoint Materiais), no banco do sistema de audiência.
//   POST /api/cadastro  nome, email, whatsapp, newsletter → libera o aparelho (cookie de 1 ano)
//   POST /api/evento    abriu / fim, pro painel de audiência
// Página inicial e endereço que não existe vão pro kapota.com.br, como antes.

const COOKIE = "kp_material";
const UM_ANO = 365 * 24 * 60 * 60;
const SITE = "https://kapota.com.br/";
const ROBO = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|vkshare|skype/i;

const json = (dados, status = 200, extra = {}) =>
  new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

// Pedido que grava só vale vindo das próprias páginas (no ar ou no wrangler dev local).
function origemValida(request, url) {
  const origem = request.headers.get("origin");
  if (!origem) return true;
  return origem === url.origin || origem === "https://conteudos.kapota.com.br" || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origem);
}

function lerCookie(request, nome) {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`));
  return m ? m[1] : null;
}

async function corpo(request) {
  const texto = await request.text();
  if (texto.length > 4000) return null;
  try { const d = JSON.parse(texto); return d && typeof d === "object" ? d : null; } catch { return null; }
}

async function cadastro(request, env, url) {
  if (!origemValida(request, url)) return json({ erro: "Origem não permitida." }, 403);
  const d = await corpo(request);
  if (!d) return json({ erro: "Pedido inválido." }, 400);
  const t = Number(d.t);
  const segundos = Number.isFinite(t) && t > 0 ? (Date.now() - t) / 1000 : null;
  const r = await env.AUDIENCIA.cadastrar(
    { nome: d.nome, email: d.email, whatsapp: d.whatsapp, newsletter: d.newsletter === true, site: d.site, material: d.material, titulo: d.titulo },
    { ip: request.headers.get("cf-connecting-ip") || "unknown", segundos }
  );
  if (r.erro) return json({ erro: r.erro }, r.status || 400);
  if (!r.token) return json({ ok: true }); // pareceu robô: não guarda nem libera
  return json({ ok: true, newsletter: r.newsletter }, 200, {
    "set-cookie": `${COOKIE}=${r.token}; Max-Age=${UM_ANO}; Path=/; Secure; HttpOnly; SameSite=Lax`
  });
}

async function evento(request, env, url) {
  if (!origemValida(request, url)) return new Response(null, { status: 403 });
  const token = lerCookie(request, COOKIE);
  const d = await corpo(request);
  if (token && d) await env.AUDIENCIA.evento(token, { material: d.material, titulo: d.titulo, tipo: d.tipo });
  return new Response(null, { status: 204 });
}

function semCache(resposta, html) {
  const r = new Response(html ?? resposta.body, resposta);
  r.headers.set("cache-control", "private, no-store");
  r.headers.set("vary", "cookie");
  return r;
}

async function material(request, env, ctx, slug, resposta) {
  const token = lerCookie(request, COOKIE);
  const quem = token ? await env.AUDIENCIA.acesso(token).catch(() => null) : null;

  if (quem) {
    return new HTMLRewriter()
      .on("html", { element: (e) => e.setAttribute("data-mt-ar", "") })
      .on("form[data-mt-cadastro]", { element: (e) => e.remove() })
      .transform(semCache(resposta));
  }

  const html = await resposta.text();
  const titulo = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || slug).replace(/ · Klysman Kley$/, "");
  if (!ROBO.test(request.headers.get("user-agent") || "")) {
    ctx.waitUntil(env.AUDIENCIA.visita(slug, titulo).catch(() => {}));
  }
  let etapa = 0;
  return new HTMLRewriter()
    .on("html", { element: (e) => e.setAttribute("data-mt-trancado", "") })
    // só a primeira etapa vai pro navegador antes do cadastro
    .on("section.step", { element: (e) => { if (etapa++ > 0) e.remove(); } })
    .on("form[data-mt-cadastro]", { element: (e) => { e.removeAttribute("hidden"); e.setAttribute("data-t", String(Date.now())); } })
    .transform(semCache(resposta, html));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const caminho = url.pathname;

    if (caminho === "/api/cadastro" && request.method === "POST") return cadastro(request, env, url);
    if (caminho === "/api/evento" && request.method === "POST") return evento(request, env, url);
    if (caminho.startsWith("/api/")) return json({ erro: "Endereço não encontrado." }, 404);

    const resposta = await env.ASSETS.fetch(request);
    if (resposta.status === 404) return Response.redirect(SITE, 302);
    const slug = (caminho.match(/^\/([a-z0-9-]+)\/$/) || [])[1];
    const ehHtml = (resposta.headers.get("content-type") || "").includes("text/html");
    if (!slug || slug === "assets" || resposta.status !== 200 || !ehHtml) return resposta;
    return material(request, env, ctx, slug, resposta);
  }
};
