// ── Cost item ──
export interface CostItem {
  id: string;
  label: string;
  value: number;
  category: CostCategory;
  currency: Currency;
}

export type CostCategory =
  | 'transfer'
  | 'hospedagem'
  | 'alimentacao'
  | 'guia'
  | 'ingresso'
  | 'equipamento'
  | 'seguro'
  | 'outro';

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  transfer: 'Transfer / Transporte',
  hospedagem: 'Hospedagem',
  alimentacao: 'Alimentação',
  guia: 'Guia local',
  ingresso: 'Ingresso / Taxa',
  equipamento: 'Equipamento',
  seguro: 'Seguro',
  outro: 'Outro',
};

// ── Variable costs (% over price) ──
export interface VariableCost {
  id: string;
  label: string;
  percentage: number; // 0-100
}

export const DEFAULT_VARIABLE_COSTS: VariableCost[] = [
  { id: 'admin', label: 'Administrativo', percentage: 10 },
  { id: 'comissao', label: 'Comissão', percentage: 10 },
  { id: 'encargos', label: 'Encargos', percentage: 12.5 },
  { id: 'taxas', label: 'Taxas / Cartão', percentage: 4 },
];

// ── Currency ──
export type Currency = 'BRL' | 'USD' | 'EUR' | 'VES';

export const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: 'Real (R$)',
  USD: 'Dólar (US$)',
  EUR: 'Euro (€)',
  VES: 'Bolívar (Bs)',
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  BRL: 'R$',
  USD: 'US$',
  EUR: '€',
  VES: 'Bs',
};

// ── Route day (for multi-day) ──
export interface RouteDay {
  id: string;
  dayNumber: number;
  title: string;
  fixedCosts: CostItem[];
  isOptional: boolean;
}

// ── Route (main entity) ──
export interface Route {
  id: string;
  name: string;
  client: string;
  date: string;
  contact: string;
  notes: string;
  region: string;
  type: RouteType;
  // Costs
  fixedCosts: CostItem[];
  variableCosts: VariableCost[];
  // Pricing
  estimatedPrice: number;
  currency: Currency;
  // Multi-day
  days: RouteDay[];
  isMultiDay: boolean;
  // Meta
  createdAt: string;
  updatedAt: string;
}

export type RouteType =
  | 'city_tour'
  | 'trilha'
  | 'expedicao'
  | 'passeio_barco'
  | 'cultural'
  | 'aventura'
  | 'gastronomico'
  | 'outro';

export const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  city_tour: 'City Tour',
  trilha: 'Trilha',
  expedicao: 'Expedição',
  passeio_barco: 'Passeio de Barco',
  cultural: 'Cultural',
  aventura: 'Aventura',
  gastronomico: 'Gastronômico',
  outro: 'Outro',
};

// ── Simulation result (per passenger count) ──
export interface SimulationRow {
  pax: number;
  costPerPax: number;
  totalCost: number;
  estimatedPrice: number;
  revenue: number;
  partialResult: number;
  discounts: number;
  finalResult: number;
  margin: number; // percentage
}

// ── Simulation summary ──
export interface SimulationSummary {
  breakEvenPax: number | null; // minimum pax to profit
  rows: SimulationRow[];
  totalFixedCosts: number;
  totalVariableCostsPercent: number;
}
