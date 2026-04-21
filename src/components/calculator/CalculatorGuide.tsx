import { cn } from '@/lib/utils';

interface CalculatorGuideProps {
  step: number;
  compact?: boolean;
}

const GUIDE_MESSAGES = [
  'Vamos começar! O nome do roteiro é como você vai identificar esse passeio depois. Quanto mais descritivo, mais fácil de encontrar nas suas análises.',
  'Aqui entram os gastos que existem independente de quantas pessoas vão. Van, hotel, guia. Seja com 2 ou 20 passageiros, você paga do mesmo jeito.',
  'Aqui você adiciona serviços extras por pessoa. Podem ser taxas, comissões, ou serviços adicionais como fotografia, alimentação, etc.',
  'Aqui está o coração da precificação! Defina o preço que quer cobrar, ou diga qual margem de lucro quer ter, e a calculadora encontra o valor ideal.',
  'Pronto! Observe o ponto de equilíbrio: é o mínimo de passageiros para não ter prejuízo. Qualquer passageiro acima disso já é lucro!',
];

const STEP_TITLES = [
  'Guia PrecificaTur',
  'Guia PrecificaTur',
  'Guia PrecificaTur',
  'Guia PrecificaTur',
  'Guia PrecificaTur',
];

export function CalculatorGuide({ step, compact = false }: CalculatorGuideProps) {
  const message = GUIDE_MESSAGES[step] || GUIDE_MESSAGES[0];

  if (compact) {
    return (
      <div className="bg-brand-navy-50 border border-brand-blue-200 rounded-xl p-3 flex items-start gap-2">
        <img
          src="./AVATAR-TESTE.png"
          alt="Guia PrecificaTur"
          className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-brand-navy mb-0.5">{STEP_TITLES[step]}</p>
          <p className="text-xs text-brand-navy-800 leading-relaxed">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Avatar flutuante */}
      <div className="flex items-start gap-3 animate-fade-in">
        <div className="relative flex-shrink-0">
          <img
            src="./AVATAR-TESTE.png"
            alt="Guia PrecificaTur"
            className="w-14 h-14 rounded-full object-cover shadow-lg ring-4 ring-brand-blue-100"
          />
          {/* Badge da etapa */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-navy rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white">
            {step + 1}
          </div>
        </div>
        
        {/* Balão de fala */}
        <div className="flex-1 bg-brand-navy-50 border border-brand-blue-200 rounded-2xl rounded-tl-sm p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-brand-navy uppercase tracking-wide">
              {STEP_TITLES[step]}
            </span>
            <div className="flex-1 h-px bg-brand-blue-200" />
          </div>
          <p className="text-sm text-brand-navy-800 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
