import { planProject } from "./planner";
import type { DesignDirection, DesignProject } from "./types";

export interface DesignProvider {
  id: string;
  label: string;
  plan(input: { prompt: string; name: string; direction: DesignDirection }): Promise<DesignProject>;
}

export class LocalDeterministicProvider implements DesignProvider {
  id = "local";
  label = "Local deterministic planner";
  async plan(input: { prompt: string; name: string; direction: DesignDirection }) {
    return planProject(input.prompt, input.direction, input.name);
  }
}
