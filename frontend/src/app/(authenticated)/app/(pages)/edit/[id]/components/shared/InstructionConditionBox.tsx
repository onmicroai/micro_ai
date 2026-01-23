import { Split, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import * as Tooltip from "@radix-ui/react-tooltip";

interface InstructionConditionBoxProps {
  conditionFieldName: string;
  operator: string;
  value?: string | boolean | number;
  onRemove?: () => void;
  currentFieldName?: string; // Optional for case when condition is shown for instruction
}

function renderConditionValue(value?: string | boolean | number) {
  if (value === true || value === "true") return "Yes";
  if (value === false || value === "false") return "No";
  return value;
}

function getTooltipText(
  conditionFieldName: string,
  operator: string,
  currentFieldName?: string,
  value?: string | boolean | number,
) {
  let conditionText: React.ReactNode;
  const formattedValue = renderConditionValue(value);
  switch (operator) {
    case "equals":
      conditionText = (
        <>
          equals <b>{formattedValue}</b>
        </>
      );
      break;
    case "not_equals":
      conditionText = (
        <>
          does not equal <b>{formattedValue}</b>
        </>
      );
      break;
    case "contains":
      conditionText = (
        <>
          contains <b>{formattedValue}</b>
        </>
      );
      break;
    case "not_contains":
      conditionText = (
        <>
          does not contain <b>{formattedValue}</b>
        </>
      );
      break;
    case "is_empty":
      conditionText = <>is empty</>;
      break;
    case "is_not_empty":
      conditionText = <>is not empty</>;
      break;
    case "greater_than":
      conditionText = (
        <>
          is greater than <b>{formattedValue}</b>
        </>
      );
      break;
    case "less_than":
      conditionText = (
        <>
          is less than <b>{formattedValue}</b>
        </>
      );
      break;
    case "greater_than_or_equal":
      conditionText = (
        <>
          is greater than or equal to <b>{formattedValue}</b>
        </>
      );
      break;
    case "less_than_or_equal":
      conditionText = (
        <>
          is less than or equal to <b>{formattedValue}</b>
        </>
      );
      break;
    default:
      conditionText = <>matches the condition</>;
      break;
  }

  return (
    <>
      This question <b>{currentFieldName}</b> will be shown if the answer in
      question <b>{conditionFieldName}</b> {conditionText}
    </>
  );
}

export default function InstructionConditionBox({
  conditionFieldName,
  operator,
  value,
  onRemove,
  currentFieldName,
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
        Shows if{" "}
        <Tooltip.Root delayDuration={0}>
          <Tooltip.Trigger asChild>
            <span className="underline mx-1 cursor-pointer">
              {conditionFieldName}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="bottom"
              align="center"
              className="z-50 bg-gray-800 text-white text-xs rounded px-3 py-2 shadow-lg whitespace-pre-line max-w-[260px]"
              sideOffset={6}
            >
              {getTooltipText(
                conditionFieldName,
                operator,
                currentFieldName,
                value,
              )}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        {operator.replace(/_/g, " ")}
        {value !== undefined && value !== null ? (
          <span className="ml-1">{renderConditionValue(value)}</span>
        ) : null}
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
