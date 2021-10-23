# @prisel/state

[![npm
version](https://badge.fury.io/js/@prisel%2Fstate.svg)](https://badge.fury.io/js/@prisel%2Fstate)

Declarative and decentralized state machine inspired by React.

## Get Started

Install the library from npm

```
npm i @prisel/state
```

## Guide

### State Function

Each state in `@prisel/state` is defined as a function. A state function is a
declarative way to define the state's property, local states, side effects,
events and transitions. A state function can usually be structured in the
following way:

```ts
function MyState(): StateFuncReturn {
  // Defines local state, side effects and events
  // Defines transitions
}
```

A very important attribute of state function is that, it is pure. Calling a
state function repeatedly should not have different results. The impure part of
the state (side effect, event subscription) are handled outside of the state
function by the state machine.

State functions are recommended to be named using `UpperCamelCase` to
differentiate from normal functions. They should ideally use adjetives that
describe the state, for example `GameStarted`, `UserLoggedIn`, unless we have
very clear name of each state, like `Children`, `Teenager`, `MidAge`, `Elder`.

# Defining State Function

A simplest state is just a noop function, like below:

```ts
function Liquid() {}
```

State function can take a prop to initialize. A prop can be any type.

```ts
function Liquid(liquidType: string) {}
```

To set this state as the initial state and run the state machine, import `run`, and pass the state function to it.

```ts
import { run } from "@prisel/state";

run(Liquid);
// or if Liquid takes a prop
run(Liquid, "water");
```

### Local State

Each state can have internal state. This is useful to model numeric states which
are hard and cumbersome to convert to individual state function. For example, we
can have a temperature state.

```ts
import { useLocalState, run, StateFuncReturn } from "@prisel/state";

function Liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useLocalState(
    /* initial temperature */ 0
  );

  console.log(temperature); // prints 0
}

run(Liquid);
```

Calling `setTemperature` with a different temperature will cause the `liquid`
function to be run again.

### Side Effect

A state that does no side effect is not interesting. Let's add some side effect.

Similar to React's effect hook, `@prisel/state` has a `useSideEffect` hook that can be
used to perform side effect.

```ts
useSideEffect(callback, deps);
```

For example:

```ts
import { useSideEffect, run, StateFuncReturn } from "@prisel/state";

function Liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useLocalState(0);
  useSideEffect(() => {
    // this will be run after the boiling state function is run.
    const intervalId = setInterval(() => {
      setTemperature((oldTemp) => oldTemp + 10);
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  }); // an empty dependencies array means side effect will be run only once when entering this state

  console.log(temperature); // will print 0, 10, 20, 30 ...
}

run(Liquid);
```

### Event

Event is an important concept in a state machine. Event can cause the state to
change, or trigger side effect. With events, state machine can finally "move".

Events in `@prisel/state` are defined outside of state function.

```ts
import { newEvent } from "@prisel/state";

const [event, emitter] = newEvent("myEvent");
```

`newEvent` returns two objects, an `Event` and an `Emitter`. `Event` is used to
subscribe to a event. `Emitter` is used to dispatch an event. `newEvent` takes a
string for the event name. Event name is only for documentation and debugging
purpose. If `newEvent` is called twice with the same event name, two different events will
be created.

To define an event that expects an event data, specify the type of the event
data.

```ts
const [event, emitter] = newEvent<number>("myNumEvent");
```

#### Create extended event

We can create new event that originates from an event using `fitler` or `map`.

```ts
// filters the event by event data. If false is returned, the event will not trigger.
const filteredEvent = event.filter((eventData) => true);

// transform the event data.
const transformedEvent = event.map((eventData) => "" + eventData);
```

Events created from `filter` or `map` shares the same `Event.ref`. They can be
invoke using the same `Emitter`.

#### Subscribe to event

Subscribing to an event is done using `useEvent` hook.

```ts
const eventResult = useEvent(event);
```

`useEvent` takes an `Event` to subscribe to and returns an `EventResult`, which
is a nullable wrapper for the event data. If event is triggered, `eventResult`
will contain the event data. Otherwise `eventResult` will be `undefined`.

```ts
import { run, newState, StateFuncReturn } from "@prisel/state";

const [heat, emitHeat] = newEvent<number>("heat");

function Liquid(): StateFuncReturn {
  const heated = useEvent(heat);
  useSideEffect(() => {
    if (heated) {
      console.log(`heated up ${heated.value} degree`);
    }
  });
}
```

#### Dispatch an event

To send an event subscribers, use `Emitter` returned from `newEvent`.

```ts
const [boil, emitBoil] = newEvent<number>("boil");

function Liquid(): StateFuncReturn {
  const boiled = useEvent(boil);
  if (boiled) {
    return newState(vapor, time);
  }
}

function Vapor(timeToBoil: number) {
  console.log(`vaporized in ${timeToBoil} seconds`);
}

run(Liquid);
emitBoil.send(10);
```

### Transition

To transition to new state, return a new state configuration from the function.
A state configuration can be constructed using `newState(stateFunc, props)`
function.

```ts
import { useSideEffect, run, newState, StateFuncReturn } from "@prisel/state";

function Liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useLocalState(0);
  useSideEffect(() => {
    // this will be run after the boiling state function is run.
    const intervalId = setInterval(() => {
      setTemperature((oldTemp) => oldTemp + 10);
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  }, []); // an empty dependencies array means side effect will be run only once when entering this state

  if (temperature >= 100) {
    return newState(vapor);
  }
}

function Vapor() {
  console.log("vaporized!");
}

run(Liquid);
```

### Nested state

State transititons are useful to describe a series of actions to be performed in
sequence. Within a state, we can also start nested states. comparing to normal
state, nested states have the following properties:

1. Nested states and parent state coexists. Starting a nested state won't replace
   the current state.
1. Nested states will be cancelled when parent state transitions to other state.
1. When a nested state transitions to end state, the parent state will get
   notified and receives results.

```ts
const [childStarted, emitChildStarted] = newEvent("start-child");
const [childFinished, emitChildFinished] = newEvent("finish-child");
function Parent(): StateFuncReturn {
  useSideEffect(() => {
    console.log("parent started");
  }, []);
  const startChild = useEvent(childStarted);
  const [childDone, result] = useNested(!!startChild, child);
  if (childDone) {
    console.log("parent ended because " + result);
    return endState();
  }
}
function Child(): StateFuncReturn {
  useSideEffect(() => {
    console.log("child started");
  }, []);
  const finishChild = useEvent(childFinished);
  if (finishChild) {
    const childMessage = "child ended";
    console.log("child ended by event");
    return endState(childMessage);
  }
}

run(Parent);
setTimeout(() => {
  emitChildStarted.send();
}, 0);
setTimeout(() => {
  emitChildFinished.send();
}, 0);

// prints
//
// parent started
// child started
// child ended by event
// parent ended because child ended
```
