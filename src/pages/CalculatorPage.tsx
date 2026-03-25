import { usePricingCalculator } from '@/hooks/usePricingCalculator';
import { FixedCostsForm } from '@/components/calculator/FixedCostsForm';
import { VariableCostsForm } from '@/components/calculator/VariableCostsForm';
import { SimulationResults } from '@/components/calculator/SimulationResults';
import { formatBRL } from '@/lib/pricing-engine';
import { Calculator, Lightbulb } from 'lucide-react';

export function CalculatorPage() {
  const calc = usePricingCalculator();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
              <Calculator size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-brand-navy">
              Calculadora de precificação
            </h1>
          </div>
          <p className="text-sm text-surface-500 ml-[52px]">
            Preencha os custos e o preço desejado para simular seus resultados.
          </p>
        </div>
      </div>

      {/* Route name + price row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <label className="input-label">Nome do roteiro</label>
          <input
            className="input"
            placeholder="Ex: City Tour Boa Vista"
            value={calc.routeName}
            onChange={e => calc.setRouteName(e.target.value)}
          />
        </div>
        <div>
          <label className="input-label">Preço estimado por pax (R$)</label>
          <input
            type="number"
            className="input text-xl font-extrabold text-brand-navy"
            placeholder="0,00"
            value={calc.estimatedPrice || ''}
            onChange={e => calc.setEstimatedPrice(parseFloat(e.target.value) || 0)}
          />
          <p className="input-hint">
            Defina o valor que pretende cobrar por passageiro
          </p>
        </div>
        <div>
          <label className="input-label">Simular até (pax)</label>
          <input
            type="number"
            className="input"
            min={5}
            max={210}
            value={calc.maxPax}
            onChange={e => calc.setMaxPax(parseInt(e.target.value) || 50)}
          />
          <p className="input-hint">
            Quantidade máxima de passageiros na simulação
          </p>
        </div>
      </div>

      {/* Reverse pricing tip */}
      {calc.totalFixedCosts > 0 && calc.estimatedPrice === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-gold-50 border border-brand-gold-200">
          <Lightbulb size={18} className="text-brand-gold-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand-gold-800">Dica: precificação reversa</p>
            <p className="text-xs text-brand-gold-700 mt-0.5">
              Seus custos fixos somam {formatBRL(calc.totalFixedCosts)}.
              Para lucrar R$ 500 com 10 passageiros, o preço precisa ser pelo menos{' '}
              <strong>{formatBRL(calc.reversePrice(500, 10))}</strong> por pessoa.
            </p>
          </div>
        </div>
      )}

      {/* Costs grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <FixedCostsForm
          costs={calc.fixedCosts}
          totalFixed={calc.totalFixedCosts}
          onAdd={calc.addFixedCost}
          onRemove={calc.removeFixedCost}
          onUpdate={calc.updateFixedCost}
        />
        <VariableCostsForm
          costs={calc.variableCosts}
          onUpdate={calc.updateVariableCost}
        />
      </div>

      {/* Simulation results */}
      <SimulationResults
        simulation={calc.simulation}
        keyScenarios={calc.keyScenarios}
        estimatedPrice={calc.estimatedPrice}
      />
    </div>
  );
}
