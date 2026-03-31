import type { Route } from '@/types';

export const MOCK_ROUTES: Route[] = [
  {
    id: 'mock-001',
    name: 'City Tour Boa Vista — Clássico',
    client: 'Agência Makunaima Turismo',
    date: '2026-04-15',
    contact: 'Carlos Menezes',
    notes: 'Grupo confirmado. Solicitar van com ar-condicionado.',
    region: 'Boa Vista — RR',
    type: 'city_tour',
    fixedCosts: [
      { id: 'fc-1', label: 'Van 15 lugares (dia inteiro)', value: 350, category: 'transfer',    currency: 'BRL' },
      { id: 'fc-2', label: 'Guia local bilíngue',          value: 200, category: 'guia',        currency: 'BRL' },
      { id: 'fc-3', label: 'Almoço típico roraimense',     value: 180, category: 'alimentacao', currency: 'BRL' },
      { id: 'fc-4', label: 'Entrada Museu Integração',     value: 90,  category: 'ingresso',    currency: 'BRL' },
    ],
    variableCosts: [
      { id: 'vc-1', label: 'Administrativo', type: 'percentage', percentage: 10 },
      { id: 'vc-2', label: 'Comissão',       type: 'percentage', percentage: 10 },
      { id: 'vc-3', label: 'Encargos',       type: 'percentage', percentage: 12.5 },
      { id: 'vc-4', label: 'Taxas / Cartão', type: 'percentage', percentage: 4 },
    ],
    estimatedPrice: 120,
    simulationPax: 10,
    isExplorationMode: false,
    maxPax: 30,
    currency: 'BRL',
    days: [],
    isMultiDay: false,
    createdAt: '2026-03-20T14:32:00Z',
    updatedAt: '2026-03-22T09:15:00Z',
  },
];
