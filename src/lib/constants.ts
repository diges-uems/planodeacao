export const API_URL = "https://script.google.com/macros/s/AKfycbzVUpywmkEqBRAjINdhDrvNmrQSFlqP4zFlxir8paq6z0NXsXYaX0uFrN5RrLHmUltE0A/exec";

export const DIMENSIONS = [
    "Organização Didático-Pedagógica",
    "Corpo Docente e Tutorial",
    "Infraestrutura"
];

export const SOURCES = [
    "Relatório Enade (INEP)",
    "Avaliação in loco (CEE/MS)",
    "Relatório de Autoavaliação",
    "Outra"
];

// Prefixo usado para gravar uma fonte digitada livremente (opção "Outra") dentro do
// próprio campo "fonte", sem precisar de uma coluna nova na planilha.
export const OUTRA_FONTE_PREFIXO = "Outra: ";
