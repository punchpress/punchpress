import { useEffect, useEffectEvent } from "react";

type ElectronIpcSubscriber<Args extends unknown[]> =
  | ((listener: (...args: Args) => void) => () => void)
  | undefined;

export const useElectronIpcEvent = <Args extends unknown[]>(
  subscribe: ElectronIpcSubscriber<Args>,
  handler: (...args: Args) => void
) => {
  const onEvent = useEffectEvent(handler);

  useEffect(() => {
    if (!subscribe) {
      return;
    }

    return subscribe((...args) => {
      onEvent(...args);
    });
  }, [subscribe]);
};
