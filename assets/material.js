/* Materiais (conteudos.kapota.com.br): uma etapa por vez, com Continuar e Voltar, a lista
   de etapas no topo (computador), o contador (celular), a barra de progresso e as setas do
   teclado. O endereço guarda a etapa (#3), então recarregar ou mandar o link abre nela.

   Cadastro: no ar, o Worker do conteudos manda <html data-mt-trancado> com só a primeira
   etapa e o formulário pra quem ainda não se cadastrou naquele aparelho, e <html data-mt-ar>
   com o material inteiro pra quem já se cadastrou (aí este script conta quem abriu e quem
   chegou ao fim). No mock (design system), ?trancado simula a tela de cadastro e o envio. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const raiz = document.documentElement;
  const NO_AR = raiz.hasAttribute("data-mt-ar") || raiz.hasAttribute("data-mt-trancado");
  const form = document.querySelector("[data-mt-cadastro]");
  const material = location.pathname.split("/").filter(Boolean)[0] || "modelo";
  const tituloMaterial = document.title.replace(/ · Klysman Kley$/, "");

  if (!NO_AR && form && new URLSearchParams(location.search).has("trancado")) raiz.setAttribute("data-mt-trancado", "");
  const trancado = () => raiz.hasAttribute("data-mt-trancado");
  if (form && !trancado()) form.remove();

  const etapas = () => Array.from(document.querySelectorAll(".step"));
  if (!etapas().length) return;
  const nav = $("stepsNav"), barra = $("progressFill"), conta = $("mobCount"), rotulo = $("mobLabel");
  const voltar = $("btnBack"), seguir = $("btnNext"), seguirTexto = $("btnNextLabel"), palco = $("scroller"), meio = $("footerMid");

  /* ---------- Contagem: abriu e chegou ao fim (só no ar, já cadastrado) ---------- */
  const contados = new Set();
  function conta_(tipo) {
    if (!raiz.hasAttribute("data-mt-ar") || contados.has(tipo)) return;
    contados.add(tipo);
    const corpo = JSON.stringify({ material, titulo: tituloMaterial, tipo });
    try {
      if (!navigator.sendBeacon || !navigator.sendBeacon("/api/evento", new Blob([corpo], { type: "application/json" }))) {
        fetch("/api/evento", { method: "POST", headers: { "content-type": "application/json" }, body: corpo, keepalive: true }).catch(() => {});
      }
    } catch (e) { /* contagem nunca atrapalha a leitura */ }
  }

  /* ---------- Navegação entre etapas ---------- */
  let botoes = [];
  let atual = 0, maisLonge = 0;
  const titulo = (i) => etapas()[i].dataset.title || `Etapa ${i + 1}`;
  const doEndereco = () => {
    const n = parseInt(location.hash.slice(1), 10);
    return n >= 1 && n <= etapas().length ? n - 1 : 0;
  };

  function montaNav() {
    nav.textContent = "";
    botoes = etapas().map((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      // no topo só a etapa atual mostra o nome; as outras ficam no número (nome no title)
      b.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t"></span>`;
      b.lastChild.textContent = titulo(i);
      b.title = titulo(i);
      b.addEventListener("click", () => { if (i <= maisLonge) vai(i); });
      nav.appendChild(b);
      return b;
    });
  }

  function mostra() {
    const lista = etapas();
    lista.forEach((s, i) => s.classList.toggle("active", i === atual));
    botoes.forEach((b, i) => {
      b.classList.toggle("active", i === atual);
      b.disabled = i > maisLonge;
      if (i === atual) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    barra.style.width = `${((atual + 1) / lista.length) * 100}%`;
    conta.textContent = `${atual + 1} de ${lista.length}`;
    rotulo.textContent = titulo(atual);
    voltar.disabled = atual === 0;
    const ultima = atual === lista.length - 1;
    seguirTexto.textContent = ultima ? "Ver de novo" : "Continuar";
    if (meio) meio.textContent = ultima ? "" : `A seguir: ${titulo(atual + 1)}`;
    palco.scrollTop = 0;
    if (nav.offsetParent && botoes[atual]) botoes[atual].scrollIntoView({ block: "nearest", inline: "nearest" });
    if (!trancado()) history.replaceState(null, "", atual ? `#${atual + 1}` : location.pathname + location.search);
    if (ultima && lista.length > 1) conta_("fim");
  }

  function vai(i) {
    if (trancado()) return;
    atual = Math.max(0, Math.min(etapas().length - 1, i));
    maisLonge = Math.max(maisLonge, atual);
    mostra();
  }

  seguir.addEventListener("click", () => vai(atual === etapas().length - 1 ? 0 : atual + 1));
  voltar.addEventListener("click", () => vai(atual - 1));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") vai(atual + 1);
    if (e.key === "ArrowLeft") vai(atual - 1);
  });
  window.addEventListener("hashchange", () => vai(doEndereco()));

  /* ---------- Cadastro ---------- */
  const soDigitos = (v) => v.replace(/\D/g, "");
  function mascara(v) {
    let d = soDigitos(v);
    if (d.startsWith("55") && d.length > 11) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function preparaCadastro() {
    form.hidden = false;
    const erro = form.querySelector("[data-mt-erro]");
    const campo = (nome) => form.elements[nome];
    const zap = campo("whatsapp");
    zap.addEventListener("input", () => { zap.value = mascara(zap.value); });

    function falha(msg, nome) {
      erro.textContent = msg;
      form.querySelectorAll("input").forEach((i) => i.removeAttribute("aria-invalid"));
      if (nome) { campo(nome).setAttribute("aria-invalid", "true"); campo(nome).focus(); }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = {
        nome: campo("nome").value.trim(),
        email: campo("email").value.trim(),
        whatsapp: zap.value.trim(),
        newsletter: campo("newsletter").checked,
        site: campo("site").value,
        material,
        titulo: tituloMaterial,
        t: Number(form.dataset.t) || null
      };
      if (dados.nome.length < 2) return falha("Escreve seu nome, com pelo menos 2 letras.", "nome");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return falha("Confere o email.", "email");
      const d = soDigitos(dados.whatsapp);
      if (d.length < 10 || d.length > 13) return falha("Confere o WhatsApp, com DDD.", "whatsapp");
      falha("");
      form.classList.add("is-ocupado");

      if (!NO_AR) {
        // mock: simula a resposta do Worker e libera o material na própria página
        await new Promise((r) => setTimeout(r, 700));
        raiz.removeAttribute("data-mt-trancado");
        form.remove();
        etapas().forEach((s) => s.classList.remove("active"));
        montaNav();
        vai(0);
        return;
      }
      try {
        const r = await fetch("/api/cadastro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(dados) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.erro || "Não deu pra liberar agora. Tenta de novo em instantes.");
        location.reload();
      } catch (err) {
        form.classList.remove("is-ocupado");
        falha(err.message || "Não deu pra liberar agora. Tenta de novo em instantes.");
      }
    });
  }

  /* ---------- Começo ---------- */
  if (trancado()) {
    preparaCadastro();
    etapas().forEach((s, i) => s.classList.toggle("active", i === 0));
    return;
  }
  montaNav();
  atual = doEndereco();
  maisLonge = atual;
  conta_("abriu");
  mostra();
})();
