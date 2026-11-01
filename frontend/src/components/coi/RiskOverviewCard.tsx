import { CheckCircle2, AlertTriangle, XCircle, Link2, Users } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface RiskOverviewCardProps {
  level: 1 | 2;
  hasConflict: boolean;
  riskScore: number;
  relationships: string[];
  description: string;
  conflictType?: string;
  className?: string;
}

const RiskOverviewCard = ({
  level,
  hasConflict,
  riskScore,
  relationships,
  description,
  conflictType,
  className,
}: RiskOverviewCardProps) => {
  // Level-specific theming - using standard Tailwind classes
  const getLevelTheme = () => {
    if (level === 1) {
      return {
        headerBg: "bg-slate-900", // Standard class instead of JIT
        accentColor: "bg-blue-500",
        iconBg: "bg-white/10",
        icon: <Link2 className="h-5 w-5 text-white" />,
        title: conflictType?.includes("sector") ? "Level 1: Sector Overlap" : "Level 1: Direct Competitor Path",
        subtitle: conflictType?.includes("sector") ? "Screening signal · shared operating sector" : "Potential portfolio exposure · verify evidence",
        tagBg: "bg-blue-50",
        tagText: "text-blue-700",
        tagBorder: "border-blue-200"
      };
    }
    return {
      headerBg: "bg-slate-900", // Standard class instead of JIT
      accentColor: "bg-purple-500",
      iconBg: "bg-white/10",
      icon: <Users className="h-5 w-5 text-white" />,
      title: "Level 2: Indirect Competitor Path",
      subtitle: "Potential multi-hop exposure · verify evidence",
      tagBg: "bg-purple-50",
      tagText: "text-purple-700",
      tagBorder: "border-purple-200"
    };
  };

  // Risk-based theming - solid colors only
  const getRiskTheme = () => {
    if (riskScore <= 30) return {
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      statusBg: "bg-emerald-50",
      statusBorder: "border-emerald-300",
      statusText: "text-emerald-800",
      statusIcon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      barBg: "bg-emerald-500",
      label: "Low Risk"
    };
    if (riskScore <= 60) return {
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      statusBg: "bg-amber-50",
      statusBorder: "border-amber-300",
      statusText: "text-amber-800",
      statusIcon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
      barBg: "bg-amber-500",
      label: "Medium Risk"
    };
    return {
      badge: "bg-rose-100 text-rose-800 border-rose-300",
      statusBg: "bg-rose-50",
      statusBorder: "border-rose-300",
      statusText: "text-rose-800",
      statusIcon: <XCircle className="h-4 w-4 text-rose-600" />,
      barBg: "bg-rose-500",
      label: "High Risk"
    };
  };

  const theme = getLevelTheme();
  const risk = getRiskTheme();

  // Override for no conflict
  const finalRisk = !hasConflict ? {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    statusBg: "bg-emerald-50",
    statusBorder: "border-emerald-300",
    statusText: "text-emerald-800",
    statusIcon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    barBg: "bg-slate-300",
    label: "No Risk"
  } : risk;

  return (
    <div className={cn("rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white", className)}>
      {/* Compact Header with Solid Navy Background */}
      <div className={`${theme.headerBg} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className={`${theme.iconBg} backdrop-blur-sm p-2 rounded-lg border border-white/20`}>
            {theme.icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">{theme.title}</h3>
            <p className="text-xs text-slate-300 font-medium">{theme.subtitle}</p>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-md ${finalRisk.badge} border-2 text-[10px] font-bold uppercase tracking-wider`}>
          {finalRisk.label}
        </div>
      </div>

      {/* Compact Content Area */}
      <div className="p-4 space-y-3 bg-slate-50">
        {/* Status Row */}
        <div className="flex items-center justify-between gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${finalRisk.statusBg} border-2 ${finalRisk.statusBorder} ${finalRisk.statusText} flex-1`}>
            {finalRisk.statusIcon}
            <span className="text-xs font-bold">
              {hasConflict ? "Potential Conflict Path" : "No Path Found"}
            </span>
          </div>
          <div className="text-right bg-white px-3 py-2 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Screening Priority</div>
            <div className="text-lg font-black text-slate-900">{riskScore}<span className="text-xs text-slate-500">/100</span></div>
            <div className="mt-1 text-[9px] text-slate-400">Heuristic, not probability</div>
          </div>
        </div>

        {/* Risk Bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
            <div
              className={`h-full ${finalRisk.barBg} transition-all duration-700 ease-out`}
              style={{ width: `${riskScore}%` }}
            />
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-xs text-slate-700 font-medium leading-relaxed">{description}</p>
        </div>

        {/* Relationships */}
        {relationships.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Related Entities</div>
            <div className="flex flex-wrap gap-1.5">
              {relationships.slice(0, 3).map((rel, i) => (
                <div
                  key={i}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${theme.tagBg} ${theme.tagText} ${theme.tagBorder}`}
                >
                  {rel}
                </div>
              ))}
              {relationships.length > 3 && (
                <div className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                  +{relationships.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskOverviewCard;
