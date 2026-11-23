# Integração com o Apps Script de solicitações existente

O ZIP original continha apenas `solicitacoes.html`, não o código `.gs` que trata `criarSolicitacao`, `uploadAnexo` e `finalizarSolicitacao`. Por isso **não é possível marcar Enviado no banco real somente editando HTML**. O formulário já foi adaptado para enviar `pendenciaId` tanto em `criarSolicitacao` quanto em `finalizarSolicitacao`.

## Passo 1 — Persistir a referência de origem na solicitação

No Apps Script atual de solicitações, acrescente `pendenciaId` ao registro salvo pela ação `criarSolicitacao`, associando-o ao `protocolo` no servidor (não confiar em um ID avulso passado na finalização). Guarde esse valor em coluna própria da aba de solicitações, por exemplo `PENDENCIA_ID`. Só aceite string curta (UUID, até 60 caracteres). Para solicitações sem `pendenciaId`, mantenha fluxo original.

## Passo 2 — Atualizar somente após finalizar com sucesso

Dentro da implementação atual de `finalizarSolicitacao`, **após** confirmar que o protocolo foi concluído e que as informações/arquivos foram gravados, obtenha os valores `pendenciaId`, `nomeCompleto`, `campoSetor`, `ministerio` do registro de solicitação recuperado no SERVIDOR pelo protocolo, não do JSON enviado pela página, e execute:

```javascript
// Exemplo de chamada inserida dentro de finalizarSolicitacao, após sucesso.
// Utilize os campos reais do objeto `solicitacao` persistido no servidor.
if (solicitacao.pendenciaId) {
  const resultadoPainel = notificarPainelPendencias_({
    pendenciaId: solicitacao.pendenciaId,
    nomeCompleto: solicitacao.nomeCompleto,
    campoSetor: solicitacao.campoSetor,
    ministerio: solicitacao.ministerio,
    protocolo: solicitacao.protocolo
  });
  if (!resultadoPainel.ok) console.error('Painel não atualizado:', resultadoPainel.error);
}
```

Adicione a função auxiliar abaixo ao Apps Script ANTIGO de solicitações:

```javascript
function notificarPainelPendencias_(dados) {
  const url = PropertiesService.getScriptProperties().getProperty('CONADIBE_PAINEL_URL');
  const token = PropertiesService.getScriptProperties().getProperty('CONADIBE_PANEL_TOKEN');
  if (!url || !token) throw new Error('Integração com painel pendente de configuração');
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify(Object.assign({action:'registrarEnvio',token},dados))
  });
  return JSON.parse(res.getContentText());
}
```

Configure no Apps Script antigo as propriedades `CONADIBE_PAINEL_URL` com a URL `/exec` do painel novo e `CONADIBE_PANEL_TOKEN` com **o mesmo token aleatório e secreto** usado pelo Apps Script novo. **Não coloque o token no HTML, GitHub ou na planilha pública.**

## Comportamento e limites

- Não marcar Enviado ao clicar no link; apenas após `finalizarSolicitacao` concluído no backend.
- O backend valida ID, nome completo, campo, ministério, registro ativo e token; nomes e campos precisam coincidir com a base para vincular.
- O envio é um aviso administrativo, não comprova a veracidade dos dados. Não atualizar o CPF/RG do Eklesia automaticamente.
- Pessoas sem link de origem devem continuar podendo enviar solicitação pelo formulário original.
- O código original do backend de solicitações não foi fornecido; a chamada acima **precisa ser encaixada no fluxo real** e testada. Até lá, o envio continuará funcionando, mas o status no painel não mudará automaticamente.
- Como o painel não tem login e mostra nomes, um terceiro pode visualizar a referência e fazer solicitação com nomes conhecidos. Isso NÃO deve ser interpretado como atualização documental validada. Use revisão humana para a credencial.
