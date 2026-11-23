# CONADIBE | Painel de pendências cadastrais

## Entregas

- `painel-secretarios.html` — novo painel responsivo e independente, sem login; cards por campo; filtros nome/campo/ministério/igreja/status; detalhe individual; exportação CSV (UTF-8, separado por `;`) e Excel `.xlsx` verdadeiro, sem dependência de biblioteca de planilha.
- `PainelPendencias.gs` — Apps Script para **ler a base original**, não expor os valores sensíveis e inicializar as novas colunas `ID PENDENCIA`, `STATUS PENDENCIA`, `PROTOCOLO PENDENCIA`, `DATA ENVIO PENDENCIA`.
- `solicitacoes.html` — formulário existente preservado, acrescido de referência opcional do registro no link e nos dois envios JSON de criar/finalizar solicitação.
- `INTEGRACAO_BACKEND.md` — instruções para integração do script de solicitações já existente com o script de pendências.

> ATENÇÃO: a conexão da sessão atual à planilha Google retornou 403 (sem permissão). O mapeamento dos cabeçalhos precisa ser confirmado antes da publicação. Sem `PAINEL_API_URL`, o HTML mostra **dados inventados e identificados como demonstração**.

## Instalação em 7 passos

1. Acesse a planilha `https://docs.google.com/spreadsheets/d/1ZKFgO6vmWuiLzTi0knMJt3eekdhOaxbGnbfQqjxIr5o/edit?gid=0#gid=0` com uma conta que possua permissão de edição.
2. Confira os cabeçalhos da aba de `gid=0`, em especial as colunas para Campo/Setor, Nome completo, Nomeação/Cargo, Naturalidade, Data nascimento, Filiação, RG, CPF, Igreja de nomeação e Data final liderança. Ajuste as listas `PAINEL_CONFIG.campos` dentro de `PainelPendencias.gs` aos títulos reais. Fotos e consagração também serão auditadas **se as colunas correspondentes existirem**. Dados de foto existentes não atestam fundo branco; isso deve ser conferido manualmente.
3. Crie um **projeto separado** em `script.google.com` e cole o conteúdo de `PainelPendencias.gs`. Em **Configurações do projeto > Propriedades do script**, adicione `CONADIBE_PANEL_TOKEN` com uma sequência secreta forte de pelo menos 32 caracteres. Nunca publique esse token no HTML. Configure o Apps Script com conta autorizada a editar a planilha.
4. Em **Implantar > Nova implantação > Aplicativo da Web**, escolha **Executar como: eu** e **Quem pode acessar: qualquer pessoa** (a página sem login exige endpoint de leitura público). Copie a URL `/exec` resultante. A primeira leitura inicializa os IDs/status nas linhas ativas incompletas. A URL é **pública**: só exponha os campos mínimos definidos no script.
5. No início do `<script>` de `painel-secretarios.html`, preencha `PAINEL_API_URL = 'https://script.google.com/macros/s/.../exec'` com a URL real. Publique esse arquivo no mesmo repositório GitHub Pages da Secretaria (`/secretaria/painel-secretarios.html`). Ao preencher a URL, o painel não cai mais para dados simulados caso haja erro.
6. Publique o `solicitacoes.html` alterado no mesmo repositório, preservando a URL original do Apps Script que ele já utiliza. O formulário continua funcionando mesmo sem origem no painel.
7. Siga `INTEGRACAO_BACKEND.md` para implementar, no Apps Script EXISTENTE de solicitações, o armazenamento de `pendenciaId` e a comunicação **servidor para servidor** após `finalizarSolicitacao`. Configure no script existente `CONADIBE_PAINEL_URL` e a mesma `CONADIBE_PANEL_TOKEN`. Só então o status mudará para Enviado automaticamente.

## Regras usadas

1. Ignorar qualquer linha em que `DATA FINAL LIDERANÇA` está preenchida (históricos não entram).
2. Ministro pendente = pelo menos um campo obrigatório ausente, nome acima de 34 caracteres ou igreja de nomeação acima de 24 caracteres (quando a coluna é reconhecida).
3. Campos auditados: Nome completo; Nomeação/Cargo; Naturalidade; Nascimento; Nome do pai; Nome da mãe; RG; CPF; Igreja de nomeação. Consagração e foto são auditadas se houver colunas correspondentes. Campo/Setor vazio é sinalizado.
4. Uma pessoa com várias lideranças ativas no mesmo campo é contada uma vez se houver código Eklesia correspondente; na falta do código, usa combinação normalizada de nome/campo/ministério. Revise homônimos e duplicidades antes de emitir números oficiais.
5. `STATUS PENDENCIA`: Pendente / Enviado. Enviado indica recebimento, não validação/correção cadastral. Quem permanece incompleto continua contado até ser regularizado no Eklesia.
6. Visualização e exportação expõem somente `nome`, `campo`, `ministerio`, `igreja`, `pendencias` (nomes dos atributos faltantes), `status`, nunca os valores de CPF/RG/filiação.
7. A contagem dos cards e todas as exportações respeitam filtros e agrupamentos. O botão de ação leva ao formulário com `?pendencia=<UUID>`.

## Privacidade e segurança

**Sem login significa que o conteúdo é publicamente acessível.** Nomes + associação religiosa + pendências cadastrais podem constituir dados pessoais e, em contexto religioso, informações sensíveis. `noindex` apenas solicita a buscadores que não indexem — não cria segurança. Antes de divulgar, valide base legal, necessidade, transparência, retenção, acesso e orientação do encarregado pela LGPD. Idealmente use controle de acesso real para nomes e pendências; um link secreto não substitui autenticação. Se o projeto exigir estritamente nenhum login, faça avaliação formal de risco e compartilhe apenas o mínimo necessário.

A coluna `STATUS PENDENCIA` não é editável pelo navegador. Apenas chamadas com token mantido em propriedades do **servidor** podem registrá-la. O formulário e o script existente precisam assegurar que o protocolo realmente foi concluído. Não trate `Enviado` como dado confirmado.

## Testes mínimos antes de publicar

- 1 registro com todos os campos preenchidos não aparece.
- 1 registro com duas faltas conta como 1 ministro e exibe 2 etiquetas.
- 1 registro com DATA FINAL LIDERANÇA não aparece.
- 2 registros ativos com mesmo código e campo contam 1 ministro.
- Registros com mesmo nome e códigos distintos são analisados separadamente.
- Teste uma solicitação real e confirme que `STATUS PENDENCIA`, `PROTOCOLO PENDENCIA` e `DATA ENVIO PENDENCIA` mudam somente após a finalização.
- Confira os arquivos CSV e XLSX no Excel e a correção dos filtros.

## Importante

O ZIP contém os arquivos atuais (`index.html`, `dashboard.html`, imagens) preservados. **Não substitua** o `dashboard.html` atual pelo novo painel. O novo painel é um arquivo independente. Nenhum dado real foi alterado neste processo; Apps Script e GitHub não foram publicados automaticamente.
