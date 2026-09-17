import { generateTokens } from "./foundations";
import type { DesignDirection, DesignTokens, DesignVariable, VariableCollection } from "./types";

const entries = <T extends Record<string, unknown>>(record: T) => Object.entries(record) as Array<[keyof T, T[keyof T]]>;

function variable(id: string, name: string, type: DesignVariable["type"], values: DesignVariable["values"], description?: string): DesignVariable {
  return { id, name, type, values, description };
}

export function createSystemVariableCollections(direction: DesignDirection): VariableCollection[] {
  const light = generateTokens({ ...direction, theme: "light" });
  const dark = generateTokens({ ...direction, theme: "dark" });
  const compact = generateTokens({ ...direction, density: "compact" });
  const balanced = generateTokens({ ...direction, density: "balanced" });
  const comfortable = generateTokens({ ...direction, density: "comfortable" });
  const sharp = generateTokens({ ...direction, radius: "sharp" });
  const soft = generateTokens({ ...direction, radius: "soft" });
  const rounded = generateTokens({ ...direction, radius: "rounded" });

  const colors: VariableCollection = {
    id: "system.colors",
    name: "System colors",
    modes: ["light", "dark"],
    defaultMode: direction.theme,
    variables: entries(light.colors).map(([key, lightValue]) => variable(
      `color.${String(key)}`,
      String(key),
      "color",
      { light: lightValue, dark: dark.colors[key] },
      `Semantic ${String(key)} color.`,
    )),
  };

  const spacing: VariableCollection = {
    id: "system.spacing",
    name: "Spacing scale",
    modes: ["compact", "balanced", "comfortable"],
    defaultMode: direction.density,
    variables: balanced.spacing.map((value, index) => variable(
      `space.${index}`,
      `space-${index}`,
      "number",
      { compact: compact.spacing[index], balanced: value, comfortable: comfortable.spacing[index] },
      "Density-aware spacing token.",
    )),
  };

  const radius: VariableCollection = {
    id: "system.radius",
    name: "Radius scale",
    modes: ["sharp", "soft", "rounded"],
    defaultMode: direction.radius,
    variables: (Object.keys(soft.radius) as Array<keyof DesignTokens["radius"]>).map((key) => variable(
      `radius.${String(key)}`,
      String(key),
      "number",
      { sharp: sharp.radius[key], soft: soft.radius[key], rounded: rounded.radius[key] },
      `Semantic ${String(key)} radius.`,
    )),
  };

  return [colors, spacing, radius];
}

export function resolveVariable(collection: VariableCollection, variableId: string, mode = collection.defaultMode) {
  const item = collection.variables.find((candidate) => candidate.id === variableId);
  if (!item) throw new Error(`Variable not found: ${variableId}`);
  if (!collection.modes.includes(mode)) throw new Error(`Mode ${mode} is not part of ${collection.name}.`);
  const value = item.values[mode];
  if (value === undefined) throw new Error(`Variable ${variableId} has no value for mode ${mode}.`);
  return value;
}

export function setCollectionMode(collections: VariableCollection[], collectionId: string, mode: string): VariableCollection[] {
  return collections.map((collection) => {
    if (collection.id !== collectionId) return structuredClone(collection);
    if (!collection.modes.includes(mode)) throw new Error(`Mode ${mode} is not part of ${collection.name}.`);
    return { ...structuredClone(collection), defaultMode: mode };
  });
}
