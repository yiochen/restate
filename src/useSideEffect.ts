import type { Hook } from "./hook";
import { HookType } from "./hook";
import { machine } from "./machine";
import { AllDeps, unchangedDeps } from "./utils";

/**
 * Imperative function that can be passed to {@linkcode useSideEffect}.
 */
export interface EffectFunc {
  (): (() => void) | void;
}

export interface EffectHook extends Hook {
  type: HookType.EFFECT;
  effectFunc: EffectFunc | undefined;
  cleanupFunc: (() => unknown) | undefined;
  deps: any[] | undefined;
}

/**
 * Accepts a function that contains imperative, possibly effectful code.
 *
 * @param effect Imperative function that can return a cleanup function
 * @param deps If present, effect will only activate if the values in the list change.
 * @category Hook
 */
export function useSideEffect(
  effect: EffectFunc,
  deps: any[] | undefined = AllDeps
): void {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot call useSideEffect outside of state machine scope");
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: EffectHook = {
      type: HookType.EFFECT,
      effectFunc: effect,
      cleanupFunc: undefined, // cleanup func might be populated when effectFunc is run after the state func.
      deps: undefined,
    };
    processingState.setHook(newQueueItem);
  }
  const queueItem: EffectHook = processingState.getHook(HookType.EFFECT);
  if (unchangedDeps(queueItem.deps, deps)) {
    // dependencies are not changed. We don't need to execute the effectFunc
    return;
  }
  // deps changed. We will store the new deps as well as the effectFunc.
  queueItem.effectFunc = effect;
  queueItem.deps = deps;
  if (queueItem.cleanupFunc != undefined) {
    // if there is a previous cleanup, we will call, because we are changing
    // deps
    queueItem.cleanupFunc();
  }
  queueItem.cleanupFunc = undefined; // cleanup func will be assigned when effectFunc is run
}
