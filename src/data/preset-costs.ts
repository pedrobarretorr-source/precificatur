import type { CostCategory } from '@/types';

export interface PresetFixedCost {
  label: string;
  category: CostCategory;
}

export interface PresetVariableCost {
  label: string;
  emoji: string;
  type: 'percentage' | 'brl';
  defaultValue: number;
  perPax?: boolean;
}

export const PRESET_FIXED_COSTS: PresetFixedCost[] = [
  { label: 'Hospedagem', category: 'hospedagem' },
  { label: 'Van/Transfer', category: 'transfer' },
  { label: 'Guia de Turismo', category: 'guia' },
  { label: 'Guia Local', category: 'guia' },
  { label: 'Estacionamento', category: 'transfer' },
  { label: 'Alimentação Guia Turismo', category: 'guia' },
  { label: 'Alimentação Guia Local', category: 'guia' },
  { label: 'Hospedagem Guia Turismo', category: 'hospedagem' },
  { label: 'Hospedagem Guia Local', category: 'hospedagem' },
  { label: 'Aluguel de Equipamento', category: 'equipamento' },
  { label: 'Kit Primeiros Socorros', category: 'equipamento' },
  { label: 'Depreciação Equipamento', category: 'equipamento' },
  { label: 'Motorista', category: 'transfer' },
  { label: 'Seguro', category: 'seguro' },
  { label: 'Fotógrafo', category: 'outro' },
  { label: 'Serviços Gráficos', category: 'outro' },
];

export const PRESET_VARIABLE_COSTS: PresetVariableCost[] = [
  { label: 'Ingresso museu',          emoji: '🎫', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Taxa de visitação',       emoji: '🎫', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Refeição',                emoji: '🍽️', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Café da manhã',           emoji: '☕', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Ingresso show',           emoji: '🎭', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Hospedagem',              emoji: '🏨', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Camping',                 emoji: '⛺', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Seguro',                  emoji: '🛡️', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Brinde',                  emoji: '🎁', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Etiqueta de bagagem',     emoji: '🏷️', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Lanche de bordo',         emoji: '🥪', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Depreciação equipamento', emoji: '🎒', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Passagem aérea',          emoji: '✈️', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Passagem terrestre',      emoji: '🚌', type: 'brl', defaultValue: 0, perPax: true },
  { label: 'Passagem fluvial',        emoji: '⛵', type: 'brl', defaultValue: 0, perPax: true },
];
