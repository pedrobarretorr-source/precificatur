import type { CostCategory } from '@/types';

export interface PresetFixedCost {
  label: string;
  category: CostCategory;
}

// Custos variáveis pré-definidos sem tipo/valor fixo
// O usuário escolhe tipo e valor ao adicionar
export interface PresetVariableCost {
  label: string;
  emoji: string;
}

export const PRESET_FIXED_COSTS: PresetFixedCost[] = [
  // Transfer / Transporte
  { label: 'Van/Transfer', category: 'transfer' },
  { label: 'Ônibus', category: 'transfer' },
  { label: 'Embarcação', category: 'transfer' },
  { label: 'Motorista', category: 'transfer' },
  { label: 'Combustível', category: 'transfer' },
  { label: 'Pedágio', category: 'transfer' },
  { label: 'Estacionamento', category: 'transfer' },

  // Hospedagem
  { label: 'Hospedagem', category: 'hospedagem' },
  { label: 'Hospedagem Guia Turismo', category: 'hospedagem' },
  { label: 'Hospedagem Guia Local', category: 'hospedagem' },

  // Guia
  { label: 'Guia de Turismo', category: 'guia' },
  { label: 'Guia Local', category: 'guia' },
  { label: 'Condutor Ambiental', category: 'guia' },
  { label: 'Piloteiro/Barqueiro', category: 'guia' },
  { label: 'Alimentação Guia Turismo', category: 'guia' },
  { label: 'Alimentação Guia Local', category: 'guia' },

  // Alimentação (equipe / operação)
  { label: 'Alimentação Equipe', category: 'alimentacao' },
  { label: 'Coffee Break Equipe', category: 'alimentacao' },

  // Ingresso / Taxa (custo fixo do grupo)
  { label: 'Ingresso Grupo', category: 'ingresso' },
  { label: 'Taxa Ambiental', category: 'ingresso' },
  { label: 'Taxa de Acesso', category: 'ingresso' },

  // Equipamento
  { label: 'Aluguel de Equipamento', category: 'equipamento' },
  { label: 'Kit Primeiros Socorros', category: 'equipamento' },
  { label: 'Depreciação Equipamento', category: 'equipamento' },
  { label: 'Colete Salva-vidas', category: 'equipamento' },
  { label: 'Rádio Comunicação', category: 'equipamento' },

  // Seguro
  { label: 'Seguro', category: 'seguro' },
  { label: 'Seguro Embarcação', category: 'seguro' },

  // Outro
  { label: 'Fotógrafo', category: 'outro' },
  { label: 'Serviços Gráficos', category: 'outro' },
  { label: 'Material Impresso', category: 'outro' },
  { label: 'Limpeza/Higienização', category: 'outro' },
];

// Sugestões rápidas para custos variáveis (sem tipo/valor fixo)
export const PRESET_VARIABLE_COSTS: PresetVariableCost[] = [
  // Taxas e encargos
  { label: 'Taxa cartão', emoji: 'orange' },
  { label: 'Comissão', emoji: 'blue' },
  { label: 'Administrativo', emoji: 'purple' },
  { label: 'Encargos', emoji: 'red' },
  { label: 'Taxa de serviço', emoji: 'amber' },
  { label: 'Taxa operacional', emoji: 'yellow' },
  
  // Serviços por pessoa
  { label: 'Ingresso museu', emoji: 'teal' },
  { label: 'Taxa de visitação', emoji: 'teal' },
  { label: 'Refeição', emoji: 'green' },
  { label: 'Café da manhã', emoji: 'amber' },
  { label: 'Almoço', emoji: 'lime' },
  { label: 'Jantar', emoji: 'cyan' },
  { label: 'Ingresso show', emoji: 'violet' },
  { label: 'Hospedagem', emoji: 'cyan' },
  { label: 'Camping', emoji: 'lime' },
  { label: 'Seguro', emoji: 'indigo' },
  { label: 'Brinde', emoji: 'pink' },
  { label: 'Lanche', emoji: 'rose' },
  { label: 'Fotógrafo', emoji: 'fuchsia' },
  { label: 'Equipamento', emoji: 'orange' },
  { label: 'Transfer', emoji: 'blue' },
  { label: 'Guia local', emoji: 'purple' },
];