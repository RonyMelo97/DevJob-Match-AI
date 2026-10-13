# Histórico de entregas

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
