declare module "spin-wheel/dist/spin-wheel-esm.js" {
  export type WheelItem = {
    label: string;
    backgroundColor?: string;
    labelColor?: string;
    value?: unknown;
    weight?: number;
  };

  export type WheelProps = {
    items?: WheelItem[];
    borderColor?: string;
    borderWidth?: number;
    isInteractive?: boolean;
    itemLabelAlign?: "left" | "center" | "right";
    itemLabelFont?: string;
    itemLabelFontSizeMax?: number;
    itemLabelRadius?: number;
    itemLabelRadiusMax?: number;
    lineColor?: string;
    lineWidth?: number;
    pointerAngle?: number;
    radius?: number;
    onRest?: (event: { currentIndex: number; rotation: number }) => void;
  };

  export class Wheel {
    constructor(container: Element, props?: WheelProps);
    /** Current rotation in degrees; used to place the SVG label layer. */
    rotation: number;
    remove(): void;
    spinToItem(
      itemIndex?: number,
      duration?: number,
      spinToCenter?: boolean,
      numberOfRevolutions?: number,
      direction?: 1 | -1,
    ): void;
  }
}
