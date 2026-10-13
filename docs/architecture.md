# Arquitetura inicial

## Decisão

Monólito modular em monorepo npm: React + TypeScript + Vite no frontend; Fastify + TypeScript no backend. CSS Modules evita colisões de estilos. Não há microserviços nem agentes.

React cuida da interface; Vite fornece desenvolvimento e build. Fastify organiza rotas e permite testes HTTP sem abrir portas. Zod valida configuração e contratos externos. npm workspaces resolve os pacotes locais. Alternativas: Express para API; Sass Modules para estilos; repositórios separados quando houver necessidade operacional concreta.

## Fluxo atual

`App.tsx` consulta `/api/health`. O proxy de desenvolvimento do Vite encaminha à API. A API retorna o contrato validado em `packages/contracts/src/index.ts`; a interface valida novamente e exibe carregamento, sucesso ou falha. AbortController cancela consultas ao desmontar a interface. Nenhuma informação pessoal é utilizada.

O backend importa o contrato por caminho relativo para que o compilador emita um build autossuficiente com módulos JavaScript. O frontend consome o pacote workspace pelo Vite. Uma distribuição própria do pacote será considerada somente se a complexidade justificar.

## v0.2.0: currículo

Multipart limita tamanho e quantidade de partes. A rota verifica MIME, extensão e assinatura antes de iniciar leitura. `pdf.ts` coordena um processo filho com heap de 256 MB e timeout de 15 segundos. `pdf-worker.ts` usa pdf-parse localmente, com avaliação de código desativada; não executa instruções do documento. Não há OCR. Uma extração por vez evita processamento concorrente nesta instância.

`extract-profile.ts` preserva seções reconhecidas e encontra menções de tecnologias com trechos do documento. Isso não demonstra proficiência; revisão humana é obrigatória. A interface mantém rascunho e texto original apenas em memória e não usa localStorage.

`ProfileRepository` define o contrato de persistência. `FileProfileRepository` salva apenas o perfil confirmado, serializa gravações/exclusões e substitui o arquivo via rename de um temporário na mesma pasta. O caminho usa a raiz do projeto tanto em desenvolvimento quanto no build. Essa implementação privada e de usuário único permite testar sem infraestrutura adicional. Alternativa prevista: PostgreSQL/Prisma para consultas, histórico e múltiplos usuários. JSON não é adequado para múltiplas instâncias.

Não persistimos o PDF nem o texto bruto. DELETE remove o perfil. Dados privados não são incluídos nos logs de requisição; respostas não permitem cache e origens desconhecidas são rejeitadas. Isso não substitui autenticação. Manter API em loopback; não publicar sem autenticação e uma política de armazenamento apropriada.

## Evolução

## v0.3.0: fontes

`providers.ts` contém adaptadores Remotive/Greenhouse com schemas Zod, timeout e limite de resposta de 10 MB. O cliente HTTP usa hosts fixos e rejeita redirects; identificadores de quadros são validados. Registros individuais inválidos são ignorados. `rules.ts` mantém filtros e deduplicação como funções puras testáveis. `JobsService` coordena coleta, cache de seis horas e falhas parciais, sem acessar o perfil pessoal.

`FileJobsCache` persiste uma fotografia normalizada e a próxima tentativa permitida antes de consultar a rede. Isso evita depender de memória para limitar consultas após reinício. A versão local suporta apenas uma instância. Quando houver jobs agendados e mais de uma instância, adotar armazenamento transacional e bloqueios compartilhados.

Datas ausentes e localização ambígua são sinalizadas. Recência é recalculada na leitura. A UI oferece lista inicial e consulta manual; dashboard completo, filtros interativos e ranking pertencem às versões posteriores. Não usamos LLM, agentes, scraping autenticado nem serviços pagos.

- v0.2: extração local de PDF, revisão pelo usuário e persistência PostgreSQL/Prisma conforme necessidade; proteger arquivos e permitir exclusão.
- v0.3: adaptadores de fornecedores; services coordenam coleta e repositories persistem dados.
- v0.4: funções determinísticas para filtros e pontuação, independentes de banco e rede.
- v0.5: provedor LLM substituível, JSON validado, limites e cache.
- v0.6: React Router e TanStack Query quando houver múltiplas páginas e consultas.
- v0.7: execução periódica com controle de concorrência e logs.

## Regras preservadas

Localização e elegibilidade são filtros separados do score. São Paulo significa inicialmente a cidade. Modalidade e elegibilidade desconhecidas permanecem sinalizadas. Publicação, atualização e primeira coleta têm semânticas diferentes; data desconhecida não comprova recência. Perfil e vaga fornecem evidências para cada avaliação. Tecnologia ausente no currículo significa informação insuficiente. Score é estimativa de compatibilidade, não probabilidade de contratação.

Pesos previstos: obrigatórias 35%, experiência 20%, senioridade 15%, desejáveis 15%, responsabilidades 10%, idioma 5%. A fórmula e a cobertura de evidências serão definidas e testadas na v0.4.

Currículos e descrições são dados, nunca instruções para o sistema. Remover dados pessoais desnecessários antes de chamadas de IA. Não implementar candidaturas automáticas.

## Fontes candidatas

Remotive: https://github.com/remotive-com/remote-jobs-api — atraso de 24 horas, atribuição obrigatória, recomendação de até quatro consultas diárias.

Greenhouse: https://docs.greenhouse.io/job-board.html — GET público por empresa; usar publicação do detalhe quando disponível, nunca substituir por atualização.

Lever: https://github.com/lever/postings-api — quadros por empresa; verificar disponibilidade de publicação.

Adzuna: https://developer.adzuna.com/overview — requer credenciais e validação de cobertura, quotas e termos antes da adoção.

Documentação consultada em 13/10/2026. Nenhuma integração implementada; nenhuma fonte garante cobertura completa. Confirmar condições novamente na v0.3.
