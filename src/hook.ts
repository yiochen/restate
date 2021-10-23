export interface Hook {
  type: HookType;
}

export enum HookType {
  LOCAL_STATE,
  EFFECT,
  EVENT,
  NESTED_STATE,
  COMPUTED,
}
