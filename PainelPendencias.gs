/**
 * CONADIBE — Painel de pendências para credenciais
 * Projeto Apps Script NOVO, separado do Apps Script de solicitações existente.
 * Publica exclusivamente: UUID opaco, nome, campo, ministério, igreja, rótulos das
 * pendências e status de envio. Nunca expõe CPF, RG, filiação ou documentos preenchidos.
 *
 * INSTALAÇÃO: atribua CONADIBE_PANEL_TOKEN em Configurações > Propriedades do script.
 * O token é usado APENAS em chamadas servidor-a-servidor feitas pelo outro Apps Script.
 */
const PAINEL_CONFIG = Object.freeze({
  planilhaId: '1ZKFgO6vmWuiLzTi0knMJt3eekdhOaxbGnbfQqjxIr5o',
  abaGid: 0,
  cabecalho: 1,
  // Confira estes aliases com os títulos REAIS das 20 colunas do Eklesia.
  campos: {
    nome: ['NOME COMPLETO','NOME','NOME DO MINISTRO','NOME PESSOA'],
    codigo: ['CODIGO PESSOA','CÓDIGO PESSOA','CODIGO','CÓDIGO','ID PESSOA','CÓDIGO MINISTRO'],
    campo: ['CAMPO','CAMPO SETOR','CAMPO / SETOR','CAMPO DE ATUACAO','CAMPO MINISTERIAL','HIERARQUIA REGIAO SETOR','REGIAO SETOR','REGIÃO/SETOR'],
    ministerio: ['MINISTERIO','MINISTÉRIO','MINISTERIO DE NOMEACAO','MINISTÉRIO DE NOMEAÇÃO','DENOMINACAO'],
    igreja: ['IGREJA','IGREJA ATUAL','CONGREGACAO','CONGREGAÇÃO','IGREJA VINCULADA','IGREJA DE NOMEACAO','MINISTERIO IGREJA DE NOMEACAO'],
    fim: ['DATA FINAL LIDERANÇA','DATA FINAL LIDERANCA','DATA FIM LIDERANCA','DATA TERMINO LIDERANCA'],
    nomeacao: ['NOMEACAO','NOMEAÇÃO','CARGO','CARGO DE NOMEACAO','CARGO MINISTERIAL','FUNCAO MINISTERIAL'],
    naturalidade: ['NATURALIDADE','CIDADE NATURALIDADE','NATURALIDADE CIDADE'],
    nascimento: ['DATA NASCIMENTO','DATA DE NASCIMENTO','NASCIMENTO'],
    pai: ['NOME PAI','NOME DO PAI','PAI','FILIACAO PAI','FILIAÇÃO PAI'],
    mae: ['NOME MAE','NOME DA MAE','MÃE','FILIACAO MAE','FILIAÇÃO MÃE'],
    rg: ['RG','NUMERO RG','NÚMERO RG','REGISTRO GERAL'],
    cpf: ['CPF','NUMERO CPF','NÚMERO CPF'],
    igrejaNomeacao: ['MINISTERIO IGREJA DE NOMEACAO','IGREJA DE NOMEACAO','IGREJA NOMEAÇÃO','IGREJA NOMEACAO','IGREJA DE ORIGEM'],
    consagracao: ['DATA DA CONSAGRACAO','DATA DA CONSAGRAÇÃO','DATA ULTIMA CONSAGRACAO','DATA ÚLTIMA CONSAGRAÇÃO','ULTIMA CONSAGRACAO'],
    foto: ['FOTO','FOTO 3X4','FOTO PERFIL','LINK FOTO','FOTO MINISTRO']
  },
  // Campos essenciais: o Apps Script só audita os que forem localizados nos cabeçalhos,
  // mas ABORTA o processamento se qualquer um dos 9 campos básicos abaixo não existir.
  obrigatoriosEstruturais: ['nome','fim','nomeacao','naturalidade','nascimento','pai','mae','rg','cpf','igrejaNomeacao'],
  rotulos: {nome:'Nome completo',nomeacao:'Nomeação / cargo',naturalidade:'Naturalidade',nascimento:'Data de nascimento',pai:'Nome do pai',mae:'Nome da mãe',rg:'RG',cpf:'CPF',igrejaNomeacao:'Igreja de nomeação',consagracao:'Data da última consagração',foto:'Foto 3×4',campo:'Campo/Setor'}
});
const ID_COL = 'ID PENDENCIA', STATUS_COL = 'STATUS PENDENCIA';
const PROTOCOLO_COL = 'PROTOCOLO PENDENCIA', DATA_COL = 'DATA ENVIO PENDENCIA';
function normal_(v) { return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/gi,' ').trim().toUpperCase(); }
function vazio_(v) { return v===null||v===undefined||String(v).trim()===''; }
function abrirBase_() {
  const book=SpreadsheetApp.openById(PAINEL_CONFIG.planilhaId);
  const sh=book.getSheetById(PAINEL_CONFIG.abaGid);
  if(!sh) throw new Error('Aba de gid 0 não encontrada. Revise abaGid.');
  return sh;
}
function indices_(cabecalho) {
  const norm=cabecalho.map(normal_), resultado={};
  Object.entries(PAINEL_CONFIG.campos).forEach(([chave,nomes])=>{
    const arr=nomes.map(normal_);let pos=norm.findIndex(h=>arr.includes(h));
    resultado[chave]=pos;
  });
  const faltam=PAINEL_CONFIG.obrigatoriosEstruturais.filter(chave=>resultado[chave]<0);
  if(faltam.length) throw new Error('Mapeamento pendente: '+faltam.join(', ')+'. Confira os títulos da planilha e PAINEL_CONFIG.campos.');
  if(resultado.campo<0) throw new Error('Coluna CAMPO / SETOR não localizada. Configure um alias para agrupar por campo.');
  return resultado;
}
function colunasAuxiliares_(sh) {
  const head=sh.getRange(PAINEL_CONFIG.cabecalho,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const wanted=[ID_COL,STATUS_COL,PROTOCOLO_COL,DATA_COL];const map={};let cursor=head.length;
  wanted.forEach(nome=>{let pos=head.findIndex(h=>normal_(h)===normal_(nome));if(pos<0){pos=cursor++;sh.getRange(PAINEL_CONFIG.cabecalho,pos+1).setValue(nome)}map[nome]=pos});
  return map;
}
function auditar_(){
  const sh=abrirBase_(),lock=LockService.getScriptLock();
  if(!lock.tryLock(20000)) throw new Error('Planilha em atualização. Tente novamente.');
  try {
    const aux=colunasAuxiliares_(sh), vals=sh.getDataRange().getValues(), idx=indices_(vals[PAINEL_CONFIG.cabecalho-1]);
    const ativos=[],headerEnd=PAINEL_CONFIG.cabecalho, minCols=Math.max(...Object.values(aux))+1;
    // Cada registro ativo recebe ID único estável. O status inicial é Pendente.
    let mudancasId=[],mudancasStatus=[];
    for(let n=headerEnd;n<vals.length;n++){
      const row=vals[n];if(row.every(v=>vazio_(v)))continue;
      if(!vazio_(row[idx.fim]))continue; // histórico: NUNCA somar linha com DATA FINAL LIDERANÇA
      const faltas=[];
      for(const chave of ['nome','nomeacao','naturalidade','nascimento','pai','mae','rg','cpf','igrejaNomeacao','consagracao','foto']){
        if(idx[chave]<0)continue;
        const valor=row[idx[chave]];
        if(vazio_(valor)) faltas.push(PAINEL_CONFIG.rotulos[chave]);
        else if(chave==='nome'&&String(valor).trim().length>34) faltas.push('Nome acima de 34 caracteres');
        else if(chave==='igrejaNomeacao'&&String(valor).trim().length>24) faltas.push('Igreja acima de 24 caracteres');
      }
      if(vazio_(row[idx.campo]))faltas.push(PAINEL_CONFIG.rotulos.campo);
      // O fundo branco da foto não pode ser validado automaticamente por coluna de link.
      if(!faltas.length)continue;
      let id=String(row[aux[ID_COL]]||'').trim();if(!id){id=Utilities.getUuid();mudancasId.push([n+1,id]);}
      let status=String(row[aux[STATUS_COL]]||'').trim();if(status!=='Enviado'&&status!=='Pendente') {status='Pendente';mudancasStatus.push([n+1,status]);}
      const nome=String(row[idx.nome]||'').trim()||'Nome não informado (registro '+(n+1)+')';
      const campo=String(row[idx.campo]||'').trim()||'Campo não informado';
      const ministerio=idx.ministerio>=0 ? String(row[idx.ministerio]||'').trim()||'Ministério não informado' : 'Ministério não informado';
      const igreja=idx.igreja>=0 ? String(row[idx.igreja]||'').trim()||'Igreja não informada' : String(row[idx.igrejaNomeacao]||'').trim()||'Igreja não informada';
      const codigo=idx.codigo>=0?String(row[idx.codigo]||'').trim():'';
      // Mesmo código no mesmo campo = um ministro, preservando múltiplos registros ativos.
      const dedup=codigo?('C:'+normal_(codigo)+'|'+normal_(campo)):('N:'+normal_(nome)+'|'+normal_(campo)+'|'+normal_(ministerio));
      ativos.push({id,nome,campo,ministerio,igreja,pendencias:faltas,status,dedup});
    }
    // setValue somente nas células novas evita sobrescrever dados/status existentes.
    mudancasId.forEach(([linha,id])=>sh.getRange(linha,aux[ID_COL]+1).setValue(id));
    mudancasStatus.forEach(([linha,status])=>sh.getRange(linha,aux[STATUS_COL]+1).setValue(status));
    const grupos=new Map();ativos.forEach(r=>{
      if(!grupos.has(r.dedup)) grupos.set(r.dedup,{id:r.id,nome:r.nome,campo:r.campo,ministerio:r.ministerio,igreja:r.igreja,pendencias:[],status:r.status});
      const g=grupos.get(r.dedup);r.pendencias.forEach(p=>{if(!g.pendencias.includes(p))g.pendencias.push(p)});
      if(r.status==='Enviado')g.status='Enviado';
    });
    return [...grupos.values()];
  } finally {lock.releaseLock();}
}
function respostaJSON_(obj,callback){
  const body=JSON.stringify(obj);
  if(callback){if(!/^cbConadibe_[A-Za-z0-9_]{1,60}$/.test(callback))return ContentService.createTextOutput('Callback inválido');
    return ContentService.createTextOutput(callback+'('+body+');').setMimeType(ContentService.MimeType.JAVASCRIPT);}
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
  const action=String(e?.parameter?.action||''),cb=String(e?.parameter?.callback||'');
  if(action!=='pendenciasPublicas')return respostaJSON_({ok:false,error:'Ação não reconhecida'},cb);
  try{return respostaJSON_({ok:true,items:auditar_()},cb)}
  catch(err){console.error(err);return respostaJSON_({ok:false,error:String(err.message||err)},cb)}
}
// Somente Apps Script de solicitações chama esta função via POST com token em PROPRIEDADES DO SCRIPT.
// É vedado marcar Enviado diretamente por botões do navegador/GET.
function doPost(e){
  let b;try{b=JSON.parse(e.postData.contents)}catch(_){return respostaJSON_({ok:false,error:'JSON inválido'})}
  if(b.action!=='registrarEnvio')return respostaJSON_({ok:false,error:'Ação inválida'});
  const expected=PropertiesService.getScriptProperties().getProperty('CONADIBE_PANEL_TOKEN');
  if(!expected||typeof b.token!=='string'||b.token!==expected)return respostaJSON_({ok:false,error:'Não autorizado'});
  try{return respostaJSON_(marcarEnviado_(b))}catch(err){console.error(err);return respostaJSON_({ok:false,error:String(err.message||err)})}
}
function marcarEnviado_(b){
  if(!b.pendenciaId||!b.nomeCompleto||!b.protocolo||!b.campoSetor||!b.ministerio)return {ok:false,error:'Faltam dados para vincular protocolo'};
  const sh=abrirBase_(),lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const aux=colunasAuxiliares_(sh),v=sh.getDataRange().getValues(),idx=indices_(v[0]);
    let target=null;
    for(let i=1;i<v.length;i++){
      if(String(v[i][aux[ID_COL]]||'')!==String(b.pendenciaId))continue;
      if(!vazio_(v[i][idx.fim]))return {ok:false,error:'Registro histórico / inativo'};
      if(normal_(v[i][idx.nome])!==normal_(b.nomeCompleto))return {ok:false,error:'Nome não corresponde ao cadastro'};
      if(normal_(v[i][idx.campo])!==normal_(b.campoSetor))return {ok:false,error:'Campo não corresponde ao cadastro'};
      if(idx.ministerio>=0&&normal_(v[i][idx.ministerio])!==normal_(b.ministerio))return {ok:false,error:'Ministério não corresponde ao cadastro'};
      target={index:i,row:v[i]};break;
    }
    if(!target)return {ok:false,error:'Referência de pendência não encontrada'};
    // Marcar também outros vínculos ativos do mesmo ministro (pelo código Eklesia, se houver).
    const code=idx.codigo>=0?String(target.row[idx.codigo]||'').trim():'';
    let atualizadas=0;
    for(let i=1;i<v.length;i++){
      const r=v[i];if(!vazio_(r[idx.fim]))continue;
      const match=code&&idx.codigo>=0?normal_(r[idx.codigo])===normal_(code)&&normal_(r[idx.campo])===normal_(b.campoSetor):normal_(r[idx.nome])===normal_(b.nomeCompleto)&&normal_(r[idx.campo])===normal_(b.campoSetor)&& (idx.ministerio<0||normal_(r[idx.ministerio])===normal_(b.ministerio));
      if(!match)continue;
      sh.getRange(i+1,aux[STATUS_COL]+1).setValue('Enviado');
      sh.getRange(i+1,aux[PROTOCOLO_COL]+1).setValue(String(b.protocolo));
      sh.getRange(i+1,aux[DATA_COL]+1).setValue(new Date());atualizadas++;
    }
    return {ok:true,atualizadas};
  }finally{lock.releaseLock()}
}
