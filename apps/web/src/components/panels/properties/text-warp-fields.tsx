import {
  ARCH_BEND_LIMIT,
  clamp,
  getDefaultWarp,
  toNumber,
  WAVE_CYCLES_MAX,
  WAVE_CYCLES_MIN,
} from "@punchpress/engine";
import { Button } from "@/components/ui/button";
import {
  IconSegmentedControl,
  IconSegmentedControlItem,
} from "@/components/ui/icon-segmented-control";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import {
  ToggleGroup,
  Toggle as ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useEditor } from "../../../editor-react/use-editor";
import { FieldRow, Section } from "./field-primitives";
import { warpIcons } from "./warp-icons";

const ARCH_BEND_RANGE = { min: -ARCH_BEND_LIMIT, max: ARCH_BEND_LIMIT };
const CIRCLE_RADIUS_RANGE = { min: 1, max: 5000 };
const CIRCLE_SWEEP_RANGE = { min: -360, max: 360 };
const WAVE_AMPLITUDE_RANGE = { min: -500, max: 500 };
const WAVE_CYCLES_RANGE = { min: WAVE_CYCLES_MIN, max: WAVE_CYCLES_MAX };
const SLANT_RISE_RANGE = { min: -400, max: 400 };

export const TextWarpFields = ({ node, withTopBorder = true }) => {
  const editor = useEditor();

  if (!node) {
    return null;
  }

  return (
    <Section
      className={withTopBorder ? "border-black/4 border-t" : undefined}
      title="Warp"
    >
      <FieldRow className="items-start" label="Type" labelClassName="pt-2.5">
        <IconSegmentedControl
          className="grid-cols-3"
          onValueChange={(values) => {
            const nextKind = values[0] ?? "none";
            editor.updateSelectedNode({
              warp: getDefaultWarp(nextKind, node),
            });

            if (nextKind === "circle") {
              if (editor.startPathEditing(node.id)) {
                editor.setActiveTool("node");
              }
              return;
            }

            if (editor.isPathEditing(node.id)) {
              editor.stopPathEditing();
            }
          }}
          value={node.warp.kind === "none" ? [] : [node.warp.kind]}
          variant="unframed"
        >
          {(["arch", "wave", "circle", "slant"] as const).map((kind) => {
            const { icon: Icon, label } = warpIcons[kind];

            return (
              <IconSegmentedControlItem
                aria-label={label}
                key={kind}
                title={label}
                value={kind}
              >
                <Icon />
              </IconSegmentedControlItem>
            );
          })}
          <WarpOptionPlaceholder />
          <WarpOptionPlaceholder />
        </IconSegmentedControl>
      </FieldRow>

      {node.warp.kind !== "none" ? (
        <div className="mt-2 grid gap-2">
          <TextWarpKindFields node={node} />
        </div>
      ) : null}

      {node.warp.kind !== "none" ? (
        <Button
          className="mt-1 w-full"
          onClick={() =>
            editor.updateSelectedNode({ warp: getDefaultWarp("none") })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Clear warp
        </Button>
      ) : null}
    </Section>
  );
};

const WarpOptionPlaceholder = () => {
  return (
    <span aria-hidden="true" className="flex h-8 items-center justify-center">
      <span className="size-2.5 rounded-full bg-muted-foreground/10" />
    </span>
  );
};

const TextWarpKindFields = ({ node }) => {
  const editor = useEditor();
  const update = (warpPatch) => {
    editor.updateSelectedNode({
      warp: {
        ...node.warp,
        ...warpPatch,
      },
    });
  };

  if (node.warp.kind === "arch") {
    const setBend = (value) => {
      const bend = clamp(
        toNumber(value, node.warp.bend),
        ARCH_BEND_RANGE.min,
        ARCH_BEND_RANGE.max
      );
      update({ bend });
    };

    return (
      <FieldRow label="Bend">
        <ScrubSlider
          ariaLabel="Bend"
          max={ARCH_BEND_RANGE.max}
          min={ARCH_BEND_RANGE.min}
          onValueChange={setBend}
          step={0.01}
          value={node.warp.bend}
        />
      </FieldRow>
    );
  }

  if (node.warp.kind === "wave") {
    const setAmplitude = (value) => {
      const amplitude = clamp(
        toNumber(value, node.warp.amplitude),
        WAVE_AMPLITUDE_RANGE.min,
        WAVE_AMPLITUDE_RANGE.max
      );
      update({ amplitude });
    };

    const setCycles = (value) => {
      const cycles = clamp(
        toNumber(value, node.warp.cycles),
        WAVE_CYCLES_RANGE.min,
        WAVE_CYCLES_RANGE.max
      );
      update({ cycles });
    };

    return (
      <>
        <FieldRow label="Amplitude">
          <ScrubSlider
            ariaLabel="Amplitude"
            max={WAVE_AMPLITUDE_RANGE.max}
            min={WAVE_AMPLITUDE_RANGE.min}
            onValueChange={setAmplitude}
            step={1}
            value={node.warp.amplitude}
          />
        </FieldRow>
        <FieldRow label="Cycles">
          <ScrubSlider
            ariaLabel="Cycles"
            max={WAVE_CYCLES_RANGE.max}
            min={WAVE_CYCLES_RANGE.min}
            onValueChange={setCycles}
            step={0.1}
            value={node.warp.cycles}
          />
        </FieldRow>
      </>
    );
  }

  if (node.warp.kind === "circle") {
    const setSide = (values) => {
      const nextSide = values[0] ?? "outside";
      update({ inverted: nextSide === "inside" });
    };

    const setRadius = (value) => {
      update({
        radius: Math.max(1, toNumber(value, node.warp.radius)),
      });
    };

    const setSweep = (value) => {
      update({
        sweepDeg: toNumber(value, node.warp.sweepDeg),
      });
    };

    return (
      <>
        <FieldRow label="Side">
          <ToggleGroup
            className="grid grid-cols-2 gap-1.5"
            onValueChange={setSide}
            value={[node.warp.inverted ? "inside" : "outside"]}
          >
            <ToggleGroupItem value="outside">Outside</ToggleGroupItem>
            <ToggleGroupItem value="inside">Inside</ToggleGroupItem>
          </ToggleGroup>
        </FieldRow>
        <FieldRow label="Radius">
          <ScrubSlider
            ariaLabel="Radius"
            max={CIRCLE_RADIUS_RANGE.max}
            min={CIRCLE_RADIUS_RANGE.min}
            onValueChange={setRadius}
            step={1}
            value={node.warp.radius}
          />
        </FieldRow>
        <FieldRow label="Sweep">
          <ScrubSlider
            ariaLabel="Sweep"
            max={CIRCLE_SWEEP_RANGE.max}
            min={CIRCLE_SWEEP_RANGE.min}
            onValueChange={setSweep}
            step={1}
            value={node.warp.sweepDeg}
          />
        </FieldRow>
      </>
    );
  }

  if (node.warp.kind === "slant") {
    const setRise = (value) => {
      const rise = clamp(
        toNumber(value, node.warp.rise),
        SLANT_RISE_RANGE.min,
        SLANT_RISE_RANGE.max
      );
      update({ rise });
    };

    return (
      <FieldRow label="Slant">
        <ScrubSlider
          ariaLabel="Slant"
          max={SLANT_RISE_RANGE.max}
          min={SLANT_RISE_RANGE.min}
          onValueChange={setRise}
          step={1}
          value={node.warp.rise}
        />
      </FieldRow>
    );
  }

  return null;
};
