# Roadmap

Cada versão exige aprovação antes de iniciar a seguinte. Cada entrega documentará arquivos, decisões, validação e commit sugerido.

| Versão | Objetivo e tarefas | Aceite e testes | Commit sugerido |
| --- | --- | --- | --- |
| 0.1.0 | Workspaces, React, API, contrato, configuração e documentação | Tela consulta API; health 200; configuração inválida recusada; lint, tipos, testes e build passam | chore: initialize project structure |
| 0.2.0 | Upload privado, extração local e revisão do perfil | Limites e PDFs inválidos testados; nenhuma habilidade inventada; exclusão documentada | feat: add resume upload |
| 0.3.0 | Fontes, normalização, filtros e deduplicação | Respostas controladas, datas desconhecidas e elegibilidade testadas; limites documentados | feat: integrate job search provider |
| 0.4.0 | Score explicável com pesos configuráveis | Estados de requisitos, pesos e evidências testados; fórmula documentada | feat: implement job matching engine |
| 0.5.0 | LLM com JSON validado e controle de custo | Respostas inválidas, ausência de evidência e falhas testadas; custos e privacidade documentados | feat: add AI job analysis |
| 0.6.0 | Dashboard, filtros e detalhes | Fluxos, responsividade e acessibilidade verificados; uso documentado | feat: add job dashboard |
| 0.7.0 | Atualização incremental periódica e logs | Repetição, concorrência, limites e recuperação testados; operação documentada | feat: schedule job searches |
| 1.0.0 | MVP integrado e deploy aprovado | Fluxos ponta a ponta, privacidade e recuperação validados; instalação e operação documentadas | feat: release MVP |

## Aceite detalhado da v0.1.0

- Frontend e API iniciam com comandos documentados.
- Interface com carregamento, sucesso, falha e nova tentativa.
- GET /health responde 200 conforme contrato compartilhado.
- TypeScript strict e nenhum any explícito sem justificativa.
- Configuração inválida impede inicialização com mensagem útil.
- Lint, typecheck, testes e build aprovados.
- .gitignore e .env.example protegem dados pessoais e segredos.
- README explica arquitetura, execução, teste manual e Git.
- Nenhum currículo real usado em código ou testes.

Banco, upload, fontes reais, matching, IA, dashboard e agendamento ficam fora desta entrega.
