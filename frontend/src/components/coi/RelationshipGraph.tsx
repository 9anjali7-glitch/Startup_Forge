import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Node {
  id: string;
  label: string;
  type: "investor" | "founder" | "company" | "target" | "sector";
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  type: "direct" | "indirect";
  label?: string;
}

interface RelationshipGraphProps {
  investorName?: string;
  targetCompany?: string;
  conflictLevel?: number;
  conflicts?: any[];
  level1Companies?: string[];
  conflictType?: string;
  graph?: { nodes?: Array<{ id: string; label: string; type: string }>; edges?: Array<{ from: string; to: string; relation?: string; evidence_type?: string }> };
}

const RelationshipGraph = ({ investorName, targetCompany, conflictLevel = 0, conflicts = [], level1Companies = [], conflictType = "", graph }: RelationshipGraphProps) => {
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Dynamic Graph Generation
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    if (!investorName || !targetCompany) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if (graph?.nodes?.length) {
      const apiNodes = graph.nodes;
      const apiEdges = graph.edges || [];
      const layerFor = (type: string) => type === "investor" ? 0 : type === "target" ? 3 : type === "sector" ? 2 : conflictLevel === 2 ? 1 + Math.max(0, apiNodes.filter(n => n.type === "company").findIndex(n => n.type === type)) : 1;
      // Place nodes by path order and spread branches vertically.
      const companyNodes = apiNodes.filter(n => n.type === "company");
      const positioned = apiNodes.map((node) => {
        const layer = node.type === "investor" ? 0 : node.type === "target" ? 3 : node.type === "sector" ? 2 : (conflictLevel === 2 ? Math.max(1, companyNodes.findIndex(n => n.id === node.id) + 1) : 1);
        const x = 90 + layer * 205;
        const siblings = apiNodes.filter(n => n.type === node.type && (n.type === "company" || n.type === "sector"));
        const index = siblings.findIndex(n => n.id === node.id);
        const y = siblings.length > 1 ? 120 + index * (220 / (siblings.length - 1)) : 200;
        return { id: node.id, label: node.label, type: (node.type === "investor" || node.type === "target" || node.type === "sector" ? node.type : "company") as Node["type"], x, y };
      });
      newNodes.push(...positioned);
      newEdges.push(...apiEdges.map(edge => ({
        from: edge.from,
        to: edge.to,
        type: edge.relation === "OPERATES_IN" ? "indirect" as const : "direct" as const,
        label: (edge.relation || "Relationship").replaceAll("_", " ").toLowerCase(),
      })));
    } else {
    // Fallback for older API responses without an explicit graph.
    newNodes.push({ id: "inv", label: investorName || "Investor", type: "investor", x: 90, y: 200 });
    newNodes.push({ id: "tgt", label: targetCompany || "Target", type: "target", x: 705, y: 200 });

    if (conflictLevel === 1) {
      // Level 1: Investor -> portfolio company -> target. A same-sector match
      // is drawn as a dashed screening signal; explicit competition is solid.
      const sectorOnly = conflictType.includes("sector");
      level1Companies.slice(0, 3).forEach((comp, i) => {
        const id = `l1-${i}`;
        newNodes.push({ id, label: comp, type: "company", x: 400, y: 100 + (i * 80) });
        newEdges.push({ from: "inv", to: id, type: "direct", label: "Invested In" });
        newEdges.push({ from: id, to: "tgt", type: sectorOnly ? "indirect" : "direct", label: sectorOnly ? "Shared Sector" : "Competes With" });
      });
    } else if (conflictLevel === 2) {
      // Level 2: Investor -> Parent -> Subsidiary -> Target
      conflicts.slice(0, 2).forEach((conf, i) => {
        const pid = `p-${i}`;
        const sid = `s-${i}`;
        const yOffset = i * 100;

        newNodes.push({ id: pid, label: conf.investedParent, type: "company", x: 300, y: 100 + yOffset });
        newNodes.push({ id: sid, label: conf.competingSubsidiary, type: "company", x: 500, y: 100 + yOffset });

        newEdges.push({ from: "inv", to: pid, type: "direct", label: "Invested In" });
        newEdges.push({ from: pid, to: sid, type: "direct", label: "Subsidiary" });
        // The conflict is indirect across the ownership path, but this individual
        // COMPETES_WITH edge is still a recorded relationship and stays solid.
        newEdges.push({ from: sid, to: "tgt", type: "direct", label: "Competes With" });
      });
    }
    }

    setNodes(newNodes);
    setEdges(newEdges);

  }, [investorName, targetCompany, conflictLevel, conflicts, level1Companies, conflictType, graph]);


  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      investor: "#4F46E5",
      founder: "#9333EA",
      company: "#0EA5E9",
      target: "#EF4444",
      sector: "#F59E0B",
    };
    return colors[type] || "#6B7280";
  };

  const getNodeBgColor = (type: string) => {
    const colors: Record<string, string> = {
      investor: "#EEF2FF",
      founder: "#FAF5FF",
      company: "#F0F9FF",
      target: "#FEF2F2",
      sector: "#FFFBEB",
    };
    return colors[type] || "#F9FAFB";
  };

  const getEdgePath = (from: Node, to: Node) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    // Simple Bezier
    const cx1 = from.x + dx * 0.4;
    const cy1 = from.y;
    const cx2 = from.x + dx * 0.6;
    const cy2 = to.y;
    return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
  };

  return (
    <Card className="animate-fade-in bg-white border-border rounded-[2.5rem] shadow-sm overflow-hidden border-none uppercase tracking-widest">
      <CardHeader className="pb-3 p-8">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Network className="h-5 w-5 text-primary" />
            </div>
            Relationship Graph
          </CardTitle>

          <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-white transition-all"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-sm font-bold text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-white transition-all"
              onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-t border-slate-100 bg-white px-5 py-3 text-sm normal-case tracking-normal">
          {conflictLevel === 2 ? <span className="font-semibold text-amber-700">Indirect conflict path detected through recorded ownership.</span> : conflictLevel === 1 ? <span className="font-semibold text-rose-700">Direct portfolio conflict path detected.</span> : <span className="font-medium text-slate-600">No direct or indirect conflict path found in the recorded graph.</span>}
          <span className="ml-2 text-slate-500">Each arrow shows a recorded relationship; demo fixtures are synthetic.</span>
        </div>
        <div className="relative border-t border-border/50 bg-[#F8FAFC] overflow-hidden" style={{ height: 400 }}>
          <svg
            id="coi-relationship-graph-svg"
            width="100%"
            height="100%"
            viewBox="0 0 800 400"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
            className="transition-transform duration-200"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
              </marker>
              <marker
                id="arrowhead-dashed"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#D1D5DB" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((edge, i) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const midX = (fromNode.x + toNode.x) / 2;
              const midY = (fromNode.y + toNode.y) / 2 - 10;

              return (
                <g key={i}>
                  <path
                    d={getEdgePath(fromNode, toNode)}
                    fill="none"
                    stroke={edge.type === "direct" ? "#9CA3AF" : "#D1D5DB"}
                    strokeWidth={edge.type === "direct" ? 2 : 1.5}
                    strokeDasharray={edge.type === "indirect" ? "6,4" : "none"}
                    markerEnd={edge.type === "direct" ? "url(#arrowhead)" : "url(#arrowhead-dashed)"}
                    className="transition-all duration-200"
                  />
                  {edge.label && (
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-200"
                style={{
                  transform: hoveredNode === node.id ? "scale(1.05)" : "scale(1)",
                  transformOrigin: `${node.x}px ${node.y}px`,
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={hoveredNode === node.id ? 34 : 30}
                  fill={getNodeBgColor(node.type)}
                  stroke={getNodeColor(node.type)}
                  strokeWidth={2}
                  className="transition-all duration-200"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={12}
                  fill={getNodeColor(node.type)}
                />
                <text
                  x={node.x}
                  y={node.y + 50}
                  textAnchor="middle"
                  className="fill-foreground text-xs font-medium"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
};

export default RelationshipGraph;
