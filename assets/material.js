/* Materiais (conteudos.kapota.com.br): uma etapa por vez, com Continuar e Voltar, a lista
   de etapas no topo (computador), o contador (celular), a barra de progresso e as setas do
   teclado. O endereço guarda a etapa (#3), então recarregar ou mandar o link abre nela. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const etapas = Array.from(document.querySelectorAll(".step"));
  if (!etapas.length) return;
  const nav = $("stepsNav"), barra = $("progressFill"), conta = $("mobCount"), rotulo = $("mobLabel");
  const voltar = $("btnBack"), seguir = $("btnNext"), seguirTexto = $("btnNextLabel"), palco = $("scroller"), meio = $("footerMid");
  const titulo = (i) => etapas[i].dataset.title || `Etapa ${i + 1}`;
  const doEndereco = () => {
    const n = parseInt(location.hash.slice(1), 10);
    return n >= 1 && n <= etapas.length ? n - 1 : 0;
  };

  let atual = doEndereco();
  let maisLonge = atual;

  const botoes = etapas.map((_, i) => {
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

  function mostra() {
    etapas.forEach((s, i) => s.classList.toggle("active", i === atual));
    botoes.forEach((b, i) => {
      b.classList.toggle("active", i === atual);
      b.disabled = i > maisLonge;
      if (i === atual) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    barra.style.width = `${((atual + 1) / etapas.length) * 100}%`;
    conta.textContent = `${atual + 1} de ${etapas.length}`;
    rotulo.textContent = titulo(atual);
    voltar.disabled = atual === 0;
    const ultima = atual === etapas.length - 1;
    seguirTexto.textContent = ultima ? "Ver de novo" : "Continuar";
    if (meio) meio.textContent = ultima ? "" : `A seguir: ${titulo(atual + 1)}`;
    palco.scrollTop = 0;
    if (nav.offsetParent) botoes[atual].scrollIntoView({ block: "nearest", inline: "nearest" });
    history.replaceState(null, "", atual ? `#${atual + 1}` : location.pathname + location.search);
  }

  function vai(i) {
    atual = Math.max(0, Math.min(etapas.length - 1, i));
    maisLonge = Math.max(maisLonge, atual);
    mostra();
  }

  seguir.addEventListener("click", () => vai(atual === etapas.length - 1 ? 0 : atual + 1));
  voltar.addEventListener("click", () => vai(atual - 1));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") vai(atual + 1);
    if (e.key === "ArrowLeft") vai(atual - 1);
  });
  window.addEventListener("hashchange", () => vai(doEndereco()));

  mostra();
})();
