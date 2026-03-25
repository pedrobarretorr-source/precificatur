# PrecificaTur 🏷️🗺️

**Solução digital para precificação de roteiros turísticos**

Plataforma web para guias de turismo, agências receptivas e organizadores de roteiros precificarem suas operações com precisão, simularem cenários e tomarem decisões financeiras informadas.

## 🎨 Design System

Cores da marca (do Manual de Identidade Visual):
- **Azul navy** `#203478` — cor institucional principal
- **Azul médio** `#557ABC` — elementos secundários
- **Laranja** `#EC6907` — CTAs, destaques, energia
- **Laranja claro** `#F28B32` — apoio
- **Amarelo** `#FEC82F` — acentos e alertas

Tipografia: **Nunito** (web equivalent of New Atten Round)

## 🚀 Início rápido

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 📁 Estrutura do projeto

```
src/
├── components/
│   ├── calculator/       # Componentes da calculadora de precificação
│   │   ├── FixedCostsForm.tsx
│   │   ├── VariableCostsForm.tsx
│   │   └── SimulationResults.tsx
│   ├── dashboard/        # Componentes do dashboard (futuro)
│   ├── layout/           # Sidebar, Header, etc.
│   │   └── Sidebar.tsx
│   └── ui/               # Componentes reutilizáveis (buttons, inputs, cards)
├── hooks/
│   └── usePricingCalculator.ts  # State management da calculadora
├── lib/
│   ├── pricing-engine.ts        # 🔥 Motor de cálculo (lógica da planilha)
│   └── utils.ts
├── pages/
│   ├── CalculatorPage.tsx       # Página principal da calculadora
│   └── DashboardPage.tsx        # Dashboard com visão geral
├── styles/
│   └── globals.css              # Tailwind + design system PrecificaTur
├── types/
│   └── index.ts                 # TypeScript types (CostItem, Route, etc.)
├── App.tsx
└── main.tsx
```

## 🧮 Motor de cálculo

A lógica de precificação (em `src/lib/pricing-engine.ts`) é baseada na planilha validada da Makunaima:

- **Custo por pax** = (Total fixo ÷ Qtd passageiros) + Total variável
- **Variável** = Soma dos percentuais × Preço estimado
- **Receita** = Preço × Qtd passageiros
- **Resultado** = Receita − Custo total − Descontos
- **Precificação reversa**: dado lucro desejado e qtd pax, calcula o preço necessário
- **Margem de segurança**: ajuste percentual sobre o preço base

## 📋 Módulos planejados

| # | Módulo | Status |
|---|--------|--------|
| 1 | Calculadora de precificação | ✅ Implementado (MVP) |
| 2 | Simulador de cenários | 🔲 Planejado |
| 3 | Gestão de roteiros | 🔲 Planejado |
| 4 | Roteiros multi-dia | 🔲 Fase 2 |
| 5 | Câmbio automático | 🔲 Fase 2 |
| 6 | Relatórios e PDF | 🔲 Fase 2 |
| 7 | Benchmark regional | 🔲 Fase 3 |
| 8 | Módulo educacional | 🔲 Transversal |

## 🛠 Stack

- **React 18** + TypeScript
- **Vite** (build tool)
- **Tailwind CSS** (design system customizado)
- **Recharts** (gráficos)
- **Lucide React** (ícones)

## 📄 Documentação

- `Precificatur_Especificacao_Funcional.docx` — Documento completo de especificação
- `MIV_Precificatur.pdf` — Manual de Identidade Visual
- `Planilha_de_Precificação_Makunaima.xlsx` — Planilha original (referência de cálculo)

---

**Cliente:** Makunaima Soluções em Turismo  
**Desenvolvido por:** Optrafy
