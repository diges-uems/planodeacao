// =========================================================================
// BACKEND DEFINITIVO - ABAS POR ANO E TABELAS POR CURSO (ATUALIZADO)
// COM NOTIFICAÇÕES POR E-MAIL ENRIQUECIDAS E TEMPLATE CORPORATIVO
// =========================================================================

/**
 * =========================================================================
 * MANUAL DO SISTEMA - PLANO DE AÇÃO UEMS (BACKEND)
 * =========================================================================
 * 
 * O QUE É O SISTEMA: 
 * App de coleta de fragilidades e planos de ação (ENADE/avaliação institucional)
 * dos cursos da UEMS, com frontend React (repositório separado) e backend nesta 
 * planilha Google Sheets via Apps Script (Web App).
 * 
 * ESTRUTURA DE ABAS:
 * - CONFIG: Guarda a senha mestre da PROE.
 * - CURSOS: Guarda o login dos coordenadores (hash | courseId | courseName | Email | Liberado).
 * - CURSOS_EMAIL: Cadastro de e-mail por curso (usado para encontrar o e-mail quando o usuário não logou).
 * - CONFIG_PRAZOS: Prazos internos definidos pela PROE por unidade universitária.
 * - ABAS POR ANO (ex: 2026, 2027): Dados de fragilidades consolidados. Cada aba contém uma "tabela" separada por curso.
 * - Atualizações e Exclusões: Abas de auditoria que registram mudanças feitas após o envio original.
 * 
 * FLUXO DE AUTENTICAÇÃO:
 * - Senha mestre -> Acesso total à PROE (role: 'reitoria').
 * - Hash Base64 da senha individual -> Acesso restrito ao coordenador do curso correspondente (role: 'coordenador').
 * 
 * FLUXO DE LIBERAÇÃO DE EDIÇÃO:
 * - Um coordenador só pode editar/excluir um registro já enviado se a coluna "Liberado" da aba CURSOS estiver como "SIM".
 * - Isso é feito manualmente pela equipe da PROE diretamente na planilha, após o coordenador solicitar a alteração por e-mail (enade@uems.br).
 * 
 * SISTEMA DE E-MAILS:
 * - O e-mail enade@uems.br recebe todas as notificações.
 * - O e-mail do curso também recebe a notificação se a variável NOTIFICACOES_POR_CURSO_ATIVAS for verdadeira (true) e tiver e-mail cadastrado.
 * 
 * BUG HISTÓRICO CONHECIDO E CORRIGIDO:
 * - O Google Sheets convertia automaticamente strings de data (ex: "dd/MM/yyyy") em objetos Date, o que gerava strings ISO com 
 *   deslocamento de fuso horário. Por isso existe a função `formatarDataSegura()` e as colunas de data usam `setNumberFormat("@")` 
 *   para forçar o formato como texto.
 * 
 * COMO FAZER DEPLOY:
 * - ATENÇÃO: É obrigatório criar uma Nova Implantação ("Gerenciar implantações" -> Editar -> Nova versão) toda vez que o código 
 *   aqui for alterado! Caso contrário, o frontend continuará consumindo a versão antiga do Web App.
 * 
 * Desenvolvido por Bruno Lopes, DIND/PROE — 2026. 
 * Ver HANDOVER.md no repositório do frontend para mais detalhes.
 * =========================================================================
 */

var NOTIFICACOES_POR_CURSO_ATIVAS = false; // true = envia e-mail individual para cada curso; false = só a PROE recebe

/**
 * Converte objetos Date do Google Sheets de volta para string legível,
 * mitigando bugs de conversão de fuso horário.
 */
function formatarDataSegura(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, "GMT-04:00", "dd/MM/yyyy");
  }
  return valor;
}

/**
 * Lida com requisições HTTP GET.
 * Utilizado para a funcionalidade de buscar prazos internos (CONFIG_PRAZOS).
 * Retorna JSON com os prazos definidos pela PROE.
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (e && e.parameter && e.parameter.action === 'get_deadlines') {
    var sheet = ss.getSheetByName('CONFIG_PRAZOS');
    var deadlines = {};
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][0]) deadlines[data[i][0]] = data[i][1];
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, deadlines: deadlines })).setMimeType(ContentService.MimeType.JSON);
  }

  // default GET: fetch data from year sheets
  var sheets = ss.getSheets();
  var allData = [];
  
  sheets.forEach(function(s) {
    var sheetName = s.getName();
    // Só processa abas cujo nome seja exatamente um ano de 4 dígitos (ex: "2026", "2027").
    // Isso evita que abas administrativas/auxiliares (CONFIG, CURSOS, CURSOS_EMAIL, 
    // CONFIG_PRAZOS, Atualizações, Exclusões, ou qualquer aba nova que venha a ser criada)
    // sejam lidas como se fossem dados de fragilidade.
    if (!/^\d{4}$/.test(sheetName)) return;
    
    var d = s.getDataRange().getValues();
    d.forEach(function(r) {
      if (r[3] && r[3] !== "Curso" && r[0] !== "" && !r[0].toString().toUpperCase().startsWith("CURSO:")) {
        var acomp = [];
        if (r[15]) {
          try { acomp = JSON.parse(r[15]); } catch(err) { acomp = []; }
        }
        allData.push({
          id: r[0], dataHora: r[1], codigoCurso: r[2], curso: r[3], ano: (r[4] !== undefined && r[4] !== null) ? r[4].toString() : '',
          tipo: r[5], fragilidade: r[6], fonte: r[7], conceito: r[8],
          acao: r[9], prazo: formatarDataSegura(r[10]), responsavel: r[11], recursos: r[12],
          dataReuniao: r[13] ? formatarDataSegura(r[13]) : "", minutaReuniao: r[14] || "",
          acompanhamentos: acomp
        });
      }
    });
  });
  
  return ContentService.createTextOutput(JSON.stringify(allData)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Insere novas linhas em uma tabela específica de curso dentro de uma aba de ano ou auditoria.
 * Localiza a tabela do curso (ou cria uma nova com cabeçalhos azul/cinza) e adiciona 
 * os dados mantendo o formato de texto nas datas usando setNumberFormat("@").
 */
function inserirRegistroEmTabelaCurso(nomeAba, curso, codigoCurso, headers, rowsToInsert) {
  if (!rowsToInsert || rowsToInsert.length === 0) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    sheet = ss.insertSheet(nomeAba);
  }

  var maxCols = sheet.getMaxColumns();
  if (maxCols < headers.length) {
      sheet.insertColumnsAfter(maxCols, headers.length - maxCols);
      maxCols = headers.length;
  }
  if (maxCols > headers.length) {
    sheet.deleteColumns(headers.length + 1, maxCols - headers.length);
  }

  // Set column widths dynamically based on headers
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    if (h === "Fragilidade" || h === "Fragilidade (Nova)") sheet.setColumnWidth(c + 1, 300);
    else if (h === "Ação") sheet.setColumnWidth(c + 1, 300);
    else if (h === "Recursos") sheet.setColumnWidth(c + 1, 200);
    else if (h === "Minuta da Reunião") sheet.setColumnWidth(c + 1, 200);
    else if (h === "Acompanhamentos") sheet.setColumnWidth(c + 1, 300);
  }

  var sheetData = sheet.getDataRange().getValues();
  var lastDataRow = sheetData.length;
  if (lastDataRow === 1 && sheetData[0].join("") === "") lastDataRow = 0; 
  
  var searchTitle = "CURSO: " + curso.toString().trim().toUpperCase();
  var foundTitleRow = -1;
  
  for (var i = 0; i < sheetData.length; i++) {
    if (sheetData[i][0] && sheetData[i][0].toString().toUpperCase().indexOf(searchTitle) === 0) {
      foundTitleRow = i + 1; 
      break;
    }
  }

  if (foundTitleRow !== -1) {
    // A Tabela já existe
    var insertAt = foundTitleRow + 1; 
    
    while (insertAt <= sheetData.length) {
      var cellValue = sheetData[insertAt - 1][0];
      if (cellValue === "" || (typeof cellValue === 'string' && cellValue.indexOf("CURSO:") === 0)) {
        break;
      }
      insertAt++;
    }
    
    if (insertAt > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), rowsToInsert.length + 5);
    } else {
      sheet.insertRowsBefore(insertAt, rowsToInsert.length);
    }
    
    var idxAno = headers.indexOf("Ano") !== -1 ? headers.indexOf("Ano") + 1 : 0;
    var idxDataFinal = headers.indexOf("Prazo") !== -1 ? headers.indexOf("Prazo") + 1 : (headers.indexOf("Data Final") !== -1 ? headers.indexOf("Data Final") + 1 : 0);
    var idxDataReuniao = headers.indexOf("Data da Reunião") !== -1 ? headers.indexOf("Data da Reunião") + 1 : 0;

    var insertRange = sheet.getRange(insertAt, 1, rowsToInsert.length, headers.length);
    if (idxAno > 0) sheet.getRange(insertAt, idxAno, rowsToInsert.length, 1).setNumberFormat("@");
    if (idxDataFinal > 0) sheet.getRange(insertAt, idxDataFinal, rowsToInsert.length, 1).setNumberFormat("@");
    if (idxDataReuniao > 0) sheet.getRange(insertAt, idxDataReuniao, rowsToInsert.length, 1).setNumberFormat("@");
    insertRange.setValues(rowsToInsert);
    insertRange.setBackground("white").setFontColor("black").setFontWeight("normal")
               .setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(true); 
    
  } else {
    // A Tabela não existe
    var startRow = lastDataRow + 1;
    var emptyRowsToAdd = 0;

    if (startRow > 1) {
      emptyRowsToAdd = 2; // Pula 2 linhas em branco
      startRow += emptyRowsToAdd;
    }
    
    var codigoCursoStr = codigoCurso ? " - CÓD: " + codigoCurso : "";
    var titleText = searchTitle + codigoCursoStr;
    var emptyTitleRow = Array(headers.length).fill("");
    emptyTitleRow[0] = titleText;
    
    var rowsToAdd = [emptyTitleRow, headers].concat(rowsToInsert);
    
    if (startRow + rowsToAdd.length - 1 > sheet.getMaxRows()) {
      var needed = (startRow + rowsToAdd.length - 1) - sheet.getMaxRows();
      sheet.insertRowsAfter(sheet.getMaxRows(), needed + 5);
    }

    var idxAno = headers.indexOf("Ano") !== -1 ? headers.indexOf("Ano") + 1 : 0;
    var idxDataFinal = headers.indexOf("Prazo") !== -1 ? headers.indexOf("Prazo") + 1 : (headers.indexOf("Data Final") !== -1 ? headers.indexOf("Data Final") + 1 : 0);
    var idxDataReuniao = headers.indexOf("Data da Reunião") !== -1 ? headers.indexOf("Data da Reunião") + 1 : 0;

    var targetRange = sheet.getRange(startRow, 1, rowsToAdd.length, headers.length);
    if (idxAno > 0) sheet.getRange(startRow, idxAno, rowsToAdd.length, 1).setNumberFormat("@");
    if (idxDataFinal > 0) sheet.getRange(startRow, idxDataFinal, rowsToAdd.length, 1).setNumberFormat("@");
    if (idxDataReuniao > 0) sheet.getRange(startRow, idxDataReuniao, rowsToAdd.length, 1).setNumberFormat("@");
    targetRange.breakApart(); 
    targetRange.setValues(rowsToAdd);
    targetRange.setBackground("white").setFontColor("black").setFontWeight("normal")
               .setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(true);
    
    sheet.getRange(startRow, 1, 1, headers.length)
         .mergeAcross()
         .setBackground("#00338C").setFontColor("white")
         .setFontWeight("bold").setHorizontalAlignment("center");
    
    sheet.getRange(startRow + 1, 1, 1, headers.length)
         .setBackground("#f1f5f9").setFontWeight("bold").setFontColor("black")
         .setVerticalAlignment("middle").setHorizontalAlignment("center").setWrap(true);
  }
}

/**
 * Função principal que lida com requisições HTTP POST (payload JSON text/plain).
 * Roteia as ações baseadas em data.action (login, save_deadlines, update, delete, etc).
 * Grava dados na planilha e dispara e-mails de notificação quando apropriado.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); 
  
  try {
    if (!e || !e.postData || !e.postData.contents) return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'No payload' })).setMimeType(ContentService.MimeType.JSON);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    // Fuso horário de Mato Grosso do Sul
    var dataHoraCuiaba = Utilities.formatDate(new Date(), "GMT-04:00", "dd/MM/yyyy HH:mm:ss");

    // =====================================================================
    // LOGIN
    // =====================================================================
    if (data.action === 'login') {
      var configSheet = ss.getSheetByName('CONFIG');
      if (!configSheet) {
        configSheet = ss.insertSheet('CONFIG');
        configSheet.appendRow(['uems2026', 'salt']);
      }
      var masterConfig = configSheet.getRange(1, 1).getValue();
      
      if (data.password === masterConfig) {
        var cursosSheet = ss.getSheetByName('CURSOS');
        var courses = {};
        if (cursosSheet) {
          var cData = cursosSheet.getDataRange().getValues();
          for (var r = 1; r < cData.length; r++) { // skip header
             if (cData[r][1]) {
               courses[cData[r][0]] = cData[r][1] + '||' + cData[r][2];
             }
          }
        }
        return ContentService.createTextOutput(JSON.stringify({ success: true, role: 'reitoria', courses: courses })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var cursosSheet = ss.getSheetByName('CURSOS');
      if (!cursosSheet) {
        cursosSheet = ss.insertSheet('CURSOS');
        cursosSheet.appendRow(['hash', 'courseId', 'courseName', 'Email', 'Liberado']);
        cursosSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#f1f5f9");
        cursosSheet.appendRow(['dGVzdGU=', '00000001', 'Teste', 'enade@uems.br', 'SIM']); 
      }
      
      var cData = cursosSheet.getDataRange().getValues();
      var inputHash = Utilities.base64Encode(data.password);
      for (var i = 1; i < cData.length; i++) {
        if (cData[i][0] === inputHash) {
          return ContentService.createTextOutput(JSON.stringify({ 
              success: true, 
              role: 'coordenador', 
              courseId: cData[i][1], 
              courseName: cData[i][2],
              emailRegistrado: !!(cData[i][3] && cData[i][3].toString().trim() !== ""),
              podeEditar: String(cData[i][4] || "").trim().toUpperCase() === "SIM"
            })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Senha inválida' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // =====================================================================
    // REGISTER COURSE EMAIL
    // =====================================================================
    if (data.action === "register_course_email") {
      var email = (data.email || "").toString().trim();
      var courseId = (data.courseId || "").toString().trim();
      
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'E-mail inválido.' })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var cursosSheet = ss.getSheetByName('CURSOS');
      if (!cursosSheet) return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Aba CURSOS não encontrada.' })).setMimeType(ContentService.MimeType.JSON);
      
      var cData = cursosSheet.getDataRange().getValues();
      var linhaEncontrada = -1;
      for (var i = 1; i < cData.length; i++) {
        if (String(cData[i][1]) === courseId) {
          linhaEncontrada = i + 1;
          break;
        }
      }
      
      if (linhaEncontrada === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Curso não encontrado.' })).setMimeType(ContentService.MimeType.JSON);
      }
      
      cursosSheet.getRange(linhaEncontrada, 4).setValue(email);
      
      var courseNameAtual = cData[linhaEncontrada - 1][2];
      var match = (typeof matchCursoEmail === 'function') ? matchCursoEmail(courseNameAtual) : null;
      if (match && match.linha) {
        ss.getSheetByName('CURSOS_EMAIL').getRange(match.linha, 4).setValue(email);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // =====================================================================
    // PRAZOS
    // =====================================================================
    if (data.action === 'save_deadlines') {
      var sheet = ss.getSheetByName('CONFIG_PRAZOS');
      if (!sheet) {
        sheet = ss.insertSheet('CONFIG_PRAZOS');
      }
      sheet.clear();
      var rows = [];
      for (var k in data.deadlines) {
        rows.push([k, data.deadlines[k]]);
      }
      if (rows.length > 0) {
        sheet.getRange(1, 1, rows.length, 2).setValues(rows);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // =====================================================================
    // GATILHO DE TESTE DE E-MAIL
    // =====================================================================
    if (data.action === "test_email") {
       enviarEmail(
         "[PROE/UEMS] Teste de Notificação - Plano de Ação", 
         "Este é um e-mail de teste disparado pelo sistema para verificar o funcionamento das notificações corporativas.", 
         "<div class='detail-row'><span class='detail-label sans'>Status</span><span class='detail-value sans'>Comunicação estabelecida com sucesso</span></div>",
         true
       );
       return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'E-mail enviado' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // =====================================================================
    // 1. GRAVAÇÃO EM LOTE E CRIAÇÃO DE TABELAS
    // =====================================================================
    if (Array.isArray(data)) {
      var lotes = {}; 
      var headers = ["ID", "Data/Hora", "Código", "Curso", "Ano", "Dimensão", "Fragilidade", "Fonte", "Conceito", "Ação", "Prazo", "Responsável", "Recursos", "Data da Reunião", "Minuta da Reunião", "Acompanhamentos"];

      data.forEach(function(item) {
        var ano = item.ano ? item.ano.toString() : "Geral";
        var curso = item.curso ? item.curso.toString().trim() : "Curso Não Identificado";
        
        if (!lotes[ano]) lotes[ano] = {};
        if (!lotes[ano][curso]) lotes[ano][curso] = [];
        
        lotes[ano][curso].push([
          gerarIdRegistro(), dataHoraCuiaba, 
          item.codigoCurso, item.curso, item.ano, item.tipo, 
          item.fragilidade, item.fonte, item.conceito, item.acao, 
          item.prazo, item.responsavel, item.recursos,
          item.dataReuniao, item.minutaReuniao,
          item.acompanhamentos ? JSON.stringify(item.acompanhamentos) : '[]'
        ]);
      });
      
      var registrosAdicionados = 0;
      var cursosAfetadosStr = ""; // Para o resumo no email

      for (var ano in lotes) {
        var cursosDesteAno = Object.keys(lotes[ano]).join(", ");
        cursosAfetadosStr += "<div style='margin-bottom: 8px;'><strong style='font-weight: 500;'>" + ano + ":</strong> " + cursosDesteAno + "</div>";

        for (var curso in lotes[ano]) {
          var rowsToInsert = lotes[ano][curso];
          registrosAdicionados += rowsToInsert.length;
          var codigoCurso = rowsToInsert[0][1];
          inserirRegistroEmTabelaCurso(ano, curso, codigoCurso, headers, rowsToInsert);
        }
      }

      // DISPARA O E-MAIL AO SALVAR LOTE DE AÇÕES (COM DETALHES)
      if (registrosAdicionados > 0) {
         var detalhesLote = "<div class='detail-row'><span class='detail-label sans'>Registros Inseridos</span><span class='detail-value sans'>" + registrosAdicionados + "</span></div>" +
                            "<div class='detail-row'><span class='detail-label sans'>Cursos Atualizados</span><span class='detail-value sans'>" + cursosAfetadosStr + "</span></div>";

         enviarEmail(
             "[PROE/UEMS] Novos Registros - Plano de Ação", 
             "Foram submetidos novos registros de Planos de Ação no sistema com sucesso. A planilha base já foi consolidada.", 
             detalhesLote,
             false
         );
         
         if (NOTIFICACOES_POR_CURSO_ATIVAS) {
             for (var ano in lotes) {
                 for (var curso in lotes[ano]) {
                     var emailCurso = buscarEmailDoCurso(curso);
                     if (emailCurso && emailCurso.toLowerCase() !== "enade@uems.br") {
                         var qtd = lotes[ano][curso].length;
                         var detalhesCur = "<div class='detail-row'><span class='detail-label sans'>Curso</span><span class='detail-value sans'>" + curso + "</span></div>" +
                                           "<div class='detail-row'><span class='detail-label sans'>Ano Ref.</span><span class='detail-value sans'>" + ano + "</span></div>" +
                                           "<div class='detail-row'><span class='detail-label sans'>Registros Inseridos</span><span class='detail-value sans'>" + qtd + "</span></div>";
                         enviarEmail(
                             "[PROE/UEMS] Novos Registros - Plano de Ação", 
                             "Seu curso recebeu novos registros de Plano de Ação submetidos no sistema.", 
                             detalhesCur,
                             false,
                             emailCurso
                         );
                     }
                 }
             }
         }
      }

      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // =====================================================================
    // 2. EDIÇÃO / EXCLUSÃO / ACOMPANHAMENTOS
    // =====================================================================
    if (data.action === "update" || data.action === "delete" || data.action === "add_acompanhamento") {
      var sheet = ss.getSheetByName(data.ano.toString());
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Aba não encontrada.' })).setMimeType(ContentService.MimeType.JSON);

      // Validação de segurança: apenas usuários com "Liberado" == "SIM" na aba CURSOS podem fazer update ou delete
      if (data.action === "update" || data.action === "delete") {
        var cursosSheet = ss.getSheetByName('CURSOS');
        var podeEditar = false;
        if (cursosSheet) {
          var cData = cursosSheet.getDataRange().getValues();
          for (var i = 1; i < cData.length; i++) {
            if (String(cData[i][1]) === String(data.codigoCurso)) {
              if (String(cData[i][4] || "").trim().toUpperCase() === "SIM") {
                podeEditar = true;
              }
              break;
            }
          }
        }
        if (!podeEditar) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Edição não autorizada. Solicite liberação à PROE.' })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      var values = sheet.getDataRange().getValues();
      var rowIndex = encontrarLinhaPorId(sheet, data.id, data.curso, data.fragilidadeAntiga);

      if (rowIndex !== -1) {
        if (data.action === "delete") {
          var timestampExclusao = Utilities.formatDate(new Date(), "GMT-04:00", "dd/MM/yyyy HH:mm:ss");
          var linhaExcluida = sheet.getRange(rowIndex, 1, 1, 16).getValues()[0];
          
          sheet.deleteRow(rowIndex);
          revogarLiberacao(data.curso);
          
          var headersExclusao = ["Data/Hora da Exclusão", "Código", "Curso", "Ano Ref.", "Dimensão", "Fragilidade", "Fonte", "Conceito", "Ação", "Data Final", "Responsável", "Recursos", "Data da Reunião", "Minuta da Reunião"];
          inserirRegistroEmTabelaCurso("Exclusões", data.curso, data.codigoCurso, headersExclusao, [[
            timestampExclusao, linhaExcluida[2], linhaExcluida[3], linhaExcluida[4], linhaExcluida[5], linhaExcluida[6], linhaExcluida[7], linhaExcluida[8], linhaExcluida[9], formatarDataSegura(linhaExcluida[10]), linhaExcluida[11], linhaExcluida[12], linhaExcluida[13] ? formatarDataSegura(linhaExcluida[13]) : "", linhaExcluida[14]
          ]]);
          
          // E-mail de Exclusão Enriquecido
          var detalhesExclusao = "<div class='detail-row'><span class='detail-label sans'>Curso</span><span class='detail-value sans'>" + data.curso + "</span></div>" +
                                 "<div class='detail-row'><span class='detail-label sans'>Ano Ref.</span><span class='detail-value sans'>" + data.ano + "</span></div>" +
                                 "<div class='detail-row'><span class='detail-label sans'>ID Registro</span><span class='detail-value sans'>#" + (data.id || "antigo") + "</span></div>" +
                                 "<div class='detail-row'><span class='detail-label sans'>Registro Excluído</span><span class='detail-value sans'><i>" + data.fragilidadeAntiga + "</i></span></div>";
          enviarEmail("[PROE/UEMS] Aviso: Plano de Ação Excluído", "Um registro de plano de ação foi removido permanentemente do sistema.", detalhesExclusao, false);
          
          if (NOTIFICACOES_POR_CURSO_ATIVAS) {
              var emailCurso = buscarEmailDoCurso(data.curso);
              if (emailCurso && emailCurso.toLowerCase() !== "enade@uems.br") {
                  enviarEmail("[PROE/UEMS] Aviso: Plano de Ação Excluído", "Um registro de plano de ação do seu curso foi removido permanentemente do sistema.", detalhesExclusao, false, emailCurso);
              }
          }
          return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);

        } else if (data.action === "update") {
          var p = data.newData;
          var updateRange = sheet.getRange(rowIndex, 6, 1, 10);
          sheet.getRange(rowIndex, 11, 1, 1).setNumberFormat("@");
          sheet.getRange(rowIndex, 14, 1, 1).setNumberFormat("@");
          updateRange.setValues([[
            p.tipo, p.fragilidade, p.fonte, p.conceito, p.acao, p.prazo, p.responsavel, p.recursos, p.dataReuniao, p.minutaReuniao
          ]]);
          updateRange.setWrap(true).setVerticalAlignment("middle");
          
          revogarLiberacao(data.curso);
          
          var timestampAcao = Utilities.formatDate(new Date(), "GMT-04:00", "dd/MM/yyyy HH:mm:ss");
          var headersAuditoria = ["Data/Hora da Alteração", "Código", "Curso", "Ano Ref.", "Dimensão", "Fragilidade (Nova)", "Fonte", "Conceito", "Ação", "Data Final", "Responsável", "Recursos", "Data da Reunião", "Minuta da Reunião", "Fragilidade Anterior"];
          inserirRegistroEmTabelaCurso("Atualizações", data.curso, data.codigoCurso, headersAuditoria, [[
            timestampAcao, data.codigoCurso, data.curso, data.ano, p.tipo, p.fragilidade, p.fonte, p.conceito, p.acao, p.prazo, p.responsavel, p.recursos, p.dataReuniao, p.minutaReuniao, data.fragilidadeAntiga
          ]]);
            
          // E-mail de Edição Enriquecido
          var detalhesEdicao = "<div class='detail-row'><span class='detail-label sans'>Curso</span><span class='detail-value sans'>" + data.curso + "</span></div>" +
                               "<div class='detail-row'><span class='detail-label sans'>Ano Ref.</span><span class='detail-value sans'>" + data.ano + "</span></div>" +
                               "<div class='detail-row'><span class='detail-label sans'>ID Registro</span><span class='detail-value sans'>#" + (data.id || "antigo") + "</span></div>" +
                               "<div class='detail-row'><span class='detail-label sans'>Fragilidade</span><span class='detail-value sans'>" + p.fragilidade + "</span></div>" +
                               "<div class='detail-row'><span class='detail-label sans'>Ação Planejada</span><span class='detail-value sans'>" + p.acao + "</span></div>" +
                               "<div class='detail-row'><span class='detail-label sans'>Data Final</span><span class='detail-value sans'>" + formatarDataSegura(p.prazo) + "</span></div>" +
                               "<div class='detail-row'><span class='detail-label sans'>Data da Reunião</span><span class='detail-value sans'>" + (p.dataReuniao ? formatarDataSegura(p.dataReuniao) : "") + "</span></div>";
          enviarEmail("[PROE/UEMS] Aviso: Plano de Ação Atualizado", "Um registro de plano de ação foi editado e atualizado no sistema com novas diretrizes.", detalhesEdicao, false);
          
          if (NOTIFICACOES_POR_CURSO_ATIVAS) {
              var emailCurso = buscarEmailDoCurso(data.curso);
              if (emailCurso && emailCurso.toLowerCase() !== "enade@uems.br") {
                  enviarEmail("[PROE/UEMS] Aviso: Plano de Ação Atualizado", "Um registro de plano de ação do seu curso foi editado e atualizado no sistema com novas diretrizes.", detalhesEdicao, false, emailCurso);
              }
          }
          
          return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
        } else if (data.action === "add_acompanhamento") {
          var acompStr = sheet.getRange(rowIndex, 16).getValue();
          var acompanhamentos = [];
          if (acompStr) {
            try { acompanhamentos = JSON.parse(acompStr); } catch(err) { acompanhamentos = []; }
          }
          if (!Array.isArray(acompanhamentos)) acompanhamentos = [];
          acompanhamentos.push(data.acompanhamento);
          sheet.getRange(rowIndex, 16).setValue(JSON.stringify(acompanhamentos));
          
          return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Registro não encontrado' })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// FUNÇÕES DE ENVIO DE E-MAIL E TEMPLATE CORPORATIVO MELHORADO
// =========================================================================

/**
 * Envia e-mails formatados em HTML pelo GmailApp.
 * Envia para enade@uems.br e, opcionalmente, para um destinatário específico (toOverride)
 * ou para o e-mail do curso se NOTIFICACOES_POR_CURSO_ATIVAS = true.
 */
function enviarEmail(assunto, textoPrincipal, detalhesContexto, isTest, toOverride) {
  var targetEmail = toOverride || "enade@uems.br"; // ALVO RECEBEDOR
  
  var sheetLink = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  var dataOperacao = Utilities.formatDate(new Date(), "GMT-04:00", "dd/MM/yyyy 'às' HH:mm:ss");
  
  var htmlBody = generateEmailTemplate(assunto, textoPrincipal, detalhesContexto || "", sheetLink, dataOperacao, isTest || false);
  
  try {
    MailApp.sendEmail({
      to: targetEmail,
      subject: assunto,
      htmlBody: htmlBody
    });
  } catch (e) {
    console.error("Falha ao enviar e-mail: " + e.message);
  }
}

/**
 * Gera o corpo do e-mail em HTML injetando parâmetros no template corporativo.
 * Monta o layout com o logo da UEMS, cabeçalhos, tabela de detalhes e botão de acesso.
 */
function generateEmailTemplate(title, messageBody, detalhesContexto, sheetLink, dataOperacao, isTest) {
  var testBadge = isTest 
    ? "<div class='badge sans' style='background-color: #C8A84B; color: #ffffff; border: none; border-radius: 4px; padding: 4px 10px;'>Ambiente de Teste</div>" 
    : "";

  var contextBox = detalhesContexto 
    ? "<div class='details'>" + detalhesContexto + "</div>"
    : "";
    
  var safeTitle = title.replace("[PROE/UEMS] ", "");

  return "<!DOCTYPE html>\n" +
"<html lang='pt-BR'>\n" +
"<head>\n" +
"  <meta charset='UTF-8'>\n" +
"  <meta name='viewport' content='width=device-width, initial-scale=1.0'>\n" +
"  <link rel='preconnect' href='https://fonts.googleapis.com'>\n" +
"  <link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>\n" +
"  <link href='https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap' rel='stylesheet'>\n" +
"  <style>\n" +
"    body { margin: 0; padding: 0; background-color: #f5f5f5; -webkit-font-smoothing: antialiased; }\n" +
"    table { border-spacing: 0; border-collapse: collapse; width: 100%; }\n" +
"    td { word-break: break-word; }\n" +
"    .serif { font-family: 'Playfair Display', Georgia, serif; }\n" +
"    .sans { font-family: 'Inter', -apple-system, sans-serif; }\n" +
"    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }\n" +
"    .wrapper { width: 100%; background-color: #f5f5f5; padding: 60px 20px; box-sizing: border-box; }\n" +
"    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e5; }\n" +
"    .header { padding: 40px; text-align: center; background: linear-gradient(135deg, #00338C 0%, #001f4d 100%); }\n" +
"    .header img { height: 40px; filter: brightness(0) invert(1); margin-bottom: 12px; }\n" +
"    .header-subtitle { color: #C8A84B; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 500; margin: 0; }\n" +
"    .highlight-band { height: 4px; background-color: #C8A84B; width: 100%; }\n" +
"    .content { padding: 50px 40px; }\n" +
"    .title { font-size: 26px; color: #001f4d; margin: 0 0 24px 0; line-height: 1.3; font-weight: 600; }\n" +
"    .message { font-size: 15px; line-height: 1.8; color: #333; margin: 0 0 40px 0; font-weight: 300; }\n" +
"    .details { background-color: #F4F6FA; border-left: 4px solid #00338C; border-radius: 8px; padding: 24px 20px; margin-bottom: 40px; }\n" +
"    .detail-row { display: table; width: 100%; margin-bottom: 12px; }\n" +
"    .detail-row:last-child { margin-bottom: 0; }\n" +
"    .detail-label { display: table-cell; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #00338C; width: 140px; vertical-align: top; }\n" +
"    .detail-value { display: table-cell; font-size: 14px; color: #333; font-weight: 400; }\n" +
"    .detail-value.mono { font-size: 13px; color: #333; }\n" +
"    .button-wrapper { text-align: left; }\n" +
"    .button { display: inline-block; background-color: #00338C; color: #ffffff !important; text-decoration: none; padding: 14px 28px; font-size: 13px; font-weight: 500; border-radius: 6px; }\n" +
"    .footer { background-color: #ffffff; padding: 0 40px 40px 40px; text-align: left; font-size: 11px; color: #666; line-height: 1.6; }\n" +
"    .footer-divider { height: 1px; background-color: #C8A84B; margin-bottom: 30px; opacity: 0.5; }\n" +
"    .footer-highlight { color: #00338C; font-weight: 600; }\n" +
"  </style>\n" +
"</head>\n" +
"<body class='sans'>\n" +
"  <div class='wrapper'>\n" +
"    <div class='container'>\n" +
"      <div class='header'>\n" +
"        <img src='https://www.uems.br/assets/img/logo-uems.png' alt='UEMS'>\n" +
"        <p class='header-subtitle'>Pró-Reitoria de Ensino — Sistema de Planos de Ação</p>\n" +
"      </div>\n" +
"      <div class='highlight-band'></div>\n" +
"      <div class='content'>\n" +
"        " + testBadge + "\n" +
"        <h2 class='title serif'>" + safeTitle + "</h2>\n" +
"        <p class='message sans'>" + messageBody + "</p>\n" +
"        " + contextBox + "\n" +
"        <div class='button-wrapper'>\n" +
"          <a href='" + sheetLink + "' class='button sans' target='_blank'>Acessar Planilha Central</a>\n" +
"        </div>\n" +
"      </div>\n" +
"      <div class='footer sans'>\n" +
"        <div class='footer-divider'></div>\n" +
"        Este é um comunicado automático gerado pelo ecossistema integrado da <strong class='footer-highlight'>PROE/UEMS</strong>.<br>\n" +
"        Ação sincronizada em: <strong>" + dataOperacao + "</strong> (Fuso MS).<br><br>\n" +
"        <i>Este endereço de e-mail é apenas para envios, por favor, não responda.</i>\n" +
"      </div>\n" +
"    </div>\n" +
"  </div>\n" +
"</body>\n" +
"</html>";
}

function configurarEmailsCursos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('CURSOS_EMAIL');
  if (!sheet) {
    sheet = ss.insertSheet('CURSOS_EMAIL');
  }
  sheet.clear();
  
  var headers = ["Unidade", "Curso", "Grau", "Email"];
  
  var CURSOS_EMAIL_DATA = [
  ["Maracaju","Administração","Bacharelado","administracao.maracaju@uems.br"],
  ["Ponta Porã","Administração","Bacharelado","administracao.pontapora@uems.br"],
  ["Campo Grande/Moreninhas","Administração Pública","Bacharelado","administracaopublica.cg@uems.br"],
  ["EaD","Administração Pública","Bacharelado","administracao.ead@uems.br"],
  ["Aquidauana","Agroecologia Intercultural para Indígenas dos Povos do Pantanal","Bacharelado","agroecologia.aquidauana@uems.br"],
  ["Aquidauana","Agronomia","Bacharelado","agronomia.aquidauana@uems.br"],
  ["Cassilândia","Agronomia","Bacharelado","agronomia.cassilandia@uems.br"],
  ["Maracaju","Agronomia","Bacharelado","agronomia.maracaju@uems.br"],
  ["Mundo Novo","Agronomia","Bacharelado","agronomiamundonovo@uems.br"],
  ["Campo Grande/Santo Amaro","Ciências Biológicas","Bacharelado","biologicas.cg@uems.br"],
  ["Dourados","Ciências Biológicas","Bacharelado","biologicasb.dourados@uems.br"],
  ["Dourados","Ciências Biológicas","Licenciatura","biologicas.dourados@uems.br"],
  ["Ivinhema","Ciências Biológicas","Licenciatura","biologicas.ivinhema@uems.br"],
  ["Mundo Novo","Ciências Biológicas","Licenciatura","biologicas.mundonovo@uems.br"],
  ["Ponta Porã","Ciências Contábeis","Bacharelado","contabeis.pontapora@uems.br"],
  ["Dourados","Ciências da Computação","Bacharelado","computacao.dourados@uems.br"],
  ["Ponta Porã","Ciências Econômicas","Bacharelado","economicas.pontapora@uems.br"],
  ["EaD","Ciências Sociais","Licenciatura","cienciassociais.ead@uems.br"],
  ["Amambai","Ciências Sociais","Licenciatura","cienciassociais.amambai@uems.br"],
  ["Paranaíba","Ciências Sociais","Licenciatura","cienciassociais.paranaiba@uems.br"],
  ["Paranaíba","Ciências Sociais","Bacharelado","cienciassociaisb.paranaiba@uems.br"],
  ["Campo Grande/Santo Amaro","Dança","Licenciatura","danca.campogrande@uems.br"],
  ["Aquidauana","Direito","Bacharelado","direito.aquidauana@uems.br"],
  ["Bataguassu","Direito","Bacharelado","direito.bataguassu@uems.br"],
  ["Campo Grande/Moreninhas","Direito","Bacharelado","direito.cg@uems.br"],
  ["Cassilândia/Paranaíba","Direito","Bacharelado","direito.cassilandia@uems.br"],
  ["Dourados","Direito","Bacharelado","direito.dourados@uems.br"],
  ["Jardim","Direito","Bacharelado","direito.jardim@uems.br"],
  ["Naviraí","Direito","Bacharelado","direito.navirai@uems.br"],
  ["Paranaíba","Direito","Bacharelado","direito.paranaiba@uems.br"],
  ["Dourados/Costa Rica","Enfermagem","Bacharelado","enfermagem.costarica@uems.br"],
  ["Dourados","Enfermagem","Bacharelado","enfermagem.dourados@uems.br"],
  ["Dourados","Engenharia Ambiental e Sanitária","Bacharelado","engenhariaambientalsanitaria.dourados@uems.br"],
  ["Nova Andradina","Engenharia Civil","Bacharelado","engenhariacivil.novaandradina@uems.br"],
  ["Naviraí","Engenharia de Alimentos","Bacharelado","engealimentos.navirai@uems.br"],
  ["Dourados","Engenharia Física","Bacharelado","engenhariafisica.dourados@uems.br"],
  ["Aquidauana","Engenharia Florestal","Bacharelado","engenhariaflorestal@uems.br"],
  ["Campo Grande","Fonoaudiologia","Bacharelado","fonoaudiologia.cg@uems.br"],
  ["Campo Grande/Santo Amaro","Geografia","Bacharelado","geografiab.cg@uems.br"],
  ["Campo Grande/Santo Amaro","Geografia","Licenciatura","geografia.cg@uems.br"],
  ["Jardim","Geografia","Licenciatura","geografia.jardim@uems.br"],
  ["Amambai","História","Licenciatura","historia_amambai@uems.br"],
  ["Campo Grande/Moreninhas","História","Licenciatura","historia.cg@uems.br"],
  ["Campo Grande/Santo Amaro","Letras","Bacharelado","letrasb.cg@uems.br"],
  ["Campo Grande/Santo Amaro","Letras, Licenciatura, Habilitação Português/Espanhol e suas Literaturas","Licenciatura","letrasespanhol.cg@uems.br"],
  ["Campo Grande/Santo Amaro","Letras, Licenciatura, Habilitação Português/Inglês e suas Literaturas","Licenciatura","letrasingles.cg@uems.br"],
  ["Dourados","Licenciatura em Física","Licenciatura","fisica.dourados@uems.br"],
  ["Dourados","Licenciatura em Letras - Habilitação Português/Espanhol","Licenciatura","letrasespanhol.dourados@uems.br"],
  ["Cassilândia","Licenciatura em Letras - Habilitação Português/Inglês","Licenciatura","letras.cassilandia@uems.br"],
  ["Dourados","Licenciatura em Letras - Habilitação Português/Inglês","Licenciatura","letrasingles.dourados@uems.br"],
  ["Jardim","Licenciatura em Letras - Habilitação Português/Inglês","Licenciatura","letras.jardim@uems.br"],
  ["Dourados","Licenciatura em Química","Licenciatura","quimica.dourados@uems.br"],
  ["Naviraí","Licenciatura em Química","Licenciatura","quimica.navirai@uems.br"],
  ["Cassilândia","Matemática","Licenciatura","matematica.cassilandia@uems.br"],
  ["Dourados","Matemática","Licenciatura","matematica.dourados@uems.br"],
  ["Nova Andradina","Matemática","Licenciatura","matematica.novaandradina@uems.br"],
  ["Campo Grande/Santo Amaro","Medicina","Bacharelado","medicina.cg@uems.br"],
  ["Campo Grande/Santo Amaro","Pedagogia","Licenciatura","pedagogia.cg@uems.br"],
  ["Dourados","Pedagogia","Licenciatura","pedagogia.dourados@uems.br"],
  ["Maracaju","Pedagogia","Licenciatura","pedagogia.maracaju@uems.br"],
  ["Paranaíba","Pedagogia","Licenciatura","pedagogia.paranaiba@uems.br"],
  ["EaD","Pedagogia","Licenciatura","pedagogia.ead@uems.br"],
  ["Amambai","Pedagogia Intercultural","Licenciatura","pedagogiainter.amambai@uems.br"],
  ["Amambai","Pedagogia Intercultural Indígena - Segunda Licenciatura para Indígenas dos Povos Guarani e Kaiowá","Licenciatura","pedagogiaparfor.amambai@uems.br"],
  ["Glória de Dourados","Agronomia","Bacharelado","agronomia.gloria@uems.br"],
  ["Ivinhema","Produção Sucroalcooleira","Tecnológico","sucroalcooleira.ivinhema@uems.br"],
  ["Campo Grande/Santo Amaro","Psicologia","Bacharelado","psicologia.cg@uems.br"],
  ["Coxim","Psicologia","Bacharelado","psicologia.coxim@uems.br"],
  ["Dourados","Química Industrial","Bacharelado","quimicaindustrial.dourados@uems.br"],
  ["Naviraí","Química Tecnológica e Agroquímica","Bacharelado","agroquimica.navirai@uems.br"],
  ["Água Clara","Silvicultura","Tecnológico","silvicultura.ac@uems.br"],
  ["Ribas do Rio Pardo","Silvicultura","Tecnológico","silvicultura.ribas@uems.br"],
  ["Dourados","Sistemas de Informação","Bacharelado","sistemas.dourados@uems.br"],
  ["Nova Andradina","Sistemas de Informação","Bacharelado","sistemasdeinformacaonovaandradina@uems.br"],
  ["Campo Grande/Santo Amaro","Teatro","Licenciatura","teatro.campogrande@uems.br"],
  ["Amambai","Tecnologia em Agroecologia Intercultural Kaiowá e Guarani","Tecnológico","agroec.amambai@uems.br"],
  ["EaD","Tecnologia em Gestão Pública","Tecnológico","tecnogestaopublica.ead@uems.br"],
  ["Jardim","Tecnologia em Logística","Tecnológico","logistica.jardim@uems.br"],
  ["Mundo Novo","Tecnologia Gestão Ambiental","Tecnológico","ambiental.mundonovo@uems.br"],
  ["Campo Grande/Santo Amaro","Terapia Ocupacional","Bacharelado","terapiaocupacional.cg@uems.br"],
  ["Campo Grande/Santo Amaro","Turismo","Bacharelado","turismo.cg@uems.br"],
  ["Dourados","Turismo","Bacharelado","turismo.dourados@uems.br"],
  ["Aquidauana","Zootecnia","Bacharelado","zootecnia.aquidauana@uems.br"],
  ["Teste","Curso Teste","Bacharelado","enade@uems.br"]
  ];
  
  var rows = [headers];
  for (var i = 0; i < CURSOS_EMAIL_DATA.length; i++) {
    rows.push([
      CURSOS_EMAIL_DATA[i][0],
      CURSOS_EMAIL_DATA[i][1],
      CURSOS_EMAIL_DATA[i][2],
      CURSOS_EMAIL_DATA[i][3]
    ]);
  }
  
  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f1f5f9");
}

function normalizarTexto(t) {
  return t ? t.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, ' ') : "";
}

/**
 * Busca o e-mail de um curso específico na aba CURSOS.
 * Faz uma varredura na tabela para retornar a coluna Email com base no nome do curso.
 */
function buscarEmailDoCurso(nomeCompletoCurso) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('CURSOS_EMAIL');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  var cursoProcurado = normalizarTexto(nomeCompletoCurso);
  
  for (var i = 1; i < data.length; i++) {
    var unidade = data[i][0];
    var curso = data[i][1];
    var email = data[i][3];
    
    var combinado1 = normalizarTexto(curso + " - " + unidade);
    var combinado2 = normalizarTexto(curso);
    
    if (combinado1 === cursoProcurado || combinado2 === cursoProcurado) {
      return email;
    }
  }
  return null;
}

/**
 * Função utilitária para cruzar o nome do curso e encontrar seu e-mail correspondente.
 * Faz normalização de texto e analisa combinações de palavras para encontrar correspondência parcial.
 */
function matchCursoEmail(courseName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('CURSOS_EMAIL');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  
  var lastDashIndex = courseName.lastIndexOf(" - ");
  var unidadeOriginal = "";
  var cursoBase = courseName;
  
  if (lastDashIndex !== -1) {
    cursoBase = courseName.substring(0, lastDashIndex).trim();
    unidadeOriginal = courseName.substring(lastDashIndex + 3).trim();
  }
  
  var grauExtraido = "";
  var match = cursoBase.match(/\(([^)]+)\)$/);
  if (match) {
    grauExtraido = match[1];
    cursoBase = cursoBase.replace(/\([^)]+\)$/, "").trim();
  }
  
  var cursoProcurado = normalizarTexto(cursoBase);
  var unidadeProcurada = normalizarTexto(unidadeOriginal);
  var grauProcurado = normalizarTexto(grauExtraido);
  
  var matches = [];
  
  for (var i = 1; i < data.length; i++) {
    var rowUnidade = data[i][0];
    var rowCurso = data[i][1];
    var rowGrau = data[i][2];
    var rowEmail = data[i][3];
    
    var rowCursoNorm = normalizarTexto(rowCurso);
    if (rowCursoNorm !== cursoProcurado) continue;
    
    var rowUnidadeNormPieces = rowUnidade.split("/").map(function(p) { return normalizarTexto(p); });
    
    var unidadeMatch = false;
    for (var j = 0; j < rowUnidadeNormPieces.length; j++) {
      if (rowUnidadeNormPieces[j] === unidadeProcurada || 
          (unidadeProcurada && unidadeProcurada.indexOf(rowUnidadeNormPieces[j]) !== -1) || 
          (rowUnidadeNormPieces[j] && rowUnidadeNormPieces[j].indexOf(unidadeProcurada) !== -1)) {
        unidadeMatch = true;
        break;
      }
    }
    
    if (unidadeMatch) {
      matches.push({
        linha: i + 1,
        email: rowEmail,
        unidade: rowUnidade,
        curso: rowCurso,
        grau: rowGrau
      });
    }
  }
  
  if (matches.length === 0) {
    console.warn("Sem correspondência para: " + courseName);
    return null;
  }
  
  if (matches.length === 1) {
    return matches[0];
  }
  
  if (grauProcurado) {
    var bestMatch = null;
    for (var m = 0; m < matches.length; m++) {
      if (normalizarTexto(matches[m].grau) === grauProcurado) {
        bestMatch = matches[m];
        break;
      }
    }
    if (bestMatch) return bestMatch;
  }
  
  console.warn("Ambiguidade no curso: " + courseName + ". Retornando o primeiro.");
  return matches[0];
}

/**
 * Função utilitária (para uso interno) para transferir a lista de cursos (da aba CURSOS_EMAIL) para a aba CURSOS.
 * Inicializa dados básicos e garante as colunas Email e Liberado, se necessário.
 */
function sincronizarCursosAtivos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cursosSheet = ss.getSheetByName('CURSOS');
  var emailSheet = ss.getSheetByName('CURSOS_EMAIL');
  
  if (!cursosSheet || !emailSheet) return;
  
  // 1) Adicionar coluna "Email" na aba CURSOS
  var headers = cursosSheet.getRange(1, 1, 1, Math.max(cursosSheet.getLastColumn(), 1)).getValues()[0];
  if (headers.length < 4 || headers[3] !== 'Email') {
    cursosSheet.getRange(1, 4).setValue('Email');
  }
  
  // Format header
  var maxCol = Math.max(cursosSheet.getLastColumn(), 4);
  cursosSheet.getRange(1, 1, 1, maxCol).setFontWeight("bold").setBackground("#f1f5f9");
  
  var cData = cursosSheet.getDataRange().getValues();
  
  var countSucesso = 0;
  var countSemCorresp = 0;
  var problematics = [];
  
  for (var i = 1; i < cData.length; i++) {
    var courseId = cData[i][1];
    var courseName = cData[i][2];
    
    if (!courseName) continue;
    
    if (courseId === "00000001" || courseName === "Curso Teste - Teste" || courseName === "Teste") {
      cursosSheet.getRange(i + 1, 4).setValue("enade@uems.br");
      countSucesso++;
      continue;
    }
    
    var match = matchCursoEmail(courseName);
    
    if (match) {
      cursosSheet.getRange(i + 1, 4).setValue(match.email);
      countSucesso++;
    } else {
      cursosSheet.getRange(i + 1, 4).setValue("");
      countSemCorresp++;
      problematics.push(courseName);
    }
  }
  
  var relatorio = "Sincronização concluída.\n\n" +
                  "Cursos sincronizados com sucesso: " + countSucesso + "\n" +
                  "Cursos sem correspondência: " + countSemCorresp + "\n";
                  
  if (countSemCorresp > 0) {
    relatorio += "Lista de sem correspondência:\n- " + problematics.join("\n- ") + "\n\n";
  } else {
    relatorio += "\n";
  }
  
  console.log(relatorio);
  
  enviarEmail(
    "[PROE/UEMS] Relatório de Sincronização de Cursos",
    "A sincronização em lote entre a aba CURSOS e CURSOS_EMAIL foi concluída. Veja os detalhes abaixo.",
    "<div class='detail-row'><span class='detail-label sans'>Detalhes</span><span class='detail-value sans'><pre style='font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; font-size: 13px; margin: 0; color: #333;'>" + relatorio + "</pre></span></div>",
    false,
    "enade@uems.br"
  );
}

/**
 * Gera um ID curto e legível para identificar unicamente cada fragilidade.
 * Usado pelo coordenador para referenciar o registro em pedidos de correção 
 * por e-mail (ex: "preciso alterar o registro #A3F92").
 */
function gerarIdRegistro() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase();
}

/**
 * Localiza a linha de uma fragilidade pelo ID único (busca primária, confiável).
 * Se o ID não vier (registros antigos, criados antes desse sistema) ou não for 
 * encontrado, cai para a busca antiga por texto (curso + fragilidade).
 */
function encontrarLinhaPorId(sheet, id, curso, fragilidadeAntiga) {
  var values = sheet.getDataRange().getValues();
  
  if (id) {
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === id) return i + 1;
    }
  }
  
  function normalizar(t) { return t ? t.toString().toLowerCase().trim().replace(/\s+/g, ' ') : ""; }
  var cursoProcurado = normalizar(curso);
  var fragilidadeProcurada = normalizar(fragilidadeAntiga);
  for (var i = 0; i < values.length; i++) {
    if (values[i][3] && normalizar(values[i][3]) === cursoProcurado && normalizar(values[i][6]) === fragilidadeProcurada) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Revoga automaticamente a liberação de edição/exclusão (coluna "Liberado" da aba CURSOS)
 * de um curso, após ele usar essa permissão uma vez (edição ou exclusão).
 * Implementa a regra de "liberação de uso único": a PROE libera, o coordenador 
 * corrige um registro, e o acesso volta a ficar bloqueado automaticamente.
 */
function revogarLiberacao(courseName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cursosSheet = ss.getSheetByName('CURSOS');
  if (!cursosSheet) return;
  var cData = cursosSheet.getDataRange().getValues();
  for (var i = 1; i < cData.length; i++) {
    if (cData[i][2] === courseName) {
      cursosSheet.getRange(i + 1, 5).setValue("NÃO");
      break;
    }
  }
}

/**
 * MIGRAÇÃO ÚNICA — rodar manualmente pelo editor do Apps Script (não pelo Web App).
 * Corrige abas de ano que ainda estão no formato ANTIGO (15 colunas, sem ID),
 * inserindo a coluna ID na posição correta e realinhando títulos/cabeçalhos
 * para o formato NOVO (16 colunas). Sem isso, o doGet() lê os dados antigos
 * deslocados em uma coluna (bug visto em julho/2026: e-mail/data/curso trocados 
 * de lugar na tabela do PROE).
 *
 * SEGURANÇA: faça uma cópia da planilha inteira (Arquivo > Fazer uma cópia) antes 
 * de rodar isso. A função é idempotente (pode rodar de novo sem duplicar dados), 
 * pois pula abas que já estão no formato novo.
 */
function migrarParaColunaId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var relatorio = [];

  sheets.forEach(function(sheet) {
    var sheetName = sheet.getName();
    if (!/^\d{4}$/.test(sheetName)) return; // só abas de ano

    var dataAntes = sheet.getDataRange().getValues();
    if (dataAntes.length === 0) return;

    // Idempotência: se já existe uma linha de cabeçalho com "ID" na coluna A, já foi migrada.
    var jaMigrada = dataAntes.some(function(r) { return r[0] === "ID" && r[1] === "Data/Hora"; });
    if (jaMigrada) {
      relatorio.push(sheetName + ": já migrada, pulando.");
      return;
    }

    // Também pula se a aba não tem NENHUMA linha no formato antigo reconhecível
    var temFormatoAntigo = dataAntes.some(function(r) { return r[0] === "Data/Hora"; });
    if (!temFormatoAntigo) {
      relatorio.push(sheetName + ": nenhuma linha no formato antigo encontrada, pulando.");
      return;
    }

    // 1. Insere uma coluna em branco antes da coluna A (desloca tudo uma posição à direita)
    sheet.insertColumnBefore(1);

    var dataDepois = sheet.getDataRange().getValues();
    var numRows = dataDepois.length;
    var numCols = dataDepois[0].length; // agora 16

    for (var i = 0; i < numRows; i++) {
      var row = dataDepois[i];
      var colB = row[1]; // valor que estava na antiga coluna A

      if (colB === "Data/Hora") {
        // Linha de CABEÇALHO antiga -> sobrescreve com o cabeçalho novo completo (16 colunas)
        var novoCabecalho = ["ID", "Data/Hora", "Código", "Curso", "Ano", "Dimensão", "Fragilidade", "Fonte", "Conceito", "Ação", "Prazo", "Responsável", "Recursos", "Data da Reunião", "Minuta da Reunião", "Acompanhamentos"];
        sheet.getRange(i + 1, 1, 1, numCols).setValues([novoCabecalho]);
        sheet.getRange(i + 1, 1, 1, numCols).setBackground("#f1f5f9").setFontWeight("bold").setFontColor("black")
             .setVerticalAlignment("middle").setHorizontalAlignment("center").setWrap(true);

      } else if (typeof colB === 'string' && colB.toString().toUpperCase().indexOf("CURSO:") === 0) {
        // Linha de TÍTULO antiga (estava mesclada em B:P) -> move o texto pra coluna A e remescla A:P
        var range15 = sheet.getRange(i + 1, 2, 1, numCols - 1); // B:P, onde o título antigo ficou mesclado
        range15.breakApart();
        sheet.getRange(i + 1, 2, 1, numCols - 1).clearContent();
        sheet.getRange(i + 1, 1).setValue(colB);
        sheet.getRange(i + 1, 1, 1, numCols)
             .mergeAcross()
             .setBackground("#00338C").setFontColor("white")
             .setFontWeight("bold").setHorizontalAlignment("center");

      } else if (colB instanceof Date || (typeof colB === 'string' && colB.trim() !== '')) {
        // Linha de DADOS antiga -> gera um ID novo para ela
        sheet.getRange(i + 1, 1).setValue(gerarIdRegistro());
      }
      // Linhas em branco: não faz nada, coluna A fica vazia mesmo.
    }

    // Garante que Prazo (agora coluna 11) e Data da Reunião (agora coluna 14) continuem como texto
    sheet.getRange(1, 11, numRows, 1).setNumberFormat("@");
    sheet.getRange(1, 14, numRows, 1).setNumberFormat("@");

    relatorio.push(sheetName + ": migrada com sucesso (" + numRows + " linhas processadas).");
  });

  Logger.log(relatorio.join("\n"));

  // Envia um e-mail de confirmação com o relatório da migração
  enviarEmail(
    "[PROE/UEMS] Migração de Dados Concluída",
    "A migração de dados para o novo sistema de ID único foi executada.",
    "<div class='detail-row'><span class='detail-label sans'>Relatório</span><span class='detail-value sans'>" + relatorio.join("<br>") + "</span></div>",
    false
  );

  return relatorio;
}
