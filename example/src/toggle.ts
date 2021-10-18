import {
  newEvent,
  newState,
  run,
  StateFuncReturn,
  useEvent,
  useSideEffect,
} from "../../index";
import "./toggle.css";

const exampleClass = "#toggle_example";
const [toggled, toggleEmitter] = newEvent("toggle");
const [individualToggled, individualToggleEmitter] =
  newEvent("individual-toggle");

const container = document.querySelector(
  `${exampleClass} > .example_container`
);
if (container) {
  container.innerHTML = `
  <div>
    <div class="toggle">TOGGLE ME</div>
    <div class="toggle">TOGGLE ALL</div>
  <div>`;
}

const firstToggle = container?.querySelector(".toggle:nth-child(1)");
const secondToggle = container?.querySelector(".toggle:nth-child(2)");

function on(props: {
  toggle: Element;
  respondToIndividualToggle: boolean;
}): StateFuncReturn {
  const { toggle, respondToIndividualToggle } = props;
  useSideEffect(() => {
    toggle.classList.add("highlight");
  }, []);
  const toggledResult = useEvent(toggled);
  const individualToggledResult = useEvent(individualToggled);
  if (toggledResult || (respondToIndividualToggle && individualToggledResult)) {
    return newState(off, props);
  }
}

function off(props: {
  toggle: Element;
  respondToIndividualToggle: boolean;
}): StateFuncReturn {
  const { toggle, respondToIndividualToggle } = props;
  useSideEffect(() => {
    toggle.classList.remove("highlight");
  }, []);
  const toggledResult = useEvent(toggled);
  const individualToggledResult = useEvent(individualToggled);
  if (toggledResult || (respondToIndividualToggle && individualToggledResult)) {
    return newState(on, props);
  }
}

const inspector = run(off, {
  toggle: firstToggle!,
  respondToIndividualToggle: true,
});
const inspector2 = run(off, {
  toggle: secondToggle!,
  respondToIndividualToggle: false,
});
firstToggle!.addEventListener("click", () => {
  console.log("toggle");
  inspector.send(individualToggleEmitter);
});
secondToggle!.addEventListener("click", () => {
  console.log("toggle all");
  inspector2.send(toggleEmitter);
});
