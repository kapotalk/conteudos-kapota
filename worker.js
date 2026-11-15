// conteudos.kapota.com.br: só roda quando o endereço não é um material (os arquivos
// estáticos respondem antes). A página inicial e endereço errado vão pro site.
// 302 (temporário) pra poder virar uma página com os materiais no futuro.
export default {
  fetch() {
    return Response.redirect("https://kapota.com.br/", 302);
  },
};
