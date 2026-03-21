import { useEffect, useRef, useState } from "react";

const EXIT_DURATION_MS = 80;

export const useNodeToolbarPresence = (actions, stateKey) => {
  const [presenceState, setPresenceState] = useState(null);
  const actionsRef = useRef(actions);
  const isVisible = actions.length > 0;

  actionsRef.current = actions;

  useEffect(() => {
    if (isVisible && stateKey) {
      setPresenceState({
        actions: actionsRef.current,
        phase: "open",
      });
      return;
    }

    setPresenceState((current) =>
      current ? { ...current, phase: "closing" } : null
    );

    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPresenceState((current) =>
        current?.phase === "closing" ? null : current
      );
    }, EXIT_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isVisible, stateKey]);

  return presenceState;
};
