import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface AIInsightCardProps {
  text: string;
  linkTo?: string;
  linkLabel?: string;
}

export function AIInsightCard({ text, linkTo = "/cfo-digital", linkLabel = "Ver análise completa" }: AIInsightCardProps) {
  if (!text) return null;

  return (
    <div 
      className="border-l-[3px] border-l-primary bg-gradient-to-r from-[hsl(226,100%,97%)] to-card rounded-lg p-5 animate-slide-up shadow-card"
      style={{ animationDelay: "400ms", animationFillMode: "backwards" }}
    >
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary mb-1">Insight da IA</p>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{text}</p>
          <Link 
            to={linkTo}
            className="inline-flex items-center gap-1 text-[13px] text-primary font-medium mt-3 hover:underline transition-colors"
          >
            {linkLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
