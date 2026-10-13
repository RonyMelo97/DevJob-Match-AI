# Histórico de entregas

## Após 1.0.0 — descoberta de vagas no Brasil

- Buscas externas para LinkedIn, Indeed, Gupy, InfoJobs, Vagas.com e Catho, sem apresentar atalhos como coleta automática.
- Pesquisa pontual de anúncios com datas/disponibilidade não confirmadas sinalizadas.
- Comparação privada da descrição colada com o perfil revisado, pelo motor existente.
- Relevância inclui WordPress e programador web, sem aceitar PHP backend genérico.


## Após 1.0.0 — busca aberta

- Opção para exibir anúncios reais fora dos critérios, com data, senioridade e motivos de exclusão preservados.
- API e exportação pública incluem anúncios descartados para diagnóstico, sem antecipar coleta.


## 1.0.0 - 2026-10-13

- MVP no GitHub Pages, com publicação e coleta agendada pelo Actions.
- PDF e perfil processados na memória do navegador; score usa o mesmo motor por regras.
- Perfil público descartado ao recarregar, sem envio a terceiros.
- API pessoal restrita a loopback; IA opcional exclusiva do modo local.
- Testes de privacidade do adaptador, recência no cliente e configuração de host.

Detalhes: [entrega 1.0.0](docs/releases/v1.0.0.md).

## 0.7.0 - 2026-10-13

- Agendamento no backend com janela persistida de seis horas.
- Pausa/retomada, status e histórico limitado a 20 rodadas.
- Contagens de mudanças entre snapshots e recuperação de execuções interrompidas.
- Concorrência compartilhada com consulta manual, parada limpa e falhas parciais.
- Nenhuma análise automática de IA ou candidatura.

Detalhes: [entrega 0.7.0](docs/releases/v0.7.0.md).

## 0.6.0 - 2026-10-13

- Dashboard com indicadores e atalhos para oportunidades/perfil.
- Filtros locais combinados e ordenação por publicação, empresa, score ou cobertura.
- Paginação independente de vagas recentes e datas incertas.
- Estados de carregamento, erro, vazio e ausência de correspondência.
- Testes de frontend incorporados ao comando raiz e ao CI.

Detalhes: [entrega 0.6.0](docs/releases/v0.6.0.md).

## 0.5.0 - 2026-10-13

- IA opcional e desativada por padrão; busca e score continuam independentes.
- Adaptador OpenAI com saída estruturada e evidências literais do texto público da vaga.
- Prévia e confirmação antes do envio, sem currículo ou perfil no payload.
- Cache, orçamento persistente, limite por chamada e ausência de retries automáticos.
- Testes com respostas simuladas; validação real depende de chave local.

Detalhes: [entrega 0.5.0](docs/releases/v0.5.0.md).

## 0.4.0 - 2026-10-13

- Motor determinístico com seis critérios, pesos configuráveis, score e cobertura.
- Estados atendido, parcial, não atendido e informação insuficiente com evidências.
- Ranking técnico sem pontuar localização, elegibilidade, data ou salário.
- API de análise sobre o perfil revisado e vagas em cache, sem chamadas externas.
- Interface de configuração, explicações e invalidação após alterações.

Detalhes: [fórmula](docs/matching.md) e [entrega 0.4.0](docs/releases/v0.4.0.md).

## 0.3.0 - 2026-10-13

Primeiro snapshot versionado: reúne o código das etapas 0.1.0, 0.2.0 e 0.3.0. As etapas anteriores foram implementadas e documentadas antes do primeiro commit, por isso não possuem snapshots ou tags próprios.

- Integrações públicas Remotive e Greenhouse.
- Filtros de recência, localização e senioridade.
- Deduplicação e cache persistente de seis horas.
- Lista inicial com links originais, fontes e informações desconhecidas.
- 32 testes e checks de lint, tipos e build.

Detalhes: [entrega 0.3.0](docs/releases/v0.3.0.md).

## Etapas anteriores incluídas no primeiro snapshot

- **0.2.0:** upload privado, extração local de PDF, revisão e persistência do perfil. [Registro](docs/releases/v0.2.0.md).
- **0.1.0:** monorepo, React, Fastify, TypeScript, contrato de saúde e configuração. [Registro](docs/releases/v0.1.0.md).

## Próximas entregas

Cada versão aprovada terá commit Conventional Commits, registro de entrega e publicação no GitHub conforme autorização do usuário. main representa a entrega estável e develop o trabalho em andamento. Não publicar dados privados nem criar tags de versões sem um snapshot correspondente.
