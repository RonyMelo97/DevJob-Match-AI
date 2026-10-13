# DevJob Match AI

Rastreador de vagas Front-end com compatibilidade explicável. Versão atual: **0.3.0**, currículo e integração com fontes públicas de vagas. O cálculo de compatibilidade começa na próxima versão.

## Executar localmente

Requisitos: Node.js 24.x e npm 11.x.

```powershell
npm.cmd install
Copy-Item .env.example apps/api/.env
npm.cmd run dev
```

Abra http://localhost:5173. A API atende em http://127.0.0.1:3001/health. A configuração é opcional: os padrões permitem iniciar sem `.env`. Se alterar a porta da API, ajuste também o destino do proxy em `apps/web/vite.config.ts`. Se alterar a origem do frontend, atualize `CORS_ORIGIN`.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run start -w @devjob/api
```

O comando `start` requer build e deve ser executado com o servidor de desenvolvimento encerrado para evitar conflito de porta. O build web fica em `apps/web/dist`; o servidor de produção deverá encaminhar `/api` à API. Deploy está fora desta versão.

## Verificação manual

1. Execute `npm.cmd run dev` e confirme a mensagem de API conectada.
2. Pare o processo e execute apenas `npm.cmd run dev -w @devjob/web`. Recarregue: deve aparecer uma mensagem de falha e o botão de nova tentativa.
3. Inicie a API em outro terminal com `npm.cmd run dev -w @devjob/api` e clique em Tentar novamente.
4. Confira a tela em largura de 360px e navegue pelo teclado.
5. Para verificar configuração inválida, coloque temporariamente `PORT=0` em `apps/api/.env`: a API deve recusar iniciar com uma mensagem indicando PORT. Restaure o arquivo depois.

## Privacidade

Não adicione currículos reais, dados pessoais ou segredos ao Git. `.env`, PDFs, uploads e a pasta `private` são ignorados. Use dados sintéticos nos testes. O PDF é enviado somente à sua API local e descartado após extração. Não há chamadas a provedores de IA.

O perfil revisado é salvo em `private/resumes/profile.json` na raiz, incluindo apenas os campos editados e a data de confirmação. O texto bruto não é salvo. O arquivo usa as permissões do usuário do sistema: não é criptografado. Não há autenticação; mantenha `HOST=127.0.0.1` e não publique esta versão. Perfis são de usuário único, com uma instância da API. PostgreSQL e autenticação serão necessários antes de suporte público ou multiusuário.

## Currículo: upload e revisão

1. Selecione um PDF de até 5 MB e 20 páginas e clique em **Extrair e revisar**.
2. Consulte texto original e evidências das tecnologias sugeridas.
3. Corrija objetivo, resumo, experiências, formação, idiomas e habilidades.
4. Marque a confirmação de revisão e clique em **Salvar perfil revisado**.
5. Recarregue a página para confirmar persistência; use **Excluir perfil salvo** e a confirmação para remover o arquivo.

Um upload não substitui o perfil salvo. Apenas o salvamento confirmado faz isso. Rascunhos ficam na memória da página e podem ser descartados; atualizar a página os perde. Editar um campo exige confirmar novamente a revisão. PDFs protegidos por senha ou corrompidos são recusados; digitalizados sem texto precisam de OCR, que não está incluído. Limites adicionais: 100.000 caracteres, uma extração por vez e 15 segundos de processamento em processo separado com heap de 256 MB.

A extração reconhece títulos comuns em português e inglês. Tecnologias são menções com evidências e exigem revisão de negações/contexto. Datas, senioridade, proficiência e anos de experiência não são inferidos. Campos não reconhecidos ficam vazios para preenchimento manual. Textos com formatação complexa podem ter ordem alterada.

Rotas: `POST /resumes/extract` (multipart, campo resume), `GET /profile`, `PUT /profile` (profile + reviewed=true), `DELETE /profile`. Respostas privadas usam `Cache-Control: no-store`. Origens de navegador são restritas à configuração e ao equivalente local localhost/127.0.0.1.

## Fontes de vagas

Abra o painel **Vagas das fontes públicas** e clique em **Consultar fontes**. O servidor consulta a API pública Remotive, categoria software-dev, e os quadros Greenhouse configurados. Nenhum dado do currículo é enviado. GET `/jobs` apenas lê o cache; POST `/jobs/refresh` consulta fontes somente quando a janela de seis horas permite. Não há agendamento automático ainda.

Remotive é uma fonte pública sem chave para esta integração. Seus termos exigem atribuição e link original, atrasam os anúncios em 24 horas e recomendam até quatro consultas por dia: https://github.com/remotive-com/remote-jobs-api. Não há cobrança de API integrada; limites e termos do provedor continuam aplicáveis. Não usar este projeto para republicar anúncios em outros agregadores ou exigir cadastro para vê-los.

Para Greenhouse, configure `GREENHOUSE_BOARDS` em `apps/api/.env` com identificadores de quadros reais, separados por vírgula (até cinco). O identificador aparece no endereço do quadro de vagas da empresa; ele não é uma URL. Reinicie a API após alterar a configuração. A janela de cache continua válida; a nova lista entra na próxima consulta permitida. Lista e detalhes são GET públicos: https://docs.greenhouse.io/job-board.html. Cada quadro é limitado a 30 vagas relevantes e a um orçamento aproximado de 30 segundos para detalhes, com até 15 segundos por requisição. Quadros adicionais não representam busca global.

O cache local fica em `private/jobs/cache.json`. A tentativa é registrada antes da chamada externa, preservando a janela mesmo após falha ou reinicialização. Falha de uma fonte preserva seus anúncios anteriores e é exibida na tela; esses anúncios podem já ter sido encerrados, portanto confira o link original. Não exclua o cache para contornar limites. Rodar múltiplas instâncias não é suportado.

Os filtros usam cargo/descrição, senioridade, localização do candidato e publicação. Vagas explicitamente sênior são descartadas, assim como presenciais/híbridas fora da cidade de São Paulo. Modalidade desconhecida permanece desconhecida; vagas com elegibilidade incerta ficam sinalizadas para conferência. Restrições geográficas em linguagem livre podem exigir revisão humana. Não inferimos modalidade pela localização da empresa.

Só usamos `first_published` do detalhe Greenhouse para publicação, nunca `updated_at`. Na Remotive, publicação é a data na própria fonte, não necessariamente a primeira publicação em outra plataforma. Datas com fuso são comparadas aos últimos 168 horas; sem fuso, usamos o intervalo conservador do dia entre UTC+14 e UTC-12. Datas próximas ao limite, ausentes ou inválidas ficam na lista separada de recência não confirmada. A recência é reavaliada em cada leitura, mesmo usando cache.

Duplicatas são removidas por fonte/ID e URL normalizada, ignorando parâmetros de rastreamento. Anúncios em URLs diferentes podem representar a mesma vaga: não os mesclamos apenas por cargo/empresa, pois poderiam ser vagas distintas. Descrições são exibidas como texto, sem executar HTML ou instruções. Salário não informado permanece desconhecido; Greenhouse não extrai salário da descrição nesta etapa.

Validação manual: consulte uma vez, confira status das fontes e o horário da próxima janela; clique novamente e confirme que o horário não muda. Recarregue a página e verifique o cache. Confira atribuição, link original e seção de datas incertas. Resultados vazios são possíveis: nenhuma fonte garante cobertura completa.

## Organização e aprendizado

- `apps/web`: interface React e estilos CSS Modules.
- `apps/api`: servidor Fastify, configuração e rotas.
- `packages/contracts`: schema Zod e tipo da resposta de saúde.
- [Arquitetura](docs/architecture.md) e [roadmap](docs/roadmap.md).

O workspace reúne os projetos e permite scripts comuns. TypeScript verifica tipos durante desenvolvimento; Zod valida dados em execução. A função `buildApp` cria a API sem abrir porta, permitindo testar com `app.inject`. `server.ts` cuida da execução e encerramento. Não precisamos de services ou repositories para uma rota de saúde sem regras de negócio ou persistência.

## Git

Use `main` para entregas estáveis e `develop` para desenvolvimento. O primeiro snapshot reúne o código até a v0.3.0. As etapas anteriores estão documentadas, sem snapshots próprios. Veja o [changelog](CHANGELOG.md). Nas próximas entregas, valide `develop` e integre por PR ou merge revisado em `main`.

Commit do primeiro snapshot: `feat: establish v0.3.0 baseline`. O usuário autorizou publicar o projeto e suas próximas entregas no GitHub em 13/10/2026. Cada versão continua exigindo aprovação antes de iniciar a seguinte. Os registros das entregas anteriores preservam o estado do Git no momento em que foram escritos.

O workflow `.github/workflows/ci.yml` verifica instalação, lint, tipos, testes e build em pushes para main/develop e em pull requests. Resultados locais não confirmam execução do GitHub Actions; confira a aba Actions após publicar.
