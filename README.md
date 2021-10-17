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

Each state in @prisel/state is defined as a function. A simplest state is just a noop
function, like below:

```typescript
function Liquid() {}
```

State function can take a prop to initialize. A prop can be any type.

```typescript
function Liquid(liquidType: string) {
  console.log("type of the liquid is " + liquidType);
}
```

To set this state as the initial state and run the state machine, import `run`, and pass the state function to it.

```typescript
import { run } from "@prisel/state";

run(Liquid);
// or with props
run(Liquid, "water");
```

Each state can have internal state. This is useful to model numeric states which
are hard and cumbersome to convert to individual state function. For example, we
can have a temperature state.

```typescript
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

A state that does no side effect is not interesting. Let's add some side effect.

Similar to React's effect hook, @prisel/state has a `useSideEffect` hook that can be
used to perform side effect.

```typescript
useSideEffect(callback, deps);
```

For example:

```typescript
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

To transition to new state, return a new state configuration from the function.
A state configuration can be constructed using `newState(stateFunc, props)`
function.

```typescript
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

State can also receive events. A event is a string name and any associated data.
To subscribe to an event, use `useEvent`.

```typescript
const [triggered, eventData] = useEvent(eventName);
```

`useEvent` takes a string event name to subscribe to this event. When the event
is triggered, the state function will be called and useEvent will return `[true, eventData]`. If state function is called for other reasons (e.g.
`setLocalState`), `useEvent` will return `[false, undefined]`.

```typescript
import { run, newState, StateFuncReturn } from "@prisel/state";

function Liquid(): StateFuncReturn {
  const [boiled, time] = useEvent<number>("boil");
  // typescript wasn't able to infer time is defined if we destructure the
  // tuple before narrowing down the tuple type
  if (boiled && time != undefined) {
    return newState(vapor, time);
  }
}

function Vapor(timeToBoil: number) {
  console.log(`vaporized in ${timeToBoil} seconds`);
}
```

To send an event to a currently running state (and it's child states), use the inspector returned from
`run`

```typescript
function Liquid(): StateFuncReturn {
  const [boiled, time] = useEvent<number>("boil");
  if (boiled && time != undefined) {
    return newState(vapor, time);
  }
}

function Vapor(timeToBoil: number) {
  console.log(`vaporized in ${timeToBoil} seconds`);
}

const inspector = run(Liquid);
inspector.send("boil", 10);
```

To send an event to all active states, use `inspector.sendAll`.

To get inspector inside a state function, we can use `useInspector` hook.

```typescript
import { useInspector, useLocalState, useSideEffect } from "@prisel/state";

function Liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useLocalState(0);
  const [heated] = useEvent("heat");
  useSideEffect(() => {
    if (heated) {
      setTemperature((oldTemperature) => oldTemperature + 10);
    }
  });
}

function HeaterActive(): StateFuncReturn {
  const inspector = useInspector();
  useSideEffect(() => {
    const intervalId = setInterval(() => {
      inspector.sendAll("heat");
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  });
}

run(Liquid);
run(HeaterActive);
```

State transititons are useful to describe a series of actions to be performed in
sequence. Within a state, we can also start nested states. comparing to normal
state, nested states have the following properties:

1. Nested states and parent state coexists. Starting a nested state won't replace
   the current state.
1. Nested states will be cancelled when parent state transitions to other state.
1. When a nested state transitions to end state, the parent state will get
   notified and receives results.

```typescript
function Parent(): StateFuncReturn {
  useSideEffect(() => {
    console.log("parent started");
  }, []);
  const [startChild] = useEvent("start-child");
  const [childDone, result] = useNested(startChild, child);
  if (childDone) {
    console.log("parent ended because " + result);
    return endState();
  }
}
function Child(): StateFuncReturn {
  useSideEffect(() => {
    console.log("child started");
  }, []);
  const [finishChild] = useEvent("finish-child");
  if (finishChild) {
    const childMessage = "child ended";
    console.log("child ended by event");
    return endState(childMessage);
  }
}

const inspector = run(Parent);
setTimeout(() => {
  inspector.send("start-child");
}, 0);
setTimeout(() => {
  inspector.send("finish-child");
}, 0);

// prints
// parent started
// child started
// child ended by event
// parent ended because child ended
```

Let's put everything together for a complex problem. Suppose we want to build an
online chat room, with maximum capacity of 10 users.

```typescript
function ChatroomOpen(capacity: number) {
  const [users, setUsers] = useLocalState<string[]>([]);
  const [userJoined, fromUserId] = useEvent("join-request");
  useSideEffect(() => {
    if (userJoined && users.length < capacity && fromUserId != undefined) {
      setUsers([...users, fromUserId]);
    }
  });
}

run(ChatroomOpen, 10);
```

Now if for every joined user, we want them to sign a code of conduct before
sending message. Signing code of conduct involves, sending user a request, and
waiting for user's response. Let's define the process of code of conduct.

```typescript
function UserJoined(userId) {
  useEffect(() => {
    // let's assume we have a api for sending user request
    api.send(userId, "code of conduct");
  }, []);

  const [codeOfConductResponse, fromUserId] = useEvent(
    "code-of-conduct-response"
  );
  if (codeOfConductResponse && userId === fromUserId) {
    return newState(UserActive, userId);
  }
}

function UserActive(userId) {
  // To be implemented
}
```

Let's connect room's state with user's state. In `chatroomOpen`, we can run a
new `userJoined` everytime a user joins.

```
function ChatroomOpen(capacity: number) {
  const [users, setUsers] = useLocalState([]);
  const [userJoined, fromUserId] = useEvent("join-request");
  useEffect(() => {
    if (userJoined && users.length < capacity) {
      setUsers([...users, fromUserId]);
+     run(userJoined, fromUserId);
    }
  });
}
```

Now let's implement the fun part. When user is active, they can broadcast
messages to other active users in the room, but not users who haven't signed the
code of conduct.

```
function UserActive(userId) {
+  const inspector = useInspector();
+  const [receivedMessage, { fromUserId, message }] =
+    useEvent<{ fromUserId: string; message: string }>("message-request");
+  useSideEffect(() => {
+    if (receivedMessageRequest && messageRequest?.fromUserId === userId) {
+      inspector.sendAll("broadcast-message", { fromUserId, message });
+    }
+  });
+  const [broadcastMessage, broadcastData] =
+    useEvent<{ fromUserId: string; message: string }>("broadcast-message");
+  useSideEffect(() => {
+    if (broadcastMessage && broadcastData) {
+        api.send(
+          userId,
+          `${broadcastData.fromUserId} says: ${broadcastData.message}`
+        );
+      }
+  });
}
```

Let's handle user leaving. When a user leaves, they shouldn't be able to receive
any messages. If they are still working on code of conduct, they should also be
able to leave. This means both `userJoined` and `userActive` state can
transition to a new `userLeft` state. When user leaves, we only want to tell
room to remove the user, so that it has capacity for more new users.

```typescript
function UserLeft(userId) {
  const inspector = useInspector();
  useSideEffect(() => {
    inspector.send("user-left", userId);
  }, []);
  return endState();
}
```

Let's listen for this event in `ChatroomOpen` state

```
function ChatroomOpen(capacity: number) {
  const [users, setUsers] = useLocalState([]);
  const [userJoined, joinUserId] = useEvent("join-request");
+  const [userLeft, leftUserId] = useEvent("user-left");
  useEffect(() => {
    if (userJoined && users.length < capacity && fromUserId != undefined) {
      setUsers([...users, joinUserId]);
      run(UserJoined, fromUserId)
    }
+    if (userLeft && leftUserId != undefined && users.includes(leftUserId)) {
+      setUsers(users.filter((user) => user != leftUserId));
+    }
  });
}
```

To transition from `userJoined` and `userActive` to `userLeft`, both
`userJoined` and `userActive` needs to add logic for listening for user's leave
request. We can extract this common logic to another function. If you are
familiar with React, this is called custom hooks.

Custom hooks are usually named `useXXX`.

```typescript
/**
 * Listen for the leave request of given userId. If received, return true, otherwise, return false
 */
function useLeaveEvent(userId) {
  const [userLeft, leftUserId] = useEvent("leave-request");
  return userLeft && leftUserId === userId;
}
```

Then add the following to both `userJoined` and `userActive`

```typescript
const left = useLeaveEvent(userId);
if (left) {
  return newState(userLeft, userId);
}
```

The following is the complete code:

```typescript
function ChatroomOpen(capacity: number) {
  const [users, setUsers] = useLocalState<string[]>([]);
  const [userJoined, fromUserId] = useEvent("join-request");
  const [userLeft, leftUserId] = useEvent("user-left");

  useSideEffect(() => {
    if (userJoined && users.length < capacity && fromUserId != undefined) {
      setUsers([...users, fromUserId]);
      run(UserJoined, fromUserId);
    }
    if (userLeft && leftUserId != undefined && users.includes(leftUserId)) {
      setUsers(users.filter((user) => user != leftUserId));
    }
  });
}

// user states

function UserJoined(userId: string) {
  useSideEffect(() => {
    // let's assume we have a api for sending user request
    api.send(userId, "code of conduct");
  }, []);
  const [codeOfConductResponse, fromUserId] = useEvent<string>(
    "code-of-conduct-response"
  );
  const left = useLeaveEvent(userId);

  if (left) {
    return newState(UserLeft, userId);
  }
  if (codeOfConductResponse && userId === fromUserId) {
    return newState(UserActive, userId);
  }
}

function UserActive(userId: string) {
  const inspector = useInspector();
  const [receivedMessageRequest, messageRequest] =
    useEvent<{ fromUserId: string; message: string }>("message-request");
  useSideEffect(() => {
    if (receivedMessageRequest && messageRequest?.fromUserId === userId) {
      inspector.sendAll("broadcast-message", messageRequest);
    }
  });
  const [broadcastMessage, broadcastData] =
    useEvent<{ fromUserId: string; message: string }>("broadcast-message");
  useSideEffect(() => {
    if (broadcastMessage && broadcastData) {
      api.send(
        userId,
        `${broadcastData.fromUserId} says: ${broadcastData.message}`
      );
    }
  });
  const left = useLeaveEvent(userId);

  if (left) {
    return newState(UserLeft, userId);
  }
}

function useLeaveEvent(userId: string) {
  const [userLeft, leftUserId] = useEvent("leave-request");
  return userLeft && leftUserId === userId;
}

function UserLeft(userId: string) {
  const inspector = useInspector();
  useSideEffect(() => {
    inspector.send("user-left", userId);
  }, []);
  return endState();
}

run(ChatroomOpen, 10);
```
