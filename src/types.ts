export type StatusAcompanhamento = 
  | 'Em Andamento'
  | 'Concluída'
  | 'Não Concluída'
  | 'Suspensa';

export interface Acompanhamento {
  dataRegistro: string;
  status: StatusAcompanhamento;
  descricao: string;
  registradoPor: string;
}

export interface Fragility {
    _id?: string;
    id?: string;
    ano: string;
    codigoCurso: string;
    curso: string;
    tipo: string;
    fragilidade: string;
    fonte: string;
    conceito: string;
    acao: string;
    prazo: string;
    responsavel: string;
    recursos: string;
    dataReuniao: string;
    minutaReuniao: string;
    acompanhamentos?: Acompanhamento[];
    statusAtual?: StatusAcompanhamento;
}

export interface User {
    role: 'reitoria' | 'coordenador';
    courseId?: string;
    courseName?: string;
    courses?: Record<string, string>;
    emailRegistrado?: boolean;
    podeEditar?: boolean;
}

export type ViewState = 'login' | 'formulario' | 'dashboard';
