import { useState, useMemo, useCallback } from 'react';
import type { CostItem, VariableCost, SimulationSummary } from '@/types';
import { DEFAULT_VARIABLE_COSTS } from '@/types';
import { runSimulation, calcReversePrice, calcTotalFixedCosts } from '@/lib/pricing-engine';
import { generateId } from '@/lib/utils';

interface UsePricingCalculatorReturn {
  // State
  routeName: string;
  fixedCosts: CostItem[];
  variableCosts: VariableCost[];
  estimatedPrice: number;
  maxPax: number;
  discounts: number;

  // Setters
  setRouteName: (name: string) => void;
  setEstimatedPrice: (price: number) => void;
  setMaxPax: (pax: number) => void;
  setDiscounts: (d: number) => void;

  // Cost management
  addFixedCost: (item: Omit<CostItem, 'id'>) => void;
  removeFixedCost: (id: string) => void;
  updateFixedCost: (id: string, updates: Partial<CostItem>) => void;
  updateVariableCost: (id: string, percentage: number) => void;

  // Computed
  simulation: SimulationSummary;
  totalFixedCosts: number;
  reversePrice: (desiredProfit: number, pax: number) => number;

  // Scenario keys (for relevant pax counts to highlight)
  keyScenarios: number[];
}

export function usePricingCalculator(): UsePricingCalculatorReturn {
  const [routeName, setRouteName] = useState('');
  const [fixedCosts, setFixedCosts] = useState<CostItem[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>(DEFAULT_VARIABLE_COSTS);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [maxPax, setMaxPax] = useState(50);
  const [discounts, setDiscounts] = useState(0);

  const addFixedCost = useCallback((item: Omit<CostItem, 'id'>) => {
    setFixedCosts(prev => [...prev, { ...item, id: generateId() }]);
  }, []);

  const removeFixedCost = useCallback((id: string) => {
    setFixedCosts(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateFixedCost = useCallback((id: string, updates: Partial<CostItem>) => {
    setFixedCosts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const updateVariableCost = useCallback((id: string, percentage: number) => {
    setVariableCosts(prev => prev.map(v => v.id === id ? { ...v, percentage } : v));
  }, []);

  const totalFixedCosts = useMemo(() => calcTotalFixedCosts(fixedCosts), [fixedCosts]);

  const simulation = useMemo(
    () => runSimulation(fixedCosts, variableCosts, estimatedPrice, maxPax, discounts),
    [fixedCosts, variableCosts, estimatedPrice, maxPax, discounts]
  );

  const reversePrice = useCallback(
    (desiredProfit: number, pax: number) =>
      calcReversePrice(desiredProfit, pax, totalFixedCosts, variableCosts, discounts),
    [totalFixedCosts, variableCosts, discounts]
  );

  const keyScenarios = useMemo(() => {
    const scenarios = [1, 5, 10, 15, 20, 30, 40, 50].filter(n => n <= maxPax);
    if (simulation.breakEvenPax && !scenarios.includes(simulation.breakEvenPax)) {
      scenarios.push(simulation.breakEvenPax);
      scenarios.sort((a, b) => a - b);
    }
    return scenarios;
  }, [maxPax, simulation.breakEvenPax]);

  return {
    routeName, fixedCosts, variableCosts, estimatedPrice, maxPax, discounts,
    setRouteName, setEstimatedPrice, setMaxPax, setDiscounts,
    addFixedCost, removeFixedCost, updateFixedCost, updateVariableCost,
    simulation, totalFixedCosts, reversePrice, keyScenarios,
  };
}
