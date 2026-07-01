export function formatDateTimeBR(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (!isNaN(d.getTime()) && dateString.includes('-')) {
        if (dateString.includes('T') || dateString.includes(':')) {
             return d.toLocaleString('pt-BR');
        } else {
             return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
    }
    return String(dateString);
}

export function sanitizeSearch(s: string | null | undefined): string {
    if (!s) return '';
    let str = String(s);
    try {
        str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
        // Fallback for environments lacking full unicode support
    }
    return str.toLowerCase()
        .replace(/[áàãâä]/g, 'a').replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i').replace(/[óòõôö]/g, 'o')
        .replace(/[úùûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function escapeHTML(s: any): string {
    return (s == null ? '' : String(s)).replace(/[&<>'"]/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[m] || m));
}

export function generatePdfHtml(
    isProe: boolean, 
    escopoCurso: string, 
    filtroAno: string, 
    dadosExportacao: any[]
): string {
    const dataAgora = new Date();
    const formatoData = dataAgora.toLocaleDateString('pt-BR');
    const formatoHora = dataAgora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataEmissao = `${formatoData} às ${formatoHora}`;

    const cardsHtml = dadosExportacao.map(i => {
        let headerCard = '';
        if (isProe) {
            headerCard = `
            <div class="card-header" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-size: 14px; font-weight: 900; text-transform: uppercase;">${escapeHTML(i.curso)}</span>
                    <span class="ref-badge">Ref: ${escapeHTML(i.ano)}</span>
                </div>
                <div class="dimension">Dimensão: ${escapeHTML(i.tipo)}</div>
            </div>`;
        } else {
            headerCard = `
            <div class="card-header">
                <span class="dimension">Dimensão: ${escapeHTML(i.tipo)}</span>
                <span class="ref-badge">Ref: ${escapeHTML(i.ano)}</span>
            </div>`;
        }

        return `
        <div class="fragility-card">
            ${headerCard}
            <div class="card-body">
                <div class="fields-grid">
                    <div class="field full">
                        <span class="field-label">4. Descrição da Fragilidade</span>
                        <span class="field-value">${escapeHTML(i.fragilidade).replace(/\n/g, '<br>')}</span>
                    </div>
                    <div class="field full">
                        <span class="field-label">7. Ação Prática Proposta</span>
                        <span class="field-value bold">${escapeHTML(i.acao).replace(/\n/g, '<br>')}</span>
                    </div>
                    <div class="field">
                        <span class="field-label">5. Fonte / 6. Conceito</span>
                        <span class="field-value">${escapeHTML(i.fonte)} <strong>(Nota: ${escapeHTML(i.conceito)})</strong></span>
                    </div>
                    <div class="field">
                        <span class="field-label">8. Data Final / 9. Responsável</span>
                        <span class="field-value"><strong>${escapeHTML(i.prazo)}</strong> — ${escapeHTML(i.responsavel)}</span>
                    </div>
                    <hr class="divider-dashed">
                    <div class="field full">
                        <span class="field-label">10. Recursos Necessários</span>
                        <span class="field-value">${escapeHTML(i.recursos).replace(/\n/g, '<br>')}</span>
                    </div>
                    <div class="meeting-box">
                        <div class="meeting-cell">
                            <span class="field-label">11. Data da Reunião</span>
                            <span class="field-value bold">${escapeHTML(formatDateTimeBR(i.dataReuniao))}</span>
                        </div>
                        <div class="meeting-cell">
                            <span class="field-label">12. Minuta da Reunião</span>
                            <span class="field-value italic">${escapeHTML(i.minutaReuniao || '-')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>${isProe ? 'Relatório Consolidado Institucional' : 'Relatório do Plano de Ação'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --black: #000000; --gray-dark: #333333; --gray-mid: #666666; --gray-light: #f2f2f2;
                --border: 1px solid #000; --border-thick: 2px solid #000; --font: 'IBM Plex Sans', Arial, sans-serif;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: var(--font); background: #d0d0d0; color: var(--black); }
            .page-wrapper { padding: 24px 16px 48px; }
            .a4 { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 18mm 20mm 16mm; box-shadow: 0 4px 32px rgba(0,0,0,0.25); display: flex; flex-direction: column; }
            .a4-body { flex: 1; }
            .doc-header { text-align: center; border-bottom: var(--border-thick); padding-bottom: 14px; margin-bottom: 18px; }
            .doc-header img { height: 64px; margin-bottom: 10px; filter: grayscale(100%); object-fit: contain; }
            .doc-header h1 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.3; }
            .doc-header h2 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gray-dark); margin-top: 4px; }
            .course-id { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
            .course-id .label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-mid); display: block; margin-bottom: 2px; }
            .course-id .value { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
            .course-id .right { text-align: right; }
            .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; border-left: 3px solid var(--black); padding-left: 8px; margin-bottom: 12px; }
            .fragility-card { border: var(--border); margin-bottom: 14px; page-break-inside: avoid; }
            .card-header { background: var(--gray-light); border-bottom: var(--border); padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
            .card-header .dimension { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
            .card-header .ref-badge { font-size: 8px; font-weight: 700; border: var(--border); padding: 2px 8px; background: white; letter-spacing: 0.05em; }
            .card-body { padding: 12px; }
            .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
            .field { display: flex; flex-direction: column; gap: 2px; }
            .field.full { grid-column: 1 / -1; }
            .field-label { font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-mid); }
            .field-value { font-size: 11px; font-weight: 400; color: var(--black); line-height: 1.4; }
            .field-value.bold { font-weight: 700; }
            .field-value.italic { font-style: italic; }
            .field-value strong { font-weight: 700; margin-left: 6px; }
            .divider-dashed { grid-column: 1 / -1; border: none; border-top: 1px dashed #999; margin: 2px 0; }
            .meeting-box { grid-column: 1 / -1; border: var(--border); display: grid; grid-template-columns: 1fr 1fr; }
            .meeting-cell { padding: 8px 10px; }
            .meeting-cell + .meeting-cell { border-left: var(--border); }
            .doc-footer { margin-top: auto; padding-top: 10px; border-top: var(--border-thick); display: flex; justify-content: space-between; align-items: center; }
            .doc-footer span { font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-mid); }
            
            @media print {
                @page { size: A4; margin: 0; }
                body { background: white !important; }
                .page-wrapper { padding: 0 !important; }
                .a4 { width: 100% !important; min-height: 100vh !important; margin: 0 !important; box-shadow: none !important; padding: 18mm 20mm 14mm !important; }
                * { border-radius: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .card-header { background: var(--gray-light) !important; }
                .fragility-card { page-break-inside: avoid !important; }
                .print-loading { display: none !important; }
                .no-print { display: none !important; }
            }
            .print-loading { position: fixed; top: 0; left: 0; right: 0; background: #1a1a2e; color: white; text-align: center; padding: 15px; font-size: 14px; font-weight: bold; z-index: 1000; font-family: sans-serif; }
        </style>
    </head>
    <body>
        <div class="print-loading no-print">Preparando o Relatório... A janela de impressão abrirá em instantes. 
            <button onclick="window.print()" style="margin-left: 10px; background: white; color: #1a1a2e; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-weight: bold;">
                Imprimir Manualmente
            </button>
        </div>
        <div class="page-wrapper">
        <div class="a4">
            <div class="a4-body">
                <header class="doc-header">
                    <img src="https://www.uems.br/anexos/imagens/conteudo/uems_imagens_2025-06-13_13-31-53.png" onerror="this.style.display='none'" alt="Logo UEMS">
                    <h1>Divisão de Gestão do ENADE e Indicadores da Educação Superior</h1>
                    <h2>${isProe ? 'Plano de Ação: Relatório Consolidado Institucional' : 'Relatório do Plano de Ação dos Cursos'}</h2>
                </header>

                <div class="course-id">
                    <div class="left">
                        <span class="label">${isProe ? 'Escopo do Relatório' : 'Curso / Unidade Acadêmica'}</span>
                        <span class="value">${escapeHTML(escopoCurso)}</span>
                    </div>
                    <div class="right">
                        <span class="label">${isProe ? 'Ano de Referência / Filtro' : 'Ano de Referência'}</span>
                        <span class="value">${escapeHTML(filtroAno)}</span>
                    </div>
                </div>

                <p class="section-title">Fragilidades Selecionadas (${dadosExportacao.length})</p>

                ${cardsHtml}

            </div>
            <footer class="doc-footer">
                <span>${isProe ? 'Sistema PROE - UEMS' : 'Documento Institucional UEMS'}</span>
                <span>Exportado em: ${dataEmissao}</span>
            </footer>
        </div>
        </div>
        <script>
            setTimeout(function() { window.print(); }, 1000);
        </script>
    </body>
    </html>`;
}
