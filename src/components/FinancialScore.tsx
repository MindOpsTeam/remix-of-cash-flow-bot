import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface FinancialScoreProps {
  revenue: number;
  expense: number;
  prevRevenue: number;
  prevExpense: number;
}

function getScoreData(revenue: number, expense: number, prevRevenue: number, prevExpense: number) {
  let score = 50;
  const tips: string[] = [];

  const profit = revenue - expense;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  if (margin > 30) { score += 20; tips.push("Margem excelente acima de 30%"); }
  else if (margin > 15) { score += 10; tips.push("Margem saudável"); }
  else if (margin > 0) { score += 5; tips.push("Margem baixa — busque otimizar custos"); }
  else { score -= 15; tips.push("⚠️ Operando com prejuízo!"); }

  if (prevRevenue > 0) {
    const growth = ((revenue - prevRevenue) / prevRevenue) * 100;
    if (growth > 10) { score += 15; tips.push("Receita crescendo — ótimo sinal!"); }
    else if (growth > 0) { score += 5; tips.push("Receita estável"); }
    else { score -= 10; tips.push("Receita em queda — atenção!"); }
  }

  if (prevExpense > 0) {
    const expGrowth = ((expense - prevExpense) / prevExpense) * 100;
    if (expGrowth < 0) { score += 10; tips.push("Despesas reduzidas — gestão eficiente"); }
    else if (expGrowth > 20) { score -= 10; tips.push("Despesas crescendo rápido"); }
  }

  if (revenue === 0 && expense === 0) { score = 0; tips.length = 0; tips.push("Adicione lançamentos para calcular o score"); }

  score = Math.max(0, Math.min(100, score));
  
  const level = score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : score >= 20 ? "Atenção" : "Crítico";
  const color = score >= 80 ? "hsl(var(--revenue))" : score >= 60 ? "hsl(var(--chart-5))" : score >= 40 ? "hsl(var(--warning))" : score >= 20 ? "hsl(38, 92%, 50%)" : "hsl(var(--expense))";
  const badge = score >= 80 ? "🏆" : score >= 60 ? "✅" : score >= 40 ? "📊" : score >= 20 ? "⚠️" : "🔴";

  return { score, level, color, badge, tips };
}

export function FinancialScore({ revenue, expense, prevRevenue, prevExpense }: FinancialScoreProps) {
  const { score, level, color, badge, tips } = getScoreData(revenue, expense, prevRevenue, prevExpense);
  const [animatedScore, setAnimatedScore] = useState(0);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1500;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimatedScore(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-card animate-slide-up" style={{ animationDelay: "200ms", animationFillMode: "backwards" }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Score Financeiro</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative flex items-center justify-center shrink-0">
          <svg width="130" height="130" className="-rotate-90">
            <circle cx="65" cy="65" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <circle
              cx="65" cy="65" r="54" fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold font-mono text-foreground">{animatedScore}</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">de 100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{badge}</span>
            <span className="text-lg font-bold" style={{ color }}>{level}</span>
          </div>
          <div className="space-y-1.5">
            {tips.slice(0, 3).map((tip, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">•</span>
                {tip}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
