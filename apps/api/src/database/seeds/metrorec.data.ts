import { Sentido } from '@sinaleiro/types/enums';

export interface EstacaoSeed {
  nome: string;
  latitude: number;
  longitude: number;
}

export interface LinhaSeed {
  nome: string;
  cor: string;
  sentidos: Sentido[];
  estacoes: EstacaoSeed[];
}

export const METROREC_DATA: LinhaSeed[] = [
  {
    nome: 'Linha Centro - Ramal Camaragibe',
    cor: '#E31C23', // Vermelho
    sentidos: [Sentido.IDA, Sentido.VOLTA],
    estacoes: [
      { nome: 'Recife', latitude: -8.067794, longitude: -34.885139 },
      { nome: 'Joana Bezerra', latitude: -8.073611, longitude: -34.896389 },
      { nome: 'Afogados', latitude: -8.077222, longitude: -34.909444 },
      { nome: 'Ipiranga', latitude: -8.076667, longitude: -34.922222 },
      { nome: 'Mangueira', latitude: -8.076111, longitude: -34.931944 },
      { nome: 'Santa Luzia', latitude: -8.075833, longitude: -34.941667 },
      { nome: 'Edgar Werneck', latitude: -8.076389, longitude: -34.953611 },
      { nome: 'Barro', latitude: -8.081111, longitude: -34.966389 },
      { nome: 'Tejipió', latitude: -8.076667, longitude: -34.977222 },
      { nome: 'Coqueiral', latitude: -8.073056, longitude: -34.986944 },
      { nome: 'Alto do Céu', latitude: -8.062778, longitude: -34.996111 },
      { nome: 'Curado', latitude: -8.053056, longitude: -35.004444 },
      { nome: 'Rodoviária', latitude: -8.043333, longitude: -35.013889 },
      { nome: 'Cosme e Damião', latitude: -8.033611, longitude: -35.022222 },
      { nome: 'Camaragibe', latitude: -8.023889, longitude: -35.030833 },
    ],
  },
  {
    nome: 'Linha Centro - Ramal Jaboatão',
    cor: '#F37021', // Laranja
    sentidos: [Sentido.IDA, Sentido.VOLTA],
    estacoes: [
      { nome: 'Cavaleiro', latitude: -8.088889, longitude: -34.991944 },
      { nome: 'Floriano', latitude: -8.098611, longitude: -35.004167 },
      { nome: 'Engenho Velho', latitude: -8.106667, longitude: -35.013889 },
      { nome: 'Jaboatão', latitude: -8.111944, longitude: -35.022778 },
    ],
  },
  {
    nome: 'Linha Sul',
    cor: '#0054A6', // Azul
    sentidos: [Sentido.IDA, Sentido.VOLTA],
    estacoes: [
      { nome: 'Imbiribeira', latitude: -8.093056, longitude: -34.906111 },
      { nome: 'Antônio Falcão', latitude: -8.107222, longitude: -34.910278 },
      { nome: 'Shopping', latitude: -8.118056, longitude: -34.913056 },
      { nome: 'Tancredo Neves', latitude: -8.128611, longitude: -34.915833 },
      { nome: 'Aeroporto', latitude: -8.138889, longitude: -34.918889 },
      { nome: 'Porta Larga', latitude: -8.151944, longitude: -34.922222 },
      { nome: 'Monte dos Guararapes', latitude: -8.163611, longitude: -34.925556 },
      { nome: 'Prazeres', latitude: -8.174444, longitude: -34.928889 },
      { nome: 'Cajueiro Seco', latitude: -8.186944, longitude: -34.932778 },
    ],
  },
  {
    nome: 'Linha Diesel (VLT) - Ramal Cabo',
    cor: '#00A651', // Verde
    sentidos: [Sentido.IDA, Sentido.VOLTA],
    estacoes: [
      { nome: 'Ângelo de Souza', latitude: -8.203056, longitude: -34.946944 },
      { nome: 'Pontezinha', latitude: -8.221667, longitude: -34.965833 },
      { nome: 'Ponte dos Carvalhos', latitude: -8.248333, longitude: -34.994444 },
      { nome: 'Santo Inácio', latitude: -8.271944, longitude: -35.019167 },
      { nome: 'Cabo', latitude: -8.286944, longitude: -35.034722 },
    ],
  },
  {
    nome: 'Linha Diesel (VLT) - Ramal Curado',
    cor: '#7AC143', // Verde Claro
    sentidos: [Sentido.IDA, Sentido.VOLTA],
    estacoes: [
      { nome: 'Jorge Lins', latitude: -8.075278, longitude: -34.996111 },
      { nome: 'Marcos Freire', latitude: -8.125556, longitude: -34.961944 },
      { nome: 'Sotave', latitude: -8.156111, longitude: -34.946944 },
    ],
  },
];
