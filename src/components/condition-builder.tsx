import { Fragment } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConditionNode, ConditionLeaf, ConditionBranch, IndicatorInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

// Must match src/screener/conditions.py's _OPERATORS allowlist exactly -- anything else
// here would look selectable but fail with a 400 the moment it's actually submitted.
const OPS = [">", ">=", "<", "<=", "==", "!="];

function isLeaf(n: ConditionNode): n is ConditionLeaf {
  return "left" in n && "right" in n;
}
function emptyLeaf(indicators: IndicatorInfo[]): ConditionLeaf {
  const first = indicators[0];
  const field = first?.output_fields?.[0] ?? "value";
  return {
    left: { indicator: first?.name ?? "", field },
    op: ">",
    right: { value: 0 },
  };
}

export function ConditionBuilder({
  value,
  onChange,
  indicators,
}: {
  value: ConditionNode | null;
  onChange: (v: ConditionNode) => void;
  indicators: IndicatorInfo[];
}) {
  const node = value ?? emptyLeaf(indicators);
  return (
    <div className="rounded border bg-muted/30 p-2">
      <NodeEditor node={node} onChange={onChange} indicators={indicators} depth={0} />
    </div>
  );
}

function NodeEditor({
  node,
  onChange,
  indicators,
  depth,
}: {
  node: ConditionNode;
  onChange: (v: ConditionNode) => void;
  indicators: IndicatorInfo[];
  depth: number;
}) {
  if (isLeaf(node)) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <RefEditor value={node.left} onChange={(v) => onChange({ ...node, left: v })} indicators={indicators} />
        <Select value={node.op} onValueChange={(v) => onChange({ ...node, op: v })}>
          <SelectTrigger className="h-8 w-36 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPS.map((o) => (
              <SelectItem key={o} value={o} className="font-mono text-xs">
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RefEditor value={node.right} onChange={(v) => onChange({ ...node, right: v })} indicators={indicators} />
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() =>
              onChange({
                op: "AND",
                conditions: [node, { left: node.left, op: node.op, right: node.right }],
              } as ConditionBranch)
            }
          >
            <Plus className="size-3" /> Group
          </Button>
        </div>
      </div>
    );
  }
  const branch = node;
  return (
    <div className={cn("space-y-2 rounded border-l-2 pl-3", depth === 0 ? "border-signal/40" : "border-muted-foreground/40")}>
      <div className="flex items-center gap-2">
        <Select
          value={branch.op}
          onValueChange={(v) => onChange({ ...branch, op: v as "AND" | "OR" })}
        >
          <SelectTrigger className="h-7 w-20 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">group of {branch.conditions.length}</span>
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onChange({ ...branch, conditions: [...branch.conditions, emptyLeaf(indicators)] })}
          >
            <Plus className="size-3" /> Add
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {branch.conditions.map((c, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <NodeEditor
                node={c}
                onChange={(v) => {
                  const next = [...branch.conditions];
                  next[i] = v;
                  onChange({ ...branch, conditions: next });
                }}
                indicators={indicators}
                depth={depth + 1}
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                const next = branch.conditions.filter((_, j) => j !== i);
                if (next.length === 1) onChange(next[0]);
                else onChange({ ...branch, conditions: next });
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RefEditor({
  value,
  onChange,
  indicators,
}: {
  value: ConditionLeaf["left"];
  onChange: (v: ConditionLeaf["left"]) => void;
  indicators: IndicatorInfo[];
}) {
  const isValue = "value" in value;
  return (
    <div className="flex items-center gap-1">
      <Select
        value={isValue ? "__value__" : (value as any).indicator}
        onValueChange={(v) => {
          if (v === "__value__") onChange({ value: 0 });
          else {
            const ind = indicators.find((i) => i.name === v);
            onChange({ indicator: v, field: ind?.output_fields?.[0] ?? "value" });
          }
        }}
      >
        <SelectTrigger className="h-8 w-40 font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__value__" className="font-mono text-xs">
            constant
          </SelectItem>
          {indicators.map((i) => (
            <SelectItem key={i.name} value={i.name} className="font-mono text-xs">
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isValue ? (
        <Input
          type="number"
          className="h-8 w-24 font-mono text-xs"
          value={(value as { value: number }).value}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
        />
      ) : (
        <Select
          value={(value as any).field}
          onValueChange={(v) => onChange({ ...(value as any), field: v })}
        >
          <SelectTrigger className="h-8 w-32 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(indicators.find((i) => i.name === (value as any).indicator)?.output_fields ?? ["value"]).map((f) => (
              <SelectItem key={f} value={f} className="font-mono text-xs">
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// helper for parent components that don't want to name Fragment
export { Fragment as _Fragment };
