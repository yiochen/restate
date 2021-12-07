import type { Inspector } from "./inspector";
import { machine } from "./machine";
import { newState } from "./newState";
import type { StateFunc } from "./state";
import { State, StateConfig } from "./state";

/**
 * Mutable configuration object that defines some property of the state machine.
 */
export interface RunConfig {
  /**
   * Sets the id of the initial state. Id will be passed to all states
   * originated from the initial state.
   * @param id The id of the initial state.
   */
  id(id: string): RunConfig;
  /**
   * Run state machine with the given state.
   * @param inititalState State function of the initial state.
   * @param prop Props to be passed to the initial state function.
   * @typeparam PropT Type of the props.
   * @returns An object to send event to currently active states in the state machine.
   */
  start<PropT>(initialState: StateFunc<PropT>, prop: PropT): Inspector;
  /**
   * Run state machine with the given {@linkcode StateConfig}. StateConfig
   * is returned from {@linkcode newState} or {@linkcode endState}.
   * @param initialStateConfig
   * @typeparam PropT type of the props.
   * @returns An object to send event to currently active states in the state machine.
   */
  start<PropT>(initialStateConfig: StateConfig<PropT>): Inspector;
  /**
   * Run state machine with the given state.
   * @param state State function of the initial state.
   * @typeparam PropT Type of the props.
   * @returns An object to send event to currently active states in the state machine.
   */
  start<PropT = undefined>(state: StateFunc<PropT>): Inspector;
}

function internalRun(
  stateFuncOrStateConfig: StateFunc<any> | StateConfig<any>,
  props: any,
  id: string | undefined
): Inspector {
  const stateKey = id ?? machine.genChainId();
  const stateConfig =
    typeof stateFuncOrStateConfig === "function"
      ? newState(stateFuncOrStateConfig, props)
      : stateFuncOrStateConfig;

  machine.addState(
    State.builder().machine(machine).config(stateConfig).id(stateKey).build()
  );

  return {
    debugStates: machine.debugStates,
    exit: () => machine.closeState(stateKey),
  };
  //   return machine.getInspector();
}
/**
 * Start the state machine with the given initial state. If the state machine is
 * already started. The state will be run in parallel of the other state.
 * @param state State to run as the initial state.
 * @param props Props to be passed to the state func to initialize the state.
 */
export function run<PropT>(state: StateFunc<PropT>, prop: PropT): Inspector;
/**
 * Start the state machine with the given initial state. If the state machine is
 * already started. The state will be run in parallel of the other state.
 * @param state State to run as the initial state.
 */
export function run(state: StateFunc<undefined>): Inspector;
/**
 * State the state machine with the given {@linkcode StateConfig}. StateConfig
 * is returned from {@linkcode newState} or {@linkcode endState}.
 * @param stateConfig A wrapper for state function and props to be passed to the
 * state when starting.
 */
export function run<PropT>(stateConfig: StateConfig<PropT>): Inspector;
/**
 * Create a {@linkcode RunConfig} that can later be started.
 */
export function run(): RunConfig;
export function run(
  state?: StateFunc<any> | StateConfig<any>,
  props?: any
): Inspector | RunConfig {
  let forcedId: string | undefined = undefined;
  if (state === undefined) {
    const runConfig: RunConfig = {
      id: (id) => {
        forcedId = id;
        return runConfig;
      },
      start: (state?, props?) => internalRun(state, props, forcedId),
    };
    return runConfig;
  }
  return internalRun(state, props, undefined);
}
