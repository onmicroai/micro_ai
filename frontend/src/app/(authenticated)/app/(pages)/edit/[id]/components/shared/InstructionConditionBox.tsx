import { Split, X } from "lucide-react";
import { Button } from "../../components/ui/button";

interface InstructionConditionBoxProps {
  property: string;
  operator: string;
  value?: string;
  onRemove?: () => void;
}

export default function InstructionConditionBox({
  property,
  operator,
  value,
  onRemove,
}: InstructionConditionBoxProps) {
  return (
    <div
      className="flex items-center justify-between px-3"
      style={{
        height: 30,
        background: "linear-gradient(90deg, #E1E3FF80 0%, #FFFFFF00 100%)",
        border: "1px solid #5963E8",
      }}
    >
      <div
        className="flex items-center gap-2 text-[14px] font-medium"
        style={{ color: "#5963E8" }}
      >
        <Split className="h-4 w-4 mr-1" style={{ color: "#5963E8" }} />
        Shows if <span className="underline mx-1">{property}</span>
        {operator.replace(/_/g, " ")}
        {value ? <span className="ml-1">{value}</span> : null}
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0"
          style={{ color: "#5963E8" }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
