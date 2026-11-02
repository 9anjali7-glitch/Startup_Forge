import { useState, useEffect } from "react";
import { ChevronRight, FileText, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

export interface ConflictExplanationData {
  level: number;
  path: string[];
  reason: string;
  severity?: "low" | "medium" | "high";
}

interface ConflictExplanationPanelProps {
  conflicts?: ConflictExplanationData[];
  hideHeader?: boolean;
  className?: string;
}

interface ConflictPath {
  id: string;
  path: string[];
  severity: "low" | "medium" | "high";
  explanation: string;
}

const ConflictExplanationPanel = ({
  conflicts = [],
  hideHeader = false,
  className
}: ConflictExplanationPanelProps) => {
  const [conflictPaths, setConflictPaths] = useState<ConflictPath[]>([]);

  useEffect(() => {
    if (conflicts && conflicts.length > 0) {
      const mapped: ConflictPath[] = conflicts.map((c, i) => ({
        id: i.toString(),
        path: c.path,
        severity: c.severity || (c.level === 2 ? "high" : "medium"),
        explanation: c.reason
      }));
      setConflictPaths(mapped);
      // Select the first one by default
      if (mapped.length > 0) {
        setSelectedPath(mapped[0].id);
      }
    } else {
      setConflictPaths([]);
      setSelectedPath("");
    }
  }, [conflicts]);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "high":
        return {
          badge: "bg-destructive/10 text-destructive border-destructive/20",
          dot: "bg-destructive",
        };
      case "medium":
        return {
          badge: "bg-warning/10 text-warning border-warning/20",
          dot: "bg-warning",
        };
      default:
        return {
          badge: "bg-success/10 text-success border-success/20",
          dot: "bg-success",
        };
    }
  };

  const [selectedPath, setSelectedPath] = useState<string>("");

  const selectedConflict = conflictPaths.find(p => p.id === selectedPath);

  return (
    <Card className={cn("animate-fade-in h-full bg-white border-border rounded-[2.5rem] shadow-sm overflow-hidden border-none", className)}>
      {!hideHeader && (
        <CardHeader className="pb-3 p-8">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            Conflict Explanation
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className="p-0">
        {conflictPaths.length > 0 ? (
          <div className="grid md:grid-cols-2">
            {/* Left: Conflict Paths */}
            <div className="p-8 border-r border-border/50">
              <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">
                Detected Conflict Paths
              </h4>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {conflictPaths.map((conflict) => {
                    const styles = getSeverityStyles(conflict.severity);
                    const isSelected = selectedPath === conflict.id;

                    return (
                      <button
                        key={conflict.id}
                        onClick={() => setSelectedPath(conflict.id)}
                        className={`w-full text-left p-4 rounded-[1.5rem] border transition-all duration-300 ${isSelected
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                          : "border-border/50 hover:border-primary/20 hover:bg-secondary/30"
                          }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className={`${styles.badge} rounded-full font-bold px-2 py-0.5 text-[10px] uppercase tracking-tighter`}>
                            {conflict.severity} severity
                          </Badge>
                          <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? "text-primary rotate-90" : "text-muted-foreground"
                            }`} />
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {conflict.path.map((node, i) => (
                            <span key={i} className="flex items-center text-xs">
                              <span className={`font-bold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                                {node}
                              </span>
                              {i < conflict.path.length - 1 && (
                                <ChevronRight className="h-3 w-3 text-muted-foreground/50 mx-1" />
                              )}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right: Explanation */}
            <div className="p-8 bg-[#F8FAFC]">
              <h4 className="text-sm font-bold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Info className="h-4 w-4" />
                Plain-English Explanation
              </h4>

              {selectedConflict ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-wrap items-center gap-2 p-4 rounded-[1.5rem] bg-white border border-border shadow-sm">
                    {selectedConflict.path.map((node, i) => (
                      <span key={i} className="flex items-center">
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${i === 0
                          ? "bg-primary text-white"
                          : i === selectedConflict.path.length - 1
                            ? "bg-destructive text-white"
                            : "bg-secondary text-foreground"
                          }`}>
                          {node}
                        </span>
                        {i < selectedConflict.path.length - 1 && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 mx-1" />
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="p-6 rounded-[1.5rem] bg-white border border-border shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ${getSeverityStyles(selectedConflict.severity).dot}`} />
                      <p className="text-base text-foreground font-medium leading-relaxed">
                        {selectedConflict.explanation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] bg-primary/5 border border-primary/10">
                    <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground font-medium leading-normal">
                      Screening output only. Verify each relationship against reliable source documents before making an investment or compliance decision.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground text-sm">
                  Select a conflict path to view details.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px] gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center">
              <FileText className="h-8 w-8 text-slate-300" />
            </div>
            <div>
              <h3 className="font-bold text-slate-700">No recorded match found</h3>
              <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                No matching relationship path is currently recorded for these names. Unrecorded relationships may still exist.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConflictExplanationPanel;
