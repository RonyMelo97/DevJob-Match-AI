# Compatibilidade explicável - motor 0.4.0

## Fórmula

Pesos padrão: obrigatórias 35%, experiência 20%, senioridade 15%, desejáveis 15%, responsabilidades 10%, idioma 5%. Pesos inteiros entre 0 e 100, somando exatamente 100. Zero desativa a contribuição de um critério.

Cada requisito identificado vale 1 quando atendido, 0,5 quando parcialmente atendido e 0 quando não atendido ou sem informação suficiente. Dentro de cada critério, calculamos a média desses valores e multiplicamos pelo peso. A soma das contribuições, arredondada a duas casas no resultado final, é o score entre 0 e 100.

Cobertura = soma dos pesos multiplicados pela proporção de requisitos avaliáveis identificados em cada critério. Met, partial e not_met são avaliáveis; insufficient não é. Essa cobertura não garante que o parser identificou todas as exigências da descrição. Cláusulas de requisitos/desejáveis sem padrão reconhecido ficam insuficientes. Não redistribuímos os pesos dos critérios desconhecidos, pois isso poderia transformar uma análise baseada apenas em React em um score alto com pesos padrão.

Quando nenhum critério com peso positivo tem evidência suficiente, score é null e a interface mostra que o resultado não é calculável. Isso é diferente de 0% com evidências explícitas de não atendimento. O percentual não é uma probabilidade de contratação; depende dos pesos e da extração limitada desta versão.

## Evidências e extração

- Títulos conhecidos em português/inglês separam requisitos, desejáveis e responsabilidades. Tecnologias fora dessas seções não são automaticamente promovidas a exigências.
- Dicionário inicial: React, TypeScript, JavaScript, HTML, CSS, SCSS, SASS, Next.js, Node.js, Git, Jest, Vitest, Testing Library, Cypress e Playwright. Não fazemos equivalências semânticas; React Native não equivale a React e GitHub não equivale a Git.
- Menções no perfil revisado sustentam tecnologias, sem comprovar proficiência. Estudo/conhecimento básico recebe partial. Negação explícita diretamente associada recebe not_met. Ausência recebe insufficient.
- Experiência usa apenas duração declarada em anos e o mesmo escopo de tecnologia na mesma frase/linha. Não somamos intervalos de datas, não transferimos anos de HTML para React e não tratamos estudo como experiência profissional. Faixas numéricas ficam desconhecidas. Duração positiva inferior à exigida recebe partial; zero declarado recebe not_met.
- Senioridade é lida do objetivo profissional revisado; não é inferida de anos. Sem declaração, insufficient. Uma senioridade declarada igual ou superior à exigida recebe met, inferior recebe partial. Esse critério é uma aproximação de nível, não previsão de seleção.
- Responsabilidades reconhecidas: interfaces responsivas, APIs, performance, acessibilidade e testes automatizados. Evidência vem do campo de experiência, não de uma tecnologia isolada.
- Idiomas iniciais: inglês/espanhol, com níveis explícitos básico, intermediário e avançado/fluente. Menção sem nível fica insuficiente. Não inferimos idioma pelo idioma em que o currículo foi escrito.

Cada item contém requisito, estado, trecho da vaga, trecho do perfil e explicação. Trechos são mantidos literalmente. Texto de currículo e vaga continua sendo dado; nenhuma instrução é executada. Regras de linguagem natural têm cobertura limitada e exigem revisão humana, especialmente textos complexos, comparações, negações e múltiplos idiomas na mesma frase.

## API e ranking

POST /matches aceita `{ "weights": { ... } }` ou `{}` para padrões. Usa perfil confirmado e vagas já em cache, sem chamadas externas. Perfil ausente retorna 409, pesos inválidos 400. Não persiste análises nem envia dados para IA.

Ranking decrescente por score, seguido de cobertura e ID como desempate determinístico. Sem score fica ao final. Datas incertas permanecem em grupo separado. Localização, elegibilidade, salário e data não concedem pontos técnicos. Os filtros da v0.3 se aplicam antes da análise.

Na interface, confirmar alteração/exclusão do perfil, editar pesos ou atualizar fontes invalida o resultado anterior. Cálculos ficam vinculados à data do perfil salvo. Recalcular para usar mudanças; não há sincronização de resultados entre abas nesta versão.
